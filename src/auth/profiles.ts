import Get from 'firebase-get';
import {AuthResponse} from './auth';
const get = Get();

export function profiles(auth) {
  auth.addAuthRule({domain: 'Profiles', action: 'update'}, async function (uid, {key}):Promise<AuthResponse> {
    const {profile: myProfile} = await get({profile: {uid}});
    const {profile} = await get({profile: key});

    if (myProfile && profile && (myProfile.isAdmin || profile.uid === uid)) {
      return {isAdmin: Boolean(myProfile.isAdmin), profile};
    } else {
      return {reject: 'Cannot update profile of another user'};
    }
  });

  auth.addAuthRule({domain: 'Profiles', action: 'create'}, async function () {
    // Anyone can create a profile
    return {};
  });
}
