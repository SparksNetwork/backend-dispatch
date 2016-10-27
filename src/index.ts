import {validate} from "./validate";
try {
  require('source-map-support').install();
} catch (err) {
  console.log('source map support not installed');
}

import * as firebase from 'firebase';
import {startMetrics, pushMetric} from 'firebase-metrics';
import {Queue} from './queue';
import {Auth} from './auth';
import {Responder, rejectMessage, acceptMessage} from './respond';
import {Dispatcher} from './dispatch';
import {Ref, QueueMessage} from './types';
import {debug, info} from './log';
import {isTest} from "./test";

/**
 * @param queueRef Place where the queue lives
 * @param responseRef Place to put responses
 * @param metricsOut Place to store metrics
 */
async function start(queueRef:Ref, responseRef:Ref, metricsOut:Ref) {
  const metricsIn:Ref = queueRef.child('metrics');
  const count = tag => pushMetric(metricsIn, tag);

  const auth = Auth();
  const dispatch = await Dispatcher(process.env['KINESIS_STREAM']);
  const respond = Responder(responseRef);

  info('Starting queue');

  Queue(queueRef, async function (message:QueueMessage) {
    debug('Incoming', message);
    count('queue-incoming');

    const validMessage = await validate(message);

    if (!validMessage) {
      debug('Invalid message', message);
      count('queue-invalid');
      return true;
    }
    debug('Message validated');

    const authResponse = await auth.auth(message);

    if (authResponse.reject) {
      await respond(rejectMessage(message, authResponse));
      debug('Rejected message', message, authResponse);
      count('queue-rejected');
      return true;
    }
    debug('Message authorized');

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

if (!isTest()) {
  if(process.env['CREDENTIALS']) {
    const credentials = JSON.parse(new Buffer(process.env['CREDENTIALS'], 'base64') as any);

    firebase.initializeApp({
      databaseURL: process.env['FIREBASE_DATABASE_URL'],
      serviceAccount: {
        projectId: credentials['project_id'],
        clientEmail: credentials['client_email'],
        privateKey: credentials['private_key']
      },
      databaseAuthVariableOverride: {
        uid: 'firebase-queue'
      }
    });
  } else {
    firebase.initializeApp({
      databaseURL: process.env['FIREBASE_DATABASE_URL'],
      serviceAccount: './credentials.json',
      databaseAuthVariableOverride: {
        uid: 'firebase-queue'
      }
    });
  }

  start(
    firebase.database().ref().child('!queue'),
    firebase.database().ref().child('!queue').child('responses'),
    firebase.database().ref().child('metrics')
  );
}
