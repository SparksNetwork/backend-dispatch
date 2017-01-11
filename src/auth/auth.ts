import {
  all, allPass, apply, compose, contains, equals, juxt, map, path,
  pathOr, prop, propOr
} from 'ramda';
import {Message} from '../types';

export interface AuthResponse {
  reject?:string;
}
export type ObjectRule = (Object) => boolean

export type AuthFn = (this:Authorizer, uid:string, payload:any) => Promise<AuthResponse>;

export interface Authorizer {
  addAuthRule(domainAction:{domain:string, action:string}, authFn:AuthFn):void;
  auth(msg:Message):Promise<AuthResponse>;
}


export const isAdmin = propOr(false, 'isAdmin');
export const isEAP = propOr(false, 'isEAP');

export const profileIsAdmin = pathOr<boolean>(false, ['profile', 'isAdmin']);
export const profileIsEAP = pathOr<boolean>(false, ['profile', 'isEAP']);

export function profileIsObjectOwner(model: string): ObjectRule {
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

export const profileIsActiveOrganizer = compose<Object, Object[], boolean>(
  apply<Object[], boolean>(contains),
  juxt<Object, Object[]>([
    path(['profile', '$key']),
    compose<Object, any, string[]>(
      map<Object, string>(prop('profileKey')),
      prop('organizers')
    ),
  ])
);

export const profileAndProject: ObjectRule = allPass([
  prop('profile'),
  prop('project'),
]);

export function pass(ruleFn: ObjectRule, rejectionMsg: string, respond) {
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

export class AuthImpl implements Authorizer {
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
