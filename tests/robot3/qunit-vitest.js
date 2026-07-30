import { describe, expect, test } from 'vitest';

let currentModule;

function assertions() {
  return {
    deepEqual(actual, expected, message) {
      expect(actual, message).toEqual(expected);
    },
    equal(actual, expected, message) {
      expect(actual == expected, message).toBe(true);
    },
    expect(count) {
      expect.assertions(count);
    },
    notEqual(actual, expected, message) {
      expect(actual != expected, message).toBe(true);
    },
    notOk(value, message) {
      expect(value, message).toBeFalsy();
    },
    ok(value, message) {
      expect(value, message).toBeTruthy();
    }
  };
}

globalThis.QUnit = {
  module(name, callback) {
    if (callback) {
      describe(name, () => {
        const previousModule = currentModule;
        currentModule = undefined;
        callback({});
        currentModule = previousModule;
      });
    } else {
      currentModule = name;
    }
  },
  test(name, callback) {
    const testName = currentModule ? `${currentModule}: ${name}` : name;
    test(testName, () => callback(assertions()));
  }
};
