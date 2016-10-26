import Get from 'firebase-get';
const get = Get();

export function shifts(auth) {
  ['update', 'remove'].forEach(action => {
    auth.addAuthRule({domain: 'Shifts', action}, async function (uid, {key}) {
      const {shift} = await get({shift: key}) as any;
      return await this.auth({
        domain: 'Teams',
        action: 'update',
        uid,
        payload: {
          key: shift.teamKey
        }
      });
    });
  });

  auth.addAuthRule({
    action: 'create',
    domain: 'Shifts'
  }, async function (uid, {values}) {
    return await this.auth({
      domain: 'Teams',
      action: 'update',
      uid,
      payload: {key: values.teamKey}
    });
  });
}
