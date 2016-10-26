import Get from 'firebase-get';
const get = Get();

export function users(auth) {
  auth.addAuthRule({
    domain: 'Users',
    action: 'migrate'
  }, async function (uid, {fromUid, toUid, profileKey}) {
    if (uid !== toUid) {
      return {reject: 'Incorrect uid'};
    }
    const {profile} = await get({profile: profileKey});

    const oldProfileKey = await firebase.database().ref().child('Users').child(fromUid)
      .once('value').then(s => s.val());
    const newProfileKey = await firebase.database().ref().child('Users').child(toUid)
      .once('value').then(s => s.val());

    assert(profile, 'Profile not found');
    assert(oldProfileKey, 'Old user not found');
    assert(!newProfileKey, 'New user not found');
    assert(profile.$key === oldProfileKey, 'Incorrect profile');

    return {};
  });
}
