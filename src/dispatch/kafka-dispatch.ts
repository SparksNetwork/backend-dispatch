import {QueueMessage, DispatchResponse, Dispatcher, Dispatch} from '../types';
import * as farmhash from 'farmhash';
import {Producer} from 'no-kafka';
import PartitionInfo = Kafka.PartitionInfo;

function makeDispatcher(streamName:string, producer):Dispatch {
  return async function dispatch(message: QueueMessage): Promise<DispatchResponse> {
    try {
      console.log('send');
      const response = await producer.send({
        topic: streamName,
        message: {
          key: message.uid,
          value: JSON.stringify(message)
        }
      });
      console.log(response);

      return {ok: true};
    } catch (error) {
      console.error(error);
      return {
        ok: false,
        error
      };
    }
  };
}

const dispatcher:Dispatcher = async function(streamName:string, options?: Kafka.ProducerOptions) {
  const defaultProducerOptions: Kafka.ProducerOptions = {
    clientId: 'dispatch',
    connectionString: 'kafka.aws.sparks.network:9092',
    partitioner: function(topic:string, partitions:PartitionInfo[], message) {
      const hash = farmhash.hash32(message.key);
      const index = hash % partitions.length;
      return partitions[index].partitionId;
    },
    batch: {
      maxWait: 0
    }
  };

  const producer = new Producer(Object.assign({}, defaultProducerOptions, options || {}));
  await producer.init();
  return makeDispatcher(streamName, producer);
};

export default dispatcher;
