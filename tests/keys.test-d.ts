/**
 * The transition-key grammar: target checking, source reads, unknown names,
 * malformed spellings, the bare-key rule, and `skip()`.
 */

import { expect, expectTypeOf, test } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs =
	| { type: 'open'; text: string }
	| { type: 'revise'; text: string }
	| { type: 'cancel' }
type States =
	{ name: 'empty' } | { name: 'draft'; text: string; revision: number }

type SkipInputs = { type: 'revise'; text: string } | { type: 'cancel' }
type SkipStates = { name: 'draft'; text: string } | { name: 'empty' }

test('a handler returning the wrong shape for its target state is rejected', () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			// @ts-expect-error - draft's data needs a `revision`, not just `text`
			'draft -revise> draft': ({ input }) => ({ text: input.text }),
			'draft -cancel> empty': () => {},
		},
	})
})

test('reading source data the source state does not have is rejected', () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ state, input }) => ({
				text: input.text,
				// @ts-expect-error - empty carries no payload; there is no `.revision` to read
				revision: state.revision,
			}),
			'draft -revise> draft': ({ state, input }) => ({
				text: input.text,
				revision: state.revision + 1,
			}),
			'draft -cancel> empty': () => {},
		},
	})
})

test('unknown state or input names in a transition key are rejected', () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			// @ts-expect-error - "nope" is not a declared state
			'nope -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			'empty -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			// @ts-expect-error - "nope" is not a declared state
			'draft -cancel> nope': () => {},
			'draft -cancel> empty': () => {},
			// @ts-expect-error - "nope" is not a declared input
			'draft -nope> empty': () => {},
		},
	})
})

test('malformed key spellings are rejected, one per row', () => {
	// Every row here is malformed, so `machine()` also throws at runtime (#16)
	// on the first one it reaches — that is a property of the runtime check,
	// not of the type layer this test exercises, so the call is only asserted
	// to throw rather than left to run to completion.
	expect(() =>
		machine({
			initial: 'empty',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				// @ts-expect-error - no space before "-"
				'empty-open> draft': () => ({ text: '', revision: 0 }),
				// @ts-expect-error - two spaces before "-"
				'empty  -open> draft': () => ({ text: '', revision: 0 }),
				// @ts-expect-error - a space after "-", before the input name
				'empty - open> draft': () => ({ text: '', revision: 0 }),
				// @ts-expect-error - a space before ">", after the input name
				'empty -open > draft': () => ({ text: '', revision: 0 }),
				// @ts-expect-error - no space after ">"
				'empty -open>draft': () => ({ text: '', revision: 0 }),
				// @ts-expect-error - two spaces after ">"
				'empty -open>  draft': () => ({ text: '', revision: 0 }),
			},
		}),
	).toThrow(SyntaxError)
})

test('an unlabelled arrow is accepted as an immediate transition', () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			'draft -> draft': ({ state }) => ({ ...state }),
		},
	})
})

test("an immediate row's handler receives no input, and a wrong-shaped return is still rejected", () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			'draft -cancel> empty': () => {},
			'empty -> draft': ({ state, input }) => {
				// @ts-expect-error - empty carries no payload; there is no `.anything` to read
				state.anything
				expectTypeOf(input).toEqualTypeOf<undefined>()
				return { text: '', revision: 0 }
			},
			// @ts-expect-error - draft's data needs a `revision`, not just `text`
			'draft -> draft': () => ({ text: '' }),
		},
	})
})

test('a bare key names a state and is rejected in the transitions table', () => {
	// A bare key throws at runtime too (#16), so the call is asserted to throw
	// rather than left to run to completion.
	expect(() =>
		machine({
			initial: 'empty',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				'empty -open> draft': ({ input }) => ({
					text: input.text,
					revision: 0,
				}),
				// @ts-expect-error - a bare key names a state; every transitions row is an edge
				draft: () => ({ text: '', revision: 0 }),
			},
		}),
	).toThrow(SyntaxError)
})

test('skip() is returnable from a handler for every target shape, including a payload-free target', () => {
	machine({
		initial: 'draft',
		inputs: type<SkipInputs>(),
		states: type<SkipStates>(),
		transitions: {
			'draft -revise> draft': ({ state, input, skip }) =>
				input.text === state.text ? skip() : { text: input.text },
			'draft -cancel> empty': ({ skip }) =>
				Math.random() > 0.5 ? skip() : undefined,
		},
	})
})

test('a declared vocabulary may still name `*` or a padded name explicitly (#22)', () => {
	// The exclusion in `StatesFromKeys`/`InputsFromKeys` only narrows what an
	// *omitted* half infers from the table. A vocabulary declared through
	// `type<T>()` is a different inference site entirely, and declaring ' b'
	// or '*' by hand is deliberate in a way a doubled space in a key never is
	// — so neither is filtered here.
	type OddStates = { name: 'off' } | { name: '*' } | { name: ' padded' }
	type OddInputs = { type: 'go' }

	machine({
		initial: 'off',
		inputs: type<OddInputs>(),
		states: type<OddStates>(),
		transitions: {
			'off -go> *': () => {},
			'* -go>  padded': () => {},
		},
	})
})

test('a wrong-shaped return is still rejected on a row that could also skip()', () => {
	machine({
		initial: 'draft',
		inputs: type<SkipInputs>(),
		states: type<SkipStates>(),
		transitions: {
			'draft -revise> draft': ({ state, input, skip }) =>
				// @ts-expect-error - draft's data needs `text`; the skip() channel does not excuse a wrong shape
				input.text === state.text ? skip() : { wrong: true },
			'draft -cancel> empty': ({ skip }) =>
				// @ts-expect-error - empty carries no payload; a handler may return skip() or nothing, not data
				Math.random() > 0.5 ? skip() : { text: 'x' },
		},
	})
})
