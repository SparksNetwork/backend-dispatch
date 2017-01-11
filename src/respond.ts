import {
  ResponseMessage, QueueMessage, DispatchResponse,
  Ref
} from './types';
import {AuthResponse} from "./auth/auth";

/**
 * Create a function that pushes responses to the given location.
 *
 * @param ref
 * @returns {(response:ResponseMessage)=>Promise<any>}
 * @constructor
 */
export function Responder(ref: Ref) {
  return async function respond(response: ResponseMessage) {
    return await ref.child(response.key)
      .set(response);
  };
}

/**
 * Construct a rejection message
 * @param message
 * @param authResponse
 */
export function rejectMessage(message: QueueMessage, authResponse: AuthResponse): ResponseMessage {
  return {
    key: message.key,
    rejected: true,
    message: authResponse.reject,
    timestamp: Date.now()
  };
}

export function invalidMessage(message: QueueMessage, error:string): ResponseMessage {
  return {
    key: message.key,
    rejected: true,
    message: error,
    timestamp: Date.now()
  };
}

/**
 * Construct an accepted message
 *
 * @param message
 * @param dispatch
 */
export function acceptMessage(message: QueueMessage, dispatch: DispatchResponse): ResponseMessage {
  return {
    key: message.key,
    rejected: !dispatch.ok,
    message: dispatch.error ? dispatch.error : '',
    timestamp: Date.now()
  };
}

