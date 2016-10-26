import {test} from "./test";
const lawgs = require('lawgs');
let logger:any = console;

if (process.env['CLOUDWATCH_LOG_GROUP']) {
  logger = lawgs.getOrCreate(process.env['CLOUDWATCH_LOG_GROUP']);
}

export function info(...msgs:any[]) {
  logger.info('[INFO]', ...msgs);
}
test(__filename, 'info', async function(t) {
  const spy = require('sinon').spy(logger, 'info');
  info('test', 'it');
  t.deepEqual(spy.firstCall.args, ['[INFO]', 'test', 'it']);
  spy.restore();
});

export function error(...msgs:any[]) {
  logger.error('[ERROR]', ...msgs);
}
test(__filename, 'error', async function(t) {
  const spy = require('sinon').spy(logger, 'error');
  error('test', 'it');
  t.deepEqual(logger.error.firstCall.args, ['[ERROR]', 'test', 'it']);
  spy.restore();
});

export function debug(...msgs:any[]) {
  logger.info('[DEBUG]', ...msgs);
}
test(__filename, 'debug', async function(t) {
  const spy = require('sinon').spy(logger, 'info');
  debug('test', 'it');
  t.deepEqual(logger.info.firstCall.args, ['[DEBUG]', 'test', 'it']);
  spy.restore();
});
