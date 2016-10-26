import Get from 'firebase-get';
import {prop} from 'ramda';
import {pass} from './auth';

const get = Get();

export function organizers(auth) {
  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Organizers',
      action
    }, async function (uid, {key}) {
      const {organizer} = await get({
        organizer: key
      });

      return await this.auth({
        domain: 'Projects',
        action: 'update',
        uid,
        payload: {key: organizer.projectKey}
      });
    });
  });

  auth.addAuthRule({
    domain: 'Organizers',
    action: 'create'
  }, async function (uid, {values}) {
    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key: values.projectKey}
    });
  });

  auth.addAuthRule({
    domain: 'Organizers',
    action: 'accept'
  }, async function (uid) {
    const data = await get({profile: {uid}});
    return pass(prop('profile'), 'Must have a profile', data);
  });
}
