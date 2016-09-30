import * as firebase from 'firebase';
import {Queue} from './queue';
import {Auth} from './auth';
import {Dispatch} from './dispatch';
import {
  Ref, QueueMessage, ResponseMessage, AuthResponse,
  DispatchResponse
} from "./types";

firebase.initializeApp({

});

function start(queueRef:Ref, responseRef:Ref) {
  async function respond(response:ResponseMessage) {
    return await responseRef.child(response.key)
      .set(response);
  }

  function rejectMessage(message:QueueMessage, authed:AuthResponse):ResponseMessage {
    return {
      key: message.key,
      rejected: true
    }
  }

  function acceptMessage(message:QueueMessage, authed:AuthResponse, dispatch:DispatchResponse):ResponseMessage {
    return {
      key: message.key,
      rejected: false
    }
  }

  Queue(firebase.database().ref('queue'), async function (message:QueueMessage) {
    const authed = await Auth(message);

    if (authed.reject) {
      return await respond(rejectMessage(message, authed));
    }

    const dispatch = await Dispatch(message);
    return await respond(acceptMessage(message, authed, dispatch));
  });
}

start(
  firebase.database().ref().child('!queue'),
  firebase.database().ref().child('!queue').child('responses')
);
