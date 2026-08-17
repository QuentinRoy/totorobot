// Notation C -- the declared target list, at a VALUE position.
//
//     submit: { to: ['review', 'published'], with: ({ input, at }) => ... }
//
// Goal: everything notation B gives, but with the targets as values rather than
// as a type annotation -- so the editor offers completions with no nameable
// union, and the reader scans strings rather than types.
//
// The hard part is holding `with` to EXACTLY the declared list. Solved here by
// enumerating target sets as a cross product of mapped types: one member per
// single target, one per ordered pair. `at` inside the handler is then
// restricted to precisely the declared set.

declare const dataBrand: unique symbol
declare const inputBrand: unique symbol

export interface Data<T> {
	readonly [dataBrand]?: (t: T) => T
}
export interface Input<T> {
	readonly [inputBrand]?: (t: T) => T
}
export function data<T>(): Data<T> {
	return {}
}
export function input<T>(): Input<T> {
	return {}
}
export type DataOf<X> = X extends Data<infer T> ? T : never
export type InputOf<X> = X extends Input<infer T> ? T : never

export type AnyStates = Record<string, Data<any>>
export type AnyInputs = Record<string, Input<any>>

export interface To<N extends string> {
	readonly kind: 'to'
	readonly to: N
	readonly data: unknown
}
export interface Keep {
	readonly kind: 'keep'
	readonly data: unknown
}
export interface Repeat {
	readonly kind: 'repeat'
	readonly data: unknown
}
export interface None {
	readonly kind: 'none'
}

/** Target-bound constructors, restricted to the declared target set `Ns`. */
export type At<S extends AnyStates, Ns extends keyof S & string> = {
	[N in Ns]: [DataOf<S[N]>] extends [void]
		? () => To<N>
		: (data: DataOf<S[N]>) => To<N>
}

export interface Ctx<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
	Ns extends keyof S & string,
> {
	readonly data: DataOf<S[K]>
	readonly input: InputOf<I[E]>
	readonly at: At<S, Ns>
	readonly keep: (data: DataOf<S[K]>) => Keep
	readonly repeat: (data: DataOf<S[K]>) => Repeat
	readonly none: () => None
}

/** One target. */
export type Edge1<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = {
	[N in keyof S & string]: {
		readonly to: N
		readonly with: (ctx: Ctx<S, I, K, E, N>) => To<N> | None
	}
}[keyof S & string]

/** Two targets, as an ordered pair. Cross product of the state names. */
export type Edge2<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = {
	[A in keyof S & string]: {
		[B in keyof S & string]: {
			readonly to: A
			readonly or: B
			readonly with: (ctx: Ctx<S, I, K, E, A | B>) => To<A | B> | None
		}
	}[keyof S & string]
}[keyof S & string]

/** Stay in the current state, or refuse. No target to declare. */
export type EdgeSame<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = {
	readonly here: (ctx: Ctx<S, I, K, E, never>) => Keep | Repeat | None
}

export type Edge<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = Edge1<S, I, K, E> | Edge2<S, I, K, E> | EdgeSame<S, I, K, E>

export type StateDef<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
> = {
	readonly data: S[K]
	readonly on?: { readonly [E in keyof I]?: Edge<S, I, K, E> }
}

export declare function machine<S extends AnyStates, I extends AnyInputs>(def: {
	readonly initial: keyof S
	readonly inputs: I
	readonly states: { readonly [K in keyof S]: StateDef<S, I, K> }
}): { readonly initial: keyof S }
