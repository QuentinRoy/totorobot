/**
 * `.on()` pattern validity, and the transition record's discrimination.
 */

import { expectTypeOf, test } from 'vitest'

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

	// @ts-expect-error - a bare key names a state; states mean residency
	host.on('draft', () => {})
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
