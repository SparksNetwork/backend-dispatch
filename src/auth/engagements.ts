import {AuthImpl, AuthResponse} from './auth';
import Get from 'firebase-get';
const get = Get();

export function engagements(auth: AuthImpl) {
  auth.addAuthRule({
    domain: 'Engagements',
    action: 'create'
  }, async function (this: AuthImpl, uid, {oppKey, profileKey}): Promise<AuthResponse> {
    const {profile, opp} = await get({
      profile: {uid},
      opp: oppKey,
    });

    if (profile.$key !== profileKey && !profile.isAdmin) {
      return {reject: 'Cannot apply another user to this engagement'};
    }

    return {opp};
  });

  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Engagements',
      action
    }, async function (this:AuthImpl, uid, {key}) {
      const {profile, engagement, opp} = await get({
        profile: {uid},
        engagement: key,
        opp: ['engagement', 'oppKey'],
      });

      if (profile.isAdmin) {
        return {profile, engagement, userRole: 'project'};
      }

      if (profile.$key === engagement.profileKey) {
        return {profile, engagement, userRole: 'volunteer'};
      }

      return await this.auth({
        domain: 'Projects',
        action: 'update',
        uid,
        payload: {key: opp.projectKey}
      });
    });
  });

  auth.addAuthRule({
    domain: 'Engagements',
    action: 'reclaim'
  }, async function (this: AuthImpl, uid): Promise<any> {
    const {profile} = await get({profile: {uid}});
    if (profile.isAdmin) {
      return {profile, userRole: 'admin'};
    }
    return {reject: 'Not authorized to modify engagement'};
  });
}
