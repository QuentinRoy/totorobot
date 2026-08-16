// Notation D -- targets as KEYS.
//
//     submit: {
//         review:    ({ data, input, skip }) => input.route === 'review' ? {...} : skip(),
//         published: ({ data, input, skip }) => input.route === 'publish' ? [...] : skip(),
//     }
//
// The target is a key of a homomorphic mapped type over `keyof S`, so every
// branch has its own target `N` and there is no union for TypeScript to
// discriminate -- which is what killed the tuple and cross-product encodings
// (see c3-target-list). Branches are tried in declaration order; the first that
// does not `skip()` wins. Each branch is ONE function, so narrowing works.
//
// --- why a data-free state can just omit `data` ------------------------------
//
// An earlier version required `data` on every state and shipped a `nothing`
// constant to write in the empty ones. Omitting it looked like it worked and
// did not: with no marker there is no inference candidate for `S[K]`,
// TypeScript substitutes the CONSTRAINT, and checking silently collapses.
//
// Two measured facts removed the placeholder.
//
//   1. The substitution is ALL-OR-NOTHING. If the inferred `S` fails the
//      constraint on ONE key, the WHOLE of `S` becomes the constraint -- so
//      `Record<string, Data<any>>` poisoned every state, not just the bare one.
//      Widen the constraint to `Record<string, unknown>` and a bare state
//      infers `unknown` while every other state keeps its real type.
//   2. The fallback therefore belongs in `DataOf`, not in the constraint: no
//      marker means no data, so `DataOf<unknown>` is `void`.
//
// One case remains where the names genuinely cannot be recovered; it is a
// compile error rather than a silent loss of checking. See `machine` below.

declare const dataBrand: unique symbol
declare const inputBrand: unique symbol
declare const cmdBrand: unique symbol
declare const skipBrand: unique symbol

export interface Data<T> {
	readonly [dataBrand]?: (t: T) => T
}
export interface Input<T> {
	readonly [inputBrand]?: (t: T) => T
}
export interface Commands<T> {
	readonly [cmdBrand]?: (t: T) => T
}
/** The "not this branch" sentinel. Branded so it cannot collide with user data. */
export interface Skip {
	readonly [skipBrand]: true
}

export function data<T>(): Data<T> {
	return {}
}
export function input<T>(): Input<T> {
	return {}
}
export function command<T>(): Commands<T> {
	return {}
}

/** No marker means no data. This default is what makes `data` omittable. */
export type DataOf<X> = X extends Data<infer T> ? T : void
export type InputOf<X> = X extends Input<infer T> ? T : never
export type CommandOf<X> = X extends Commands<infer T> ? T : never

/**
 * Deliberately as wide as possible. A state that omits `data` infers `unknown`
 * for its slot, and if `unknown` failed this constraint TypeScript would
 * discard the WHOLE inferred map, not just that slot.
 */
export type AnyStates = Record<string, unknown>
export type AnyInputs = Record<string, Input<any>>

/** What a branch receives. */
export interface BranchCtx<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
	C,
> {
	readonly data: DataOf<S[K]>
	readonly input: InputOf<I[E]>
	/** Decline this branch; the next one is tried. */
	readonly skip: () => Skip
	/** Attach effects to this branch's commit. */
	readonly emit: (...commands: readonly C[]) => void
}

/**
 * One input's outgoing branches. Target names are KEYS, so they sit at fixed,
 * formatter-stable positions, get completions, and never need a type
 * annotation.
 *
 * `&` is this state, as in CSS. It is the ONLY non-state key, it is not a valid
 * identifier so it cannot collide with a state name, and it is what makes the
 * outcome algebra fall out of the notation instead of needing reserved words:
 *
 *     '&': fn        stay here      -- residency preserved   (keep_state)
 *     draft: fn      ENTER `draft`  -- residency re-runs     (repeat_state,
 *                                      when written inside `draft` itself)
 *     review: fn     go to `review` -- residency re-runs     (next_state)
 *     skip()         no transition
 *
 * Re-entering the state you are in is not a special case at all: it is an
 * ordinary transition whose target happens to be the current state.
 */
export type Edge<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
	C,
> =
	// Bare `'&'` -- handled, nothing changes at all.
	| '&'
	| { [N in keyof S]: [DataOf<S[N]>] extends [void] ? N : never }[keyof S]
	// `object &` is load-bearing: without it a bare string is structurally
	// assignable to this all-optional member, and every invalid target name is
	// silently accepted. (d1 only caught them because `String.prototype.repeat`
	// happened to collide with the reserved `repeat` key.)
	| (object & {
			readonly [N in keyof S]?: (
				ctx: BranchCtx<S, I, K, E, C>,
			) => DataOf<S[N]> | Skip
	  } & {
			readonly '&'?: (ctx: BranchCtx<S, I, K, E, C>) => DataOf<S[K]> | Skip
	  })

export type StateDef<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	C,
> = {
	/** Omit entirely when the state carries no data. */
	readonly data?: S[K]
	readonly enter?: (ctx: { readonly data: DataOf<S[K]> }) => readonly C[]
	readonly exit?: (ctx: { readonly data: DataOf<S[K]> }) => readonly C[]
	readonly on?: { readonly [E in keyof I]?: Edge<S, I, K, E, C> }
}

export type StateValue<S extends AnyStates> = {
	[K in keyof S & string]: {
		readonly state: K
		readonly data: DataOf<S[K]>
	}
}[keyof S & string]

export type Step<S extends AnyStates, C> =
	| {
			readonly kind: 'none'
			readonly reason: 'declined' | 'unavailable'
			readonly commands: readonly C[]
	  }
	| {
			readonly kind: 'keep' | 'repeat' | 'to'
			readonly next: StateValue<S>
			readonly commands: readonly C[]
	  }

export interface Machine<
	S extends AnyStates,
	I extends AnyInputs,
	C,
	D = { readonly [K in keyof S]: StateDef<S, I, K, C> },
> {
	readonly initial: keyof S
	readonly states: D
}

/** Recover the inferred state map from a machine -- used by the checks. */
export type StatesOf<M> = M extends Machine<infer S, any, any, any> ? S : never

/** The inputs state `K` declared -- the basis of send-site checking. */
export type Handled<I extends AnyInputs, D, K extends keyof D> = D[K] extends {
	readonly on: infer O
}
	? keyof O & keyof I
	: never

/**
 * The one case where omitting `data` costs something, made loud.
 *
 * Two things have to coincide (see README, and check.ts for the measurements):
 * nothing in the states object is inferable, AND `S` occurs in a closure
 * parameter's type -- which it always does, since `ctx.data` is `DataOf<S[K]>`.
 * So: every state data-free and every branch a closure leaves nothing to infer
 * the names from, and `keyof S` widens to `string`, silently unchecking every
 * target name. This unsatisfiable member turns that into a compile error whose
 * text is the fix.
 */
type CannotInferStateNames = {
	readonly 'Cannot infer the state names: every state is data-free and every branch is a closure. Give one state a `data` marker, or write one transition as a bare target name.': never
}

export function machine<
	S extends AnyStates,
	I extends AnyInputs,
	Cm extends Commands<any> = Commands<any>,
	D = unknown,
>(
	def: { readonly states: D } & {
		readonly initial: keyof S
		readonly inputs: I
		readonly commands?: Cm
		readonly states: {
			readonly [K in keyof S]: StateDef<S, I, K, CommandOf<Cm>>
		}
	} & (string extends keyof S ? CannotInferStateNames : unknown),
): Machine<S, I, CommandOf<Cm>, D & { readonly [K in keyof S]: unknown }> {
	return def as unknown as Machine<
		S,
		I,
		CommandOf<Cm>,
		D & { readonly [K in keyof S]: unknown }
	>
}
