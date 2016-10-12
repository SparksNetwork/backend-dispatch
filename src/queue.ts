import * as FirebaseQueue from 'firebase-queue';
import {QueueMessage} from './types';
import {test} from "./test";

interface FirebaseQueueMessage {
  _id:string;
  _owner:string;
  _progress:number;
  _state:string;
  _state_changed:number;
  action:string;
  domain:string;
  payload:any;
  uid:string;
}

type QueueCallback = (message:QueueMessage) => Promise<any>

function firebaseMessageToQueueMessage(data:FirebaseQueueMessage):QueueMessage {
  return {
    domain: data.domain,
    action: data.action,
    key: data._id,
    payload: data.payload,
    uid: data.uid
  };
}

function makeQueueHandler(callback:QueueCallback):FirebaseQueueCallback {

  return function queueHandler(data:FirebaseQueueMessage, progress, resolve, reject) {
    ((_)=>(_))(progress); // Stupid not used message

    const message = firebaseMessageToQueueMessage(data);

    return callback(message)
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  };
}
test(__filename, 'makeQueueHandler', {
  'success': async function(t) {
    const {spy} = require('sinon');
    const callback = spy(() => Promise.resolve(true));
    const progress = spy();
    const resolve = spy();
    const reject = spy();
    const handler = makeQueueHandler(callback);

    await handler({
      domain: 'test',
      action: 'test',
      _id: 'abc123',
      payload: 'test',
      uid: '123abc',
    }, progress, resolve, reject);

    t.true(callback.calledOnce, 'callback called once');
    t.deepEqual(callback.getCall(0).args[0], {
      domain: 'test',
      action: 'test',
      key: 'abc123',
      payload: 'test',
      uid: '123abc',
    });
    t.true(resolve.calledOnce, 'resolve called once');
    t.equal(reject.callCount, 0, 'reject never called');
  },
  'failure': async function(t) {
    const {spy} = require('sinon');
    const callback = spy(() => Promise.reject('error'));
    const progress = spy();
    const resolve = spy();
    const reject = spy();
    const handler = makeQueueHandler(callback);

    await handler({
      domain: 'test',
      action: 'test',
      _id: 'abc123',
      payload: 'test',
      uid: '123abc',
    }, progress, resolve, reject);

    t.true(callback.calledOnce, 'callback called once');
    t.deepEqual(callback.getCall(0).args[0], {
      domain: 'test',
      action: 'test',
      key: 'abc123',
      payload: 'test',
      uid: '123abc',
    });
    t.equal(resolve.callCount, 0, 'resolve never called');
    t.true(reject.calledOnce, 'reject never called');
    t.equal(reject.getCall(0).args[0], 'error');
  }
});

/**
 * Start a firebase queue process listening to the queue and making a callback
 * with each message. The callback must return a promise that when resolves
 * removes the queue entry and if rejects puts the queue entry into an error
 * state.
 *
 * @param ref
 * @param callback
 * @returns {FirebaseQueue}
 */
export function Queue(ref:firebase.database.Reference, callback:(message:QueueMessage) => Promise<any>) {
  return new FirebaseQueue(ref, {sanitize: false}, makeQueueHandler(callback));
}
