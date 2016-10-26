import Get from 'firebase-get';
import {
  pass, ObjectRule, profileIsEAP, profileIsAdmin,
  profileIsObjectOwner, profileAndProject, profileIsActiveOrganizer
} from './auth';
import {allPass, anyPass, merge} from 'ramda';
const get = Get();

const profileIsProjectOwner: ObjectRule = profileIsObjectOwner('project');

const createProjectRules: ObjectRule = anyPass([
  profileIsAdmin,
  profileIsEAP,
]);

export const updateProjectRules: ObjectRule = allPass([
  profileAndProject,
  anyPass([
    profileIsAdmin,
    profileIsProjectOwner,
    profileIsActiveOrganizer,
  ]),
]);

const removeProjectRules: ObjectRule = allPass([
  profileAndProject,
  anyPass([
    profileIsAdmin,
    profileIsProjectOwner,
  ]),
]);

export function projects(auth) {
  auth.addAuthRule({
    action: 'create',
    domain: 'Projects'
  }, async function (uid) {
    const {profile} = await get({profile: {uid}});

    return pass(
      createProjectRules,
      'User cannot create project',
      {profile, userRole: 'project'}
    );
  });

  auth.addAuthRule({
    action: 'update',
    domain: 'Projects'
  }, async function (uid, {key}) {
    const objects = await get({
      profile: {uid},
      project: key,
      organizers: {projectKey: key},
    });

    return pass(
      updateProjectRules,
      'User cannot update project',
      merge(objects, {userRole: 'project'})
    );
  });

  auth.addAuthRule({
    action: 'remove',
    domain: 'Projects'
  }, async function (uid, {key}) {
    const objects = await get({
      profile: {uid},
      project: key,
    });

    return pass(
      removeProjectRules,
      'User cannot remove project',
      merge(objects, {userRole: 'project'})
    );
  });

  // ProjectImages
  auth.addAuthRule({
    domain: 'ProjectImages',
    action: 'set'
  }, async function (uid, {key}) {
    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key}
    });
  });
}
