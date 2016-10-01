try {
  require('source-map-support').install();
} catch (err) {
  console.log('Sourcemap support not installed');
}

import * as firebase from 'firebase';
import {Queue} from './queue';
import {Auth} from './auth';
import {Responder, rejectMessage, acceptMessage} from './respond';
import {Dispatcher} from './dispatch';
import {Ref, QueueMessage} from './types';
import {debug, info} from './log';

firebase.initializeApp({
  databaseURL: process.env['FIREBASE_DATABASE_URL'],
  serviceAccount: './credentials.json',
  databaseAuthVariableOverride: {
    uid: 'firebase-queue'
  }
});

function start(queueRef:Ref, responseRef:Ref) {
  const auth = Auth();
  const dispatch = Dispatcher(process.env['KINESIS_STREAM']);
  const respond = Responder(responseRef);

  info('Starting queue');

  Queue(queueRef, async function (message:QueueMessage) {
    debug('Processing message', message);
    const authResponse = await auth.auth(message);

    if (authResponse.reject) {
      debug('Rejected message', message, authResponse);
      return await respond(rejectMessage(message, authResponse));
    }

    debug('Dispatching', message);
    const dispatchResponse = await dispatch(message);
    return await respond(acceptMessage(message, dispatchResponse));
  });
}

start(
  firebase.database().ref().child('!queue'),
  firebase.database().ref().child('!queue').child('responses')
);
