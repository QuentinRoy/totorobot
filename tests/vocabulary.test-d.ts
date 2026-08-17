/**
 * Per-state narrowing, handler inference, `start`/`send` arity, and the
 * derived type helpers.
 */

import { expectTypeOf, test } from 'vitest'

import {
	machine,
	types,
	type Handled,
	type InputsOf,
	type Sources,
	type StatesOf,
} from '../src/totorobot.ts'

type Inputs = {
	open: { text: string }
	revise: { text: string }
	cancel: void
}
type States = {
	empty: void
	draft: { text: string; revision: number }
}

const doc = machine({
	initial: 'empty',
	inputs: types<Inputs>(),
	states: types<States>(),
	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -revise> draft': ({ data, input, skip }) =>
			input.text === data.text
				? skip()
				: { text: input.text, revision: data.revision + 1 },
		'draft -cancel> empty': () => {},
	},
})

const withData = machine({
	initial: 'draft',
	inputs: types<Inputs>(),
	states: types<States>(),
	transitions: {
		'draft -revise> draft': ({ data, input, skip }) =>
			input.text === data.text
				? skip()
				: { text: input.text, revision: data.revision + 1 },
		'draft -cancel> draft': ({ data }) => data,
	},
})

/**
 * Passes a value through an unannotated parameter before it reaches
 * `expectTypeOf`. Reading straight off `machine`/`types` while they don't
 * exist yet types as an unresolved import, which `expectTypeOf` compares
 * against anything without complaint — so an assertion here would pass for
 * the wrong reason before the entry point exists. An unannotated parameter
 * has no such special case: it types as an ordinary `any` and still fails
 * the comparison, so the assertion stays red for the right reason.
 */
function read(value) {
	return value
}

test('narrowing the state narrows its data, with no nullable padding', () => {
	const current = read(doc.start().current)

	if (current.state === 'empty') {
		expectTypeOf(current.data).toEqualTypeOf<undefined>()
	}
	if (current.state === 'draft') {
		expectTypeOf(current.data).toEqualTypeOf<{
			text: string
			revision: number
		}>()
	}
})

test("a handler's data is its source state's data and its input is that input's payload, with no type annotations", () => {
	machine({
		initial: 'empty',
		inputs: types<Inputs>(),
		states: types<States>(),
		transitions: {
			'empty -open> draft': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<undefined>()
				expectTypeOf(input).toEqualTypeOf<{ text: string }>()
				return { text: input.text, revision: 0 }
			},
			'draft -revise> draft': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<{
					text: string
					revision: number
				}>()
				expectTypeOf(input).toEqualTypeOf<{ text: string }>()
				return { text: input.text, revision: data.revision + 1 }
			},
			'draft -cancel> empty': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<{
					text: string
					revision: number
				}>()
				expectTypeOf(input).toEqualTypeOf<undefined>()
			},
		},
	})
})

test('start() takes no argument when the initial state is void, and requires one otherwise', () => {
	doc.start()
	// @ts-expect-error - empty's data is void; start() takes no argument
	doc.start({ text: 'x', revision: 0 })

	withData.start({ text: 'x', revision: 0 })
	// @ts-expect-error - draft's data is required; start() cannot be called with none
	withData.start()
})

test('send needs no payload for a void input, and requires one otherwise', () => {
	const host = doc.start()

	host.send('cancel')
	// @ts-expect-error - cancel's input is void; send() takes no payload
	host.send('cancel', { text: 'x' })

	host.send('open', { text: 'x' })
	// @ts-expect-error - open's input requires a payload
	host.send('open')
})

test('InputsOf, StatesOf, Handled and Sources resolve correctly over a machine type', () => {
	type M = typeof doc

	expectTypeOf<InputsOf<M>>().toEqualTypeOf<Inputs>()
	expectTypeOf<StatesOf<M>>().toEqualTypeOf<States>()
	expectTypeOf<Handled<M, 'empty'>>().toEqualTypeOf<'open'>()
	expectTypeOf<Handled<M, 'draft'>>().toEqualTypeOf<'revise' | 'cancel'>()
	expectTypeOf<Sources<M, 'draft'>>().toEqualTypeOf<'empty' | 'draft'>()
	expectTypeOf<Sources<M, 'empty'>>().toEqualTypeOf<'draft'>()
})

test('available is asserted only as a readonly array of input names, not a per-state literal union', () => {
	const host = read(doc.start())
	expectTypeOf(host.available).toEqualTypeOf<
		readonly ('open' | 'revise' | 'cancel')[]
	>()
})
