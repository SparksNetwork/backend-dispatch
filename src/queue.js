"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var FirebaseQueue = require('firebase-queue');
var ramda_1 = require('ramda');
var metrics_1 = require('./metrics');
var test_1 = require("./test/test");
var log_1 = require("./log");
/**
 * If the given argument is an object with a single property called 'key'
 * then unwrap it and return the value of the property. Otherwise return the
 * object.
 *
 * @type {U}
 */
var objectOrKey = ramda_1.when(ramda_1.compose(ramda_1.equals(['key']), ramda_1.keys), ramda_1.prop('key'));
/**
 * Given a domain, event and a payload that represents the response from
 * calling a seneca action, build a suitable response to send back to the queue.
 *
 * @returns {{domain: any, event: any, payload: (any|boolean)}}
 */
function buildResponse(domain, event, payload) {
    return { domain: domain, event: event, payload: payload || false };
}
/**
 * Given the queue dispatch payload generate a seneca pattern where domain
 * becomes role, action becomes cmd, and payload is merged.
 * @returns {{role: any, cmd: any, uid: any}&T2}
 */
function buildPattern(_a) {
    var domain = _a.domain, action = _a.action, uid = _a.uid, payload = _a.payload;
    return ramda_1.merge({
        role: domain,
        cmd: action,
        uid: uid,
    }, payload);
}
/**
 * Given a seneca pattern create a seneca auth pattern using our auth role
 */
function buildAuthPattern(pattern) {
    return ramda_1.merge(pattern, {
        role: 'Auth',
        model: pattern.role,
    });
}
/**
 * Wrap a call to seneca.act in a try/catch. If an error is thrown return
 * the error message as the response in the form {error}
 *
 * @param seneca
 * @param pattern
 * @returns {SenecaResponse}
 */
function tryAct(seneca, pattern) {
    return __awaiter(this, void 0, Promise, function* () {
        try {
            var response = yield seneca.act(pattern);
            return ramda_1.type(response) === 'Object' ? response : { response: response };
        }
        catch (error) {
            return { error: error };
        }
    });
}
/**
 * Given a seneca pattern call an Auth action for the pattern
 *
 * @param seneca
 * @param pattern
 * @returns {{reject: any}|SenecaResponse}
 */
function authenticatePattern(seneca, pattern) {
    return __awaiter(this, void 0, Promise, function* () {
        var response = yield tryAct(seneca, buildAuthPattern(pattern));
        return response.error ? { reject: response.error } : response;
    });
}
/**
 * Given a seneca instance and pattern, first call an Auth action for the
 * pattern. If that returns reject then return, otherwise carry on and call
 * the original pattern
 *
 * @param seneca
 * @param pattern
 * @returns {any}
 */
function actAuthenticated(seneca, pattern) {
    return __awaiter(this, void 0, Promise, function* () {
        log_1.debug('authenticating', pattern);
        var auth = yield authenticatePattern(seneca, pattern);
        if (auth.reject) {
            return { reject: auth.reject };
        }
        log_1.debug('executing', pattern);
        var combinedPattern = ramda_1.merge(pattern, auth);
        return yield tryAct(seneca, combinedPattern);
    });
}
/**
 * Generate an async function that executes the queue payload data as a
 * seneca action.
 *
 * @param seneca
 * @returns {({domain, action, uid, payload}:{domain: any, action: any, uid: any, payload: any})=>Promise<SenecaResponse>}
 */
function createHandler(seneca) {
    return function handle(_a) {
        return __awaiter(this, void 0, Promise, function* () {
            var domain = _a.domain, action = _a.action, uid = _a.uid, payload = _a.payload;
            var pattern = buildPattern({ domain: domain, action: action, uid: uid, payload: payload });
            var taskResponse = yield actAuthenticated(seneca, pattern);
            if (taskResponse.error || taskResponse.reject) {
                log_1.error('queue error', pattern, taskResponse);
            }
            return taskResponse;
        });
    };
}
test_1.test(__filename, 'createHandler', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        var spy = require('sinon').spy;
        var data = {
            domain: 'test', action: 'createHandlerTest', uid: 'abc123',
            payload: { some: 'data' }
        };
        var actSpy = spy(function () { return ({ pass: 'on' }); });
        var seneca = { act: actSpy };
        var handler = createHandler(seneca);
        var response = yield handler(data);
        t.ok(response);
        t.equals(actSpy.callCount, 2);
        t.deepEqual(actSpy.getCall(0).args, [{
                model: 'test',
                cmd: 'createHandlerTest',
                role: 'Auth',
                some: 'data',
                uid: 'abc123',
            }]);
        t.deepEqual(actSpy.getCall(1).args, [{
                role: 'test',
                cmd: 'createHandlerTest',
                some: 'data',
                pass: 'on',
                uid: 'abc123',
            }]);
        t.deepEquals(response, { pass: 'on' });
    });
});
function createRecorder(ref, tag) {
    return function record(data) {
        return __awaiter(this, void 0, void 0, function* () {
            metrics_1.pushMetric(ref, tag);
            return data;
        });
    };
}
test_1.test(__filename, 'createRecorder', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        var spy = require('sinon').spy;
        var data = { some: 'data' };
        var timestamp = Date.now();
        var ref = {};
        var pushSpy = spy();
        ref.push = pushSpy;
        var recorder = createRecorder(ref, 'my tag');
        var response = yield recorder(data);
        var pushArgs = pushSpy.getCall(0).args[0];
        t.equals(response, data);
        t.equals(pushSpy.callCount, 1);
        t.equals(pushArgs.tag, 'my tag');
        t.ok(pushArgs.timestamp >= timestamp);
    });
});
/**
 * Generate a function that generates an async function that writes the payload
 * response data back into firebase.
 *
 * @param ref
 * @returns {({domain, action, uid}:{domain: any, action: any, uid: any})=>
 *   (response:SenecaResponse)=>Promise<SenecaResponse>}
 */
function createResponder(ref) {
    return function (data) {
        return function (response) {
            return __awaiter(this, void 0, Promise, function* () {
                var _id = data._id, domain = data.domain, action = data.action, uid = data.uid;
                var responsePayload = buildResponse(domain, action, objectOrKey(response));
                yield ref.child(uid).child(_id).set(responsePayload);
                return response;
            });
        };
    };
}
test_1.test(__filename, 'createResponder', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        var spy = require('sinon').spy;
        var data = { domain: 'test', action: 'createResponderTest', uid: 'abc123', _id: '123abc' };
        var ref = {};
        var childSpy = spy(function () { return ref; });
        var setSpy = spy();
        ref.child = childSpy;
        ref.set = setSpy;
        var responder = createResponder(ref);
        var respond = responder(data);
        var response = yield respond({ some: 'data' });
        t.ok(response);
        t.equals(childSpy.callCount, 2);
        t.deepEquals(childSpy.getCall(0).args, ['abc123']);
        t.deepEquals(childSpy.getCall(1).args, ['123abc']);
        t.equals(setSpy.callCount, 1);
        t.deepEquals(setSpy.getCall(0).args, [{
                domain: 'test',
                event: 'createResponderTest',
                payload: { some: 'data' }
            }]);
    });
});
/**
 * Process the firebase queue and turn messages there into seneca tasks.
 */
function startDispatch(ref, seneca) {
    var responsesRef = ref.child('responses');
    var metricsRef = ref.child('metrics');
    var handle = createHandler(seneca);
    var responder = createResponder(responsesRef);
    var recordIncoming = createRecorder(metricsRef, 'queue-incoming');
    var recordResponse = createRecorder(metricsRef, 'queue-response');
    var recordError = createRecorder(metricsRef, 'queue-error');
    return new FirebaseQueue(ref, { sanitize: false }, function (data, progress, resolve, reject) {
        recordIncoming(data)
            .catch(ramda_1.identity)
            .then(handle)
            .then(responder(data))
            .then(recordResponse)
            .then(resolve)
            .catch(function (err) {
            return recordError({ error: err.toString() })
                .then(function (err) { return log_1.error(err) || err; })
                .then(function () { return reject(err); });
        });
    });
}
exports.startDispatch = startDispatch;
