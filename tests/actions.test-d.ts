/**
 * The `actions` block: trigger checking against the declared vocabulary, bag
 * narrowing per trigger, and the teardown/`void` type-layer guardrails from §9.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs = { type: 'toggle' } | { type: 'go' }
type States = { name: 'off' } | { name: 'on'; count: number } | { name: 'gone' }

test("a residency trigger's bag narrows state to that trigger's own state, tag included", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			on: ({ state }) => {
				expectTypeOf(state).toEqualTypeOf<{ name: 'on'; count: number }>()
			},
		},
	})
})

test("an edge trigger's bag narrows the transition the way a listener's pattern narrows its record", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			'off -toggle> on': ({ transition }) => {
				expectTypeOf(transition.from).toEqualTypeOf<{ name: 'off' }>()
				expectTypeOf(transition.to).toEqualTypeOf<{
					name: 'on'
					count: number
				}>()
				expectTypeOf(transition.input).toEqualTypeOf<{ type: 'toggle' }>()
			},
		},
	})
})

test('an undeclared state named by a bare trigger is rejected', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - "nope" is not a declared state
			nope: () => {},
		},
	})
})

test('an undeclared input in an edge trigger is rejected', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - "nope" is not a declared input
			'off -nope> on': () => {},
		},
	})
})

test('a malformed trigger key reports on its own row, and does not poison a well-formed neighbour', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - a space after "-", before the input name
			'off - toggle> on': () => {},
			on: () => {}, // still checked on its own terms, unpoisoned by the row above
		},
	})
})

test('a wildcard is legal in an edge trigger, as in observe patterns', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			'* -> on': () => {},
			'off -> *': () => {},
		},
	})
})

test('a residency action may return a teardown', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			on: () => () => {}, // the returned function is the teardown
		},
	})
})

test('a plain block body with nothing to tear down is accepted on both a residency and an edge trigger (I27)', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			on: ({ state }) => {
				state.count // no return statement at all: infers as `void`, not `undefined`
			},
			'off -toggle> on': ({ transition }) => {
				transition.to.count
			},
		},
	})
})

test('a wrong-shaped explicit return is rejected on both a residency and an edge trigger', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - a residency action returns `undefined | Teardown`, not a number
			on: () => 5,
			// @ts-expect-error - an edge action returns `undefined`, not a number
			'off -toggle> on': () => 5,
		},
	})
})

test('a returned teardown is rejected on an edge trigger, so moving a helper from a state key to an edge key cannot silently strand it', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - an edge action returns `undefined`; `void` would accept this, but a stranded teardown would compile
			'off -toggle> on': () => () => {},
		},
	})
})

test('an async body is rejected on both a residency and an edge trigger, since it returns a Promise rather than a teardown', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - an async body returns a `Promise`, not `undefined | Teardown`
			on: async () => {},
			// @ts-expect-error - an async body returns a `Promise`, not `undefined`
			'off -toggle> on': async () => {},
		},
	})
})
