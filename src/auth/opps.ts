import {get} from 'firebase-get';
import {pass, ObjectRule, profileIsObjectOwner} from './auth';
import {anyPass} from 'ramda';
import {updateProjectRules} from './projects';

const profileIsOppOwner: ObjectRule = profileIsObjectOwner('opp');
const updateOppRules: ObjectRule = anyPass([profileIsOppOwner, updateProjectRules]);

export function opps(auth) {
  auth.addAuthRule({
    domain: 'Opps',
    action: 'create'
  }, async function (uid, {values}) {
    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key: values.projectKey}
    });
  });

  ['update', 'create', 'remove'].forEach(action => {
    auth.addAuthRule({
      domain: 'Opps',
      action
    }, async function (uid, {key, oppKey}) {
      const {profile, opp, project, organizers} = await get({
        profile: {uid},
        opp: oppKey || key,
        project: ['opp', 'projectKey'],
        organizers: {projectKey: ['opp', 'projectKey']},
      });

      assert(opp, 'Opp not found');
      assert(project, 'Project not found');

      return pass(
        updateOppRules,
        'User cannot update opp',
        {profile, opp, project, organizers}
      );
    });
  });
}
