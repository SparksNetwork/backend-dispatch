import {QueueMessage} from './types';

export async function Dispatch(message:QueueMessage) {
  console.log(message);
  return {ok: true};
}