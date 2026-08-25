/**
 * Nothing a caller can reach is `any`.
 *
 * A leak is invisible in a green suite: `toEqualTypeOf` passes against `any`,
 * which is why the older files pair it with `not.toBeAny()`. Those cover the
 * positions somebody named; `HasAny` walks the reachable surface instead. The
 * planted-leak tests stop it rotting into a detector that always answers no.
 * What the walk cannot reach, and why, is I24.
 */

import { expectTypeOf, test } from 'vitest'

import {
	machine,
	type,
	type Handled,
	type InputsOf,
	type Skip,
	type Sources,
	type StatesOf,
} from 'totorobot'

// ---------------------------------------------------------------------------
// The detector
// ---------------------------------------------------------------------------

/** `1 & any` is `any`, so this holds for `any` and for nothing else. */
type IsAny<T> = 0 extends 1 & T ? true : false

/** The walk distributes over unions; this collapses the result back to one boolean. */
type Some<U> = true extends U ? true : false

/** Bounds the recursion. Twelve clears the deepest public position; a test pins it. */
type Fuel = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** `never` first: a conditional checked on `never` resolves to `never`, not a branch. */
type Walk<T, D extends number> = [T] extends [never]
	? false
	: IsAny<T> extends true
		? true
		: [D] extends [never]
			? false
			: T extends (...args: infer A) => infer R
				? Some<Walk<A, Fuel[D]> | Walk<R, Fuel[D]>>
				: T extends readonly unknown[]
					? Walk<T[number], Fuel[D]>
					: T extends object
						? Some<{ [K in keyof T]-?: Walk<T[K], Fuel[D]> }[keyof T]>
						: false

type HasAny<T> = Some<Walk<T, 12>>

// ---------------------------------------------------------------------------
// The detector detects
// ---------------------------------------------------------------------------

test('a planted leak is found wherever it sits', () => {
	expectTypeOf<HasAny<any>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<{ a: { b: any } }>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<readonly any[]>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<(x: any) => void>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<() => { deep: { deeper: any } }>>().toEqualTypeOf<true>()
	expectTypeOf<
		HasAny<{ ok: string; fn: (a: number) => any }>
	>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<{ a: string } | { b: any }>>().toEqualTypeOf<true>()
	expectTypeOf<
		HasAny<(p: string, l: (e: { from: any }) => void) => () => void>
	>().toEqualTypeOf<true>()
})

test('the neighbours of `any` are not mistaken for it', () => {
	expectTypeOf<HasAny<unknown>>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<{ u: unknown; s: string; n: never; v: void; f: () => void }>
	>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<{ a: string } | { b: number }>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<Record<string, unknown>>>().toEqualTypeOf<false>()
})

test('the walk reaches as deep as it claims', () => {
	// Reduce `Fuel` and this goes red.
	expectTypeOf<
		HasAny<{ a: { b: { c: { d: { e: { f: { g: { h: () => any } } } } } } } }>
	>().toEqualTypeOf<true>()
})

// ---------------------------------------------------------------------------
// The surface
// ---------------------------------------------------------------------------

type Inputs =
	| { type: 'open'; text: string }
	| { type: 'submit'; route: 'review' | 'publish' }
	| { type: 'cancel' }
type States =
	| { name: 'empty' }
	| { name: 'draft'; text: string }
	| { name: 'review'; text: string; reviewer: string }

const declared = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text }),
		'draft -submit> review': ({ state, input, skip }) =>
			input.route === 'review' ? { text: state.text, reviewer: '' } : skip(),
		'draft -cancel> empty': () => {},
		'review -> draft': ({ state }) => ({ text: state.text }),
	},
})

/** The untyped path, where a collapse to `any` would be least visible. */
const inferred = machine({
	initial: 'off',
	transitions: {
		'off -toggle> on': () => {},
		'on -toggle> off': () => {},
		'on -> on': ({ skip }) => skip(),
	},
})

/** Half declared, half read off the table. */
const half = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	transitions: {
		'empty -open> draft': () => {},
		'draft -cancel> empty': () => {},
	},
})

/** A payload-carrying initial state, so `start` takes an argument. */
const carrying = machine({
	initial: 'draft',
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		'draft -cancel> empty': () => {},
	},
})

test('`machine` itself is clean, arguments and result alike', () => {
	expectTypeOf<HasAny<typeof machine>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<typeof type>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<Skip>>().toEqualTypeOf<false>()
})

test('a declared machine and its host are clean, transitively', () => {
	expectTypeOf<HasAny<typeof declared>>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<ReturnType<typeof declared.start>>
	>().toEqualTypeOf<false>()
})

test('an inferred machine and its host are clean, transitively', () => {
	expectTypeOf<HasAny<typeof inferred>>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<ReturnType<typeof inferred.start>>
	>().toEqualTypeOf<false>()
	expectTypeOf(inferred.start().current['whatever']).not.toBeAny()
	expectTypeOf(inferred.start().current['whatever']).toEqualTypeOf<unknown>()
})

test('a half-declared machine and its host are clean, transitively', () => {
	expectTypeOf<HasAny<typeof half>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<ReturnType<typeof half.start>>>().toEqualTypeOf<false>()
})

test("`start`'s payload parameter is clean", () => {
	expectTypeOf<
		HasAny<Parameters<typeof carrying.start>>
	>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<Parameters<typeof inferred.start>>
	>().toEqualTypeOf<false>()
})

test('the derived helpers are clean', () => {
	expectTypeOf<HasAny<InputsOf<typeof declared>>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<StatesOf<typeof declared>>>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<Handled<typeof declared, 'draft'>>
	>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<Sources<typeof declared, 'draft'>>
	>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<InputsOf<typeof inferred>>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<StatesOf<typeof inferred>>>().toEqualTypeOf<false>()
})

// ---------------------------------------------------------------------------
// What the walk cannot reach
// ---------------------------------------------------------------------------

test("a handler's arguments are clean, on every kind of row", () => {
	// Walking `typeof machine` resolves `Table` at its constraints, so an `any`
	// on `state` passes every assertion above (I24).
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
				return { text: args.input.text }
			},
			'draft -submit> review': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
				return args.skip()
			},
			// An unlabelled arrow: `input` is `undefined`.
			'draft -> empty': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
			},
		},
	})

	// The same with no vocabulary declared, where `unknown` must come back.
	machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
				expectTypeOf(args.state['whatever']).toEqualTypeOf<unknown>()
				expectTypeOf(args.input['whatever']).toEqualTypeOf<unknown>()
			},
		},
	})
})

test("a listener's transition record is clean, under every pattern shape", () => {
	const host = declared.start()

	// Each pattern instantiates `Transition` differently.
	host.observe('* -> *', (e) => {
		expectTypeOf<HasAny<typeof e>>().toEqualTypeOf<false>()
	})
	host.observe('draft -cancel> empty', (e) => {
		expectTypeOf<HasAny<typeof e>>().toEqualTypeOf<false>()
	})
	host.observe('* -submit> review', (e) => {
		expectTypeOf<HasAny<typeof e>>().toEqualTypeOf<false>()
	})
	host.observe('review -> *', (e) => {
		expectTypeOf<HasAny<typeof e>>().toEqualTypeOf<false>()
	})

	// The unsubscribe handle.
	expectTypeOf<HasAny<ReturnType<typeof host.observe>>>().toEqualTypeOf<false>()

	const untyped = inferred.start()
	untyped.observe('* -> *', (e) => {
		expectTypeOf<HasAny<typeof e>>().toEqualTypeOf<false>()
	})
})
