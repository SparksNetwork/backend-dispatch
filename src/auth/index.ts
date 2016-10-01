import {AuthImpl, Authorizer} from './auth';
import {projects} from './projects';
import {teams} from './teams';
import {opps} from './opps';
import {shifts} from './shifts';
import {organizers} from './organizers';
import {profiles} from './profiles';
import {commitments} from './commitments';
import {fulfillers} from './fulfillers';
import {assignments} from './assignments';
import {memberships} from './memberships';
import {users} from './users';
import {arrivals} from './arrivals';
import {engagements} from './engagements';

const auth = new AuthImpl();
projects(auth);
teams(auth);
opps(auth);
shifts(auth);
organizers(auth);
profiles(auth);
commitments(auth);
fulfillers(auth);
assignments(auth);
memberships(auth);
users(auth);
arrivals(auth);
engagements(auth);

export function Auth():Authorizer {
  return auth;
}
