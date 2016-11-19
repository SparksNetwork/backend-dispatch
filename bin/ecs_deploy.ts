require('source-map-support').install();

import {ECS} from 'aws-sdk';
import {exec} from "child_process";

const ecs = new ECS();

function exitUsage() {
  console.log('[usage]', process.argv[1], '<cluster> <family> <repository_url>');
}

if (process.argv.slice(2).length < 3) { exitUsage(); }
const [cluster, family, repositoryUrl] = process.argv.slice(2);

function getVersion():Promise<string> {
  return new Promise((resolve, reject) => {
    exec('git rev-parse --short HEAD', function (error, stdout) {
      if (error) { return reject(error); }
      resolve('v' + stdout.trim());
    });
  });
}

async function getTaskDefinitionArn():Promise<string> {
  let tasks = (await ecs.listTaskDefinitions({
    familyPrefix: family,
    status: 'ACTIVE'
  }).promise()).taskDefinitionArns;

  if (tasks && tasks.length === 0) {
    tasks = (await ecs.listTaskDefinitions({
      familyPrefix: family,
      status: 'INACTIVE'
    }).promise()).taskDefinitionArns;
  }

  if (!tasks || tasks.length === 0) {
    throw new Error('Cannot find any tasks in ' + family);
  }

  return tasks[0];
}

async function getTaskDefinition():Promise<ECS.Types.TaskDefinition> {
  const arn = await getTaskDefinitionArn();
  const response = await ecs.describeTaskDefinition({
    taskDefinition: arn
  }).promise();

  if (!response.taskDefinition) {
    throw new Error('No task definition');
  }

  return response.taskDefinition;
}

async function makeTaskDefinition(taskDefinition:ECS.Types.TaskDefinition, version:string):Promise<ECS.Types.TaskDefinition> {
  if (!taskDefinition.containerDefinitions) {
    throw new Error('No container definitions');
  }

  taskDefinition.containerDefinitions[0].image = [repositoryUrl, version].join(':');

  const existingTaskArns = await ecs.listTaskDefinitions({
    familyPrefix: family,
    status: 'ACTIVE'
  }).promise();

  const response = await ecs.registerTaskDefinition({
    containerDefinitions: taskDefinition.containerDefinitions,
    family: family,
    taskRoleArn: taskDefinition.taskRoleArn
  }).promise();

  if (!response.taskDefinition) {
    throw new Error('No task definition');
  }

  if (existingTaskArns.taskDefinitionArns) {
    await Promise.all(existingTaskArns.taskDefinitionArns.map(arn => {
      ecs.deregisterTaskDefinition({
        taskDefinition: arn
      }).promise();
    }));
  }

  return response.taskDefinition;
}

async function updateService({family, revision}) {
  const taskDef:string = [family, revision].join(':');

  return ecs.updateService({
    cluster: cluster,
    service: family,
    taskDefinition: taskDef,
  }).promise();
}

async function doit() {
  console.log('Deploying', family, 'to', cluster);

  const version = await getVersion();
  console.log(`Making new definition for ${version}`);

  const taskDefinition = await getTaskDefinition();
  const newDefinition = await makeTaskDefinition(taskDefinition, version);
  console.log(`Registered definition ${newDefinition.family}:${newDefinition.revision}`);

  await updateService({family: newDefinition.family || "", revision: newDefinition.revision});
  console.log('Successfully updated task definition to image', version);
}

doit();