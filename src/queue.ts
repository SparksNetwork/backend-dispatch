import * as FirebaseQueue from 'firebase-queue';
import {QueueMessage} from './types';

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

export function Queue(ref:firebase.database.Reference, callback:(message:QueueMessage) => Promise<any>) {
  return new FirebaseQueue(ref, {sanitize: false}, function(data:FirebaseQueueMessage, progress, resolve, reject) {
    ((_)=>(_))(progress);

    const message:QueueMessage = {
      domain: data.domain,
      action: data.action,
      key: data._id,
      payload: data.payload,
      uid: data.uid
    };

    callback(message)
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  });
}
