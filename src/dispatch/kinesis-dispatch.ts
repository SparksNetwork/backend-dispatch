import {QueueMessage, DispatchResponse, Dispatcher, Dispatch} from '../types';
import * as aws from 'aws-sdk';
import * as https from 'https';
import {test} from "../test";

const agent = new https.Agent({
  rejectUnauthorized: false
} as any);

const kinesisOptions = {
  endpoint: process.env['KINESIS_ENDPOINT'],
  httpOptions: {agent}
};
const kinesis = new aws.Kinesis(kinesisOptions);

/**
 * Create a partition key for the message. We partition by UID because then
 * items in the stream are guaranteed to be ordered by arrival per user. The
 * disadvantage is that a users messages will all be processed by the same
 * worker.
 * @param message
 * @returns {string}
 */
function partitionKey(message) {
  return String(message.uid);
}
test(__filename, 'partitionKey', async function(t) {
  t.equal(partitionKey({uid: '123'}), '123');
  t.equal(partitionKey({uid: 123}), '123');
});

/**
 * @param ms
 * @returns {T}
 */
async function sleep(ms: number) {
  return await new Promise(resolve => {
    setTimeout(() => resolve(ms), ms);
  });
}
test(__filename, 'sleep', {
  'await': async function(t) {
    const start = Date.now();
    await sleep(100);
    t.ok(Date.now() >= start + 100 && Date.now() <= start + 200, 'It waited for 100ms');
  },
  'non-await': async function(t) {
    const start = Date.now();
    const p = sleep(100);
    t.ok(Date.now() < start + 50);
    await p;
  }
});

/**
 * Create a stream
 * @param streamName
 * @returns {boolean}
 */
async function createStream(streamName: string, shardCount:number) {
  let state = 'CREATING';

  try {
    await kinesis.createStream({
      StreamName: streamName,
      ShardCount: shardCount
    }).promise();
  } catch (err) {
  }

  while (state === 'CREATING') {
    await sleep(500);

    const stream = await kinesis.describeStream({
      StreamName: streamName
    }).promise();
    state = stream.StreamDescription.StreamStatus;
  }

  return true;
}
test(__filename, 'createStream', async function(t) {
  const {spy} = require('sinon');
  kinesis.createStream = spy(() => ({
    promise: () => Promise.resolve({})
  }));
  kinesis.describeStream = spy(() => ({
    promise: () => Promise.resolve({
      StreamDescription: {
        StreamStatus: 'CREATED'
      }
    })
  }));

  const created = await createStream('my stream', 5);
  t.equal(created, true);
  t.deepEqual(
    (kinesis.createStream as any).getCall(0).args[0],
    {
      StreamName: 'my stream',
      ShardCount: 5
    }
  );
});

function makeDispatcher(streamName:string):Dispatch {
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
test(__filename, 'makeDispatcher', {
  'make a dispatch function': async function(t) {
    const dispatch = makeDispatcher('my-stream');
    t.is(typeof dispatch, 'function');
  },
  'send a message successfully': async function(t) {
    const {spy} = require('sinon');
    const promiseSpy = spy(() => Promise.resolve('response'));
    const putRecordSpy = spy(() => ({
      promise: promiseSpy
    }));
    kinesis.putRecord = putRecordSpy;

    const dispatch = makeDispatcher('my-stream');
    const message:QueueMessage = {
      action: 'test-action',
      domain: 'test-domain',
      payload: 'test-payload',
      uid: 'test-uid',
      key: 'test-key',
    };

    const response = await dispatch(message);
    t.deepEqual(response, {
      response: 'response',
      ok: true
    });

    const params = putRecordSpy.getCall(0).args[0]
    t.equal(params.StreamName, 'my-stream');
    t.equal(params.PartitionKey, 'test-uid');
    t.equal(params.Data.constructor, Buffer);
    t.true(promiseSpy.calledOnce);
  },
  'sending fails': async function(t) {
    const {spy} = require('sinon');
    const promiseSpy = spy(() => Promise.reject('error'));
    const putRecordSpy = spy(() => ({
      promise: promiseSpy
    }));
    kinesis.putRecord = putRecordSpy;

    const dispatch = makeDispatcher('my-stream');
    const message:QueueMessage = {
      action: 'test-action',
      domain: 'test-domain',
      payload: 'test-payload',
      uid: 'test-uid',
      key: 'test-key',
    };

    const response = await dispatch(message);
    t.deepEqual(response, {
      ok: false,
      response: null,
      error: 'error'
    });
  }
});

const dispatcher:Dispatcher = async function(streamName: string) {
  await createStream(streamName, 1);
  return makeDispatcher(streamName);
};

export default dispatcher;
