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
import {
  Responder, rejectMessage, acceptMessage,
  invalidMessage
} from './respond';
import kafkaDispatcher from './dispatch/kafka-dispatch';
import {Ref, QueueMessage, Dispatch} from './types';
import {debug, info} from './log';
import {isTest} from "./test";

/**
 * @param dispatcher
 * @param queueRef Place where the queue lives
 * @param responseRef Place to put responses
 * @param metricsOut Place to store metrics
 */
async function start(dispatcher:Promise<Dispatch>, queueRef:Ref, responseRef:Ref, metricsOut:Ref) {
  const metricsIn:Ref = queueRef.child('metrics');
  const count = tag => pushMetric(metricsIn, tag);

  const auth = Auth();
  const dispatch = await dispatcher;
  const respond = Responder(responseRef);

  info('Starting queue');

  Queue(queueRef, async function (message:QueueMessage) {
    const start = Date.now();
    debug('Incoming', message);
    count('queue-incoming');

    const validMessage = await validate(message);

    if (!validMessage.valid) {
      await respond(invalidMessage(message, validMessage.message));
      debug('Invalid message', message);
      debug(validMessage.errors);
      count('queue-invalid');
      return true;
    }

    debug('Message validated', Date.now() - start);

    const authResponse = await auth.auth(message);

    if (authResponse.reject) {
      await respond(rejectMessage(message, authResponse));
      debug('Rejected message', message, authResponse);
      count('queue-rejected');
      return true;
    }
    debug('Message authorized', Date.now() - start);

    const dispatchResponse = await dispatch(message);
    debug('Dispatched', dispatchResponse, Date.now() - start);
    count('queue-dispatched');

    await respond(acceptMessage(message, dispatchResponse));
    debug('Responded', Date.now() - start);
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
  } else if (process.env['FIREBASE_PRIVATE_KEY']) {
    firebase.initializeApp({
      databaseURL: process.env['FIREBASE_DATABASE_URL'],
      serviceAccount: {
        projectId: process.env['FIREBASE_PROJECT_ID'],
        clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
        privateKey: process.env['FIREBASE_PRIVATE_KEY']
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

  let connectionString = process.env['KAFKA_CONNECTION'];

  // If there is a docker link then use that
  if (process.env['KAFKA_PORT_9092_TCP_ADDR']) {
    connectionString = process.env['KAFKA_PORT_9092_TCP_ADDR'] + ':9092';
  }

  const dispatcher = kafkaDispatcher(process.env['KINESIS_STREAM'], {connectionString});

  start(
    dispatcher,
    firebase.database().ref().child('!queue'),
    firebase.database().ref().child('!queue').child('responses'),
    firebase.database().ref().child('metrics')
  );
}
