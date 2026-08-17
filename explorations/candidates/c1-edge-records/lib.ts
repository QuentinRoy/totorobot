// Candidate 1 -- encoding (d), the discriminated edge record, single declaration site.
//
// The target is a sibling property sitting immediately after the input key:
//
//     on: { open: { to: 'draft', with: ({ input }) => ({ ... }) } }
//
// Note 06 F17 measured this as the only encoding that is simultaneously
// arrow-test compliant, completion-driven, and equipped with TS2820
// did-you-mean errors. Zag v1 shipped it independently.
//
// The single declaration site uses note 06 F1/F2's mechanism: state data and
// input payloads are declared as NON-FUNCTION values (`data<T>()`, `input<T>()`)
// in the same object literal as the handlers, so TypeScript's
// CheckMode.SkipContextSensitive pass infers them first and every handler gets a
// contextual type computed from EVERY sibling state's data.

// --- phantom markers ---------------------------------------------------------

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

// --- the handler context -----------------------------------------------------

export interface Ctx<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> {
	readonly data: DataOf<S[K]>
	readonly input: InputOf<I[E]>
}

// --- the edge ----------------------------------------------------------------
//
// A state whose data is `void` needs no `with`, which is what makes the toggle
// cheap: `{ to: 'on' }` and nothing else.

// The outcome kind is the edge record's FIRST KEY, so it sits at a fixed
// syntactic position alongside the target. The algebra has four members
// (brief section 6): `to` = next_state, `keep` = keep_state, `repeat` =
// repeat_state, `none` = no transition.

export type Change<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = {
	[N in keyof S]: [DataOf<S[N]>] extends [void]
		? { readonly to: N }
		: {
				readonly to: N
				readonly with: (ctx: Ctx<S, I, K, E>) => DataOf<S[N]>
			}
}[keyof S]

export type Same<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = [DataOf<S[K]>] extends [void]
	? { readonly keep: true } | { readonly repeat: true }
	: | { readonly keep: (ctx: Ctx<S, I, K, E>) => DataOf<S[K]> }
		| { readonly repeat: (ctx: Ctx<S, I, K, E>) => DataOf<S[K]> }

export type NoTransition = { readonly none: true }

export type Outcome<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = Change<S, I, K, E> | Same<S, I, K, E> | NoTransition

/** A guarded clause. Clauses are tried in order; the last must be unguarded. */
export type Guarded<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = { readonly when: (ctx: Ctx<S, I, K, E>) => boolean } & Outcome<S, I, K, E>

export type Edge<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
> = Outcome<S, I, K, E>

export type StateDef<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
> = {
	readonly data: S[K]
	readonly on?: { readonly [E in keyof I]?: Edge<S, I, K, E> }
}

export interface Machine<S extends AnyStates, I extends AnyInputs> {
	readonly initial: keyof S
	readonly states: { readonly [K in keyof S]: StateDef<S, I, K> }
}

export declare function machine<S extends AnyStates, I extends AnyInputs>(def: {
	readonly initial: keyof S
	readonly inputs: I
	readonly states: { readonly [K in keyof S]: StateDef<S, I, K> }
}): Machine<S, I>
