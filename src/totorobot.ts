/**
 * A finite state machine with per-state context ("typestate"), built from a spec
 * declared up front.
 *
 * An earlier design declared a state's context inline, which means a
 * transition's target type is not yet known while the type checker is looking
 * at the reducer nested in the same object literal. That forced target checking
 * into a deferred, machine-wide validation at `defineMachine(...)`, with the
 * unreadable errors that came with it.
 *
 * Here the spec - every state's context and every event's payload - is a type
 * argument, so both ends of a transition are known when its modifiers are
 * checked. A wrong reducer output is reported on the `reduce(...)` call itself.
 *
 *     defineMachine<Spec>().create("idle", ({
 *       state, final, transition, guard, reduce,
 *     }) => ({
 *       idle: state(
 *         transition("login", "authenticating",
 *           guard((context, event) => event.username.length > 0),
 *           reduce((context, event) => ({ ... })),
 *         ),
 *       ),
 *       authenticated: final(),
 *     }))
 *
 * `context` and `event` are inferred from the enclosing state key and the event
 * name. Nothing is annotated by hand.
 */

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

/**
 * The shape a machine spec must have. `states` maps a state name to the context
 * that state carries; `events` maps an event name to the payload it carries in
 * addition to its `type` field. Event names may be strings or symbols.
 */
export interface MachineSpec {
	readonly states: object
	readonly events: object
}

export type StateName<S extends MachineSpec> = keyof S["states"] & string
export type EventName<S extends MachineSpec> = keyof S["events"]

/** The context carried by state `K`. */
export type ContextOf<S extends MachineSpec, K extends StateName<S>> =
	S["states"][K & keyof S["states"]]

/** The full event object for event `E`: its `type` plus its declared payload. */
export type EventObject<S extends MachineSpec, E extends EventName<S>> =
	E extends unknown
		? { readonly type: E } & S["events"][E & keyof S["events"]]
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
	readonly kind: "reduce"
	readonly apply: (context: Context, event: Event) => Output
}

export interface GuardModifier<Context, Event> {
	readonly kind: "guard"
	readonly apply: (context: Context, event: Event) => boolean
}

export interface ActionModifier<Context, Event> {
	readonly kind: "action"
	readonly apply: (context: Context, event: Event) => void
}

export type Modifier<Context, Event, Output> =
	| ReduceModifier<Context, Event, Output>
	| GuardModifier<Context, Event>
	| ActionModifier<Context, Event>

/** Modifiers that leave the context shape alone, so any number may appear. */
export type ShapeNeutralModifier<Context, Event> =
	| GuardModifier<Context, Event>
	| ActionModifier<Context, Event>

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
export type TransitionModifiers<Context, Event, Output> =
	[Context] extends [Output]
		?
				| ShapeNeutralModifier<Context, Event>[]
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
function reduce<Context, Event, Output>(
	apply: (context: Context, event: Event) => Output,
): ReduceModifier<Context, Event, Output> {
	return { kind: "reduce", apply }
}

/**
 * Veto the transition. Multiple guards are evaluated in order and combined with
 * `&&`, so the first one to return `false` stops the rest from running.
 */
function guard<Context, Event>(
	apply: (context: Context, event: Event) => boolean,
): GuardModifier<Context, Event> {
	return { kind: "guard", apply }
}

/**
 * A side effect. Runs in order once every guard has passed, before the state
 * changes, and receives the *source* context - which is what its type says.
 * Unlike robot3's `action` (sugar over `reduce`, so its output shape had to
 * equal its input shape) this is its own kind, so it can be attached to a
 * transition that changes shape.
 */
function action<Context, Event>(
	apply: (context: Context, event: Event) => void,
): ActionModifier<Context, Event> {
	return { kind: "action", apply }
}

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
	readonly settlement: "done" | "error"
	readonly target: string
	readonly modifiers: readonly Modifier<Context, Result, unknown>[]
}

export interface StateDefinition<
	S extends MachineSpec,
	K,
	Handled,
	Final extends boolean = boolean,
> {
	readonly state?: K
	readonly handles?: Handled
	readonly final: Final
	readonly transitions: readonly TransitionDefinition<
		ContextOf<S, StateName<S>>,
		EventName<S>
	>[]
	readonly source:
		| ((context: never, signal: AbortSignal) => Promise<unknown>)
		| undefined
	readonly settlements: readonly SettlementDefinition<never, never>[]
}

type AnyStateDefinition<S extends MachineSpec> = StateDefinition<
	S,
	StateName<S>,
	EventName<S>,
	boolean
>

/** The events state `K` of a built machine actually handles. */
export type HandledBy<States, K extends keyof States> =
	States[K] extends { readonly handles?: infer Handled }
		? Exclude<Handled, undefined>
		: never

// ---------------------------------------------------------------------------
// The builder kit
// ---------------------------------------------------------------------------

export interface InvokeKit<S extends MachineSpec, K extends StateName<S>, Result> {
	/** Taken when the source promise resolves. `result` is its resolved value. */
	done: <To extends StateName<S>>(
		target: To,
		...modifiers: TransitionModifiers<ContextOf<S, K>, Result, ContextOf<S, To>>
	) => SettlementDefinition<ContextOf<S, K>, Result>
	/** Taken when the source promise rejects. `error` is `unknown`, as it must be. */
	error: <To extends StateName<S>>(
		target: To,
		...modifiers: TransitionModifiers<ContextOf<S, K>, unknown, ContextOf<S, To>>
	) => SettlementDefinition<ContextOf<S, K>, Result>
}

export interface StateBuilder<S extends MachineSpec> {
	<K extends StateName<S>, Handled extends EventName<S>>(
		...transitions: TransitionDefinition<ContextOf<S, K>, Handled>[]
	): StateDefinition<S, K, Handled, false>
}

export interface InvokeBuilder<S extends MachineSpec> {
	<K extends StateName<S>, Result>(
		source: (context: ContextOf<S, K>, signal: AbortSignal) => Promise<Result>,
		settlements: (
			kit: InvokeKit<S, K, Result>,
		) => SettlementDefinition<ContextOf<S, K>, Result>[],
	): StateDefinition<S, K, never, false>
}

export interface Kit<S extends MachineSpec> {
	reduce: typeof reduce
	guard: typeof guard
	action: typeof action
	state: StateBuilder<S>
	final: <K extends StateName<S>>() => StateDefinition<S, K, never, true>

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

/** Narrowing `state` narrows its associated `context`. */
export type Snapshot<S extends MachineSpec> = {
	[K in StateName<S>]: {
		readonly state: K
		readonly context: ContextOf<S, K>
	}
}[StateName<S>]

/**
 * The current state, its context, and a `send` accepting only the events this
 * state actually handles. Narrowing `state` narrows both `context` and `send`.
 */
export type Current<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
> = {
	[K in StateName<S> & keyof States]: {
		readonly state: K
		readonly context: ContextOf<S, K>
		readonly send: (
			event: EventObject<S, HandledBy<States, K> & EventName<S>>,
		) => void
	}
}[StateName<S> & keyof States]

export interface Service<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
> {
	/** Narrowed view: state, context, and the events this state handles. */
	readonly current: Current<S, States>
	readonly snapshot: Snapshot<S>
	/** Unnarrowed escape hatch: accepts any of the machine's events. */
	readonly send: (event: AnyEvent<S>) => void
	/** Abort a pending `invoke` and stop accepting events. */
	readonly stop: () => void
}

const makeState = (final: boolean, transitions: unknown[]) => ({
	final,
	transitions,
	source: undefined,
	settlements: [],
})

const state = (...transitions: unknown[]) => makeState(false, transitions)
const final = () => makeState(true, [])

const makeInvoke = (
	source: unknown,
	settlements: (kit: unknown) => unknown[],
) => ({
	final: false,
	transitions: [],
	source,
	settlements: settlements({
		done: (target: string, ...modifiers: unknown[]) => ({
			settlement: "done",
			target,
			modifiers,
		}),
		error: (target: string, ...modifiers: unknown[]) => ({
			settlement: "error",
			target,
			modifiers,
		}),
	}),
})

const invoke = (
	source: unknown,
	settlements: (kit: unknown) => unknown[],
) => makeInvoke(source, settlements)

const kit = {
	reduce,
	guard,
	action,
	state,
	final,
	transition: (handles: PropertyKey, target: string, ...modifiers: unknown[]) => ({
		handles,
		target,
		modifiers,
	}),
	invoke,
} as unknown as Kit<MachineSpec>

/**
 * Define the type-level shape of a machine, then create its state map from an
 * explicit initial state.
 *
 * The separate `create(...)` call lets TypeScript infer the state map's own
 * type after the spec has been fixed. That inferred type is what lets a state
 * key absent from the spec be rejected and `send` be narrowed per state.
 */
export function defineMachine<S extends MachineSpec>() {
	return {
		create<
			Initial extends StateName<S>,
			States extends Record<StateName<S>, unknown>,
		>(
			initial: Initial,
			build: (kit: Kit<S>) => States & {
				[K in StateName<S>]: StateDefinition<S, K, EventName<S>>
			} & { [K in Exclude<keyof States, StateName<S>>]: never },
		): Machine<S, States, Initial> {
			const states = build(kit as unknown as Kit<S>) as Record<
				string,
				AnyStateDefinition<S>
			>

			if (!(initial in states)) {
				throw new Error(`machine has no state named "${initial}"`)
			}

			// At most one `reduce` per transition. robot3 pipelines multiple
			// reducers (each receives the previous one's output), which cannot be
			// typed here: with per-state context every reducer's input depends on
			// the previous one's output, and that fold is not expressible through
			// the inference path this design relies on. Rejecting it is better than
			// typing the second reducer's `context` as the source state's and handing
			// it the first one's output.
			for (const [name, definition] of Object.entries(states)) {
				const branches = [
					...definition.transitions,
					...definition.settlements,
				] as readonly { readonly modifiers: readonly { kind: string }[] }[]
				for (const branch of branches) {
					const reducers = branch.modifiers.filter(
						(modifier) => modifier.kind === "reduce",
					)
					if (reducers.length > 1) {
						throw new Error(
							`state "${name}" has a transition with ${reducers.length} reduce() modifiers; at most one is allowed`,
						)
					}
				}
			}

			return {
				states: states as unknown as States,
				initial,
			}
		},
	}
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

interface RuntimeModifier {
	readonly kind: "reduce" | "guard" | "action"
	readonly apply: (context: unknown, event: unknown) => unknown
}

interface RuntimeBranch {
	readonly target: string
	readonly modifiers: readonly RuntimeModifier[]
	readonly handles?: PropertyKey
	readonly settlement?: "done" | "error"
}

interface RuntimeState {
	readonly final: boolean
	readonly transitions: readonly RuntimeBranch[]
	readonly settlements: readonly RuntimeBranch[]
	readonly source:
		| ((context: unknown, signal: AbortSignal) => Promise<unknown>)
		| undefined
}

/**
 * Run a machine from its declared initial state. `initialContext` is checked
 * against exactly that state's declared context.
 */
export function interpret<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
	Initial extends StateName<S>,
>(
	machine: Machine<S, States, Initial>,
	initialContext: ContextOf<S, Initial>,
	onChange?: (snapshot: Snapshot<S>) => void,
): Service<S, States> {
	const states = machine.states as unknown as Record<string, RuntimeState>

	let currentState: string = machine.initial
	let currentContext: unknown = initialContext
	let stopped = false
	// Bumped on every transition so a promise settling after we have already
	// left the invoke state is ignored.
	let epoch = 0
	let pending: AbortController | undefined

	const runBranch = (branch: RuntimeBranch, event: unknown): boolean => {
		for (const modifier of branch.modifiers) {
			if (
				modifier.kind === "guard" &&
				!modifier.apply(currentContext, event)
			) {
				return false
			}
		}
		for (const modifier of branch.modifiers) {
			if (modifier.kind === "action") modifier.apply(currentContext, event)
		}
		const reducer = branch.modifiers.find((m) => m.kind === "reduce")
		epoch++
		pending?.abort()
		pending = undefined
		currentContext = reducer
			? reducer.apply(currentContext, event)
			: currentContext
		currentState = branch.target
		onChange?.({
			state: currentState,
			context: currentContext,
		} as Snapshot<S>)
		enter()
		return true
	}

	const enter = (): void => {
		if (stopped) return
		const definition = states[currentState]
		if (!definition?.source) return
		const entered = epoch
		const controller = new AbortController()
		pending = controller
		definition.source(currentContext, controller.signal).then(
			(result) => {
				if (epoch === entered && !stopped) settle("done", result)
			},
			(error: unknown) => {
				if (epoch === entered && !stopped) settle("error", error)
			},
		)
	}

	const settle = (kind: "done" | "error", payload: unknown): void => {
		const definition = states[currentState]
		if (!definition) return
		for (const branch of definition.settlements) {
			if (branch.settlement !== kind) continue
			if (runBranch(branch, payload)) return
		}
	}

	const dispatch = (event: { type: PropertyKey }): void => {
		if (stopped) return
		const definition = states[currentState]
		if (!definition || definition.final) return
		for (const branch of definition.transitions) {
			if (branch.handles !== event.type) continue
			if (runBranch(branch, event)) return
		}
	}

	enter()

	const send = (event: unknown): void => {
		dispatch(event as { type: PropertyKey })
	}

	return {
		get current(): Current<S, States> {
			return {
				state: currentState,
				context: currentContext,
				send,
			} as unknown as Current<S, States>
		},
		get snapshot(): Snapshot<S> {
			return {
				state: currentState,
				context: currentContext,
			} as Snapshot<S>
		},
		send: send as (event: AnyEvent<S>) => void,
		stop: (): void => {
			stopped = true
			pending?.abort()
			pending = undefined
		},
	}
}
