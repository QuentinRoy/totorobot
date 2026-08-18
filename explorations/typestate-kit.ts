/**
 * The previous generation's type surface, kept for the two API-shape records
 * that prototype against it.
 *
 * `option-a` and `option-b` ask how a spec should be handed to the builder, and
 * they answer it by compiling — one fails, one succeeds, and the failure is the
 * finding. Both were written against the library entry of the day. v1 replaced
 * that entry with a transition table, so the declarations they need moved here
 * rather than being deleted with it: the records only ever needed the shapes,
 * never the implementation, so this file is types and ambient signatures alone.
 *
 * Nothing outside those two files should import this. It documents a design
 * that was not adopted.
 */

/**
 * The shape a machine spec must have. `states` maps a state name to the context
 * that state carries; `events` maps an event name to the payload it carries in
 * addition to its `type` field. Event names may be strings or symbols.
 */
export interface MachineSpec {
	readonly states: object
	readonly events: object
}

export type StateName<S extends MachineSpec> = keyof S['states'] & string
export type EventName<S extends MachineSpec> = keyof S['events']

/** The context carried by state `K`. */
export type ContextOf<
	S extends MachineSpec,
	K extends StateName<S>,
> = S['states'][K & keyof S['states']]

/** The full event object for event `E`: its `type` plus its declared payload. */
export type EventObject<
	S extends MachineSpec,
	E extends EventName<S>,
> = E extends unknown
	? { readonly type: E } & S['events'][E & keyof S['events']]
	: never

/** Every event the machine accepts. */
export type AnyEvent<S extends MachineSpec> = EventObject<S, EventName<S>>

// ---------------------------------------------------------------------------
// Modifiers
//
// These are real runtime objects, not phantom-typed markers: `kind` and `apply`
// both exist. That keeps the public surface honest (no `__types` placeholders)
// and, more importantly, puts `Context`/`Event` in `apply`'s parameter positions,
// where TypeScript's contravariance gives reusable combinators the variance
// they need. Branding a modifier with a tuple of its type parameters instead
// makes it invariant, and a guard written against `{ attempts: number }` would
// stop fitting a state whose context is `{ attempts: number; tries: number }`.
// ---------------------------------------------------------------------------

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

export type Modifier<Context, Event, Output> =
	| ReduceModifier<Context, Event, Output>
	| GuardModifier<Context, Event>
	| ActionModifier<Context, Event>

/** Modifiers that leave the context shape alone, so any number may appear. */
export type ShapeNeutralModifier<Context, Event> =
	GuardModifier<Context, Event> | ActionModifier<Context, Event>

/**
 * The modifier list a transition accepts: any number of guards and actions,
 * then an optional trailing reducer - guards decide, then the context is mapped.
 *
 * When `Context` is not assignable to `Output` the reducer stops being optional. A
 * transition between differently shaped states cannot silently carry the source
 * context across, and stating the rule in the signature is what makes the checker
 * enforce it instead of the documentation.
 *
 * Fixing the reducer's position is also what keeps a transition to one reducer.
 * robot3 pipelines them (each receives the previous one's output), which cannot
 * be typed once context is per-state: reducer n's input is reducer n-1's output,
 * and that fold is not expressible through the inference path used here.
 */
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

/**
 * Map the source context to the target state's context. At most one per transition.
 * It may be omitted when the source context is already assignable to the target's.
 */
declare function reduce<Context, Event, Output>(
	apply: (context: Context, event: Event) => Output,
): ReduceModifier<Context, Event, Output>

/**
 * Veto the transition. Multiple guards are evaluated in order and combined with
 * `&&`, so the first one to return `false` stops the rest from running.
 */
declare function guard<Context, Event>(
	apply: (context: Context, event: Event) => boolean,
): GuardModifier<Context, Event>

/**
 * A side effect. Runs in order once every guard has passed, before the state
 * changes, and receives the *source* context - which is what its type says.
 * Unlike robot3's `action` (sugar over `reduce`, so its output shape had to
 * equal its input shape) this is its own kind, so it can be attached to a
 * transition that changes shape.
 */
declare function action<Context, Event>(
	apply: (context: Context, event: Event) => void,
): ActionModifier<Context, Event>

// ---------------------------------------------------------------------------
// Transitions and states
// ---------------------------------------------------------------------------

/**
 * `Context` binds the source state's context; `Handled` records which event this
 * transition responds to, so `state(...)` can collect the set of events a state
 * accepts and `send` can be narrowed to it.
 */
export interface TransitionDefinition<Context, Handled> {
	readonly handles: Handled
	readonly target: string
	readonly modifiers: readonly Modifier<Context, never, unknown>[]
}

/** A settlement branch of an `invoke` state. */
export interface SettlementDefinition<Context, Result> {
	readonly settlement: 'done' | 'error'
	readonly target: string
	readonly modifiers: readonly Modifier<Context, Result, unknown>[]
}

export interface StateDefinition<S extends MachineSpec, K, Handled> {
	readonly state?: K
	readonly handles?: Handled
	readonly transitions: readonly TransitionDefinition<
		ContextOf<S, StateName<S>>,
		EventName<S>
	>[]
	readonly source:
		((context: never, signal: AbortSignal) => Promise<unknown>) | undefined
	readonly settlements: readonly SettlementDefinition<never, never>[]
}

/** The events state `K` of a built machine actually handles. */
export type HandledBy<States, K extends keyof States> = States[K] extends {
	readonly handles?: infer Handled
}
	? Exclude<Handled, undefined>
	: never

// ---------------------------------------------------------------------------
// The builder kit
// ---------------------------------------------------------------------------

export interface InvokeKit<
	S extends MachineSpec,
	K extends StateName<S>,
	Result,
> {
	/** Taken when the source promise resolves. `result` is its resolved value. */
	done: <To extends StateName<S>>(
		target: To,
		...modifiers: TransitionModifiers<ContextOf<S, K>, Result, ContextOf<S, To>>
	) => SettlementDefinition<ContextOf<S, K>, Result>
	/** Taken when the source promise rejects. `error` is `unknown`, as it must be. */
	error: <To extends StateName<S>>(
		target: To,
		...modifiers: TransitionModifiers<
			ContextOf<S, K>,
			unknown,
			ContextOf<S, To>
		>
	) => SettlementDefinition<ContextOf<S, K>, Result>
}

export interface StateBuilder<S extends MachineSpec> {
	(): StateDefinition<S, never, never>
	<K extends StateName<S>, Handled extends EventName<S>>(
		transition: TransitionDefinition<ContextOf<S, K>, Handled>,
		...transitions: TransitionDefinition<ContextOf<S, K>, Handled>[]
	): StateDefinition<S, K, Handled>
}

export interface InvokeBuilder<S extends MachineSpec> {
	<K extends StateName<S>, Result>(
		source: (context: ContextOf<S, K>, signal: AbortSignal) => Promise<Result>,
		settlements: (
			kit: InvokeKit<S, K, Result>,
		) => SettlementDefinition<ContextOf<S, K>, Result>[],
	): StateDefinition<S, K, never>
}

export interface Kit<S extends MachineSpec> {
	reduce: typeof reduce
	guard: typeof guard
	action: typeof action
	state: StateBuilder<S>

	/**
	 * An edge. Guards and actions may appear in any order, followed by an
	 * optional reducer (robot3 partitions modifiers by kind, so their relative
	 * order was never meaningful anyway).
	 *
	 * The reducer is *required* exactly when the source context is not already
	 * assignable to the target's - which is the only way to state that rule so
	 * the checker enforces it rather than the documentation.
	 */
	transition: <Context, E extends EventName<S>, To extends StateName<S>>(
		event: E,
		target: To,
		...modifiers: TransitionModifiers<
			Context,
			EventObject<S, E>,
			ContextOf<S, To>
		>
	) => TransitionDefinition<Context, E>

	/**
	 * A state that runs a promise on entry.
	 *
	 * The settlement branches are built by a callback rather than passed
	 * variadically, because `Result` has to be fixed by `source` before `done`'s
	 * modifiers can be checked against it. Passing `done(...)` as a sibling
	 * argument leaves `Result` unresolved and its reducer sees `unknown`.
	 */
	invoke: InvokeBuilder<S>
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export interface Machine<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
	Initial extends StateName<S>,
> {
	readonly states: States
	readonly initial: Initial
}
