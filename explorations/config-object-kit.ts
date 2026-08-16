/**
 * Shared machinery for the config-object family of prototypes (Options D, E
 * and F of [Design explorations](../docs/api-rationale.md)).
 *
 * None of this is the real library. Every function here is `declare`d: these
 * files exist to record what TypeScript can and cannot infer for a proposed
 * API shape, so only the signatures matter.
 *
 * Two things differ from the current API. The spec is carried as a *value*
 * (`types: {} as Spec`) rather than fixed through an explicit type argument,
 * and `state` / `transition` / `reduce` / `guard` are top-level functions
 * rather than members of a kit handed to a builder callback.
 */

/** States and events are discriminated unions keyed by `name`. */
export interface MachineSpec {
	readonly states: { readonly name: string }
	readonly events: { readonly name: string }
}

export type StateName<S extends MachineSpec> = S['states']['name']
export type EventName<S extends MachineSpec> = S['events']['name']

export type ContextOf<S extends MachineSpec, K extends StateName<S>> = Omit<
	Extract<S['states'], { name: K }>,
	'name'
>

export type EventObject<
	S extends MachineSpec,
	E extends EventName<S>,
> = Extract<S['events'], { name: E }>

export interface ReduceModifier<Context, Event, Output> {
	readonly kind: 'reduce'
	readonly apply: (context: Context, event: Event) => Output
}
export interface GuardModifier<Context, Event> {
	readonly kind: 'guard'
	readonly apply: (context: Context, event: Event) => boolean
}
export interface ActionModifier<Context, Event> {
	readonly kind: 'action'
	readonly apply: (context: Context, event: Event) => void
}

export type ShapeNeutralModifier<Context, Event> =
	GuardModifier<Context, Event> | ActionModifier<Context, Event>

/** Unchanged from the real library: a reducer is required exactly when the
 * source context is not already assignable to the target's. */
export type TransitionModifiers<Context, Event, Output> = [Context] extends [
	Output,
]
	? | ShapeNeutralModifier<Context, Event>[]
		| [
				...ShapeNeutralModifier<Context, Event>[],
				ReduceModifier<Context, Event, Output>,
		  ]
	: [
			...ShapeNeutralModifier<Context, Event>[],
			ReduceModifier<Context, Event, Output>,
		]

export declare function reduce<Context, Event, Output>(
	apply: (context: Context, event: Event) => Output,
): ReduceModifier<Context, Event, Output>

export declare function guard<Context, Event>(
	apply: (context: Context, event: Event) => boolean,
): GuardModifier<Context, Event>

/**
 * `Context` is a free type parameter rather than `ContextOf<S, K>`.
 *
 * This is not a stylistic choice. Deriving the source context from `K` inside
 * `TransitionModifiers` makes resolving that conditional force `To` before the
 * `target` argument has been read, and `To` then collapses onto `K` - so
 * `transition("login", "authenticating", ...)` is rejected with
 * `"authenticating" is not assignable to "idle"`. The first version of all
 * three config-object prototypes hit this. The real `Kit` in
 * [`src/totorobot.ts`](../src/totorobot.ts) already carries `Context` this way,
 * for an unrelated reason (variance of reusable combinators).
 */
export interface TransitionDefinition<S extends MachineSpec, Context, Handled> {
	readonly spec: S
	readonly context: (context: Context) => void
	readonly handles: Handled
}

export interface StateDefinition<S extends MachineSpec, K, Handled> {
	readonly spec: S
	readonly state: K
	readonly handles: Handled
}

/** The counterpart to `TransitionDefinition` for `invoke`'s `done`/`error`
 * edges - a branch taken when the invoked promise settles rather than when an
 * event is sent. */
export interface SettlementDefinition<S extends MachineSpec, Context, Result> {
	readonly spec: S
	readonly context: (context: Context) => void
	readonly result: (result: Result) => void
}

export interface InvokeKit<
	S extends MachineSpec,
	K extends StateName<S>,
	Result,
> {
	/** Taken when the source promise resolves. `result` is its resolved value. */
	readonly done: <To extends StateName<S>>(
		target: To,
		...modifiers: TransitionModifiers<ContextOf<S, K>, Result, ContextOf<S, To>>
	) => SettlementDefinition<S, ContextOf<S, K>, Result>
	/** Taken when the source promise rejects. `error` is `unknown`, as it must
	 * be. */
	readonly error: <To extends StateName<S>>(
		target: To,
		...modifiers: TransitionModifiers<
			ContextOf<S, K>,
			unknown,
			ContextOf<S, To>
		>
	) => SettlementDefinition<S, ContextOf<S, K>, Result>
}

export declare function transition<
	S extends MachineSpec,
	Context,
	E extends EventName<S>,
	To extends StateName<S>,
>(
	event: E,
	target: To,
	...modifiers: TransitionModifiers<
		Context,
		EventObject<S, E>,
		ContextOf<S, To>
	>
): TransitionDefinition<S, Context, E>

export interface Machine<S extends MachineSpec, States, Initial> {
	readonly spec: S
	readonly states: States
	readonly initial: Initial
}

// ---------------------------------------------------------------------------
// Assertion helpers
//
// These files are not run, and vitest never sees them, so `expectTypeOf` would
// pull a test dependency into non-test code for no benefit.
// ---------------------------------------------------------------------------

export type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false

export declare function assertType<_T extends true>(): void

// ---------------------------------------------------------------------------
// The fixture every prototype builds: the authentication machine, restated in
// the discriminated-union spec shape.
// ---------------------------------------------------------------------------

export interface IdleContext {
	readonly attempts: number
}

export interface LoginPayload {
	readonly username: string
}

export type AuthSpec = {
	states:
		| ({ name: 'idle' } & IdleContext)
		| { name: 'authenticating'; username: string }
		| { name: 'authenticated'; token: string }
	events:
		| ({ name: 'login' } & LoginPayload)
		| { name: 'ping'; count: number }
		| { name: 'success'; token: string }
}

/** What `ContextOf<AuthSpec, "idle">` should resolve to. */
export type IdleContextOf = { readonly attempts: number }

/** What `EventObject<AuthSpec, "login">` should resolve to. */
export type LoginEvent = { name: 'login' } & LoginPayload
