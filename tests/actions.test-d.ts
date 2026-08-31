/**
 * The `actions` block: trigger checking against the declared vocabulary, bag
 * narrowing per trigger, and the teardown/`void` type-layer guardrails from §9.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs = { type: 'toggle' } | { type: 'go' }
type States = { name: 'off' } | { name: 'on'; count: number } | { name: 'gone' }

test("a residency trigger's arrival narrows `to` to that trigger's own state, tag included, whichever way the state was entered", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			on: ({ to }) => {
				expectTypeOf(to).toEqualTypeOf<{ name: 'on'; count: number }>()
			},
		},
	})
})

test("a residency trigger's `from` covers every state that can reach it, plus `undefined` for the initial arrival no transition caused", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			on: ({ from }) => {
				expectTypeOf(from).toEqualTypeOf<States | undefined>()
			},
		},
	})
})

test('a residency action reading `from` without narrowing away the initial arrival is a compile error', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			on: ({ from }) => {
				// @ts-expect-error - `from` is `undefined` on the initial arrival
				from.name
			},
		},
	})
})

test("an edge trigger's argument narrows the transition exactly the way a listener's pattern narrows its record — same type, not a second bag around it", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			'off -toggle> on': (transition) => {
				expectTypeOf(transition.from).toEqualTypeOf<{ name: 'off' }>()
				expectTypeOf(transition.to).toEqualTypeOf<{
					name: 'on'
					count: number
				}>()
				expectTypeOf(transition.input).toEqualTypeOf<{ type: 'toggle' }>()
				expectTypeOf(transition.send).toEqualTypeOf<(input: Inputs) => void>()
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

test('an undeclared trigger is still rejected, and a malformed key still reports on its own row, when the value is a record or an array', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - "nope" is not a declared state
			nope: { run: () => {} },
			// @ts-expect-error - "nope" is not a declared state
			alsoNope: [() => {}],
			// @ts-expect-error - a space after "-", before the input name
			'off - toggle> on': [{ run: () => {} }],
			on: { run: () => {} }, // still checked on its own terms, unpoisoned by the row above
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
			on: ({ to }) => {
				to.count // no return statement at all: infers as `void`, not `undefined`
			},
			'off -toggle> on': ({ to }) => {
				to.count // no return statement at all: infers as `void`, not `undefined`
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

test('a residency or edge action may be a record with `run`, sugar for the bare function', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			on: { run: () => {} },
			'off -toggle> on': { run: () => {} },
		},
	})
})

test('a residency or edge action may be an array of bare functions and records', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			on: [() => {}, { run: () => {} }],
			'off -toggle> on': [() => {}, { run: () => {} }],
		},
	})
})

test('a residency record accepts `restart` as a boolean or a predicate over the narrowed state either side', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			on: { run: () => {}, restart: false },
			gone: {
				run: () => {},
				restart: (from, to) => {
					expectTypeOf(from).toEqualTypeOf<{ name: 'gone' }>()
					expectTypeOf(to).toEqualTypeOf<{ name: 'gone' }>()
					return true
				},
			},
		},
	})
})

test('`restart` on an edge trigger is a compile error, in the record and in the array', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// @ts-expect-error - `restart` has no meaning on an edge
			'off -toggle> on': { run: () => {}, restart: false },
			// @ts-expect-error - same, inside the array arm
			'off -> *': [{ run: () => {}, restart: false }],
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
