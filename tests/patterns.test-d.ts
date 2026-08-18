/**
 * `.on()` pattern validity, and the transition record's discrimination.
 */

import { expect, expectTypeOf, test } from 'vitest'

import { machine, types } from 'totorobot'

type Inputs = {
	open: { text: string }
	submit: { route: 'review' | 'publish' }
	cancel: void
}
type States = {
	empty: void
	draft: { text: string }
	review: { text: string; reviewer: string }
	published: { text: string }
}

const doc = machine({
	initial: 'empty',
	inputs: types<Inputs>(),
	states: types<States>(),
	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text }),
		'draft -submit> review': ({ data, input, skip }) =>
			input.route === 'review' ? { text: data.text, reviewer: '' } : skip(),
		'draft -submit> published': ({ data, input, skip }) =>
			input.route === 'publish' ? { text: data.text } : skip(),
		'draft -cancel> empty': () => {},
	},
})

// Observation is a property of a running machine: `.on()` lives on the host and
// not on the definition, so that an imported definition stays inert. Every
// pattern assertion below therefore goes through `start()`.

test('unknown names in a pattern are rejected', () => {
	const host = doc.start()

	// @ts-expect-error - "nope" is not a declared state
	host.on('nope -> *', () => {})
	// @ts-expect-error - "nope" is not a declared state
	host.on('* -> nope', () => {})
	// @ts-expect-error - "nope" is not a declared input
	host.on('* -nope> *', () => {})
})

test('there is no -*> form; the wildcard appears only in state positions', () => {
	const host = doc.start()

	// @ts-expect-error - "*" is not a legal input name
	host.on('draft -*> *', () => {})
})

test('a bare key names a state and is not a legal pattern', () => {
	const host = doc.start()

	// A bare pattern throws at runtime too (#16), so the call is asserted to
	// throw rather than left to run to completion.
	expect(() =>
		// @ts-expect-error - a bare key names a state; states mean residency
		host.on('draft', () => {}),
	).toThrow(SyntaxError)
})

test('the transition record is discriminated by its input name, and each end carries its own state and data', () => {
	const host = doc.start()

	host.on('* -> *', (e) => {
		if (e.on === 'open') {
			expectTypeOf(e.input).toEqualTypeOf<{ text: string }>()
		}
		if (e.on === 'submit') {
			expectTypeOf(e.input).toEqualTypeOf<{
				route: 'review' | 'publish'
			}>()
		}
		if (e.on === 'cancel') {
			expectTypeOf(e.input).toEqualTypeOf<undefined>()
		}

		if (e.from.state === 'draft') {
			expectTypeOf(e.from.data).toEqualTypeOf<{ text: string }>()
		}
		if (e.to.state === 'review') {
			expectTypeOf(e.to.data).toEqualTypeOf<{
				text: string
				reviewer: string
			}>()
		}
		if (e.to.state === 'empty') {
			expectTypeOf(e.to.data).toEqualTypeOf<undefined>()
		}
	})
})

test('an unlabelled pattern admits on: undefined for an immediate hop; a labelled pattern excludes it', () => {
	type ImmediateInputs = { open: { text: string } }
	type ImmediateStates = { empty: void; draft: { text: string } }

	const withImmediate = machine({
		initial: 'empty',
		inputs: types<ImmediateInputs>(),
		states: types<ImmediateStates>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({ text: input.text }),
			'draft -> draft': ({ data }) => data,
		},
	})
	const host = withImmediate.start()

	host.on('* -> *', (e) => {
		expectTypeOf(e.on).not.toBeAny()
		expectTypeOf(e.on).toEqualTypeOf<'open' | undefined>()

		if (e.on === undefined) {
			expectTypeOf(e.input).toEqualTypeOf<undefined>()
		}
	})

	host.on('* -open> *', (e) => {
		expectTypeOf(e.on).not.toBeAny()
		expectTypeOf(e.on).toEqualTypeOf<'open'>()
	})
})
