require('source-map-support').install();

import {ECS} from 'aws-sdk';
import {exec} from "child_process";
import * as async from 'async';

const ecs = new ECS();

function exitErr(err:any) {
  console.log('ERROR:', err);
  process.exit(1);
}

function exitUsage() {
  console.log('[usage]', process.argv[1], '<cluster> <family> <repository_url>');
}

if (process.argv.slice(2).length < 3) { exitUsage(); }
const [cluster, family, repositoryUrl] = process.argv.slice(2);
console.log('Deploying new version of', family, 'to', cluster);

function getVersion(cb: (error, version: string) => void) {
  exec('git rev-parse --short HEAD', function (error, stdout) {
    cb(error, 'v' + (stdout || '').trim());
  });
}

function getTaskDefinitionArn(cb: (error, arn: string) => void) {
  ecs.listTaskDefinitions({
    familyPrefix: family,
    status: 'ACTIVE'
  }, function (err, response) {
    if (response.taskDefinitionArns.length === 0) {
      ecs.listTaskDefinitions({
        familyPrefix: family,
        status: 'INACTIVE'
      }, function(err, response) {
        console.log(response.taskDefinitionArns);
        cb(err, response.taskDefinitionArns[0]);
      });
    } else {
      cb(err, response.taskDefinitionArns[0]);
    }
  });
}

function getTaskDefinition(cb: (error, definition) => void) {
  async.waterfall([
    getTaskDefinitionArn,
    function (arn, cb) {
      ecs.describeTaskDefinition({
        taskDefinition: arn
      }, function (err, response) {
        cb(err, response.taskDefinition);
      });
    }
  ], cb);
}

function makeTaskDefinition(
  {taskDefinition, version}:{taskDefinition: ECS.TaskDefinition, version: string},
  cb: (error, response?: ECS.RegisterTaskDefinitionResponse) => void
) {
  taskDefinition.containerDefinitions[0].image = [repositoryUrl, version].join(':');

  ecs.listTaskDefinitions({
    familyPrefix: family,
    status: 'ACTIVE'
  }, function(err, listResponse) {
    if (err) { return cb(err); }

    ecs.registerTaskDefinition({
      containerDefinitions: taskDefinition.containerDefinitions,
      family: family,
      taskRoleArn: taskDefinition.taskRoleArn
    }, function(err, registerResponse) {
      if (err) { return cb(err); }

      async.each(listResponse.taskDefinitionArns, function(arn, cb) {
        ecs.deregisterTaskDefinition({
          taskDefinition: arn
        }, cb);
      }, function(err) {
        if (err) { return cb(err); }
        cb(null, registerResponse);
      });
    });
  });
}

function updateService({makeTaskDefinition}:{makeTaskDefinition: ECS.RegisterTaskDefinitionResponse}, cb: (error) => void) {
  console.log(makeTaskDefinition);
  const taskDef:string = [makeTaskDefinition.taskDefinition.family, makeTaskDefinition.taskDefinition.revision].join(':');

  ecs.updateService({
    cluster: cluster,
    service: family,
    taskDefinition: taskDef,
  }, cb);
}

async.auto({
  taskDefinition: getTaskDefinition,
  version: getVersion,
  makeTaskDefinition: ['taskDefinition', 'version', makeTaskDefinition],
  updateService: ['makeTaskDefinition', updateService]
}, 10, function (err, responses) {
  if (err) {
    exitErr(err);
  }
  console.log('Successfully updated task definition to image', responses.version);
});
