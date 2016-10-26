import Get from 'firebase-get';
const get = Get();

export function memberships(auth) {
  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Memberships',
      action
    }, async function (uid, {key}) {
      const {membership} = await get({membership: key});
      assert(membership, 'Membership not found');
      return await this.auth({
        domain: 'Engagements',
        action: 'update',
        uid,
        payload: {key: membership.engagementKey}
      });
    });
  });

  auth.addAuthRule({
    domain: 'Memberships',
    action: 'create'
  }, async function (uid, {values}) {
    const {profile, engagement, opp} = await get({
      profile: {uid},
      engagement: values.engagementKey,
      opp: ['engagement', 'oppKey'],
    });

    assert(profile, 'Profile not found');
    assert(engagement, 'Engagement not found');

    if (profile.$key === engagement.profileKey) {
      return {profile, engagement, userRole: 'volunteer'};
    } else {
      return await this.auth({
        domain: 'Projects',
        action: 'update',
        uid,
        payload: {key: opp.projectKey}
      });
    }
  });
}
