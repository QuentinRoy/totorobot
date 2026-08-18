/**
 * The transition-key grammar: target checking, source reads, unknown names,
 * malformed spellings, the bare-key rule, and `skip()`.
 */

import { expect, expectTypeOf, test } from 'vitest'

import { machine, types } from 'totorobot'

type Inputs = {
	open: { text: string }
	revise: { text: string }
	cancel: void
}
type States = {
	empty: void
	draft: { text: string; revision: number }
}

type SkipInputs = { revise: { text: string }; cancel: void }
type SkipStates = { draft: { text: string }; empty: void }

test('a handler returning the wrong shape for its target state is rejected', () => {
	machine({
		initial: 'empty',
		inputs: types<Inputs>(),
		states: types<States>(),
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
		inputs: types<Inputs>(),
		states: types<States>(),
		transitions: {
			'empty -open> draft': ({ data, input }) => ({
				text: input.text,
				// @ts-expect-error - empty's data is void; there is no `.revision` to read
				revision: data.revision,
			}),
			'draft -revise> draft': ({ data, input }) => ({
				text: input.text,
				revision: data.revision + 1,
			}),
			'draft -cancel> empty': () => {},
		},
	})
})

test('unknown state or input names in a transition key are rejected', () => {
	machine({
		initial: 'empty',
		inputs: types<Inputs>(),
		states: types<States>(),
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
			inputs: types<Inputs>(),
			states: types<States>(),
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
		inputs: types<Inputs>(),
		states: types<States>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			'draft -> draft': ({ data }) => data,
		},
	})
})

test("an immediate row's handler receives no input, and a wrong-shaped return is still rejected", () => {
	machine({
		initial: 'empty',
		inputs: types<Inputs>(),
		states: types<States>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({
				text: input.text,
				revision: 0,
			}),
			'draft -cancel> empty': () => {},
			'empty -> draft': ({ data, input }) => {
				// @ts-expect-error - empty's data is void; there is no `.anything` to read
				data.anything
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
			inputs: types<Inputs>(),
			states: types<States>(),
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

test('skip() is returnable from a handler for every target shape, including a void target', () => {
	machine({
		initial: 'draft',
		inputs: types<SkipInputs>(),
		states: types<SkipStates>(),
		transitions: {
			'draft -revise> draft': ({ data, input, skip }) =>
				input.text === data.text ? skip() : { text: input.text },
			'draft -cancel> empty': ({ skip }) =>
				Math.random() > 0.5 ? skip() : undefined,
		},
	})
})

test('a wrong-shaped return is still rejected on a row that could also skip()', () => {
	machine({
		initial: 'draft',
		inputs: types<SkipInputs>(),
		states: types<SkipStates>(),
		transitions: {
			'draft -revise> draft': ({ data, input, skip }) =>
				// @ts-expect-error - draft's data needs `text`; the skip() channel does not excuse a wrong shape
				input.text === data.text ? skip() : { wrong: true },
			'draft -cancel> empty': ({ skip }) =>
				// @ts-expect-error - empty is void; a handler may return skip() or nothing, not data
				Math.random() > 0.5 ? skip() : { text: 'x' },
		},
	})
})
