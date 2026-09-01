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

test("a residency trigger's `from` covers only the states declared to reach it, plus `undefined` for the initial arrival no transition caused", () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			// Narrowed to the states this table's own rows declare reaching "off"
			// ("on" alone), not to every name `States` declares.
			off: ({ from, fromData }) => {
				expectTypeOf(from).toEqualTypeOf<'on' | undefined>()
				expectTypeOf(fromData).toEqualTypeOf<{ count: number } | undefined>()
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
			off: ({ from }) => {
				// @ts-expect-error - `from` is `undefined` on the initial arrival
				from.length
			},
		},
	})
})

test("a noninitial residency action shares observe's arrival-capable record type: `from` stays optional-`undefined` even though only a late `observe` registration can ever produce that member for a noninitial state — eligibility is checked at declaration (#100), not by narrowing what the callback describes", () => {
	const doc = machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			on: ({ from }) => {
				expectTypeOf(from).toEqualTypeOf<'off' | undefined>()
				// @ts-expect-error - `from` is `undefined` on the shared arrival member
				from.length
			},
		},
	})
	const host = doc.start()

	// `observe`'s residency form narrows to the exact same union.
	host.observe('on', ({ from }) => {
		expectTypeOf(from).toEqualTypeOf<'off' | undefined>()
		// @ts-expect-error - `from` is `undefined` on the synthetic arrival
		from.length
	})
})

test('a residency action naming a noninitial state with no incoming row is a compile-time registration error: neither a real transition nor the startup arrival can ever reach it (#100)', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States & { ghost: undefined }>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// "ghost" is declared, but no row reaches it and it is not `initial`.
			// @ts-expect-error - no row matches 'ghost'
			ghost: () => {},
		},
	})
})

test('a residency action declared on the initial state remains valid with no incoming row at all: the startup arrival alone makes it eligible (#100)', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		// Nothing transitions into "off"; only "on" is reached, and only by it.
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			off: ({ to, toData, send }) => {
				expectTypeOf(to).toEqualTypeOf<'off'>()
				expectTypeOf(toData).toEqualTypeOf<undefined>()
				expectTypeOf(send).not.toBeAny()
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

test('a residency action and a residency observer for the initial state share the same arrival-narrowed facts — the one bare state where both are reachable through `actions` (#99)', () => {
	const doc = machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'off -toggle> on': () => ({ count: 0 }),
			'on -toggle> off': () => {},
		},
		actions: {
			off: ({ from, fromData, to, toData }) => {
				expectTypeOf(from).toEqualTypeOf<'on' | undefined>()
				expectTypeOf(fromData).toEqualTypeOf<{ count: number } | undefined>()
				expectTypeOf(to).toEqualTypeOf<'off'>()
				expectTypeOf(toData).toEqualTypeOf<undefined>()
			},
		},
	})
	const host = doc.start()

	// Same bare state, same table: `observe`'s residency form narrows to the
	// exact same facts as the declared action above — reachable there too, by
	// registering while the host is already resident on "off".
	host.observe('off', ({ from, fromData, to, toData }) => {
		expectTypeOf(from).toEqualTypeOf<'on' | undefined>()
		expectTypeOf(fromData).toEqualTypeOf<{ count: number } | undefined>()
		expectTypeOf(to).toEqualTypeOf<'off'>()
		expectTypeOf(toData).toEqualTypeOf<undefined>()
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

test('an edge trigger naming only declared state/input names, but no declared row, is rejected (#100)', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// "gone", "toggle" and "off" are all declared, but no row pairs them.
			// @ts-expect-error - no row matches 'gone -toggle> off'
			'gone -toggle> off': () => {},
		},
	})
})

test('a broad edge trigger with no matching row is rejected the same way, wildcard source and wildcard target alike (#100)', () => {
	machine({
		initial: 'off',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: { 'off -toggle> on': () => ({ count: 0 }) },
		actions: {
			// "gone" has no outgoing row at all.
			// @ts-expect-error - no row matches 'gone -> *'
			'gone -> *': () => {},
			// no row uses "go", from any source.
			// @ts-expect-error - no row matches '* -go> gone'
			'* -go> gone': () => {},
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
