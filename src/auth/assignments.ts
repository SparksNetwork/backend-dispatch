import Get from 'firebase-get';
const get = Get();

export function assignments(auth) {
  auth.addAuthRule({
    domain: 'Assignments',
    action: 'create'
  }, async function (uid, {values}) {
    const {profile, opp} = await get({
      profile: {uid},
      opp: values.oppKey,
    });

    assert(profile, 'Profile not found');
    assert(opp, 'Opp not found');

    if (profile.$key === values.profileKey) {
      return {profile};
    } else {
      return await this.auth({
        domain: 'Projects',
        action: 'update',
        uid,
        payload: {key: opp.projectKey}
      });
    }
  });

  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Assignments',
      action
    }, async function (uid, {key}) {
      const {profile, assignment, opp} = await get({
        profile: {uid},
        assignment: key,
        opp: ['assignment', 'oppKey'],
      });

      if (profile.$key === assignment.profileKey) {
        return {profile};
      } else {
        return await this.auth({
          domain: 'Projects',
          action: 'update',
          uid,
          payload: {key: opp.projectKey}
        });
      }
    });
  });
}
