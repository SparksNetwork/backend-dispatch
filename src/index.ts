try {
  require('source-map-support').install();
} catch (err) {
  console.log('Sourcemap support not installed');
}

import * as firebase from 'firebase';
import {Queue} from './queue';
import {Auth} from './auth';
import {Dispatch} from './dispatch';
import {
  Ref, QueueMessage, ResponseMessage, AuthResponse,
  DispatchResponse
} from './types';
import {debug} from './log';

firebase.initializeApp({
  databaseURL: process.env['FIREBASE_DATABASE_URL'],
  serviceAccount: './credentials.json',
  databaseAuthVariableOverride: {
    uid: 'firebase-queue'
  }
});

function start(queueRef:Ref, responseRef:Ref) {
  const auth = Auth();

  async function respond(response:ResponseMessage) {
    return await responseRef.child(response.key)
      .set(response);
  }

  function rejectMessage(message:QueueMessage, authResponse:AuthResponse):ResponseMessage {
    return {
      key: message.key,
      rejected: true,
      message: authResponse.reject,
      timestamp: Date.now()
    };
  }

  function acceptMessage(message:QueueMessage, authResponse:AuthResponse, dispatch:DispatchResponse):ResponseMessage {
    console.log(authResponse);
    console.log(dispatch);

    return {
      key: message.key,
      rejected: false,
      timestamp: Date.now()
    };
  }

  Queue(queueRef, async function (message:QueueMessage) {
    debug('Processing message', message);
    const authResponse = await auth.auth(message);

    if (authResponse.reject) {
      debug('Rejected message', message, authResponse);
      return await respond(rejectMessage(message, authResponse));
    }

    debug('Dispatching', message);
    const dispatch = await Dispatch(message);
    return await respond(acceptMessage(message, authResponse, dispatch));
  });
}

start(
  firebase.database().ref().child('!queue'),
  firebase.database().ref().child('!queue').child('responses')
);
