import * as assert from 'assert';
import {
  all, allPass, anyPass, apply, compose, contains, equals, juxt, map, path,
  pathOr, prop, propOr, merge,
} from 'ramda';
import {AuthResponse, Message} from './types';
import * as firebase from 'firebase';
import {get} from 'firebase-get';

type ObjectRule = (Object) => boolean
type AuthFn = (this:Authorizer, uid:string, payload:any) => Promise<any>;

interface Authorizer {
  addAuthRule(domainAction:{domain:string, action:string}, authFn:AuthFn):void;
  auth(msg:Message):Promise<AuthResponse>;
}

export const isAdmin = propOr(false, 'isAdmin');
export const isEAP = propOr(false, 'isEAP');

// Rules
const profileIsAdmin = pathOr<boolean>(false, ['profile', 'isAdmin']);
const profileIsEAP = pathOr<boolean>(false, ['profile', 'isEAP']);
function profileIsObjectOwner(model: string): ObjectRule {
  return compose<Object, Array<string>, boolean>(
    allPass([
      all(Boolean),
      apply<any, any>(equals)
    ]),
    juxt<any, string>([
      pathOr(false, ['profile', '$key']),
      pathOr(false, [model, 'ownerProfileKey']),
    ])
  );
}
const profileIsProjectOwner: ObjectRule = profileIsObjectOwner('project');
const profileIsOppOwner: ObjectRule = profileIsObjectOwner('opp');
const profileIsTeamOwner: ObjectRule = profileIsObjectOwner('team');

const profileIsActiveOrganizer = compose<Object, Object[], boolean>(
  apply<Object[], boolean>(contains),
  juxt<Object, Object[]>([
    path(['profile', '$key']),
    compose<Object, any, string[]>(
      map<Object, string>(prop('profileKey')),
      prop('organizers')
    ),
  ])
);

const profileAndProject: ObjectRule = allPass([
  prop('profile'),
  prop('project'),
]);

const createProjectRules: ObjectRule = anyPass([
  profileIsAdmin,
  profileIsEAP,
]);

const updateProjectRules: ObjectRule = allPass([
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

const updateTeamRules: ObjectRule = anyPass([profileIsTeamOwner, updateProjectRules]);
const updateOppRules: ObjectRule = anyPass([profileIsOppOwner, updateProjectRules]);

function pass(ruleFn: ObjectRule, rejectionMsg: string, respond) {
  if (typeof respond === 'object') {
    if (ruleFn(respond)) {
      return respond;
    } else {
      return {reject: rejectionMsg};
    }
  } else {
    return function (obj) {
      if (ruleFn(obj)) {
        console.log('respond with', obj);
        respond(null, obj);
      } else {
        console.log('reject with', rejectionMsg);
        respond(null, {reject: rejectionMsg});
      }
    };
  }
}

class AuthImpl implements Authorizer {
  private domains;

  constructor() {
    this.domains = {};
  }

  addAuthRule({domain, action}, authFn: AuthFn) {
    (this.domains[domain] || (this.domains[domain] = {}))[action] = authFn;
  }

  async auth(msg: Message): Promise<AuthResponse> {
    const domain = this.domains[msg.domain];
    if (!domain) {
      return {reject: 'Unauthorized'};
    }
    const fn: AuthFn = domain[msg.action];
    if (!fn) {
      return {reject: 'Unauthorized'};
    }

    try {
      return await fn.call(this, msg.uid, msg.payload);
    } catch (err) {
      return {reject: err};
    }
  }
}

const auth = new AuthImpl();

// Projects
auth.addAuthRule({action: 'create', domain: 'Projects'}, async function (uid) {
  const {profile} = await get({profile: {uid}});

  return pass(
    createProjectRules,
    'User cannot create project',
    {profile, userRole: 'project'}
  );
});

auth.addAuthRule({action: 'update', domain: 'Projects'}, async function (uid, {key}) {
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

auth.addAuthRule({action: 'remove', domain: 'Projects'}, async function (uid, {key}) {
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
auth.addAuthRule({domain: 'ProjectImages', action: 'set'}, async function (uid, {key}) {
  return await this.auth({
    domain: 'Projects',
    action: 'update',
    uid,
    payload: {key}
  });
});

// Teams
auth.addAuthRule({action: 'remove', domain: 'Teams'}, async function (uid, {key}) {
  const {team} = await get({team: key}) as any;
  assert(team, `Team ${key} not found`);

  return await this.auth({
    domain: 'Projects',
    action: 'update',
    uid,
    payload: {key: team.projectKey}
  });
});

auth.addAuthRule({action: 'update', domain: 'Teams'}, async function (uid, {key}) {
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

auth.addAuthRule({action: 'create', domain: 'Teams'}, async function (uid, {values}) {
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
auth.addAuthRule({domain: 'TeamImages', action: 'set'}, async function (uid, {key}) {
  return await this.auth({
    domain: 'Teams',
    action: 'update',
    uid,
    payload: {key}
  });
});

auth.addAuthRule({domain: 'Opps', action: 'create'}, async function (uid, {values}) {
  return await this.auth({
    domain: 'Projects',
    action: 'update',
    uid,
    payload: {key: values.projectKey}
  });
});

// Opps
['update', 'create', 'remove'].forEach(action => {
  auth.addAuthRule({domain: 'Opps', action}, async function (uid, {key, oppKey}) {
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

// Shifts
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

auth.addAuthRule({action: 'create', domain: 'Shifts'}, async function (uid, {values}) {
  return await this.auth({
    domain: 'Teams',
    action: 'update',
    uid,
    payload: {key: values.teamKey}
  });
});

// Organizers
['update', 'remove'].forEach(action => {
  auth.addAuthRule({domain: 'Organizers', action}, async function (uid, {key}) {
    const {organizer} = await get({
      organizer: key
    });

    return await this.auth({
      domain: 'Projects',
      action: 'update',
      uid,
      payload: {key: organizer.projectKey}
    });
  });
});

auth.addAuthRule({domain: 'Organizers', action: 'create'}, async function (uid, {values}) {
  return await this.auth({
    domain: 'Projects',
    action: 'update',
    uid,
    payload: {key: values.projectKey}
  });
});

auth.addAuthRule({domain: 'Organizers', action: 'accept'}, async function (uid) {
  const data = await get({profile: {uid}});
  return pass(prop('profile'), 'Must have a profile', data);
});

// Profiles
auth.addAuthRule({domain: 'Profiles', action: 'update'}, async function (uid, {key}) {
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

// Commitments
['update', 'remove'].forEach(action => {
  auth.addAuthRule({domain: 'Commitments', action}, async function (uid, {key}) {
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

auth.addAuthRule({domain: 'Commitments', action: 'create' }, async function (uid, {values: {oppKey}}) {
  const {opp} = await get({opp: oppKey});
  return await this.auth({
    domain:'Projects',
    action:'update',
    uid,
    payload: {key: opp.projectKey}
  });
});

// Fulfillers
['create', 'update', 'remove'].forEach(action => {
  auth.addAuthRule({domain: 'Fulfillers', action}, async function (uid, {key, values}) {
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

// Assignments
auth.addAuthRule({domain: 'Assignments', action: 'create'}, async function (uid, {values}) {
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
      domain:'Projects',
      action:'update',
      uid,
      payload: {key: opp.projectKey}
    });
  }
});

['update', 'remove'].forEach(action => {
  auth.addAuthRule({domain: 'Assignments', action}, async function (uid, {key}) {
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

// Memberships
['update', 'remove'].forEach(action => {
  auth.addAuthRule({domain: 'Memberships', action}, async function (uid, {key}) {
    const {membership} = await get({membership: key});
    assert(membership, 'Membership not found');
    return await this.auth({
      domain:'Engagements',
      action:'update',
      uid,
      payload: {key: membership.engagementKey}
    });
  });
});

auth.addAuthRule({domain: 'Memberships', action: 'create'}, async function (uid, {values}) {
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
      domain:'Projects',
      action:'update',
      uid,
      payload: {key: opp.projectKey}
    });
  }
});

auth.addAuthRule({ domain: 'Users', action: 'migrate' }, async function (uid, {fromUid, toUid, profileKey}) {
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

export function Auth():Authorizer {
  return auth;
}