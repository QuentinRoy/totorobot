/**
 * Why the handler's source parameter is wrapped in `NoInfer`, pinned — and why
 * the wrapper stopped being load-bearing there.
 *
 * While a state was a tagged object, `Table` reached its payload with
 * `Extract<S, { name: From<P> }>`: a distributive conditional over the naked
 * `S`, and therefore an inference site. A *context-sensitive* handler — one
 * that destructures its argument — made the compiler infer `S`
 * contravariantly from the table, competing with the `states` property that is
 * meant to be its only source. `S` landed on garbage, `Key<I, S>` collapsed,
 * and every row was rejected as `not a transition: '…'` — the type layer's
 * diagnostic for a malformed key, fired on rows that are perfectly well
 * formed.
 *
 * Since #98 the payload is `S[From<P> & keyof S]`, an **indexed access**, and
 * TypeScript does not infer to one. The leaky miniature below now compiles, so
 * the wrapper `Table` still carries is insurance rather than load-bearing. The
 * same shape does still bite one property over: `Restart`'s predicate takes a
 * mapped type over `keyof S`, which is an inference site again
 * ([I28](../docs/implementation-record.md#i28)).
 *
 * This is easy to misread as a checker bug in the vocabulary machinery — the
 * story that `S` is self-referentially derived from the same `K` that indexes
 * `Table`'s own conditional fits the symptom and is wrong. It is recorded as
 * [I14](../docs/implementation-record.md#i14) with the false diagnosis intact,
 * because the wrong conclusion cost a
 * two-overload signature and a set of relocated `@ts-expect-error`s before the
 * one-word fix was found. With that site closed, the state half of `machine`'s
 * signature needs no special machinery at all: it takes the same
 * `RawS`/`Declared` pair the input half always had.
 *
 * So this file pins the mechanism directly, on a miniature of `Table` rather
 * than through the library, so the claim cannot rot: **without** `NoInfer` a
 * well-formed row is rejected once a handler is context-sensitive; **with**
 * it, both the inferred and the declared path resolve. The negative half
 * carries a tripwire that must fail — if a future TypeScript stops inferring
 * from that position, its `@ts-expect-error` goes unused and `pnpm typecheck`
 * says so, which is the announcement that the wrapper could be dropped.
 *
 * TS 7.0.2.
 */

import { assertType, type Equal } from './config-object-kit.ts'

type StateVocab = Record<string, unknown>
type From<K> = K extends `${infer F} -${string}> ${string}` ? F : never
type To<K> = K extends `${string} -${string}> ${infer T}` ? T : never
type StateName<S extends StateVocab> = keyof S & string
type Key<S extends StateVocab> = `${StateName<S>} -${string}> ${StateName<S>}`

type StatesFromKeys<K extends string> = {
	[N in From<K> | To<K>]: unknown
}

/**
 * Two row shapes, both without the wrapper: the tagged one, whose conditional
 * over `S` is an inference site, and the map one, whose indexed access is not.
 */
type TaggedTable<S extends Tagged, K extends string> = {
	readonly [P in K]: P extends TaggedKey<S>
		? (args: { readonly fromData: Extract<S, { name: From<P> }> }) => void
		: `not a transition: '${P}'`
}

type LeakyTable<S extends StateVocab, K extends string> = {
	readonly [P in K]: P extends Key<S>
		? (args: { readonly fromData: S[From<P> & keyof S] }) => void
		: `not a transition: '${P}'`
}

/** The same, with that one position closed. */
type FixedTable<S extends StateVocab, K extends string> = {
	readonly [P in K]: P extends Key<S>
		? (args: { readonly fromData: NoInfer<S[From<P> & keyof S]> }) => void
		: `not a transition: '${P}'`
}

type Tagged = { readonly name: string }
type TaggedKey<S extends Tagged> = `${S['name']} -${string}> ${S['name']}`
type TaggedFromKeys<K extends string> = {
	[N in From<K> | To<K>]: { readonly name: N }
}[From<K> | To<K>]

declare function tagged<
	K extends string,
	S extends Tagged = TaggedFromKeys<K>,
>(d: {
	readonly states?: S | undefined
	readonly transitions: TaggedTable<S, K>
}): S

declare function leaky<
	K extends string,
	S extends StateVocab = StatesFromKeys<K>,
>(d: {
	readonly states?: S | undefined
	readonly transitions: LeakyTable<S, K>
}): S

declare function fixed<
	K extends string,
	S extends StateVocab = StatesFromKeys<K>,
>(d: {
	readonly states?: S | undefined
	readonly transitions: FixedTable<S, K>
}): S

// ---------------------------------------------------------------------------
// The negative, on the tagged shape: without `NoInfer`, a context-sensitive
// handler poisons its own well-formed row. This is the tripwire — it must keep
// failing.
// ---------------------------------------------------------------------------

tagged({
	transitions: {
		// @ts-expect-error - well formed, yet rejected: the handler destructures
		// its argument, so `S` is inferred from this parameter as well as from
		// `states`, and `Key<S>` collapses
		'off -go> on': ({ fromData }) => {
			void fromData
		},
	},
})

// A handler that destructures nothing is not context-sensitive, so the same
// row is accepted even in the leaky form — which is what makes the failure
// above look intermittent rather than structural.
tagged({ transitions: { 'off -go> on': () => {} } })

// The same row, on the map shape and still without the wrapper, is accepted:
// an indexed access is not a position TypeScript infers from. A future
// TypeScript that starts inferring from one turns this red, which is the
// announcement that `Table`'s wrapper is load-bearing again.
leaky({
	transitions: {
		'off -go> on': ({ fromData }) => {
			void fromData
		},
	},
})

// ---------------------------------------------------------------------------
// The positive: with `NoInfer`, both paths resolve.
// ---------------------------------------------------------------------------

// Inferred vocabulary: the row is accepted, and an inferred payload is
// `unknown` because nothing declares what it is.
const inferred = fixed({
	transitions: {
		'off -go> on': ({ fromData }) => {
			assertType<Equal<typeof fromData, unknown>>()
		},
	},
})
assertType<Equal<StateName<typeof inferred>, 'off' | 'on'>>()

// Declared vocabulary: `states` is still the inference site it was, and the
// declared payload survives — the thing a blunter `NoInfer` around the whole
// type argument destroys, turning every `fromData` into `never`.
type Doc = { empty: undefined; draft: { text: string } }
declare const doc: Doc | undefined
const declared = fixed({
	states: doc,
	transitions: {
		'empty -open> draft': ({ fromData }) => {
			assertType<Equal<typeof fromData, undefined>>()
		},
		'draft -open> empty': ({ fromData }) => {
			assertType<Equal<typeof fromData, { text: string }>>()
		},
	},
})
assertType<Equal<typeof declared, Doc>>()

// A genuinely malformed row is still rejected, on its own line: closing the
// inference site does not cost the diagnostic the notation exists to give.
fixed({
	transitions: {
		'off -go> on': ({ fromData }) => {
			void fromData
		},
		// @ts-expect-error - no space after '>', so this is not a transition
		'off -go>on': () => {},
	},
})
