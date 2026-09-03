/**
 * The transition-key grammar: target checking, source reads, unknown names,
 * malformed spellings, the bare-key rule, and `skip()`.
 */

import { expect, expectTypeOf, test } from 'vitest'

import { machine, type, type Skip } from 'totorobot'

type Inputs = {
	open: { text: string }
	revise: { text: string }
	cancel: undefined
}
type States = { empty: undefined; draft: { text: string; revision: number } }

type SkipInputs = { revise: { text: string }; cancel: undefined }
type SkipStates = { draft: { text: string }; empty: undefined }

type NavInputs = { up: undefined; move: undefined }
type NavStates = {
	startup: { stroke: number[] }
	expert: { stroke: number[] }
	novice: { stroke: number[] }
	idle: undefined
}

test('a handler returning the wrong shape for its target state is rejected', () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ inputData }) => ({
				text: inputData.text,
				revision: 0,
			}),
			// @ts-expect-error - draft's data needs a `revision`, not just `text`
			'draft -revise> draft': ({ inputData }) => ({ text: inputData.text }),
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
			'empty -open> draft': ({ fromData, inputData }) => ({
				text: inputData.text,
				// @ts-expect-error - empty carries no payload; there is no `.revision` to read
				revision: fromData.revision,
			}),
			'draft -revise> draft': ({ fromData, inputData }) => ({
				text: inputData.text,
				revision: fromData.revision + 1,
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
			'nope -open> draft': ({ inputData }) => ({
				text: inputData.text,
				revision: 0,
			}),
			'empty -open> draft': ({ inputData }) => ({
				text: inputData.text,
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
			'empty -open> draft': ({ inputData }) => ({
				text: inputData.text,
				revision: 0,
			}),
			'draft -> draft': ({ fromData }) => fromData,
		},
	})
})

test("an immediate row's handler receives no input, and a wrong-shaped return is still rejected", () => {
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': ({ inputData }) => ({
				text: inputData.text,
				revision: 0,
			}),
			'draft -cancel> empty': () => {},
			'empty -> draft': ({ fromData, inputData }) => {
				// @ts-expect-error - empty carries no payload; there is no `.anything` to read
				fromData.anything
				expectTypeOf(inputData).toEqualTypeOf<undefined>()
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
				'empty -open> draft': ({ inputData }) => ({
					text: inputData.text,
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
			'draft -revise> draft': ({ fromData, inputData, skip }) =>
				inputData.text === fromData.text ? skip() : { text: inputData.text },
			'draft -cancel> empty': ({ skip }) =>
				Math.random() > 0.5 ? skip() : undefined,
		},
	})

	// `Skip` is exported, so a caller names it directly.
	expectTypeOf<Skip>().not.toBeAny()
})

test('a declared vocabulary may not name `*` or a name carrying a space (#141)', () => {
	// Reversed from #22: back then, the exclusion in
	// `StatesFromKeys`/`InputsFromKeys` was read as narrowing only what an
	// *omitted* half infers from the table, leaving a hand-declared `'*'` or
	// padded name alone. #141 closes that gap too — the wildcard row #142
	// adds gives a declared `'*'` state a second, colliding meaning, so the
	// declared site now agrees with what inference already refused.
	machine({
		initial: 'off',
		inputs: type<{ go: undefined }>(),
		// @ts-expect-error - reserved state name: '*' is the pattern wildcard
		states: type<{ off: undefined; '*': undefined }>(),
		transitions: { 'off -go> off': () => {} },
	})

	machine({
		initial: 'off',
		inputs: type<{ go: undefined }>(),
		// @ts-expect-error - reserved state name: ' padded' contains a space
		states: type<{ off: undefined; ' padded': undefined }>(),
		transitions: { 'off -go> off': () => {} },
	})

	machine({
		initial: 'off',
		// @ts-expect-error - reserved input name: '*' is the pattern wildcard
		inputs: type<{ go: undefined; '*': undefined }>(),
		states: type<{ off: undefined }>(),
		transitions: { 'off -go> off': () => {} },
	})

	machine({
		initial: 'off',
		inputs: type<{ go: undefined }>(),
		states: type<{ off: undefined }>(),
		// @ts-expect-error - reserved output name: 'a b' contains a space
		outputs: type<{ 'a b': undefined }>(),
		transitions: { 'off -go> off': () => {} },
	})

	// A name that merely contains `*`, or one with no space anywhere, is
	// untouched.
	machine({
		initial: 'off',
		inputs: type<{ go: undefined }>(),
		states: type<{ off: undefined; 'a*b': undefined }>(),
		transitions: { 'off -go> off': () => {} },
	})
})

test('a wrong-shaped return is still rejected on a row that could also skip()', () => {
	machine({
		initial: 'draft',
		inputs: type<SkipInputs>(),
		states: type<SkipStates>(),
		transitions: {
			'draft -revise> draft': ({ fromData, inputData, skip }) =>
				// @ts-expect-error - draft's data needs `text`; the skip() channel does not excuse a wrong shape
				inputData.text === fromData.text ? skip() : { wrong: true },
			'draft -cancel> empty': ({ skip }) =>
				// @ts-expect-error - empty carries no payload; a handler may return skip() or nothing, not data
				Math.random() > 0.5 ? skip() : { text: 'x' },
		},
	})
})

test("`*` is legal as a row's own source; the target stays a single named state (#142)", () => {
	machine({
		initial: 'startup',
		inputs: type<NavInputs>(),
		states: type<NavStates>(),
		transitions: {
			'* -up> idle': () => {},
			// @ts-expect-error - "*" is not a legal input name: only the source position widens
			'startup -*> idle': () => {},
			// @ts-expect-error - a row's target stays a single named state
			'startup -up> *': () => {},
		},
	})
})

test('the unlabelled wildcard form is legal: an immediate that applies from every state', () => {
	machine({
		initial: 'startup',
		inputs: type<NavInputs>(),
		states: type<NavStates>(),
		transitions: {
			'* -> idle': ({ from, skip }) => (from === 'idle' ? skip() : undefined),
		},
	})
})

test("a wildcard row's handler reads a discriminated union of source and source payload: checking `from` narrows `fromData` beside it", () => {
	machine({
		initial: 'startup',
		inputs: type<NavInputs>(),
		states: type<NavStates>(),
		transitions: {
			'* -up> idle': ({ from, fromData, skip }) => {
				expectTypeOf(from).toEqualTypeOf<
					'startup' | 'expert' | 'novice' | 'idle'
				>()
				// Unnarrowed, `fromData` is not simply one shape: "idle" carries
				// nothing, the other three carry a stroke.
				if (from === 'idle') {
					expectTypeOf(fromData).toEqualTypeOf<undefined>()
					return skip()
				}
				expectTypeOf(fromData).toEqualTypeOf<{ stroke: number[] }>()
				return undefined
			},
		},
	})
})

test('reading a field only some states carry, before narrowing `from`, is rejected', () => {
	machine({
		initial: 'startup',
		inputs: type<NavInputs>(),
		states: type<NavStates>(),
		transitions: {
			'* -up> expert': ({ fromData }) => ({
				// @ts-expect-error - `fromData` is not narrowed yet; "idle" carries no `.stroke`
				stroke: fromData.stroke,
			}),
		},
	})
})
