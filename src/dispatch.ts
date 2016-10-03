import {QueueMessage, DispatchResponse} from './types';
import * as aws from 'aws-sdk';
import * as https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
} as any);

const kinesisOptions = {
  endpoint: process.env['KINESIS_ENDPOINT'],
  httpOptions: {agent}
};
const kinesis = new aws.Kinesis(kinesisOptions);

function partitionKey(message) {
  return [
    message.domain, message.action, message.uid, message.key
  ].join('');
}

async function sleep(ms:number) {
  return await new Promise(resolve => {
    setTimeout(() => resolve(ms), ms);
  });
}

async function createStream(streamName:string) {
  let state = 'CREATING';

  try {
    await kinesis.createStream({
      StreamName: streamName,
      ShardCount: 5
    }).promise();
  } catch(err) {}

  while (state === 'CREATING') {
    console.log('...', state);
    await sleep(500);

    const stream = await kinesis.describeStream({
      StreamName: streamName
    }).promise();
    console.log(stream);
    state = stream.StreamDescription.StreamStatus;
  }

  return true;
}

export async function Dispatcher(streamName:string) {
  await createStream(streamName);

  return async function dispatch(message: QueueMessage): Promise<DispatchResponse> {
    try {
      const params = {
        Data: new Buffer(JSON.stringify(message)),
        PartitionKey: partitionKey(message),
        StreamName: streamName
      };

      const response = await kinesis.putRecord(params).promise();
      return {response, ok: true};
    } catch (error) {
      return {
        ok: false,
        response: null,
        error
      };
    }
  };
}