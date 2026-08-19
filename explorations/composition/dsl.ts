/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The type machinery both models share. It is a re-implementation of the
 * library's own (`Table`, `Transition`, `Dispatch`), because those are
 * module-local on purpose — a prototype that wanted to extend `machine()` had
 * to restate them. Nothing here is a design proposal; it is scaffolding so the
 * two authoring surfaces in `model-a.ts` and `model-b.ts` can be real.
 */

import type { Skip } from '../../src/totorobot.ts'

export type Vocab = Record<string, unknown>
export type Names<V> = keyof V & string

/** `'a -b> c'` and `'a -> c'`; the unlabelled arrow gives an empty label. */
export type PFrom<P extends string> =
	P extends `${infer F} -${string}> ${string}` ? F : never
export type PLabel<P extends string> =
	P extends `${string} -${infer L}> ${string}` ? L : never
export type PTo<P extends string> = P extends `${string} -${string}> ${infer T}`
	? T
	: never

/** `*` opens a coordinate to every name. */
export type Open<X extends string, All extends string> = X extends '*'
	? All
	: X & All

export type At<S, K extends string> = {
	[N in K & Names<S>]: { readonly state: N; readonly data: S[N] }
}[K & Names<S>]

export type Snap<S> = At<S, Names<S>>

/** The transition record, narrowed by the pattern that selected it. */
export type Rec<I, S, P extends string> = P extends unknown
	? | {
				[N in Open<PLabel<P>, Names<I>>]: {
					readonly on: N
					readonly input: I[N]
					readonly from: At<S, Open<PFrom<P>, Names<S>>>
					readonly to: At<S, Open<PTo<P>, Names<S>>>
				}
		  }[Open<PLabel<P>, Names<I>>]
		| ([PLabel<P>] extends ['']
				? {
						readonly on: undefined
						readonly input: undefined
						readonly from: At<S, Open<PFrom<P>, Names<S>>>
						readonly to: At<S, Open<PTo<P>, Names<S>>>
					}
				: never)
	: never

/** Arity follows the payload: a `void` entry takes no argument. */
export type Args<V> = {
	[N in Names<V>]: [V[N]] extends [void] ? [name: N] : [name: N, payload: V[N]]
}[Names<V>]

export type Post<V> = (...args: Args<V>) => void

export type StartArgs<S, Init extends string> = [S[Init & Names<S>]] extends [
	void,
]
	? []
	: [data: S[Init & Names<S>]]

/** One row per edge — the same shape the library's `Table` gives. */
export type Table<I extends Vocab, S extends Vocab, K extends string> = {
	[P in K]: (arg: {
		readonly data: S[PFrom<P> & Names<S>]
		readonly input: I[PLabel<P> & Names<I>]
		readonly skip: () => Skip
	}) => S[PTo<P> & Names<S>] | Skip
}

/** A trigger is an edge pattern when it contains an arrow, a state otherwise. */
export const isEdge = (trigger: string): boolean => trigger.includes('> ')

const PERSISTENT = Symbol('persistent')

/**
 * The residency policy wrapper from rationale §9. The default is to restart on
 * re-entry; `persistent` survives a self-transition instead.
 *
 * Both models need it, and Example 1 shows why: a state can hold two residents
 * that want opposite answers — a dwell timer that must NOT restart when the
 * stroke moves, and a trail that must.
 */
export const persistent = <A, R>(fn: (arg: A) => R): ((arg: A) => R) => {
	const wrapped = (arg: A) => fn(arg)
	Object.defineProperty(wrapped, PERSISTENT, { value: true })
	return wrapped
}

export const isPersistent = (fn: unknown): boolean =>
	Boolean((fn as Record<symbol, unknown> | undefined)?.[PERSISTENT])
