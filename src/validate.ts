import {omit} from 'ramda';
import {QueueMessage} from "./types";
import {test} from "./test";
import {Test} from "tape-async";
import * as util from 'util';
import Ajv from '@sparksnetwork/sparks-schemas/lib/ajv';

const ajv = Ajv();
const commandValidator = ajv.getSchema('Command');

export interface Validation {
  valid:boolean;
  errors:any | undefined;
  message: string;
}

export async function validate(message:QueueMessage):Promise<Validation> {
  const messageWithoutKey = omit(['key'], message);
  const {domain, action} = messageWithoutKey;

  const payloadValidator = ajv.getSchema([domain, action].join('.'));

  if (!commandValidator(messageWithoutKey)) {
    return {
      valid: false,
      errors: commandValidator.errors,
      message: ajv.errorsText(commandValidator.errors)
    };
  }

  if (!payloadValidator) {
    return {
      valid: false,
      errors: ['No schema found'],
      message: 'No schema found'
    };
  }

  if (!payloadValidator(messageWithoutKey.payload)) {
    return {
      valid: false,
      errors: payloadValidator.errors,
      message: ajv.errorsText(payloadValidator.errors)
    };
  }

  return {valid: true, errors: [], message: ''};
}
test(__filename, 'validate command', async function(t:Test) {
  ajv.addSchema({
    type: "object",
    properties: {
      key: {type: "string"}
    }
  }, 'somethingElse.something');

  const validCommands = [
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
    t.deepEqual(valid, {
      valid: true,
      message: '',
      errors: []
    }, `${util.inspect(command)} should be valid`);
  }

  for (let command of invalidCommands) {
    const valid = await validate(command as any);
    t.notOk(valid.valid, `${util.inspect(command)} should be invalid`);
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
    {uid:'abc', domain:'Domains', action: 'create', payload: {values: {name: 1}}},
    {uid:'abc', domain:'Domains', action: 'create', payload: {values: {name: "moose"}}},
    {uid:'abc', domain:'Domains', action: 'remove', payload: {key: 'abc'}}
  ];

  const invalidPayloads = [
    {uid:'abc', domain:'Domains', action: 'create', payload: {values: 'moose'}},
    {uid:'abc', domain:'Domains', action: 'create', payload: {dancing: 'moose'}},
    {uid:'abc', domain:'Domains', action: 'remove', payload: {}}
  ];

  for (let command of validPayloads) {
    const valid = await validate(command as any);
    t.deepEqual(valid, {
      valid: true,
      message: '',
      errors: []
    }, `${util.inspect(command.payload)} should be valid`);
  }

  for (let command of invalidPayloads) {
    const valid = await validate(command as any);
    t.notOk(valid.valid, `${util.inspect(command.payload)} should be invalid`);
  }
});