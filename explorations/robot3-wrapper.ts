/**
 * Option G, implemented as a thin typed layer over Robot3. Covers most of
 * Robot3's public surface, not just the state/transition/guard/reduce/action
 * subset the first version of this file wrapped.
 *
 * Unlike the rest of this directory, this file has a runtime: it imports
 * Robot3 and casts its combinators to totorobot's signatures. Nothing is
 * reimplemented, except `invoke`'s done/error routing, which is built from the
 * wrapper's own `transition` (see below). The question being tested is whether
 * "totorobot is mostly types" is literally true - whether Option G's
 * guarantees survive when the interpreter underneath is Robot3's rather than
 * this repository's.
 *
 * Result: yes, for everything exercised here. The type layer transplants
 * unchanged - `TransitionModifiers` (reduce required exactly when the context
 * shape changes), per-state contexts, exhaustive state maps, and `send`
 * narrowing all come across.
 *
 * Six mismatches are worth knowing about, all but the last recorded as tests
 * in [`robot3-wrapper.test.ts`](robot3-wrapper.test.ts):
 *
 * 1. Robot3 discriminates events on `type`; the proposed spec shape uses
 *    `name`. `send` translates. This is not cosmetic: Robot3 computes the
 *    event key as `event.type || event`, so an untranslated `{ name }` object
 *    is used as a Map key, matches nothing, and is *silently ignored* rather
 *    than throwing. Adopting `type` in the spec would delete the translation
 *    and the hazard, and it is what `src/totorobot.ts` already uses.
 *
 * 2. Robot3's `onChange` is optional in its `.d.ts` and required at runtime -
 *    `transitionTo` calls `service.onChange(service)` unconditionally. Passing
 *    nothing throws on the first transition. The wrapper always passes a
 *    function.
 *
 * 3. Robot3's `action` is implemented as
 *    `reduce((ctx, ev) => !!~fn(ctx, ev) && ctx)`, so an action that returns
 *    `-1` replaces the whole context with `false`. Typing the callback as
 *    `=> void` does not prevent this: TypeScript permits returning a value
 *    from a void-returning callback.
 *
 * 4. Robot3 chains multiple reducers on one transition; totorobot's
 *    `TransitionModifiers` permits at most one. The wrapper is therefore
 *    stricter than the runtime, which is the safe direction.
 *
 * 5. Robot3's `invoke` does not send the resolved value or the rejection
 *    reason directly. It sends `{ type: 'done', data }` / `{ type: 'error',
 *    error }`, so a settlement reducer typed to receive `Result` would
 *    silently receive `{ type: 'done', data: Result }` instead. `invoke`
 *    below rebuilds each modifier to unwrap it first - see
 *    `unwrapSettlement`. Caught by running the tests, not by reading the
 *    source: the first version had `result.token` read as `undefined`.
 *
 * 6. **No cancellation.** `invoke`'s source still receives an `AbortSignal`,
 *    matching `InvokeBuilder` in [`src/totorobot.ts`](../src/totorobot.ts),
 *    but nothing ever aborts it. A stale settlement is already dropped
 *    correctly - Robot3's invoke checks `machine2 === service.machine` before
 *    sending `done`/`error`, the same identity guard it uses for its own
 *    child-machine invoke - but the underlying async work (a `fetch`, say)
 *    is never told to stop. Doing so would mean aborting whatever was pending
 *    the moment a transition leaves the invoke state, and Robot3 exposes no
 *    hook for that; it would have to be a hidden action threaded onto every
 *    transition this wrapper builds. Not attempted.
 *
 * Two more things are unwrapped entirely, rather than wrapped with a caveat:
 * Robot3's machine-valued `invoke` (nested/child machines - `service.child`)
 * and the `d`/`logging` debugging modules. Both are plausible to add; neither
 * has been tried.
 *
 * See [the design record](../docs/api-rationale.md).
 */

import * as robot from 'robot3'

import type {
	ActionModifier,
	ContextOf,
	EventName,
	EventObject,
	GuardModifier,
	InvokeKit,
	MachineSpec,
	ReduceModifier,
	SettlementDefinition,
	StateDefinition,
	StateName,
	TransitionDefinition,
	TransitionModifiers,
} from './config-object-kit.ts'

/**
 * `types` is phantom - it is never read, and never present at runtime. It
 * exists so the value spelling (`defineMachine({ types: {} as Spec, ... })`)
 * has somewhere to put the spec.
 */
export interface Spec<S extends MachineSpec, Initial extends StateName<S>> {
	readonly types?: S
	readonly initialState: Initial
}

export interface Machine<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
	Initial extends StateName<S>,
> {
	readonly __spec?: S
	readonly __states?: States
	readonly __initial?: Initial
}

type HandledBy<States, K extends keyof States> = States[K] extends {
	readonly handles: infer H
}
	? H
	: never

export interface Service<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
> {
	readonly current: {
		[K in StateName<S> & keyof States]: {
			readonly state: K
			readonly context: ContextOf<S, K>
			readonly send: (
				event: EventObject<S, HandledBy<States, K> & EventName<S>>,
			) => void
		}
	}[StateName<S> & keyof States]
}

// ---------------------------------------------------------------------------
// The combinators. Every one of these is Robot3's function with a totorobot
// signature painted on: the casts are the entire implementation.
// ---------------------------------------------------------------------------

export const reduce = robot.reduce as unknown as <Context, Event, Output>(
	apply: (context: Context, event: Event) => Output,
) => ReduceModifier<Context, Event, Output>

export const guard = robot.guard as unknown as <Context, Event>(
	apply: (context: Context, event: Event) => boolean,
) => GuardModifier<Context, Event>

/** See mismatch 3 in the header: a `-1` return here destroys the context. */
export const action = robot.action as unknown as <Context, Event>(
	apply: (context: Context, event: Event) => void,
) => ActionModifier<Context, Event>

export const transition = robot.transition as unknown as <
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
) => TransitionDefinition<S, Context, E>

/**
 * Two call signatures, matching `StateBuilder` in
 * [`src/totorobot.ts`](../src/totorobot.ts). The no-argument one keeps a
 * terminal state's `Handled` at `never`; a single rest-parameter signature
 * leaves `Handled` without an inference candidate, so it falls back to its
 * constraint and the terminal state's `send` accepts every declared event.
 * Robot3 agrees at runtime - `state()` with no arguments sets `final: true`.
 */
interface StateFn {
	<S extends MachineSpec>(): StateDefinition<S, never, never>
	<S extends MachineSpec, K extends StateName<S>, Handled extends EventName<S>>(
		transition: TransitionDefinition<S, ContextOf<S, K>, Handled>,
		...transitions: TransitionDefinition<S, ContextOf<S, K>, Handled>[]
	): StateDefinition<S, K, Handled>
}

export const state = robot.state as unknown as StateFn

/**
 * Not in `src/totorobot.ts` yet - the README lists immediate transitions
 * among the missing features. Robot3 has one, so it costs nothing extra here.
 *
 * Typed as `TransitionDefinition<S, Context, never>` rather than a separate
 * `ImmediateDefinition`: `handles: never` is already the right contribution to
 * `state()`'s `Handled` union (an immediate is not triggered by `send`, so it
 * should add nothing to what a state handles), and every field on
 * `TransitionDefinition` is phantom already, so a second interface would add
 * a name without adding a distinction.
 *
 * The event type is `unknown` rather than derived from `EventName<S>`: an
 * immediate fires on entry, using whatever event caused entry into the
 * *current* state, which this wrapper has no static way to name. Untyped
 * rather than mistyped.
 */
export const immediate = robot.immediate as unknown as <
	S extends MachineSpec,
	Context,
	To extends StateName<S>,
>(
	target: To,
	...modifiers: TransitionModifiers<Context, unknown, ContextOf<S, To>>
) => TransitionDefinition<S, Context, never>

/**
 * Robot3's `invoke(fn, ...transitions)` runs `fn` on entry and, if it returns
 * a promise, sends `{ type: 'done', data }` or `{ type: 'error', error }`
 * through the ordinary transition path - `done`/`error` are just event names,
 * checked against the very transitions passed in. So `done`/`error` here are
 * built with the wrapper's own `transition`, not a separate mechanism; the
 * `InvokeKit` shape only exists to keep `Result` fixed by `source` before its
 * settlements are checked against it, exactly as `src/totorobot.ts` explains
 * for the real `invoke`.
 *
 * One more translation, found by running this rather than by reading the
 * source: Robot3's invoke does not send the resolved value or the rejection
 * reason directly. It sends `{ type: 'done', data }` / `{ type: 'error',
 * error }`, and every guard/action/reduce on the settlement transition
 * receives that wrapper object as `event`, not `data`/`error` itself. Left
 * alone, a `done` reducer typed to receive `Result` would silently receive
 * `{ type: 'done', data: Result }` instead - which is exactly what the first
 * version of the test below caught (`result.token` was `undefined`;
 * `result.data.token` was not). `unwrapSettlement` rebuilds each modifier so
 * its callback sees the unwrapped value, the same shape of fix as `send`
 * translating `name` to `type`.
 */
function unwrapSettlement<M extends object>(
	modifier: M,
	extract: (event: unknown) => unknown,
): M {
	const fn = (
		modifier as unknown as { fn: (context: unknown, event: unknown) => unknown }
	).fn
	// A fresh object on the same prototype: Robot3 tells guards from actions
	// from reducers by prototype (`Type.isPrototypeOf(value)`), not by any
	// property this wrapper could otherwise preserve.
	return Object.create(Object.getPrototypeOf(modifier), {
		fn: {
			enumerable: true,
			value: (context: unknown, event: unknown) => fn(context, extract(event)),
		},
	}) as M
}

export function invoke<S extends MachineSpec, K extends StateName<S>, Result>(
	source: (context: ContextOf<S, K>, signal: AbortSignal) => Promise<Result>,
	settlements: (
		kit: InvokeKit<S, K, Result>,
	) => SettlementDefinition<S, ContextOf<S, K>, Result>[],
): StateDefinition<S, K, never> {
	const untypedTransition = transition as unknown as (
		event: string,
		target: string,
		...modifiers: unknown[]
	) => unknown

	const kit: InvokeKit<S, K, Result> = {
		done: (target, ...modifiers) =>
			untypedTransition(
				'done',
				target,
				...modifiers.map((m) =>
					unwrapSettlement(
						m as object,
						(event) => (event as { data: unknown }).data,
					),
				),
			) as unknown as SettlementDefinition<S, ContextOf<S, K>, Result>,
		error: (target, ...modifiers) =>
			untypedTransition(
				'error',
				target,
				...modifiers.map((m) =>
					unwrapSettlement(
						m as object,
						(event) => (event as { error: unknown }).error,
					),
				),
			) as unknown as SettlementDefinition<S, ContextOf<S, K>, Result>,
	}

	const branches = settlements(kit) as unknown as Parameters<
		typeof robot.transition
	>[]

	// See mismatch 5 in the header: a fresh signal per entry, but nothing
	// aborts it.
	const wrappedSource = (context: unknown): Promise<Result> =>
		source(context as ContextOf<S, K>, new AbortController().signal)

	return robot.invoke(
		wrappedSource,
		...(branches as unknown as Parameters<typeof robot.invoke>[1][]),
	) as unknown as StateDefinition<S, K, never>
}

/** Curried, because `defineMachine<S>({ initialState })` cannot infer
 * `Initial` alongside an explicit `S` - see
 * [`option-g-define-then-create.ts`](option-g-define-then-create.ts). */
export function defineMachine<S extends MachineSpec>() {
	return <Initial extends StateName<S>>(
		config: Spec<S, Initial>,
	): Spec<S, Initial> => config
}

/**
 * Robot3's `createMachine` takes the initial state name and the state map.
 * The third argument is a context *function*, called by `interpret` with the
 * initial context; `identity` is what routes totorobot's per-state initial
 * context through it.
 */
export function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends Record<StateName<S>, unknown>,
>(
	spec: Spec<S, Initial>,
	states: States & {
		[K in StateName<S>]: StateDefinition<S, K, EventName<S>>
	} & { [K in Exclude<keyof States, StateName<S>>]: never },
): Machine<S, States, Initial> {
	const machine = robot.createMachine(
		spec.initialState,
		states as never,
		(context) => context,
	)
	return machine as unknown as Machine<S, States, Initial>
}

export function interpret<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
	Initial extends StateName<S>,
>(
	machine: Machine<S, States, Initial>,
	initialContext: ContextOf<S, Initial>,
	onChange?: (service: Service<S, States>) => void,
): Service<S, States> {
	// Only the three members the wrapper touches. Robot3's own `Service<M>`
	// derives `send`'s event union from `M['states']`, which collapses to
	// `never` for the default `Machine`, so naming it here would fight
	// generic plumbing that the cast discards anyway.
	interface RobotService {
		readonly machine: { readonly current: string }
		readonly context: unknown
		readonly send: (event: { readonly type: string }) => void
	}

	let robotService!: RobotService

	// Robot3 keys transitions off `event.type`; the spec shape uses `name`.
	// Spreading keeps `name` visible to guards and reducers, which are typed
	// against the spec's event objects.
	const send = (event: { readonly name: string }): void => {
		robotService.send({ ...event, type: event.name })
	}

	const service = {
		get current() {
			return {
				state: robotService.machine.current,
				context: robotService.context,
				send,
			}
		},
	} as unknown as Service<S, States>

	robotService = robot.interpret(
		machine as unknown as robot.Machine,
		// Always a function: Robot3 calls this unconditionally on every
		// transition, despite its `.d.ts` marking it optional.
		() => onChange?.(service),
		initialContext,
	) as unknown as RobotService

	return service
}
