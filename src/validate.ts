import * as Ajv from 'ajv';
import {omit} from 'ramda';
import {QueueMessage} from "./types";
import {test} from "./test";
import {Test} from "tape-async";
import * as util from 'util';

const ajv = new Ajv({
  loadSchema
});
const command = ajv.compile(require('sparks-schemas/schemas/command.json'));

export interface Validation {
  valid:boolean;
  errors:any | undefined;
}

function loadSchema(uri:string, callback:(err:Error|null, schema?:any) => void) {
  try {
    const schema = require(`sparks-schemas/schemas/${uri}`);
    callback(null, schema);
  } catch(err) {
    callback(err);
  }
}

async function addSchema(message:QueueMessage) {
  try {
    const commandFile = require(`sparks-schemas/schemas/commands/${message.domain}.json`);
    const schemaData = commandFile[message.action];

    if (schemaData) {
      return await new Promise((resolve, reject) => {
        ajv.compileAsync(schemaData, (err, validate) => {
          if (err) {
            return reject(err);
          }
          resolve(validate);
        });
      });
    } else {
      return null;
    }
  } catch(err) {
    return null;
  }
}

async function getSchema(message:QueueMessage) {
  const schemaName = `${message.domain}.${message.action}`;
  return ajv.getSchema(schemaName) || await addSchema(message);
}

export async function validate(message:QueueMessage):Promise<Validation> {
  const messageWithoutKey = omit(['key'], message);
  const commandValid = await command(messageWithoutKey);
  if (!commandValid) { return { valid: false, errors: command.errors }; }

  const schema = await getSchema(message);

  if (schema) {
    const valid = await schema(message.payload || null);
    return {valid, errors: schema.errors};
  } else {
    return {valid: false, errors: ["No schema found"]};
  }
}

test(__filename, 'validate command', async function(t:Test) {
  ajv.addSchema({
    type: "null",
  }, 'anything.anything');

  ajv.addSchema({
    type: "object",
    properties: {
      key: {type: "string"}
    }
  }, 'somethingElse.something');

  const validCommands = [
    {uid: 'abc', domain: 'anything', action: 'anything'},
    {uid: 'abc', domain: 'somethingElse', action: 'something', payload: {key: 'test'}}
  ];
  const invalidCommands = [
    {domain: 'moose'},
    {action: 'loop'},
    {uid: 'abc'},
    {domain: 'moose', action: 'loop', payload: 'string', uid: 'abc'},
    {domain: 'moose', action: 'loop', payload: 123, uid: 'abc'},
    {domain: 'moose', action: 'loop', payload: [1,2,3], uid: 'abc'},
    {domain: 'unknown', action: 'nothing', payload: {}, uid: 'abc'}
  ];

  for (let command of validCommands) {
    const valid = await validate(command as any);
    t.ok(valid.valid, `${util.inspect(command)} is valid`);
  }

  for (let command of invalidCommands) {
    const valid = await validate(command as any);
    t.notOk(valid.valid, `${util.inspect(command)} is invalid`);
  }
});

test(__filename, 'validate payload', async function(t:Test) {
  ajv.addSchema({
    type: "object",
    properties: {
      values: {
        type: "object",
        properties: {
          name: {type: "string"}
        },
        required: ["name"],
        additionalProperties: false
      }
    },
    required: ["values"],
    additionalProperties: false
  }, 'Domains.create');

  ajv.addSchema({
    type:"object",
    properties: {
      key: {type: "string"}
    },
    required: ["key"],
    additionalProperties: false
  }, "Domains.remove");

  const validPayloads = [
    {uid:'abc', domain:'Domains', action: 'create', payload: {values: {name: "moose"}}},
    {uid:'abc', domain:'Domains', action: 'remove', payload: {key: 'abc'}}
  ];

  const invalidPayloads = [
    {uid:'abc', domain:'Domains', action: 'create', payload: {values: {name: 1}}},
    {uid:'abc', domain:'Domains', action: 'create', payload: {values: 'moose'}},
    {uid:'abc', domain:'Domains', action: 'create', payload: {dancing: 'moose'}},
    {uid:'abc', domain:'Domains', action: 'remove', payload: {}}
  ];

  for (let command of validPayloads) {
    const valid = await validate(command as any);
    t.ok(valid.valid, `${util.inspect(command.payload)} is valid`);
  }

  for (let command of invalidPayloads) {
    const valid = await validate(command as any);
    t.notOk(valid.valid, `${util.inspect(command.payload)} is invalid`);
  }
});