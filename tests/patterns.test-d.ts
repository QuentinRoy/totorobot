/**
 * `.observe()` pattern validity, and the transition record's discrimination.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs = {
	open: { text: string }
	submit: { route: 'review' | 'publish' }
	cancel: undefined
}
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
		'empty -open> draft': ({ inputData }) => ({ text: inputData.text }),
		'draft -submit> review': ({ state, inputData, skip }) =>
			inputData.route === 'review'
				? { text: state.text, reviewer: '' }
				: skip(),
		'draft -submit> published': ({ state, inputData, skip }) =>
			inputData.route === 'publish' ? { text: state.text } : skip(),
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

test("observe's residency shares actions' arrival-capable type: `from` is `undefined` on registration's synthetic arrival (#92)", () => {
	const host = doc.start()

	host.observe('draft', ({ from }) => {
		expectTypeOf(from).toEqualTypeOf<States | undefined>()
		// @ts-expect-error - `from` is `undefined` on the synthetic arrival
		from.name
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

test('the transition record carries input, from, to and is discriminated by input, with no separate on field', () => {
	const host = doc.start()

	host.observe('* -> *', (e) => {
		// @ts-expect-error - `on` is removed from the transition record
		e.on

		if (e.input === 'open') {
			expectTypeOf(e.inputData).toEqualTypeOf<{ text: string }>()
		}
		if (e.input === 'submit') {
			expectTypeOf(e.inputData).toEqualTypeOf<{ route: 'review' | 'publish' }>()
		}
		if (e.input === 'cancel') {
			expectTypeOf(e.inputData).toEqualTypeOf<undefined>()
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

test('an immediate transition is distinguished from a payload-free input by input: undefined, and narrows by name checks, switch, and truthiness', () => {
	type ImmediateInputs = { open: { text: string }; cancel: undefined }
	type ImmediateStates = { name: 'empty' } | { name: 'draft'; text: string }

	const withImmediate = machine({
		initial: 'empty',
		inputs: type<ImmediateInputs>(),
		states: type<ImmediateStates>(),
		transitions: {
			'empty -open> draft': ({ inputData }) => ({ text: inputData.text }),
			'draft -cancel> empty': () => {},
			'draft -> draft': ({ state }) => ({ ...state }),
		},
	})
	const host = withImmediate.start()

	host.observe('* -> *', (e) => {
		// 1. Name check
		if (e.input === 'cancel') {
			expectTypeOf(e.inputData).toEqualTypeOf<undefined>()
		}

		// 2. Switch including the absent (undefined) case
		switch (e.input) {
			case 'open':
				expectTypeOf(e.inputData).toEqualTypeOf<{ text: string }>()
				break
			case 'cancel':
				expectTypeOf(e.inputData).toEqualTypeOf<undefined>()
				break
			case undefined:
				expectTypeOf(e.inputData).toEqualTypeOf<undefined>()
				break
		}

		// 3. Truthiness split
		if (e.input) {
			expectTypeOf(e.inputData).toEqualTypeOf<
				ImmediateInputs[keyof ImmediateInputs]
			>()
		} else {
			expectTypeOf(e.inputData).toEqualTypeOf<undefined>()
		}
	})

	host.observe('* -open> *', (e) => {
		expectTypeOf(e.inputData).not.toBeAny()
		expectTypeOf(e.inputData).toEqualTypeOf<{ text: string }>()
	})
})

test('the record carries a send typed with the whole declared vocabulary, however narrow the pattern', () => {
	const host = doc.start()

	host.observe('draft -submit> review', (e) => {
		expectTypeOf(e.send).not.toBeAny()
		expectTypeOf(e.send).toEqualTypeOf<
			(
				...args:
					| ['open', { text: string }]
					| ['submit', { route: 'review' | 'publish' }]
					| ['cancel', undefined?]
			) => void
		>()

		// The pattern still narrows both ends: `send` is additive.
		expectTypeOf(e.from).toEqualTypeOf<{ name: 'draft'; text: string }>()
		expectTypeOf(e.to).toEqualTypeOf<{
			name: 'review'
			text: string
			reviewer: string
		}>()

		// Deliberately not narrowed to what `from` or `to` handles: the send is
		// read at drain time, by when the machine has moved (design record §12).
		e.send('open', { text: 'hello' })
		e.send('submit', { route: 'publish' })
		e.send('cancel')

		// @ts-expect-error - "nope" is not a declared input
		e.send('nope')
	})

	// An immediate arm carries it too, and it is the host's own signature.
	host.observe('* -> *', (e) => {
		expectTypeOf(e.send).toEqualTypeOf<typeof host.send>()
		if (!e.input)
			expectTypeOf(e.send).toEqualTypeOf<
				(
					...args:
						| ['open', { text: string }]
						| ['submit', { route: 'review' | 'publish' }]
						| ['cancel', undefined?]
				) => void
			>()
	})
})

test('observe returns an unsubscribe function, not `any`', () => {
	const off = doc.start().observe('* -> *', () => {})
	expectTypeOf(off).not.toBeAny()
	expectTypeOf(off).toEqualTypeOf<() => void>()
})
