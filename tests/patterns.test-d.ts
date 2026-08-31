/**
 * `.observe()` pattern validity, and the transition record's discrimination.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs =
	| { type: 'open'; text: string }
	| { type: 'submit'; route: 'review' | 'publish' }
	| { type: 'cancel' }
type States =
	| { name: 'empty' }
	| { name: 'draft'; text: string }
	| { name: 'review'; text: string; reviewer: string }
	| { name: 'published'; text: string }

const doc = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text }),
		'draft -submit> review': ({ state, input, skip }) =>
			input.route === 'review' ? { text: state.text, reviewer: '' } : skip(),
		'draft -submit> published': ({ state, input, skip }) =>
			input.route === 'publish' ? { text: state.text } : skip(),
		'draft -cancel> empty': () => {},
	},
})

// Observation is a property of a running machine: `.observe()` lives on the host and
// not on the definition, so that an imported definition stays inert. Every
// pattern assertion below therefore goes through `start()`.

test('unknown names in a pattern are rejected', () => {
	const host = doc.start()

	// @ts-expect-error - "nope" is not a declared state
	host.observe('nope -> *', () => {})
	// @ts-expect-error - "nope" is not a declared state
	host.observe('* -> nope', () => {})
	// @ts-expect-error - "nope" is not a declared input
	host.observe('* -nope> *', () => {})
})

test('there is no -*> form; the wildcard appears only in state positions', () => {
	const host = doc.start()

	// @ts-expect-error - "*" is not a legal input name
	host.observe('draft -*> *', () => {})
})

test('a bare key means residency, typed as the same record `actions` takes (#76)', () => {
	const host = doc.start()

	host.observe('draft', (arrival) => {
		expectTypeOf(arrival.to).toEqualTypeOf<{ name: 'draft'; text: string }>()
	})
	host.observe('draft', { run: () => {} })
	host.observe('draft', {
		run: () => {},
		restart: (from, to) => from.text !== to.text,
	})

	// @ts-expect-error - "nope" is not a declared state
	host.observe('nope', () => {})
})

test("a residency observer's arrival has a defined `from`, unlike a declared action's — only start() can produce the initial arrival no transition caused — and an immediate hop can still have no input (#95)", () => {
	const host = doc.start()

	host.observe('draft', (arrival) => {
		expectTypeOf(arrival.from).toEqualTypeOf<States>()
	})

	host.observe('* -> *', (e) => {
		expectTypeOf(e.from).toEqualTypeOf<States>()
		if (!e.input) expectTypeOf(e.input).toEqualTypeOf<undefined>()
	})
})

test('a block-bodied restart predicate on observe does not reopen the host as an inference site (I28)', () => {
	const host = doc.start()

	host.observe('draft', {
		run: () => {},
		restart: (from, to) => {
			expectTypeOf(from).toEqualTypeOf<{ name: 'draft'; text: string }>()
			expectTypeOf(to).toEqualTypeOf<{ name: 'draft'; text: string }>()
			return true
		},
	})
})

test('the record form is only for a bare state key: an edge pattern still takes a plain listener', () => {
	const host = doc.start()

	// @ts-expect-error - `{ run, restart }` is the residency form, not an edge listener
	host.observe('draft -submit> review', { run: () => {}, restart: false })
})

test('no array form, no third argument, and no options object with an `AbortSignal` (#76)', () => {
	const host = doc.start()

	// @ts-expect-error - an array is an `actions`-only shape; call `observe` again for a second one
	host.observe('draft', [() => {}])

	// @ts-expect-error - `observe` takes exactly two arguments
	host.observe('draft', () => {}, {})

	host.observe('draft', {
		run: () => {},
		// @ts-expect-error - no third-argument options form; no subscription `AbortSignal`
		signal: new AbortController().signal,
	})
})

test('the transition record carries input, from, to and is discriminated by input.type, with no separate on field', () => {
	const host = doc.start()

	host.observe('* -> *', (e) => {
		// @ts-expect-error - `on` is removed from the transition record
		e.on

		if (e.input?.type === 'open') {
			expectTypeOf(e.input).toEqualTypeOf<{ type: 'open'; text: string }>()
		}
		if (e.input?.type === 'submit') {
			expectTypeOf(e.input).toEqualTypeOf<{
				type: 'submit'
				route: 'review' | 'publish'
			}>()
		}
		if (e.input?.type === 'cancel') {
			expectTypeOf(e.input).toEqualTypeOf<{ type: 'cancel' }>()
		}

		if (e.from.name === 'draft') {
			expectTypeOf(e.from).toEqualTypeOf<{ name: 'draft'; text: string }>()
		}
		if (e.to.name === 'review') {
			expectTypeOf(e.to).toEqualTypeOf<{
				name: 'review'
				text: string
				reviewer: string
			}>()
		}
		if (e.to.name === 'empty') {
			expectTypeOf(e.to).toEqualTypeOf<{ name: 'empty' }>()
		}
	})
})

test('an immediate transition is distinguished from a payload-free input by input: undefined, and narrows by optional access, switch, and truthiness', () => {
	type ImmediateInputs = { type: 'open'; text: string } | { type: 'cancel' }
	type ImmediateStates = { name: 'empty' } | { name: 'draft'; text: string }

	const withImmediate = machine({
		initial: 'empty',
		inputs: type<ImmediateInputs>(),
		states: type<ImmediateStates>(),
		transitions: {
			'empty -open> draft': ({ input }) => ({ text: input.text }),
			'draft -cancel> empty': () => {},
			'draft -> draft': ({ state }) => ({ ...state }),
		},
	})
	const host = withImmediate.start()

	host.observe('* -> *', (e) => {
		// 1. Optional access
		if (e.input?.type === 'cancel') {
			expectTypeOf(e.input).toEqualTypeOf<{ type: 'cancel' }>()
		}

		// 2. Switch including the absent (undefined) case
		switch (e.input?.type) {
			case 'open':
				expectTypeOf(e.input).toEqualTypeOf<{ type: 'open'; text: string }>()
				break
			case 'cancel':
				expectTypeOf(e.input).toEqualTypeOf<{ type: 'cancel' }>()
				break
			case undefined:
				expectTypeOf(e.input).toEqualTypeOf<undefined>()
				break
		}

		// 3. Truthiness split
		if (e.input) {
			expectTypeOf(e.input).toEqualTypeOf<ImmediateInputs>()
		} else {
			expectTypeOf(e.input).toEqualTypeOf<undefined>()
		}
	})

	host.observe('* -open> *', (e) => {
		expectTypeOf(e.input).not.toBeAny()
		expectTypeOf(e.input).toEqualTypeOf<{ type: 'open'; text: string }>()
	})
})

test('the record carries a send typed with the whole declared vocabulary, however narrow the pattern', () => {
	const host = doc.start()

	host.observe('draft -submit> review', (e) => {
		expectTypeOf(e.send).not.toBeAny()
		expectTypeOf(e.send).toEqualTypeOf<(input: Inputs) => void>()

		// The pattern still narrows both ends: `send` is additive.
		expectTypeOf(e.from).toEqualTypeOf<{ name: 'draft'; text: string }>()
		expectTypeOf(e.to).toEqualTypeOf<{
			name: 'review'
			text: string
			reviewer: string
		}>()

		// Deliberately not narrowed to what `from` or `to` handles: the send is
		// read at drain time, by when the machine has moved (design record §12).
		e.send({ type: 'open', text: 'hello' })
		e.send({ type: 'submit', route: 'publish' })
		e.send({ type: 'cancel' })

		// @ts-expect-error - "nope" is not a declared input
		e.send({ type: 'nope' })
	})

	// An immediate arm carries it too, and it is the host's own signature.
	host.observe('* -> *', (e) => {
		expectTypeOf(e.send).toEqualTypeOf<typeof host.send>()
		if (!e.input) expectTypeOf(e.send).toEqualTypeOf<(input: Inputs) => void>()
	})
})

test('observe returns an unsubscribe function, not `any`', () => {
	const off = doc.start().observe('* -> *', () => {})
	expectTypeOf(off).not.toBeAny()
	expectTypeOf(off).toEqualTypeOf<() => void>()
})
