function parseRules(rules) {
    var lookupRules = rules.rules || {};
    delete rules.rules;
    function replaceSimpleLookup(rule) {
        if (typeof rule === 'string') {
            return lookupRules[rule];
        }
        else {
            return rule;
        }
    }
    function replaceFortifiedLookup(rule) {
        if (rule._) {
            var lookup = lookupRules[rule._];
            delete rule._;
            return Object.assign({}, lookup, rule);
        }
        else {
            return rule;
        }
    }
    function replaceKnownKeysInString(object, string) {
        return Object.keys(object).reduce(function (str, key) {
            if (typeof object[key] !== 'object') {
                return str.replace("{{" + key + "}}", object[key]);
            }
            else {
                return str;
            }
        }, string);
    }
    function replaceKnownKeysInObject(object) {
        return function (rule) {
            return Object.keys(rule).reduce(function (obj, k) {
                var v = obj[k];
                if (typeof v === 'string') {
                    obj[k] = replaceKnownKeysInString(object, v);
                }
                return obj;
            }, rule);
        };
    }
    function actionFunction(domain, action) {
        return function (rule) {
            return function (message) {
                if (!(message.domain === domain && action(message.action))) {
                    return false;
                }
            };
        };
    }
    Object.keys(rules).forEach(function (domainName) {
        var domain = rules[domainName];
        Object.keys(domain).forEach(function (actionName) {
            var actionFn;
            if (actionName.startsWith('/') && actionName.endsWith('/')) {
                var r_1 = new RegExp(actionName);
                actionFn = function (str) { return Boolean(r_1.test(str)); };
            }
            else {
                actionFn = function (str) { return str === actionName; };
            }
            var actionRules = domain[actionName]
                .map(replaceSimpleLookup)
                .map(replaceFortifiedLookup)
                .map(replaceKnownKeysInObject({ domain: domainName }))
                .map(actionFunction(domainName, actionFn));
        });
    });
}
