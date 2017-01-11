import start from './src/index';
import {info} from './src/log';
import kafkaDispatcher from './src/dispatch/kafka-dispatch';

let connectionString = process.env['KAFKA_CONNECTION'];

// If there is a docker link then use that
if (process.env['KAFKA_PORT_9092_TCP_ADDR']) {
  connectionString = process.env['KAFKA_PORT_9092_TCP_ADDR'] + ':9092';
}

const dispatcher = kafkaDispatcher(process.env['KINESIS_STREAM'], {connectionString});
const firebaseDatabaseUrl = process.env['FIREBASE_DATABASE_URL'];

if(process.env['CREDENTIALS']) {
  const credentials = JSON.parse(new Buffer(process.env['CREDENTIALS'], 'base64') as any);

  firebase.initializeApp({
    databaseURL: firebaseDatabaseUrl,
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
    databaseURL: firebaseDatabaseUrl,
    serviceAccount: 'credentials.json',
    databaseAuthVariableOverride: {
      uid: 'firebase-queue'
    }
  });
}

start(dispatcher).then(() => {
  info('Started');
  info('Firebase: ', firebaseDatabaseUrl);
  info('Kafka: ', connectionString);
});
