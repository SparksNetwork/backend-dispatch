import Get from 'firebase-get';
const get = Get();

export function fulfillers(auth) {
  ['create', 'update', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Fulfillers',
      action
    }, async function (uid, {key, values}) {
      if (key) {
        const {fulfiller} = await get({fulfiller: key});
        const oppKey = fulfiller.key;
        return await this.auth({
          domain: 'Opp',
          action: 'update',
          uid,
          payload: {key: oppKey}
        });
      } else if (values.oppKey) {
        return await this.auth({
          domain: 'Opp',
          action: 'update',
          uid,
          payload: {key: values.oppKey}
        });
      } else {
        return {reject: 'No oppKey'};
      }
    });
  });
}
