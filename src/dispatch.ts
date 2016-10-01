import {QueueMessage, DispatchResponse} from './types';
import * as aws from 'aws-sdk';

const kinesis = new aws.Kinesis();

function partitionKey(message) {
  return [
    message.domain, message.action, message.uid, message.key
  ].join('');
}

export async function Dispatch(message:QueueMessage):Promise<DispatchResponse> {
  try {
    const params = {
      Data: new Buffer(JSON.stringify(message)),
      PartitionKey: partitionKey(message),
      StreamName: process.env['KINESIS_STREAM']
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
}