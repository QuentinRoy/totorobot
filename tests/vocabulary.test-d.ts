/**
 * Per-state narrowing, handler inference, `start`/`send` arity, and the
 * derived type helpers.
 */

import { expectTypeOf, test } from 'vitest'

import {
	machine,
	type,
	type Handled,
	type InputsOf,
	type Sources,
	type StatesOf,
} from 'totorobot'

type Inputs = {
	open: { text: string }
	revise: { text: string }
	cancel: undefined
}
type States = { empty: undefined; draft: { text: string; revision: number } }

const doc = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'empty -open> draft': ({ inputData }) => ({
			text: inputData.text,
			revision: 0,
		}),
		'draft -revise> draft': ({ fromData, inputData, skip }) =>
			inputData.text === fromData.text
				? skip()
				: { text: inputData.text, revision: fromData.revision + 1 },
		'draft -cancel> empty': () => {},
	},
})

const withData = machine({
	initial: 'draft',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'draft -revise> draft': ({ fromData, inputData, skip }) =>
			inputData.text === fromData.text
				? skip()
				: { text: inputData.text, revision: fromData.revision + 1 },
		'draft -cancel> draft': ({ fromData }) => fromData,
	},
})

/**
 * Passes a value through a generic parameter before it reaches
 * `expectTypeOf`, so the assertions below read the inferred type rather than
 * the expression itself. The parameter is generic on purpose: an
 * `any`-annotated one would widen every real type to `any` and could never
 * go green once the entry point lands.
 *
 * `read` does not by itself keep an assertion honest — while `machine` and
 * `type` are unresolved imports the value is `any`, and `toEqualTypeOf`
 * compares `any` against anything without complaint. Every assertion here is
 * therefore paired with `not.toBeAny()`, which is what actually holds these
 * tests red until the real types exist.
 */
function read<T>(value: T): T {
	return value
}

test('checking the name narrows the data beside it, with no nullable padding', () => {
	const current = read(doc.start().current)

	expectTypeOf(current).not.toBeAny()
	if (current.name === 'empty') {
		expectTypeOf(current).not.toBeAny()
		expectTypeOf(current.data).toEqualTypeOf<undefined>()
	}
	if (current.name === 'draft') {
		expectTypeOf(current).not.toBeAny()
		expectTypeOf(current.data).toEqualTypeOf<{
			text: string
			revision: number
		}>()
	}
})

test("a handler's names and payloads are the row's own, with no type annotations", () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ from, fromData, to, input, inputData }) => {
				expectTypeOf(from).toEqualTypeOf<'empty'>()
				expectTypeOf(fromData).toEqualTypeOf<undefined>()
				expectTypeOf(to).toEqualTypeOf<'draft'>()
				expectTypeOf(input).toEqualTypeOf<'open'>()
				expectTypeOf(inputData).toEqualTypeOf<{ text: string }>()
				return { text: inputData.text, revision: 0 }
			},
			'draft -revise> draft': ({ fromData, inputData }) => {
				expectTypeOf(fromData).toEqualTypeOf<{
					text: string
					revision: number
				}>()
				expectTypeOf(inputData).toEqualTypeOf<{ text: string }>()
				return { text: inputData.text, revision: fromData.revision + 1 }
			},
			'draft -cancel> empty': ({ fromData, inputData }) => {
				expectTypeOf(fromData).toEqualTypeOf<{
					text: string
					revision: number
				}>()
				expectTypeOf(inputData).toEqualTypeOf<undefined>()
			},
		},
	})
})

test('a handler returns the destination payload, and nothing else', () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			// @ts-expect-error - the destination carries no payload
			'draft -cancel> empty': () => ({ text: 'x' }),
			// @ts-expect-error - `revision` is missing from the destination payload
			'empty -open> draft': ({ inputData }) => ({ text: inputData.text }),
			// @ts-expect-error - a destination that carries data needs a return
			'draft -revise> draft': () => {},
		},
	})
})

test('start() takes no argument when the initial state carries no payload, and requires one otherwise', () => {
	doc.start()
	// @ts-expect-error - empty carries no payload; start() takes no argument
	doc.start({ text: 'x', revision: 0 })

	withData.start({ text: 'x', revision: 0 })
	// @ts-expect-error - draft's data is required; start() cannot be called with none
	withData.start()

	// The payload is the declared state's data, not `any`: nothing else here
	// reads this parameter, so an `any` in `Start` would go unnoticed.
	expectTypeOf(withData.start).parameter(0).not.toBeAny()
	expectTypeOf(withData.start)
		.parameter(0)
		.toEqualTypeOf<{ text: string; revision: number }>()
})

test('send needs no extra fields for a payload-free input, and requires them otherwise', () => {
	const host = doc.start()

	host.send('cancel')
	// @ts-expect-error - cancel carries no extra payload
	host.send('cancel', { text: 'x' })

	host.send('open', { text: 'x' })
	// @ts-expect-error - open's input requires a payload
	host.send('open')
})

test('an input name outside the declared vocabulary is rejected at send', () => {
	const host = doc.start()

	// The runtime half of this — that such a call changes nothing rather
	// than throwing — is asserted from plain JavaScript in `untyped.test.js`,
	// where no cast is needed to reach it.
	// @ts-expect-error - 'bogus' is not a declared input name
	host.send('bogus')
})

test('InputsOf, StatesOf, Handled and Sources resolve correctly over a machine type', () => {
	type M = typeof doc

	// These are pure type-level assertions, with no value to launder through
	// `read`. `toEqualTypeOf` compares `any` against anything without
	// complaint, so without the `toBeAny` guards this test would pass
	// vacuously while the entry point is unresolved — and would keep passing
	// against an `any` implementation, the failure mode the plan calls worse
	// than red.
	expectTypeOf<InputsOf<M>>().not.toBeAny()
	expectTypeOf<InputsOf<M>>().toEqualTypeOf<Inputs>()
	expectTypeOf<StatesOf<M>>().not.toBeAny()
	expectTypeOf<StatesOf<M>>().toEqualTypeOf<States>()
	expectTypeOf<Handled<M, 'empty'>>().not.toBeAny()
	expectTypeOf<Handled<M, 'empty'>>().toEqualTypeOf<'open'>()
	expectTypeOf<Handled<M, 'draft'>>().not.toBeAny()
	expectTypeOf<Handled<M, 'draft'>>().toEqualTypeOf<'revise' | 'cancel'>()
	expectTypeOf<Sources<M, 'draft'>>().not.toBeAny()
	expectTypeOf<Sources<M, 'draft'>>().toEqualTypeOf<'empty' | 'draft'>()
	expectTypeOf<Sources<M, 'empty'>>().not.toBeAny()
	expectTypeOf<Sources<M, 'empty'>>().toEqualTypeOf<'draft'>()
})

test('Handled excludes an immediate row; Sources includes an immediate source', () => {
	const withImmediate = machine({
		initial: 'draft',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'draft -cancel> empty': () => {},
			'empty -> draft': () => ({ text: '', revision: 0 }),
		},
	})

	type M = typeof withImmediate

	expectTypeOf<Handled<M, 'empty'>>().not.toBeAny()
	expectTypeOf<Handled<M, 'empty'>>().toEqualTypeOf<never>()
	expectTypeOf<Sources<M, 'draft'>>().not.toBeAny()
	expectTypeOf<Sources<M, 'draft'>>().toEqualTypeOf<'empty'>()
})

test('a wildcard-sourced row counts for `Handled`, and `Sources` expands it to every declared state rather than reporting `*` (#142)', () => {
	const nav = machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ inputData }) => ({
				text: inputData.text,
				revision: 0,
			}),
			'* -cancel> empty': () => {},
		},
	})

	type M = typeof nav

	// "cancel" reaches "empty" from every declared state, "empty" and "draft"
	// alike, through the one wildcard row — "cancel" is therefore something
	// "empty" itself handles too, beside its own "open".
	expectTypeOf<Handled<M, 'empty'>>().not.toBeAny()
	expectTypeOf<Handled<M, 'empty'>>().toEqualTypeOf<'open' | 'cancel'>()
	expectTypeOf<Handled<M, 'draft'>>().not.toBeAny()
	expectTypeOf<Handled<M, 'draft'>>().toEqualTypeOf<'cancel'>()

	// The reverse index never names the wildcard token itself.
	expectTypeOf<Sources<M, 'empty'>>().not.toBeAny()
	expectTypeOf<Sources<M, 'empty'>>().toEqualTypeOf<'empty' | 'draft'>()

	// A wildcard row reaches every *declared* state, not literally any string:
	// a name the machine never declares still resolves to `never`, the same
	// as it did with no wildcard row in the table at all.
	expectTypeOf<Handled<M, 'notAState'>>().toEqualTypeOf<never>()
})
