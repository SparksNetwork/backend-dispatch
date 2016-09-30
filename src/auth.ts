interface Message {
  domain:string,
  action:string,
  uid:string,
  payload:any
}

function parseRules(rules:any) {
  const lookupRules = rules.rules || {};
  delete rules.rules;

  function replaceSimpleLookup(rule:any) {
    if (typeof rule === 'string') {
      return lookupRules[rule];
    } else {
      return rule;
    }
  }

  function replaceFortifiedLookup(rule:any) {
    if (rule._) {
      const lookup = lookupRules[rule._];
      delete rule._;
      return Object.assign({}, lookup, rule);
    } else {
      return rule;
    }
  }

  function replaceKnownKeysInString(object:any, string:string) {
    return Object.keys(object).reduce((str, key) => {
      if (typeof object[key] !== 'object') {
        return str.replace(`{{${key}}}`, object[key]);
      } else {
        return str;
      }
    }, string)
  }

  function replaceKnownKeysInObject(object:any) {
    return function(rule:any) {
      return Object.keys(rule).reduce((obj, k) => {
        const v = obj[k];

        if (typeof v === 'string') {
          obj[k] = replaceKnownKeysInString(object, v);
        }

        return obj;
      }, rule);
    }
  }

  function actionFunction(domain:string, action:Function) {
    return function(rule:any) {
      return function(message:Message) {
        if (!(message.domain === domain && action(message.action)) { return false }
      }
    }
  }

  Object.keys(rules).forEach(domainName => {
    const domain = rules[domainName];

    Object.keys(domain).forEach(actionName => {
      let actionFn:(str:string) => boolean;

      if (actionName.startsWith('/') && actionName.endsWith('/')) {
        const r = new RegExp(actionName);
        actionFn = str => Boolean(r.test(str))
      } else {
        actionFn = str => str === actionName;
      }

      const actionRules = domain[actionName]
        .map(replaceSimpleLookup)
        .map(replaceFortifiedLookup)
        .map(replaceKnownKeysInObject({domain: domainName}))
        .map(actionFunction(domainName, actionFn))
    });
  });
}

