import {get} from "firebase-get";
import {anyPass} from 'ramda';
import {ObjectRule, profileIsObjectOwner, pass} from './auth';
import {updateProjectRules} from './projects';

const profileIsTeamOwner: ObjectRule = profileIsObjectOwner('team');
const updateTeamRules: ObjectRule = anyPass([profileIsTeamOwner, updateProjectRules]);

export function teams(auth) {
  auth.addAuthRule({
    action: 'remove',
    domain: 'Teams'
  }, async function (uid, {key}) {
    const {team} = await get({team: key}) as any;
    assert(team, `Team ${key} not found`);

    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key: team.projectKey}
    });
  });

  auth.addAuthRule({
    action: 'update',
    domain: 'Teams'
  }, async function (uid, {key}) {
    const {profile, team, project, organizers} = await get({
      profile: {uid},
      team: key,
      project: ['team', 'projectKey'],
      organizers: {projectKey: ['team', 'projectKey']},
    });

    assert(team, `Team ${key} not found`);
    assert(project, 'Project not found');

    return pass(
      updateTeamRules,
      'User cannot update team',
      {profile, team, project, organizers}
    );
  });

  auth.addAuthRule({
    action: 'create',
    domain: 'Teams'
  }, async function (uid, {values}) {
    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {
        key: values.projectKey
      }
    });
  });

// TeamImages
  auth.addAuthRule({
    domain: 'TeamImages',
    action: 'set'
  }, async function (uid, {key}) {
    return await this.auth({
      domain: 'Teams',
      action: 'update',
      uid,
      payload: {key}
    });
  });
}
