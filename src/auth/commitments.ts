import {get} from 'firebase-get';

export function commitments(auth) {
  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Commitments',
      action
    }, async function (uid, {key}) {
      const {opp} = await get({
        commitment: key,
        opp: ['commitment', 'oppKey'],
      });

      return await this.auth({
        domain: 'Projects',
        action: 'update',
        uid,
        payload: {key: opp.projectKey}
      });
    });
  });

  auth.addAuthRule({
    domain: 'Commitments',
    action: 'create'
  }, async function (uid, {values: {oppKey}}) {
    const {opp} = await get({opp: oppKey});
    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key: opp.projectKey}
    });
  });
}
