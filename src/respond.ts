import {
  ResponseMessage, QueueMessage, AuthResponse, DispatchResponse,
  Ref
} from './types';

export function Responder(ref: Ref) {
  return async function respond(response: ResponseMessage) {
    return await ref.child(response.key)
      .set(response);
  };
}

export function rejectMessage(message: QueueMessage, authResponse: AuthResponse): ResponseMessage {
  return {
    key: message.key,
    rejected: true,
    message: authResponse.reject,
    timestamp: Date.now()
  };
}

export function acceptMessage(message: QueueMessage, dispatch: DispatchResponse): ResponseMessage {
  return {
    key: message.key,
    rejected: !dispatch.ok,
    message: dispatch.error ? dispatch.error : '',
    timestamp: Date.now()
  };
}

