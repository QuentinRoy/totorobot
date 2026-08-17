/**
 * How `inputs:` / `states:` stay optional without the type surface collapsing.
 *
 * P1.4 requires that a JavaScript caller — `machine({ initial, transitions })` —
 * and a TypeScript caller with partial types both get a usable interface, widening
 * as information is lost rather than collapsing. That does not fall out for free:
 * a first attempt had `S` **reverse-inferred from `initial`** (`initial: 'whatever'`
 * produced `S = { whatever: any }`), after which the only legal state was that bogus
 * one, every real key was rejected, and the error moved off the offending line onto
 * the whole `transitions` block — failing P1.4 and P1.2 at once.
 *
 * Three things fix it, and the third removes machinery rather than adding it:
 *
 *  1. **Constrained defaults.** `S extends Vocab = Vocab`, where
 *     `Vocab = Record<string, unknown>`. Widening then falls out of the constraint —
 *     `keyof Vocab & string` is `string`, `Vocab[K]` is `unknown` — so no conditional
 *     is needed anywhere to express "no vocabulary declared".
 *  2. **`NoInfer` on `initial`.** `keyof NoInfer<S> & string` leaves `states:` as the
 *     only inference site for `S`, so the default applies when it is omitted. Note
 *     `NoInfer` alone is not enough: an earlier attempt wrapped it inside a
 *     conditional (`S extends Vocab ? keyof S & string : string`) and the reverse
 *     inference happened anyway. The constrained default is what makes the
 *     conditional unnecessary, and the plain position is what makes `NoInfer` work.
 *  3. **A bad key poisons its own value type** rather than being reported through an
 *     intersected missing property. `{ [K in keyof T]: K extends Key<S> ? Handler
 *     : \`not a transition: '${K}'\` }` reports on the offending line; the
 *     intersection form reports at the object level, because a missing property is
 *     an object-level error. This replaces a separate `Check<S, T>` helper.
 *
 * An overload per combination of declared maps was tried and is worse: it fixes the
 * inference, but every failure becomes `No overload matches this call` at the call
 * site, and the states-only combination does not resolve at all.
 *
 * Nothing here is the library. It exists so that a TypeScript release which breaks
 * any of this turns the build red — the assertions below are the tripwire.
 */

type Trim<S> = S extends ` ${infer R}`
	? Trim<R>
	: S extends `${infer R} `
		? Trim<R>
		: S
type FromOf<K> = K extends `${infer F} -${string}> ${string}` ? Trim<F> : never
type OnOf<K> = K extends `${string} -${infer E}> ${string}` ? Trim<E> : never
type ToOf<K> = K extends `${string} -${string}> ${infer T}` ? Trim<T> : never

declare const SKIP: unique symbol
type Skip = typeof SKIP

/** The widened vocabulary: every name legal, every payload `unknown`. */
type Vocab = Record<string, unknown>

type Ctx<I extends Vocab, S extends Vocab, K> = {
	data: FromOf<K> extends keyof S ? S[FromOf<K>] : never
	input: OnOf<K> extends keyof I ? I[OnOf<K>] : never
	skip: () => Skip
}
type Ret<S extends Vocab, K> =
	(ToOf<K> extends keyof S ? S[ToOf<K>] : never) | Skip
type Key<S extends Vocab> =
	`${keyof S & string} -${string}> ${keyof S & string}`

type Table<I extends Vocab, S extends Vocab, T> = {
	[K in keyof T]: K extends Key<S>
		? (c: Ctx<I, S, K>) => Ret<S, K>
		: `not a transition: '${K & string}'`
}

interface Types<T> {
	readonly __spec?: T
}
declare function types<T>(): Types<T>

declare function machine<
	I extends Vocab = Vocab,
	S extends Vocab = Vocab,
	T = unknown,
>(c: {
	initial: keyof NoInfer<S> & string
	inputs?: Types<I>
	states?: Types<S>
	transitions: T & Table<I, S, T>
}): void

/** Fails unless A and B are the *same* type — catches `any` and silent widening. */
declare function exact<A, B>(
	...a: (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
		? []
		: [never]
): void

type Inputs = { open: { text: string } }
type States = { empty: void; draft: { text: string } }

// --- 1. fully typed: nothing widens ------------------------------------------

machine({
	initial: 'empty',
	inputs: types<Inputs>(),
	states: types<States>(),
	transitions: {
		'empty -open> draft': ({ data, input }) => {
			exact<typeof input, { text: string }>()
			exact<typeof data, void>()
			return { text: input.text }
		},
		// @ts-expect-error unknown target state, reported on this line
		'empty -open> drafft': () => ({ text: 'x' }),
	},
})

// @ts-expect-error `initial` is checked once `states` is declared
machine({ initial: 'nope', states: types<States>(), transitions: {} })

// --- 2. nothing declared: the JavaScript path --------------------------------

machine({
	initial: 'whatever', // any string, because no states were declared
	transitions: {
		'empty -open> draft': ({ data, input }) => {
			exact<typeof data, unknown>()
			exact<typeof input, unknown>()
			return { anything: true }
		},
		// @ts-expect-error the key *grammar* survives, and still reports on the line
		garbage: () => ({}),
	},
})

// --- 3. states only: half checked, half widened ------------------------------

machine({
	initial: 'empty',
	states: types<States>(),
	transitions: {
		'empty -open> draft': ({ data, input }) => {
			exact<typeof data, void>()
			exact<typeof input, unknown>()
			return { text: 'x' }
		},
		// @ts-expect-error states were declared, so this is still caught
		'empty -open> drafft': () => ({ text: 'x' }),
	},
})

// --- 4. inputs only ----------------------------------------------------------

machine({
	initial: 'anything',
	inputs: types<Inputs>(),
	transitions: {
		'empty -open> draft': ({ data, input }) => {
			exact<typeof input, { text: string }>()
			exact<typeof data, unknown>()
			return { whatever: 1 }
		},
	},
})
