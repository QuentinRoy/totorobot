/**
 * How `inputs:` / `states:` stay optional without the type surface collapsing.
 *
 * P1.4 requires that a JavaScript caller — `machine({ initial, transitions })` —
 * and a TypeScript caller with partial types both get a usable interface,
 * narrowing to what `transitions` itself says rather than collapsing. That does
 * not fall out for free: a first attempt had the state vocabulary **reverse-
 * inferred from `initial`** (`initial: 'whatever'` produced `{ whatever: any }`),
 * after which the only legal state was that bogus one, every real key was
 * rejected, and the error moved off the offending line onto the whole
 * `transitions` block — failing P1.4 and P1.2 at once.
 *
 * An omitted half now defaults to `StatesFromKeys<K>` / `InputsFromKeys<K>`:
 * every name `transitions` itself mentions, each mapped to `unknown` — the
 * *names* narrow to what the table says instead of widening to `string`, but
 * the *data* each one carries stays `unknown`, since nothing declares it one
 * way or the other. A name the table never mentions — in a row, or in
 * `initial` — is rejected.
 *
 * Three things make that safe rather than a repeat of the `initial` cliff:
 *
 *  1. **Constrained defaults that read a sibling, not the argument itself.**
 *     `K` — the table's own keys — is inferred first, from `transitions`, and
 *     `I`/`S` default to `InputsFromKeys<K>`/`StatesFromKeys<K>` only when
 *     `inputs`/`states` are omitted. Nothing reverse-infers from a single field
 *     the way the rejected `initial` attempt did.
 *  2. **`NoInfer` on `initial`.** `keyof NoInfer<S> & string` keeps `initial`
 *     itself from ever being a vocabulary inference site, so a bogus `initial`
 *     is rejected on its own line and the rest of the table stays fully typed
 *     — unlike the cliff, where one bad field poisoned everything downstream.
 *  3. **A bad key poisons its own value type** rather than being reported
 *     through an intersected missing property, which is an object-level error
 *     and would report at the table rather than at the row.
 *
 * These assertions are the tripwire: a TypeScript release that breaks any of the
 * above turns this file red. They are written against the public surface like
 * every other test here — the techniques are described so the failure is
 * diagnosable, not so they can be asserted directly.
 */

import { expect, expectTypeOf, test } from 'vitest'

import { machine, types, type Handled } from 'totorobot'

test('a well-formed table compiles with no vocabulary declared', () => {
	const untyped = machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				// `not.toBeAny()` is load-bearing: `toEqualTypeOf<unknown>()` alone
				// passes against `any` too, which is exactly the historical "any
				// leak" this design must not repeat.
				expectTypeOf(data).not.toBeAny()
				expectTypeOf(data).toEqualTypeOf<unknown>()
				expectTypeOf(input).not.toBeAny()
				expectTypeOf(input).toEqualTypeOf<unknown>()
			},
		},
	})

	const host = untyped.start()
	expectTypeOf(host.current.state).toEqualTypeOf<'off' | 'on'>()
	expectTypeOf(host.current.data).not.toBeAny()
	expectTypeOf(host.current.data).toEqualTypeOf<unknown>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'toggle'>()
})

test('initial must be a state transitions mentions when no states are declared', () => {
	// Legal: 'draft' is mentioned as a target, even though no row starts there.
	machine({
		initial: 'draft',
		transitions: {
			'off -toggle> on': () => {},
			'on -open> draft': () => {},
		},
	})

	machine({
		// @ts-expect-error - 'bogus' names no state in the table
		initial: 'bogus',
		// The rows stay legal and stay checked: were `initial` an inference
		// site, 'bogus' would become the only known state and every other row
		// would be rejected instead — with the error moving off `initial` and
		// onto the whole table. 'nope' below is legal here for a different
		// reason than in the declared-vocabulary test further down: with no
		// external vocabulary, a name is a state precisely because some row
		// mentions it, so there is nothing left for 'nope' to violate.
		transitions: {
			'off -toggle> on': () => {},
			'nope -toggle> on': () => {},
		},
	})
})

test('initial is checked against the declared states and never infers them', () => {
	type States = { off: void; on: void }

	machine({
		initial: 'off',
		states: types<States>(),
		transitions: {
			'off -toggle> on': () => {},
		},
	})

	machine({
		// @ts-expect-error - 'bogus' is not a declared state
		initial: 'bogus',
		states: types<States>(),
		// The rows stay legal and stay checked: were `initial` an inference
		// site, 'bogus' would become the only known state and this row would
		// be rejected instead — with the error moving off `initial` and onto
		// the whole table.
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - 'nope' is not a declared state
			'nope -toggle> on': () => {},
		},
	})
})

test('a malformed key is rejected with no vocabulary declared', () => {
	// It throws at runtime too (#16), so the call is asserted to throw rather
	// than left to run to completion.
	expect(() =>
		machine({
			initial: 'off',
			transitions: {
				'off -toggle> on': () => {},
				// @ts-expect-error - no space before '-'
				'on-toggle> off': () => {},
			},
		}),
	).toThrow(SyntaxError)
})

test('a bare key naming a state is rejected with no vocabulary declared', () => {
	// It throws at runtime too (#16), so the call is asserted to throw rather
	// than left to run to completion.
	expect(() =>
		machine({
			initial: 'off',
			transitions: {
				'off -toggle> on': () => {},
				// @ts-expect-error - a bare key names a state, not an edge
				on: () => {},
			},
		}),
	).toThrow(SyntaxError)
})

test('a state reachable only as a target is still inferred, in a table larger than one edge', () => {
	// `published` never appears in a `from` position — `StatesFromKeys` has to
	// pick it up from `To<K>` alone, not just `From<K>`, or a terminal state
	// would silently disappear from the inferred vocabulary.
	const flow = machine({
		initial: 'empty',
		transitions: {
			'empty -open> draft': () => {},
			'draft -revise> draft': () => {}, // self-transition
			'draft -cancel> empty': () => {},
			'draft -submit> review': () => {},
			'review -approve> published': () => {},
		},
	})

	const host = flow.start()
	expectTypeOf(host.current.state).toEqualTypeOf<
		'empty' | 'draft' | 'review' | 'published'
	>()
	expectTypeOf(host.send)
		.parameter(0)
		.toEqualTypeOf<'open' | 'revise' | 'cancel' | 'submit' | 'approve'>()
	// published is terminal: no row starts there, so it has nothing to send.
	expectTypeOf<Handled<typeof flow, 'published'>>().toEqualTypeOf<never>()
})

test('a malformed key does not leak a name into the inferred vocabulary, in a bigger table', () => {
	const build = () =>
		machine({
			initial: 'off',
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
				// @ts-expect-error - no space before '-'
				'on-bogus> nowhere': () => {},
			},
		})

	// It throws at runtime too (#16), so `build` is never actually called —
	// its inferred *type* is checked instead, which is what this test is
	// really about.
	expect(build).toThrow(SyntaxError)

	// 'nowhere' must not have leaked into the state union alongside the row's
	// own rejection — this is the "one bad row poisons the whole table" cliff,
	// checked against a mixed table rather than a single-row one.
	type Host = ReturnType<ReturnType<typeof build>['start']>
	expectTypeOf<Host['current']['state']>().toEqualTypeOf<'off' | 'on'>()
})

test('start() takes an optional, unknown payload for an inferred initial state', () => {
	const untyped = machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': () => {},
		},
	})

	// 'off' has no declared data, so it widens to `unknown` rather than being
	// assumed data-free — both an omitted and a present payload are legal.
	untyped.start()
	untyped.start({ anything: true })
})

test('an immediate row is legal with no vocabulary declared, and contributes no input name', () => {
	const untyped = machine({
		initial: 'draft',
		transitions: {
			'draft -submit> checking': () => ({ via: 'submit' }),
			'checking -> settled': ({ input }) => {
				expectTypeOf(input).not.toBeAny()
				expectTypeOf(input).toEqualTypeOf<undefined>()
				return { via: 'immediate' }
			},
		},
	})

	const host = untyped.start()
	expectTypeOf(host.current.state).toEqualTypeOf<
		'draft' | 'checking' | 'settled'
	>()
	// the immediate row must not leak '' into the inferred input vocabulary
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'submit'>()
})

test('declaring inputs and omitting states checks inputs and infers states from the table', () => {
	type Inputs = { toggle: void }

	const half = machine({
		initial: 'off',
		inputs: types<Inputs>(),
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				// The declared half is checked; the omitted half is read off the table,
				// with unknown (not `any` — see `not.toBeAny()` above) data since
				// nothing declares what it is.
				expectTypeOf(input).toEqualTypeOf<undefined>()
				expectTypeOf(data).not.toBeAny()
				expectTypeOf(data).toEqualTypeOf<unknown>()
			},
			// @ts-expect-error - 'bogus' is not a declared input
			'off -bogus> on': () => {},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<'off' | 'on'>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'toggle'>()
})

test('declaring states and omitting inputs checks states and infers inputs from the table', () => {
	type States = { off: void; on: void }

	const half = machine({
		initial: 'off',
		states: types<States>(),
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				// The declared half is checked; the omitted half is read off the table,
				// with unknown (not `any`) data since nothing declares what it is.
				expectTypeOf(data).toEqualTypeOf<undefined>()
				expectTypeOf(input).not.toBeAny()
				expectTypeOf(input).toEqualTypeOf<unknown>()
			},
			// @ts-expect-error - 'bogus' is not a declared state
			'bogus -toggle> on': () => {},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<'off' | 'on'>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'toggle'>()
})

test('`*` in a key position is rejected rather than joining the inferred vocabulary (#22)', () => {
	// Every row here parses fine at runtime — `*` is a well-formed name to the
	// grammar `parse` enforces — so nothing throws. The rejection is entirely
	// the type layer's: `*` never joins `StatesFromKeys`/`InputsFromKeys`, so
	// `Key` never matches these rows and `Table` poisons each on its own line.
	machine({
		initial: 'off',
		transitions: {
			// @ts-expect-error - '*' is the wildcard, not an inferable state name
			'* -go> on': () => {},
			// @ts-expect-error - '*' is the wildcard, not an inferable state name
			'on -back> *': () => {},
			// @ts-expect-error - '*' is the wildcard, not an inferable input name
			'off -*> on': () => {},
		},
	})
})

test('`initial: "*"` is rejected once `*` is excluded from the inferred states (#22)', () => {
	machine({
		// @ts-expect-error - '*' never joins the inferred state vocabulary, even
		// though it is mentioned in a row — that row is itself rejected below
		initial: '*',
		transitions: {
			'off -go> on': () => {},
			// @ts-expect-error - '*' is the wildcard, not an inferable state name
			'* -back> off': () => {},
		},
	})
})

test('a name padded by a leading or trailing space is rejected rather than joining the inferred vocabulary (#22)', () => {
	// Each of these parses to a well-formed, if oddly spelled, key at runtime —
	// #16's grammar check only rejects a spelling that collides with ` -`/`> `,
	// and a padded name does not. The rejection here is the type layer's alone.
	machine({
		initial: 'off',
		transitions: {
			'off -go> on': () => {},
			// @ts-expect-error - the doubled space puts a leading space into ' on'
			'on -go>  on': () => {},
			// @ts-expect-error - the trailing space names 'on ', not 'on'
			'on -go> on ': () => {},
			// @ts-expect-error - the space after '-' names input ' go', not 'go'
			'on - go> off': () => {},
		},
	})
})

test('passing the marker explicitly as undefined behaves as omitting the property does', () => {
	// `exactOptionalPropertyTypes` makes a bare `inputs: undefined` a
	// different call from leaving `inputs` out — both are legal writes of
	// `types()`'s return value, and both must infer the same fallback.
	const half = machine({
		initial: 'off',
		inputs: undefined,
		states: undefined,
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				expectTypeOf(data).not.toBeAny()
				expectTypeOf(data).toEqualTypeOf<unknown>()
				expectTypeOf(input).not.toBeAny()
				expectTypeOf(input).toEqualTypeOf<unknown>()
			},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<'off' | 'on'>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'toggle'>()
})
