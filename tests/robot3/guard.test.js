import { defineMachine, interpret } from 'totorobot';
import { describe, expect, test } from 'vitest';

describe('Guards', () => {
  test('Can prevent changing states', () => {
    let canProceed = false;
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two', guard(() => canProceed))
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    // Preserve QUnit assert.equal's loose equality semantics.
    expect.soft(service.snapshot.state == 'one').toBe(true);
    canProceed = true;
    service.send({ type: 'ping' });
    // Preserve QUnit assert.equal's loose equality semantics.
    expect.soft(service.snapshot.state == 'two').toBe(true);
  });

  test('If there are multiple guards, any returning false prevents a transition', () => {
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two',
          guard(() => false),
          guard(() => true)
        )
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    // Preserve QUnit assert.equal's loose equality semantics.
    expect.soft(service.snapshot.state == 'one').toBe(true);
  });

  test('Guards are passed the event', () => {
    let machine = defineMachine().create('one', ({ guard, state, transition }) => ({
      one: state(
        transition('ping', 'two',
          guard((ctx, ev) => ev.canProceed)
        )
      ),
      two: state()
    }));
    let service = interpret(machine, {});
    service.send({ type: 'ping' });
    // Preserve QUnit assert.equal's loose equality semantics.
    expect.soft(service.snapshot.state == 'one', 'still in the initial state').toBe(true);
    service.send({ type: 'ping', canProceed: true });
    // Preserve QUnit assert.equal's loose equality semantics.
    expect.soft(service.snapshot.state == 'two', 'now moved').toBe(true);
  });
});
