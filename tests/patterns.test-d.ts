/**
 * `.observe()` pattern validity, and the transition record's discrimination.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, type, type Patterns } from 'totorobot'

type Inputs = {
	open: { text: string }
	submit: { route: 'review' | 'publish' }
	cancel: undefined
}
type Send = (
	...args:
		| ['open', { text: string }]
		| ['submit', { route: 'review' | 'publish' }]
		| ['cancel', undefined?]
) => void
type States = {
	empty: undefined
	draft: { text: string }
	review: { text: string; reviewer: string }
	published: { text: string }
}

const doc = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'empty -open> draft': ({ inputData }) => ({ text: inputData.text }),
		'draft -submit> review': ({ fromData, inputData, skip }) =>
			inputData.route === 'review'
				? { text: fromData.text, reviewer: '' }
				: skip(),
		'draft -submit> published': ({ fromData, inputData, skip }) =>
			inputData.route === 'publish' ? fromData : skip(),
		'draft -cancel> empty': () => {},
		'draft -> draft': ({ fromData }) => fromData,
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

test('an exact edge naming valid state and input names, but no declared row, is a compile-time registration error rather than a listener silently typed with `never` (#100)', () => {
	const host = doc.start()

	// "empty", "cancel" and "draft" are all declared, but no row pairs them.
	// @ts-expect-error - no row matches 'empty -cancel> draft'
	host.observe('empty -cancel> draft', () => {})
})

test('a broad edge pattern with no matching row is rejected the same way, wildcard source and wildcard target alike (#100)', () => {
	const host = doc.start()

	// "review" has no outgoing row at all.
	// @ts-expect-error - no row matches 'review -> *'
	host.observe('review -> *', () => {})
	// nothing reaches "review" by "cancel".
	// @ts-expect-error - no row matches '* -cancel> review'
	host.observe('* -cancel> review', () => {})
})

test('there is no -*> form; the wildcard appears only in state positions', () => {
	const host = doc.start()

	// @ts-expect-error - "*" is not a legal input name
	host.observe('draft -*> *', () => {})
})

test('a bare key means residency, typed as the same record `actions` takes (#76)', () => {
	const host = doc.start()

	host.observe('draft', (arrival) => {
		expectTypeOf(arrival.to).toEqualTypeOf<'draft'>()
		expectTypeOf(arrival.toData).toEqualTypeOf<{ text: string }>()
	})
	host.observe('draft', { run: () => {} })
	host.observe('draft', {
		run: () => {},
		restart: ({ fromData, toData }) => fromData.text !== toData.text,
	})

	// @ts-expect-error - "nope" is not a declared state
	host.observe('nope', () => {})
})

test("observe's residency shares actions' arrival-capable type: `from` is `undefined` on registration's synthetic arrival, and narrowed to only the sources the table declares otherwise (#92, #99)", () => {
	const host = doc.start()

	host.observe('draft', ({ from, fromData }) => {
		// "empty" reaches "draft" by `open`, "draft" reaches itself by the
		// self-loop above; "review" and "published" never do, so they are
		// excluded even though they too are declared states.
		expectTypeOf(from).toEqualTypeOf<'empty' | 'draft' | undefined>()
		// @ts-expect-error - `from` is `undefined` on the synthetic arrival
		from.length
		// A name check narrows the data beside it, "empty"'s own `undefined`
		// included, rather than every state's payload.
		expectTypeOf(fromData).toEqualTypeOf<{ text: string } | undefined>()
	})
})

test('a block-bodied restart predicate on observe does not reopen the host as an inference site (I28)', () => {
	const host = doc.start()

	host.observe('draft', {
		run: () => {},
		restart: (facts) => {
			expectTypeOf(facts.fromData).toEqualTypeOf<{ text: string }>()
			expectTypeOf(facts.toData).toEqualTypeOf<{ text: string }>()
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

test('the transition record carries each name beside its payload, and a check on any one name narrows the payload', () => {
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

		if (e.from === 'draft') {
			expectTypeOf(e.fromData).toEqualTypeOf<{ text: string }>()
		}
		if (e.to === 'review') {
			expectTypeOf(e.toData).toEqualTypeOf<{
				text: string
				reviewer: string
			}>()
		}
		if (e.to === 'empty') {
			expectTypeOf(e.toData).toEqualTypeOf<undefined>()
		}
		if (e.to === 'published') {
			expectTypeOf(e.toData).toEqualTypeOf<{ text: string }>()
		}

		// "empty" only ever reaches "draft": a check against a state it cannot
		// reach is a comparison between two literals with no overlap, caught at
		// compile time rather than merely failing to narrow (#99).
		if (e.from === 'empty') {
			// @ts-expect-error - "review" is not among the destinations "empty" reaches
			if (e.to === 'review') {
			}
		}
	})
})

test('a guard on one row does not collapse its declared alternative: both "review" and "published" stay live from the same source and input, distinguished by destination (#99)', () => {
	const host = doc.start()

	// "draft -submit>" has two declared rows, "review" and "published", picked
	// between at runtime by `skip()`. Typing is off the declared rows, not off
	// which one the guard actually takes, so both remain, and the destination
	// name still correlates with its own payload shape.
	host.observe('draft -submit> *', (e) => {
		expectTypeOf(e.to).toEqualTypeOf<'review' | 'published'>()
		if (e.to === 'review') {
			expectTypeOf(e.toData).toEqualTypeOf<{ text: string; reviewer: string }>()
		}
		if (e.to === 'published') {
			expectTypeOf(e.toData).toEqualTypeOf<{ text: string }>()
			// @ts-expect-error - "published" carries no "reviewer"
			e.toData.reviewer
		}
	})
})

test('an immediate transition is distinguished from a payload-free input by input: undefined, and narrows by name checks, switch, and truthiness', () => {
	type ImmediateInputs = { open: { text: string }; cancel: undefined }
	type ImmediateStates = { empty: undefined; draft: { text: string } }

	const withImmediate = machine({
		initial: 'empty',
		inputs: type<ImmediateInputs>(),
		states: type<ImmediateStates>(),
		transitions: {
			'empty -open> draft': ({ inputData }) => ({ text: inputData.text }),
			'draft -cancel> empty': () => {},
			'draft -> draft': ({ fromData }) => fromData,
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

test('an incoming wildcard narrows the source to what actually reaches the input, and an outgoing wildcard narrows the destination to what the source actually reaches (#99)', () => {
	const host = doc.start()

	// "open" only ever fires from "empty", to "draft": narrowed to those alone,
	// not every declared state either side.
	host.observe('* -open> *', (e) => {
		expectTypeOf(e.from).toEqualTypeOf<'empty'>()
		expectTypeOf(e.to).toEqualTypeOf<'draft'>()
	})

	// "empty" only ever reaches "draft": narrowed there, not to "review" or
	// "published", which "empty" cannot reach directly.
	host.observe('empty -> *', (e) => {
		expectTypeOf(e.to).toEqualTypeOf<'draft'>()
		expectTypeOf(e.toData).toEqualTypeOf<{ text: string }>()
	})
})

test('an edge listener needs no narrowing to read `from`: no synthetic arrival member, unlike a residency (#99)', () => {
	const host = doc.start()

	host.observe('* -> *', (e) => {
		// Not a compile error, unlike the same read on a residency's arrival
		// (tests/actions.test-d.ts, "reading `from` without narrowing"): an edge
		// record never carries the arrival member, so `from` is always one of
		// the declared source names, never `undefined`.
		e.from.length
	})
})

test('the record carries a send typed with the whole declared vocabulary, however narrow the pattern', () => {
	const host = doc.start()

	host.observe('draft -submit> review', (e) => {
		expectTypeOf(e.send).not.toBeAny()
		expectTypeOf(e.send).toEqualTypeOf<Send>()

		// The pattern still narrows both ends: `send` is additive.
		expectTypeOf(e.from).toEqualTypeOf<'draft'>()
		expectTypeOf(e.fromData).toEqualTypeOf<{ text: string }>()
		expectTypeOf(e.to).toEqualTypeOf<'review'>()
		expectTypeOf(e.toData).toEqualTypeOf<{
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
		if (!e.input) expectTypeOf(e.send).toEqualTypeOf<Send>()
	})
})

test('observe returns an unsubscribe function, not `any`', () => {
	const off = doc.start().observe('* -> *', () => {})
	expectTypeOf(off).not.toBeAny()
	expectTypeOf(off).toEqualTypeOf<() => void>()
})

test('`Patterns<M>` is the matchable subset of the name-valid cross-product, wildcard generalizations included (#116)', () => {
	// The three-state, two-input example #115/#116 measure completions
	// against: 48 name-valid patterns, of which only these 20 admit a
	// declared row — 11 under each input name, plus 9 more under the
	// unlabelled, any-input wildcard, which admits a named-input row too
	// (line 37's own "'' as the label wildcard"). Hand-enumerated, not
	// reconstructed from `Matches` or `MatchingRows`, so a wrong wildcard
	// rule cannot pass by agreeing with itself.
	type Inputs = { coucou: undefined; maybe: undefined }
	type States = { start: undefined; middle: undefined; end: undefined }

	const three = machine({
		initial: 'start',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'start -coucou> end': () => {},
			'start -maybe> middle': () => {},
			'middle -maybe> start': () => {},
		},
	})

	expectTypeOf<Patterns<typeof three>>().toEqualTypeOf<
		| '* -coucou> *'
		| '* -coucou> end'
		| 'start -coucou> *'
		| 'start -coucou> end'
		| '* -maybe> *'
		| '* -maybe> middle'
		| '* -maybe> start'
		| 'start -maybe> *'
		| 'start -maybe> middle'
		| 'middle -maybe> *'
		| 'middle -maybe> start'
		| '* -> *'
		| '* -> start'
		| '* -> middle'
		| '* -> end'
		| 'start -> *'
		| 'start -> middle'
		| 'start -> end'
		| 'middle -> *'
		| 'middle -> start'
	>()
})

test('a pattern the table cannot fire is still rejected by hand, with the same message as before #116 (#100)', () => {
	const host = doc.start()

	// @ts-expect-error - no row matches 'empty -cancel> draft'
	host.observe('empty -cancel> draft', () => {})
})

test('`Patterns<M>` matches what `observe` itself accepts and rejects (#116)', () => {
	// Named directly, not through a generic forwarding helper: `observe` is
	// overloaded, and `Parameters<typeof host.observe>` — the only way to
	// name its parameter type from outside, since neither `Pattern` nor
	// `Host` is exported — collapses to the last overload's, the bare-state
	// one, same as any other overloaded method. `Patterns<M>` is the public
	// type for this precisely because that route is not available.
	const live: Patterns<typeof doc> = 'draft -submit> review'
	doc.start().observe(live, () => {})

	// @ts-expect-error - "empty -cancel> draft" is not in `Patterns<typeof doc>`
	const dead: Patterns<typeof doc> = 'empty -cancel> draft'
	void dead
})

test('the listener callback still infers its argument with no parameter annotation (#116)', () => {
	const host = doc.start()

	host.observe('draft -submit> review', (e) => {
		expectTypeOf(e.to).toEqualTypeOf<'review'>()
		expectTypeOf(e.toData).toEqualTypeOf<{ text: string; reviewer: string }>()
	})
})
