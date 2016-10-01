import * as firebase from 'firebase';
import * as Inflection from 'inflection';
import * as BPromise from 'bluebird';
import {
  applySpec, complement, compose, filter, fromPairs, head, keys, lensPath, map,
  mapObjIndexed, objOf, prop, propEq, tail, type, values, view, toPairs, not,
  merge
} from 'ramda';
import {test} from './test';
import {Test} from 'tape-async';

type SpecValue = string | number | boolean | Array<string>

interface ByChildSpec {
  [propName:string]: SpecValue;
}

interface Spec {
  [propName:string]: SpecValue | ByChildSpec;
}

interface FulfilledSpec {
  [propName:string]: null | any;
}

interface FirebaseRecord {
  $key:string;
  [key:string]:any;
}

type PairObject<T> = {[name:string]:T}
type Pair<T> = [string, T]
/**
 * Given an object with a single property return a pair of property and value.
 * @type {(x0:PairObject<any>)=>Array<Array<any>>}
 */
const pair:<T>(object:PairObject<T>) => Pair<T> =
  compose<PairObject<any>, Array<Array<any>>, Pair<any>>(head, toPairs);

function getDependsOn(value) {
  const t = type(value);

  if (t === 'Object') {
    return getDependsOn(head(values(value)));
  }

  if (t === 'Array') {
    return head(value);
  }

  return null;
}
test(__filename, 'getDependsOn', async function(t:Test) {
  t.equal(getDependsOn('whatever'), null, 'strings return null');
  t.equal(getDependsOn([3,2,1]), 3, 'arrays return head');
  t.equal(getDependsOn({value: 'whatever'}), null, 'object returns value of first value');
  t.equal(getDependsOn({value: [4,5,6]}), 4, 'object array returns head');
  t.equal(getDependsOn({value: {value: {value: [6,7,8]}}}), 6, 'it goes deep');
});

function resolveDependentValue(value:any, record:Object) {
  if (type(value) === 'Object') {
    const bv = pair(value);
    return objOf(bv[0], resolveDependentValue(bv[1], record));
  }

  const lens = lensPath(tail<string>(value));
  return view(lens, record);
}

function snapshotValue(snapshot): FirebaseRecord {
  return Object.assign({$key: snapshot.key}, snapshot.val());
}

function objToRows(obj:any): FirebaseRecord[] {
  return obj && keys(obj).map(key => merge(obj[key], {$key: key})) || [];
}

function createPromise(spec) {
  const value = spec.value;
  if (not(value)) { return Promise.resolve(null); }

  const ref = firebase.database().ref()
    .child(spec.model);

  if (typeof value === 'string') {
    return ref.child(value).once('value').then(snapshotValue);
  } else {
    const child = keys(value)[0];
    const childValue = values(value)[0] as any;

    const query = ref.orderByChild(child)
      .equalTo(childValue);

    if (spec.isArray) {
      return query.once('value')
        .then(snapshotValue)
        .then(objToRows);
    } else {
      return query
        .limitToFirst(1)
        .once('value')
        .then(snapshotValue)
        .then(objToRows)
        .then(rows => rows[0]);
    }
  }
}

function createDependentPromises(spec, specs) {
  const dependentSpecs = compose(filter(propEq('dependsOn', spec.key)), values)(specs);

  dependentSpecs.forEach(ds => {
    ds.promise = spec.promise.then(r => {
      const value = resolveDependentValue(ds.value, r);
      return createPromise(merge(ds, {value}));
    });

    createDependentPromises(ds, specs);
  });
}

/**
 * Take a spec and return a bunch of things from the database. The spec is an
 * object where the key is the name of a model, i.e. project, and the value
 * is either a string with the project key OR a key/value pair with the key
 * being the field.
 *
 * If the key is plural then it will resolve an array, otherwise will resolve a
 * single item.
 *
 * @example
 *
 *    const stuff = getStuff(models)({
 *     profile: {uid: '123'},
 *     project: 'abc',
 *     opps: {projectKey: ['project', '$key']}
 *   })
 *    stuff.then(({profile, project, opps}) =>
 *      console.log('profile:', profile, 'project:', project, 'opps:', opps))
 *
 * @param stuff
 * @returns {Promise<FulfilledSpec>}
 */
export default function get(stuff:Spec):Promise<FulfilledSpec> {
  const specs = mapObjIndexed((value, key) => {
    const model = compose(
      Inflection.pluralize,
      Inflection.camelize
    )(key);

    const isArray = type(value) !== 'String' &&
      key === Inflection.pluralize(key);

    const dependsOn = getDependsOn(value);
    const isDeferred = Boolean(dependsOn);

    return {
      key,
      model,
      isArray,
      isDeferred,
      dependsOn,
      value,
    };
  })(stuff);

  const specsWithNoDependencies = compose(
    filter(complement(prop('dependsOn'))),
    values
  )(specs);

  specsWithNoDependencies.forEach(spec => {
    spec.promise = createPromise(spec);
    createDependentPromises(spec, specs);
  });

  const promises = compose(
    fromPairs,
    map(applySpec([prop('key'), prop('promise')])),
    filter(prop('promise')),
    values,
  )(specs);

  const promise = BPromise.props(promises);
  return Promise.resolve(promise) as Promise<FulfilledSpec>;
}

