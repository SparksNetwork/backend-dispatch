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
import {Ref, QueueMessage, Dispatch} from './types';
import {debug, info} from './log';

export * from './types';

/**
 * @param dispatcher
 * @param queueRef Place where the queue lives
 * @param responseRef Place to put responses
 * @param metricsOut Place to store metrics
 */
export default async function start(dispatcher:Promise<Dispatch>,
                                    queue:string = '!queue',
                                    response:string = '!queue/responses',
                                    metrics:string = 'metrics',
                                    app = firebase
) {
  const queueRef:Ref = app.database().ref().child(queue);
  const responseRef:Ref = app.database().ref(response);
  const metricsOut:Ref = app.database().ref().child(metrics);

  const metricsIn:Ref = queueRef.child('metrics');
  const count = tag => pushMetric(metricsIn, tag);

  const auth = Auth();
  const dispatch = await dispatcher;
  const respond = Responder(responseRef);

  info('Starting queue');

  Queue(queueRef, async function (message:QueueMessage) {
    const start = Date.now();
    info('Incoming', message);
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

