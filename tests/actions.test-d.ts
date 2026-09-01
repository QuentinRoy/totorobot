/**
 * The `actions` block: trigger checking against the declared vocabulary, bag
 * narrowing per trigger, and the teardown/`void` type-layer guardrails from §9.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs = { toggle: undefined; go: undefined }
type States = { off: undefined; on: { count: number }; gone: undefined }
type Send = (...args: ['toggle', undefined?] | ['go', undefined?]) => void

test("a residency trigger's arrival narrows `to` to that trigger's own state, and `toData` to what it carries, whichever way the state was entered", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			on: ({ to, toData }) => {
				expectTypeOf(to).toEqualTypeOf<'on'>()
				expectTypeOf(toData).toEqualTypeOf<{ count: number }>()
			},
		},
	})
})

test("a residency trigger's `from` covers only the states declared to reach it, plus `undefined` for the initial arrival no transition caused (#99)", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			// "gone" is declared but no row reaches "on": excluded from `from`,
			// unlike every name the table's own rows admit.
			on: ({ from, fromData }) => {
				expectTypeOf(from).toEqualTypeOf<'off' | undefined>()
				expectTypeOf(fromData).toEqualTypeOf<undefined>()
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
				from.length
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
				expectTypeOf(transition.from).toEqualTypeOf<'off'>()
				expectTypeOf(transition.fromData).toEqualTypeOf<undefined>()
				expectTypeOf(transition.to).toEqualTypeOf<'on'>()
				expectTypeOf(transition.toData).toEqualTypeOf<{ count: number }>()
				expectTypeOf(transition.input).toEqualTypeOf<'toggle'>()
				expectTypeOf(transition.inputData).toEqualTypeOf<undefined>()
				expectTypeOf(transition.send).toEqualTypeOf<Send>()
			},
		},
	})
})

test('an action and a listener for the same edge pattern narrow to the same facts and sending capability (#99)', () => {
	const doc = machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			'off -toggle> on': (transition) => {
				expectTypeOf(transition.from).toEqualTypeOf<'off'>()
				expectTypeOf(transition.fromData).toEqualTypeOf<undefined>()
				expectTypeOf(transition.to).toEqualTypeOf<'on'>()
				expectTypeOf(transition.toData).toEqualTypeOf<{ count: number }>()
				expectTypeOf(transition.send).toEqualTypeOf<Send>()
			},
		},
	})
	const host = doc.start()

	// Same pattern, same table: an observer narrows to the exact same fields —
	// not a second, independently-derived bag.
	host.observe('off -toggle> on', (transition) => {
		expectTypeOf(transition.from).toEqualTypeOf<'off'>()
		expectTypeOf(transition.fromData).toEqualTypeOf<undefined>()
		expectTypeOf(transition.to).toEqualTypeOf<'on'>()
		expectTypeOf(transition.toData).toEqualTypeOf<{ count: number }>()
		expectTypeOf(transition.send).toEqualTypeOf<Send>()
	})
})

test('a residency action and a residency observer for the same bare state share the same arrival-narrowed facts (#99)', () => {
	const doc = machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			on: ({ from, fromData, to, toData }) => {
				expectTypeOf(from).toEqualTypeOf<'off' | undefined>()
				expectTypeOf(fromData).toEqualTypeOf<undefined>()
				expectTypeOf(to).toEqualTypeOf<'on'>()
				expectTypeOf(toData).toEqualTypeOf<{ count: number }>()
			},
		},
	})
	const host = doc.start()

	// Same bare state, same table: `observe`'s residency form narrows to the
	// exact same arrival-capable facts as the declared action above.
	host.observe('on', ({ from, fromData, to, toData }) => {
		expectTypeOf(from).toEqualTypeOf<'off' | undefined>()
		expectTypeOf(fromData).toEqualTypeOf<undefined>()
		expectTypeOf(to).toEqualTypeOf<'on'>()
		expectTypeOf(toData).toEqualTypeOf<{ count: number }>()
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
			on: ({ toData }) => {
				toData.count // no return statement at all: infers as `void`, not `undefined`
			},
			'off -toggle> on': ({ toData }) => {
				toData.count // no return statement at all: infers as `void`, not `undefined`
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

test('a residency record accepts `restart` as a boolean or a predicate over the transition facts', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			// A self-transition is what `restart`'s facts describe (#99): without
			// one declared for "gone", the predicate below would take `never`.
			'gone -> gone': () => {},
		},
		actions: {
			on: { run: () => {}, restart: false },
			gone: {
				run: () => {},
				restart: ({ from, fromData, to, toData }) => {
					expectTypeOf(from).toEqualTypeOf<'gone'>()
					expectTypeOf(fromData).toEqualTypeOf<undefined>()
					expectTypeOf(to).toEqualTypeOf<'gone'>()
					expectTypeOf(toData).toEqualTypeOf<undefined>()
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

test('the block declares no vocabulary of its own: a definition with actions is the same type as one without', () => {
	const rows = {
		'off -toggle> on': () => ({ count: 0 }),
		'on -toggle> off': () => {},
	} as const

	const bare = machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: rows,
	})
	const withActions = machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: rows,
		actions: { on: () => {} },
	})

	expectTypeOf(withActions).toEqualTypeOf<typeof bare>()
	expectTypeOf(withActions.start().send).toEqualTypeOf<Send>()
})
