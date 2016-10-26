import * as winston from 'winston';
import * as util from 'util';

if (process.env['CLOUDWATCH_LOG_GROUP']) {
  const cw = require('winston-cloudwatch');
  winston.add(cw, {
    logGroupName: process.env['CLOUDWATCH_LOG_GROUP'],
    logStreamName: Date.now().toString(),
    awsRegion: process.env['AWS_REGION'],
    level: 'debug'
  });
}

function log(level:'info'|'debug'|'error', ...msg:any[]) {
  const output:string = msg.map(m => util.format(m)).join(' ');
  winston.log(level, output, () => {});
}

export function info(...msg:any[]) {
  log('info', ...msg);
}

export function debug(...msg:any[]) {
  log('debug', ...msg);
}

export function error(...msg:any[]) {
  log('error', ...msg);
}
