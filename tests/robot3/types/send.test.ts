import {expect, expectTypeOf, test} from 'vitest';
import {
  type Service,
  createMachine,
  defineMachine,
  transition,
  state,
  invoke, interpret
} from 'totorobot';

test('send(event) is typed', () => {
  type Spec = {
    states: {
      one: {};
      two: {};
      three: {};
    };
    events: {
      'go-one': Record<never, never>;
      'go-two': Record<never, never>;
    };
  };
  const machine = defineMachine<Spec>().create('one', ({ state, transition }) => ({
    one: state(transition('go-two', 'two')),
    two: state(transition('go-one', 'one')),
    three: state()
  }));

  type Params = Parameters<Service<Spec, typeof machine.states>['send']>;
  type EventParam = Params[0];
  type StringParams = Extract<EventParam, string>;
  expectTypeOf<StringParams>().toEqualTypeOf<'go-one' | 'go-two'>();

  type ObjectParams = Extract<EventParam, { type: string; }>;
  expectTypeOf<ObjectParams['type']>().toEqualTypeOf<'go-one' | 'go-two'>();
});

test('types machine with multiple transitions from one state', () => {
  type Spec = {
    states: {
      one: {};
      two: {};
      three: {};
    };
    events: {
      'go-one': Record<never, never>;
      'go-two': Record<never, never>;
      'go-three': Record<never, never>;
    };
  };
  const machine = defineMachine<Spec>().create('one', ({ state, transition }) => ({
    one: state(transition('go-two', 'two'), transition('go-three', 'three')),
    two: state(transition('go-one', 'one')),
    three: state()
  }));

  type Params = Parameters<Service<Spec, typeof machine.states>['send']>;
  type EventParam = Params[0];
  type StringParams = Extract<EventParam, string>;
  expectTypeOf<StringParams>().toEqualTypeOf<'go-one' | 'go-two' | 'go-three'>();

  type ObjectParams = Extract<EventParam, { type: string; }>;
  expectTypeOf<ObjectParams['type']>().toEqualTypeOf<'go-one' | 'go-two' | 'go-three'>();
});


test('types nested machine', () => {
  const stopwalk = createMachine({
    walk: state(
      transition('startBlinking', 'blink'),
    ),
    blink: state(
      transition('finishBlinking', 'dontWalk'),
    ),
    dontWalk: state()
  });

  const stoplight = createMachine({
    green: state(
      transition('next', 'yellow')
    ),
    yellow: state(
      transition('next', 'red')
    ),
    red: invoke(stopwalk,
      transition('done', 'green')
    )
  });

  const s = interpret(stoplight, console.log);

  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.machine.current == 'green').toBe(true)
  s.send("next")
  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.machine.current == 'yellow').toBe(true)
  s.send("next")
  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.machine.current == 'red').toBe(true)
  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.child?.machine.current == 'walk').toBe(true)
  s.child?.send("startBlinking")
  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.child?.machine.current == 'blink').toBe(true)
  s.child?.send("finishBlinking")
  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.child == undefined).toBe(true)
  // Preserve QUnit assert.equal's loose equality semantics.
  expect.soft(s.machine.current == "green").toBe(true)

  type Params = Parameters<Service<typeof stoplight>['send']>;
  type EventParam = Params[0];
  type StringParams = Extract<EventParam, string>;
  expectTypeOf<StringParams>().toEqualTypeOf<'next' | 'startBlinking' | 'finishBlinking'>();

  type ObjectParams = Extract<EventParam, { type: string; }>;
  expectTypeOf<ObjectParams['type']>().toEqualTypeOf<'next' | 'startBlinking' | 'finishBlinking'>();
})
