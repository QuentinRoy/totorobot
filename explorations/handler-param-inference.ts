/**
 * Why the handler's `state` parameter is wrapped in `NoInfer`, pinned.
 *
 * `Table` in `src/totorobot.ts` puts the state vocabulary `S` in a handler
 * **parameter** (`state: Extract<S, { name: From<P> }>`). A parameter is an
 * inference site, so a *context-sensitive* handler — one that destructures its
 * argument — makes the compiler infer `S` contravariantly from the table,
 * competing with the `states` property that is meant to be its only source.
 * `S` lands on garbage, `Key<I, S>` collapses, and every row is rejected as
 * `not a transition: '…'` — the type layer's diagnostic for a malformed key,
 * fired on rows that are perfectly well formed.
 *
 * This is easy to misread as a checker bug in the vocabulary machinery — the
 * story that `S` is self-referentially derived from the same `K` that indexes
 * `Table`'s own conditional fits the symptom and is wrong. It is recorded in
 * [§5](../docs/api-rationale.md#why-the-handlers-state-parameter-uses-noinfer)
 * with the false diagnosis intact, because the wrong conclusion cost a
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

type StateVocab = { readonly name: string }
type From<K> = K extends `${infer F} -${string}> ${string}` ? F : never
type To<K> = K extends `${string} -${string}> ${infer T}` ? T : never
type StateName<S extends StateVocab> = S['name']
type Key<S extends StateVocab> = `${StateName<S>} -${string}> ${StateName<S>}`

type StatesFromKeys<K extends string> = {
	[N in From<K> | To<K>]: { readonly name: N }
}[From<K> | To<K>]

/** The row shape, with the source state left as a plain inference site. */
type LeakyTable<S extends StateVocab, K extends string> = {
	readonly [P in K]: P extends Key<S>
		? (args: { readonly state: Extract<S, { name: From<P> }> }) => void
		: `not a transition: '${P}'`
}

/** The same, with that one position closed. */
type FixedTable<S extends StateVocab, K extends string> = {
	readonly [P in K]: P extends Key<S>
		? (args: { readonly state: NoInfer<Extract<S, { name: From<P> }>> }) => void
		: `not a transition: '${P}'`
}

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
// The negative: without `NoInfer`, a context-sensitive handler poisons its own
// well-formed row. This is the tripwire — it must keep failing.
// ---------------------------------------------------------------------------

leaky({
	transitions: {
		// @ts-expect-error - well formed, yet rejected: the handler destructures
		// its argument, so `S` is inferred from this parameter as well as from
		// `states`, and `Key<S>` collapses
		'off -go> on': ({ state }) => {
			void state
		},
	},
})

// A handler that destructures nothing is not context-sensitive, so the same
// row is accepted even in the leaky form — which is what makes the failure
// above look intermittent rather than structural.
leaky({ transitions: { 'off -go> on': () => {} } })

// ---------------------------------------------------------------------------
// The positive: with `NoInfer`, both paths resolve.
// ---------------------------------------------------------------------------

// Inferred vocabulary: the row is accepted and `state` is the narrowed member.
const inferred = fixed({
	transitions: {
		'off -go> on': ({ state }) => {
			assertType<Equal<typeof state, { readonly name: 'off' }>>()
		},
	},
})
assertType<Equal<StateName<typeof inferred>, 'off' | 'on'>>()

// Declared vocabulary: `states` is still the inference site it was, and the
// declared payload survives — the thing a blunter `NoInfer` around the whole
// type argument destroys, turning every `state` into `never`.
type Doc = { name: 'empty' } | { name: 'draft'; text: string }
declare const doc: Doc | undefined
const declared = fixed({
	states: doc,
	transitions: {
		'empty -open> draft': ({ state }) => {
			assertType<Equal<typeof state, { name: 'empty' }>>()
		},
		'draft -open> empty': ({ state }) => {
			assertType<Equal<typeof state, { name: 'draft'; text: string }>>()
		},
	},
})
assertType<Equal<typeof declared, Doc>>()

// A genuinely malformed row is still rejected, on its own line: closing the
// inference site does not cost the diagnostic the notation exists to give.
fixed({
	transitions: {
		'off -go> on': ({ state }) => {
			void state
		},
		// @ts-expect-error - no space after '>', so this is not a transition
		'off -go>on': () => {},
	},
})
