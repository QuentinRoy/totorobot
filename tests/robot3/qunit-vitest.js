import { describe, expect, test } from 'vitest';

let currentModule;

function assertions() {
  const failures = [];
  let assertionCount = 0;
  let expectedCount;

  function record(assertion) {
    assertionCount++;
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  }

  return {
    assert: {
      deepEqual(actual, expected, message) {
        record(() => expect(actual, message).toEqual(expected));
      },
      equal(actual, expected, message) {
        record(() => expect(actual == expected, message).toBe(true));
      },
      expect(count) {
        expectedCount = count;
      },
      notEqual(actual, expected, message) {
        record(() => expect(actual != expected, message).toBe(true));
      },
      notOk(value, message) {
        record(() => expect(value, message).toBeFalsy());
      },
      ok(value, message) {
        record(() => expect(value, message).toBeTruthy());
      }
    },
    verify() {
      if (expectedCount !== undefined && assertionCount !== expectedCount) {
        failures.push(
          new Error(`Expected ${expectedCount} assertions, but ${assertionCount} ran`)
        );
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) {
        throw new AggregateError(failures, `${failures.length} assertions failed`);
      }
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
    test(testName, async () => {
      const testAssertions = assertions();
      await callback(testAssertions.assert);
      testAssertions.verify();
    });
  }
};
