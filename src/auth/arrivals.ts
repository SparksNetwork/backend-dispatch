import {AuthImpl} from './auth';
import {get} from 'firebase-get';

export function arrivals(auth:AuthImpl) {
  auth.addAuthRule({domain:'Arrivals', action: 'create'}, async function(this:AuthImpl, uid, {projectKey}) {
    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key: projectKey}
    });
  });

  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({domain: 'Arrvials', action}, async function (this:AuthImpl, uid, {key}) {
      const {arrival} = await get({arrival: key});
      const projectKey = arrival.projectKey;
      return await this.auth({
        domain: 'Projects',
        action: 'update',
        uid,
        payload: {key: projectKey}
      });
    });
  });
}