try {
  require('source-map-support').install();
} catch (err) {
  console.log('Sourcemap support not installed');
}

import * as firebase from 'firebase';
import {startMetrics, pushMetric} from 'firebase-metrics';
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

function start(queueRef:Ref, responseRef:Ref, metricsOut:Ref) {
  const metricsIn:Ref = queueRef.child('metrics');
  const count = tag => pushMetric(metricsIn, tag);

  const auth = Auth();
  const dispatch = Dispatcher(process.env['KINESIS_STREAM']);
  const respond = Responder(responseRef);

  info('Starting queue');

  Queue(queueRef, async function (message:QueueMessage) {
    debug('Incoming', message);
    count('queue-incoming');

    const authResponse = await auth.auth(message);

    if (authResponse.reject) {
      await respond(rejectMessage(message, authResponse));
      debug('Rejected message', message, authResponse);
      count('queue-rejected');
      return true;
    }

    const dispatchResponse = await dispatch(message);
    debug('Dispatched', dispatchResponse);
    count('queue-dispatched');

    await respond(acceptMessage(message, dispatchResponse));
    debug('Responded');
    count('queue-responded');

    return true;
  });

  info('Starting metrics');
  startMetrics(metricsIn, metricsOut);
}

start(
  firebase.database().ref().child('!queue'),
  firebase.database().ref().child('!queue').child('responses'),
  firebase.database().ref().child('metrics')
);
