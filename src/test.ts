import * as tape from 'tape-async';
import {Test} from "tape-async";

type TestFn = (t:Test) => Promise<any>
type TestFnOrObj = TestFn | {
  [key:string]:TestFn;
};

/**
 * @param filename should be set to __filename
 * @param name test name
 * @param fn test function
 */
export function test(filename:string, name:string, fn:TestFnOrObj):void {
  if (isMain(filename)) {
    if (typeof fn === 'function') {
      tape(name, fn);
    } else {
      const tests = Object.keys(fn);

      tests.forEach(test => {
        tape([name, test].join(" "), fn[test]);
      });
    }
  }
}

export function isTest() {
  return (process.env as any).NODE_ENV === 'test';
}

export function isMain(filename:string) {
  const mainModule = (process as any).mainModule;
  return mainModule.filename === filename;
}