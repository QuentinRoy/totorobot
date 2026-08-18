/**
 * How `inputs:` / `states:` stay optional without the type surface collapsing.
 *
 * P1.4 requires that a JavaScript caller — `machine({ initial, transitions })` —
 * and a TypeScript caller with partial types both get a usable interface,
 * widening as information is lost rather than collapsing. That does not fall out
 * for free: a first attempt had the state vocabulary **reverse-inferred from
 * `initial`** (`initial: 'whatever'` produced `{ whatever: any }`), after which
 * the only legal state was that bogus one, every real key was rejected, and the
 * error moved off the offending line onto the whole `transitions` block —
 * failing P1.4 and P1.2 at once.
 *
 * Three things fix it, and the third removes machinery rather than adding it:
 *
 *  1. **Constrained defaults.** `S extends Vocab = Vocab`, where
 *     `Vocab = Record<string, unknown>`. Widening then falls out of the
 *     constraint — `keyof Vocab & string` is `string`, `Vocab[K]` is `unknown` —
 *     so no conditional is needed anywhere to express "no vocabulary declared".
 *  2. **`NoInfer` on `initial`.** `keyof NoInfer<S> & string` leaves `states:` as
 *     the only inference site, so the default applies when it is omitted.
 *     `NoInfer` alone is not enough: an earlier attempt wrapped it inside a
 *     conditional (`S extends Vocab ? keyof S & string : string`) and the
 *     reverse inference happened anyway. The constrained default is what makes
 *     the conditional unnecessary, and the plain position is what makes
 *     `NoInfer` bite.
 *  3. **A bad key poisons its own value type** rather than being reported
 *     through an intersected missing property, which is an object-level error
 *     and would report at the table rather than at the row.
 *
 * An overload per combination of declared maps was tried and is worse: it fixes
 * the inference, but every failure becomes `No overload matches this call` at the
 * call site, and the states-only combination does not resolve at all.
 *
 * These assertions are the tripwire: a TypeScript release that breaks any of the
 * above turns this file red. They are written against the public surface like
 * every other test here — the techniques are described so the failure is
 * diagnosable, not so they can be asserted directly.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, types } from '../src/totorobot.ts'

test('a well-formed table compiles with no vocabulary declared', () => {
	const untyped = machine({
		initial: 'anything',
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<unknown>()
				expectTypeOf(input).toEqualTypeOf<unknown>()
			},
		},
	})

	const host = untyped.start()
	expectTypeOf(host.current.state).toEqualTypeOf<string>()
	expectTypeOf(host.current.data).toEqualTypeOf<unknown>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<string>()
})

test('initial is open to any string when no states are declared', () => {
	// The names in the table are not a state vocabulary either: `initial` is
	// unconstrained here, and naming something the table never mentions is
	// still legal.
	machine({
		initial: 'a state nothing else mentions',
		transitions: {
			'off -toggle> on': () => {},
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
	machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - no space before '-'
			'on-toggle> off': () => {},
		},
	})
})

test('a bare key naming a state is rejected with no vocabulary declared', () => {
	machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - a bare key names a state, not an edge
			on: () => {},
		},
	})
})

test('declaring inputs and omitting states checks inputs and widens states', () => {
	type Inputs = { toggle: void }

	const half = machine({
		initial: 'anything',
		inputs: types<Inputs>(),
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				// The declared half is checked; the omitted half widens.
				expectTypeOf(input).toEqualTypeOf<undefined>()
				expectTypeOf(data).toEqualTypeOf<unknown>()
			},
			// @ts-expect-error - 'bogus' is not a declared input
			'off -bogus> on': () => {},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<string>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'toggle'>()
})

test('declaring states and omitting inputs checks states and widens inputs', () => {
	type States = { off: void; on: void }

	const half = machine({
		initial: 'off',
		states: types<States>(),
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				// The declared half is checked; the omitted half widens.
				expectTypeOf(data).toEqualTypeOf<undefined>()
				expectTypeOf(input).toEqualTypeOf<unknown>()
			},
			// @ts-expect-error - 'bogus' is not a declared state
			'bogus -toggle> on': () => {},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<'off' | 'on'>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<string>()
})
