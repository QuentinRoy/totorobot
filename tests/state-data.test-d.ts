/**
 * State vocabularies as name-to-payload maps: what `start` takes, what a
 * snapshot narrows to, what a handler returns, and what each callback may see.
 * The input-side counterpart is `input-data.test-d.ts`.
 */

import { expectTypeOf, test } from 'vitest'
import { machine, type, type StatesOf } from 'totorobot'

test('state maps preserve payload types, and start follows the sending omission rule', () => {
	interface States {
		idle: undefined
		ready: number
	}
	const definition = machine({
		initial: 'idle',
		states: type<States>(),
		transitions: { 'idle -go> ready': () => 42 },
	})
	expectTypeOf<StatesOf<typeof definition>>().toEqualTypeOf<States>()

	definition.start()
	definition.start(undefined)
	// @ts-expect-error - `idle` carries no payload
	definition.start(42)

	// A required payload is required; one that admits `undefined` is not; an
	// inferred payload is `unknown`, which admits it.
	machine({
		initial: 'ready',
		states: type<{ ready: number }>(),
		transitions: {},
		// @ts-expect-error - `ready` carries a number
	}).start()
	machine({
		initial: 'ready',
		states: type<{ ready: number | undefined }>(),
		transitions: {},
	}).start()
	machine({
		initial: 'ready',
		states: type<{ ready: null }>(),
		transitions: {},
		// @ts-expect-error - `null` is explicit data
	}).start()
	machine({ initial: 'a', transitions: { 'a -go> b': () => {} } }).start()
})

test('checking the snapshot name narrows its data, and a payload-free state keeps an undefined data', () => {
	const current = machine({
		initial: 'empty',
		states: type<{ empty: undefined; draft: { text: string } }>(),
		transitions: { 'empty -open> draft': () => ({ text: '' }) },
	}).start().current

	expectTypeOf(current).not.toBeAny()
	if (current.name === 'draft') {
		expectTypeOf(current.data).toEqualTypeOf<{ text: string }>()
	} else {
		expectTypeOf(current.data).toEqualTypeOf<undefined>()
	}
})

test('a payload is whatever the vocabulary says, including values no wrapper object could carry', () => {
	type Tagged = { name: string; type: string }
	const host = machine({
		initial: 'idle',
		states: type<{
			idle: undefined
			counted: number
			listed: readonly string[]
			called: () => void
			mapped: Map<string, number>
			marked: symbol
			tagged: Tagged
		}>(),
		transitions: {
			'idle -count> counted': () => 1,
			'idle -list> listed': () => ['a'],
			'idle -call> called': () => () => {},
			'idle -map> mapped': () => new Map(),
			'idle -mark> marked': () => Symbol(),
			// `name` and `type` are ordinary domain fields, not library tags.
			'idle -tag> tagged': () => ({ name: 'n', type: 't' }),
		},
	}).start()

	if (host.current.name === 'tagged') {
		expectTypeOf(host.current.data).toEqualTypeOf<Tagged>()
	}
	if (host.current.name === 'called') {
		expectTypeOf(host.current.data).toEqualTypeOf<() => void>()
	}
})

test('the row owns the destination: a handler returns its payload and nothing else', () => {
	machine({
		initial: 'empty',
		states: type<{ empty: undefined; draft: { text: string } }>(),
		transitions: {
			// @ts-expect-error - that is `empty`'s payload, and the row targets `draft`
			'empty -open> draft': () => undefined,
			// @ts-expect-error - a destination name in the payload does not redirect it
			'draft -close> empty': () => ({ name: 'draft', text: '' }),
		},
	})
})

test('an empty body is what a destination carrying nothing takes, and a `void` expression is indistinguishable from one', () => {
	const cleanUp: () => void = () => {}

	machine({
		initial: 'empty',
		states: type<{ empty: undefined; draft: { text: string } }>(),
		transitions: {
			// The common row, and the reason the return type keeps a `void` arm
			// where the payload admits `undefined`: a parameterless block body is
			// inferred as `() => void` before the contextual type reaches it (I27).
			'draft -close> empty': () => {},
			// Which is the same type as the row above, so no return type can tell
			// them apart. A returned `void` lands the destination's `undefined`.
			'draft -discard> empty': () => cleanUp(),
			// The arm is conditional, so a destination that carries data rejects
			// both spellings, and a teardown-shaped return is rejected either way.
			// @ts-expect-error - `draft` carries `{ text: string }`
			'empty -open> draft': () => {},
			// @ts-expect-error - `draft` carries `{ text: string }`
			'empty -reopen> draft': () => cleanUp(),
			// @ts-expect-error - a function is not `empty`'s payload
			'draft -drop> empty': () => () => {},
			// @ts-expect-error - and neither is `{}`, which the tagged shape took
			'draft -abandon> empty': () => ({}),
		},
	})
})

test('a handler has no sending capability and no destination payload before it returns one', () => {
	machine({
		initial: 'empty',
		states: type<{ empty: undefined; draft: { text: string } }>(),
		transitions: {
			'empty -open> draft': (args) => {
				// @ts-expect-error - handlers do not send
				args.send
				// @ts-expect-error - there is no destination payload yet
				args.toData
				return { text: '' }
			},
		},
	})
})

test('a committed record carries all three names beside their payloads, and a name check narrows the payload', () => {
	machine({
		initial: 'empty',
		inputs: type<{ open: { text: string }; close: undefined }>(),
		states: type<{ empty: undefined; draft: { text: string } }>(),
		transitions: {
			'empty -open> draft': ({ inputData }) => inputData,
			'draft -close> empty': () => {},
		},
		actions: {
			'* -> *': (e) => {
				if (e.from === 'draft') {
					expectTypeOf(e.fromData).toEqualTypeOf<{ text: string }>()
				}
				if (e.to === 'empty') {
					expectTypeOf(e.toData).toEqualTypeOf<undefined>()
				}
				if (e.input === 'open') {
					expectTypeOf(e.inputData).toEqualTypeOf<{ text: string }>()
				}
			},
		},
	})
})

test('a restart predicate sees the same transition facts, and neither send nor skip', () => {
	machine({
		initial: 'draft',
		inputs: type<{ revise: undefined }>(),
		states: type<{ draft: { text: string } }>(),
		transitions: { 'draft -revise> draft': ({ fromData }) => fromData },
		actions: {
			draft: {
				run: () => {},
				restart: (facts) => {
					expectTypeOf(facts.from).toEqualTypeOf<'draft'>()
					expectTypeOf(facts.fromData).toEqualTypeOf<{ text: string }>()
					expectTypeOf(facts.to).toEqualTypeOf<'draft'>()
					expectTypeOf(facts.toData).toEqualTypeOf<{ text: string }>()
					expectTypeOf(facts.input).toEqualTypeOf<'revise' | undefined>()
					// @ts-expect-error - a restart decision is pure
					facts.send
					// @ts-expect-error - and it cannot decline the hop either
					facts.skip
					return facts.fromData.text !== facts.toData.text
				},
			},
		},
	})
})

test('state vocabularies are name-to-payload maps', () => {
	type Tagged = { name: 'open'; text: string } | { name: 'closed' }

	// A rejected declaration leaves no state name behind, so `initial` stops
	// resolving too — the same collapse an undeclarable vocabulary always causes.
	machine({
		// @ts-expect-error - arrays are not state maps
		states: type<string[]>(),
		// @ts-expect-error - and the collapse leaves no name for `initial`
		initial: 'idle',
		transitions: {},
	})
	machine({
		// @ts-expect-error - functions are not state maps
		states: type<() => void>(),
		// @ts-expect-error - and the collapse leaves no name for `initial`
		initial: 'idle',
		transitions: {},
	})
	machine({
		// @ts-expect-error - tagged unions are not state maps
		states: type<Tagged>(),
		// @ts-expect-error - and the collapse leaves no name for `initial`
		initial: 'open',
		transitions: {},
	})
})

test('an omitted state vocabulary infers names from the rows alone, with unknown payloads', () => {
	const inferred = machine({
		initial: 'a',
		inputs: type<{ go: undefined }>(),
		transitions: { 'a -go> b': () => 1 },
	})

	expectTypeOf<StatesOf<typeof inferred>>().toEqualTypeOf<{
		a: unknown
		b: unknown
	}>()
	// @ts-expect-error - `c` is named nowhere in the table
	inferred.start().observe('c', () => {})
})
