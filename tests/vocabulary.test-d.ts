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

type Inputs =
	| { type: 'open'; text: string }
	| { type: 'revise'; text: string }
	| { type: 'cancel' }
type States =
	{ name: 'empty' } | { name: 'draft'; text: string; revision: number }

const doc = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -revise> draft': ({ state, input, skip }) =>
			input.text === state.text
				? skip()
				: { text: input.text, revision: state.revision + 1 },
		'draft -cancel> empty': () => {},
	},
})

const withData = machine({
	initial: 'draft',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'draft -revise> draft': ({ state, input, skip }) =>
			input.text === state.text
				? skip()
				: { text: input.text, revision: state.revision + 1 },
		'draft -cancel> draft': ({ state }) => ({ ...state }),
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

test('narrowing the tag narrows the state, with no nullable padding', () => {
	const current = read(doc.start().current)

	expectTypeOf(current).not.toBeAny()
	if (current.name === 'empty') {
		expectTypeOf(current).not.toBeAny()
		expectTypeOf(current).toEqualTypeOf<{ name: 'empty' }>()
	}
	if (current.name === 'draft') {
		expectTypeOf(current).not.toBeAny()
		expectTypeOf(current).toEqualTypeOf<{
			name: 'draft'
			text: string
			revision: number
		}>()
	}
})

test("a handler's state is the full source state, tag included, and its input is that input's payload, with no type annotations", () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ state, input }) => {
				expectTypeOf(state).toEqualTypeOf<{ name: 'empty' }>()
				expectTypeOf(input).toEqualTypeOf<{ type: 'open'; text: string }>()
				return { text: input.text, revision: 0 }
			},
			'draft -revise> draft': ({ state, input }) => {
				expectTypeOf(state).toEqualTypeOf<{
					name: 'draft'
					text: string
					revision: number
				}>()
				expectTypeOf(input).toEqualTypeOf<{ type: 'revise'; text: string }>()
				return { text: input.text, revision: state.revision + 1 }
			},
			'draft -cancel> empty': ({ state, input }) => {
				expectTypeOf(state).toEqualTypeOf<{
					name: 'draft'
					text: string
					revision: number
				}>()
				expectTypeOf(input).toEqualTypeOf<{ type: 'cancel' }>()
			},
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
})

test('send needs no extra fields for a payload-free input, and requires them otherwise', () => {
	const host = doc.start()

	host.send({ type: 'cancel' })
	// @ts-expect-error - cancel carries no extra payload
	host.send({ type: 'cancel', text: 'x' })

	host.send({ type: 'open', text: 'x' })
	// @ts-expect-error - open's input requires a payload
	host.send({ type: 'open' })
})

test('an input name outside the declared vocabulary is rejected at send', () => {
	const host = doc.start()

	// The runtime half of this — that such a call changes nothing rather
	// than throwing — is asserted from plain JavaScript in `untyped.test.js`,
	// where no cast is needed to reach it.
	// @ts-expect-error - 'bogus' is not a declared input name
	host.send({ type: 'bogus' })
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
