/**
 * Nothing a caller can reach is `any`.
 *
 * `any` is fine inside the module — the runtime half has no use for the type
 * layer's per-row precision, and discarding it there costs a caller nothing. It
 * is not fine on the way out: `any` does not merely widen a type, it switches
 * checking off for every expression downstream of it, silently and
 * transitively. A leak is invisible in a green suite, because the assertions
 * that would have caught it pass vacuously against `any` — `toEqualTypeOf`
 * compares `any` to anything without complaint, which is why the older files
 * pair it with `not.toBeAny()`.
 *
 * Those pairings check the positions somebody thought to name. This file checks
 * the surface: `HasAny` walks a type's properties, its array elements, and both
 * ends of every function signature it meets, and reports whether `any` occurs
 * anywhere inside. Pointing it at `machine` and at what `machine` returns covers
 * the reachable surface in one assertion each, including positions no
 * hand-written assertion names — the `from` of a transition record delivered to
 * a listener registered under a narrowed pattern, say.
 *
 * A detector that always answered `false` would pass every assertion here and
 * catch nothing, so the planted-leak tests below are load-bearing rather than
 * decorative: each one is a position `HasAny` must fire on, and one of them
 * (`state` in the table) was a genuine blind spot until the handler-argument
 * assertions were added. See I24 for what the walk does not reach.
 *
 * The suite imports by package name, so this runs against `src/` under
 * `pnpm test` and against the emitted declarations under `pnpm test:dist` —
 * the rollup is where a leak would appear with no runtime symptom at all.
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

/**
 * `any` is the one type that swallows an intersection: `1 & any` is `any`, so
 * `0 extends 1 & any` holds where `0 extends 1 & T` holds for no other `T`.
 */
type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * A walk distributes over unions and a mapped type yields one answer per key,
 * so the arms below produce a union of booleans; this collapses it back to one.
 * `true` wins: a leak in any member is a leak.
 */
type Some<U> = true extends U ? true : false

/**
 * Recursion has to be bounded, and a tuple index is how a conditional type
 * counts down. Twelve is comfortably past the deepest public position — a
 * listener's transition record, reached through `observe`'s second parameter —
 * and the `reaches as deep as it claims` test below pins that.
 */
type Fuel = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/**
 * `never` first, because a conditional whose checked type is `never` resolves
 * to `never` rather than to a branch; `IsAny` before the fuel check, so an `any`
 * sitting exactly at the limit is still reported rather than run out of budget.
 */
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

/** `true` if `any` occurs anywhere in `T`. The union `Walk` may return, collapsed. */
type HasAny<T> = Some<Walk<T, 12>>

// ---------------------------------------------------------------------------
// The detector detects
// ---------------------------------------------------------------------------

test('a planted leak is found wherever it sits', () => {
	expectTypeOf<HasAny<any>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<{ a: { b: any } }>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<readonly any[]>>().toEqualTypeOf<true>()
	// A parameter, which is where a leak hurts a caller writing a callback.
	expectTypeOf<HasAny<(x: any) => void>>().toEqualTypeOf<true>()
	expectTypeOf<HasAny<() => { deep: { deeper: any } }>>().toEqualTypeOf<true>()
	expectTypeOf<
		HasAny<{ ok: string; fn: (a: number) => any }>
	>().toEqualTypeOf<true>()
	// One arm of a union is enough: this is the shape a vocabulary has.
	expectTypeOf<HasAny<{ a: string } | { b: any }>>().toEqualTypeOf<true>()
	// A callback's callback: the shape `observe` has.
	expectTypeOf<
		HasAny<(p: string, l: (e: { from: any }) => void) => () => void>
	>().toEqualTypeOf<true>()
})

test('the neighbours of `any` are not mistaken for it', () => {
	// `unknown` is the whole point of the untyped path: it widens without
	// disabling anything, and must not be reported as a leak.
	expectTypeOf<HasAny<unknown>>().toEqualTypeOf<false>()
	expectTypeOf<
		HasAny<{ u: unknown; s: string; n: never; v: void; f: () => void }>
	>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<{ a: string } | { b: number }>>().toEqualTypeOf<false>()
	expectTypeOf<HasAny<Record<string, unknown>>>().toEqualTypeOf<false>()
})

test('the walk reaches as deep as it claims', () => {
	// Eight objects down, then through a function at both ends: deeper than any
	// position the surface below actually has. Reduce `Fuel` and this goes red.
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

/** Half declared, half read off the table: the two default resolutions meet. */
const half = machine({
	initial: 'empty',
	inputs: type<Inputs>(),
	transitions: {
		'empty -open> draft': () => {},
		'draft -cancel> empty': () => {},
	},
})

/** A payload-carrying initial state, so `start`'s parameter is not empty. */
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
	// The named guarantee of the untyped path: unknown, and not the other one.
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
// The two positions the walk above cannot reach
// ---------------------------------------------------------------------------

test("a handler's arguments are clean, on every kind of row", () => {
	// `Table` is only ever instantiated against a real call's vocabulary, so
	// walking `typeof machine` resolves it at its constraints and never reaches
	// these — an `any` on `state` there passes every assertion above (I24).
	machine({
		initial: 'empty',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'empty -open> draft': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
				return { text: args.input.text }
			},
			// A row that declines, so `skip` is used rather than merely present.
			'draft -submit> review': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
				return args.skip()
			},
			// An unlabelled arrow, whose `input` is `undefined` rather than a member.
			'draft -> empty': (args) => {
				expectTypeOf<HasAny<typeof args>>().toEqualTypeOf<false>()
			},
		},
	})

	// And the same with no vocabulary declared, where the arguments are widened
	// rather than declared and `unknown` is what must come back.
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

	// Reachable from `HasAny<typeof host>` only at `observe`'s constraint; each
	// pattern below instantiates it differently, and a narrowed one is where the
	// mapped arm of `Transition` actually does its work.
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

	// The unsubscribe handle, which is the one thing `observe` hands back.
	expectTypeOf<HasAny<ReturnType<typeof host.observe>>>().toEqualTypeOf<false>()

	const untyped = inferred.start()
	untyped.observe('* -> *', (e) => {
		expectTypeOf<HasAny<typeof e>>().toEqualTypeOf<false>()
	})
})
