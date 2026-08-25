/**
 * Option F: states as positional arguments.
 *
 *     createMachine(
 *       { types: {} as AuthSpec, initialState: 'idle' },
 *       state('idle', transition(...)),
 *       state('foo', transition(...)),
 *     )
 *
 * Result: a forced trade-off rather than a flat failure. You can have per-state
 * context inference, or compile-time exhaustiveness and per-state `send`
 * narrowing, but not both.
 *
 * Narrowing `send` and rejecting a missing state require inferring the rest
 * arguments as a *tuple*. But a naked inferred tuple type parameter supplies no
 * contextual type to the arguments themselves, so `state(...)` never learns `S`.
 * Three formulations were tried - naked `States`, a mapped type over
 * `keyof States`, and `States & StateDefinition<S, ...>[]` (the intersection
 * that works for Option D's object literal). All three lose the spec.
 *
 * Both halves are recorded below.
 *
 * Separately, and independent of the trade-off: nothing in this shape catches
 * the same state being declared twice.
 *
 * See [the design record](../docs/design-record.md).
 */

import {
	type AuthSpec,
	type ContextOf,
	type Equal,
	type EventName,
	type EventObject,
	type IdleContextOf,
	type LoginEvent,
	type MachineSpec,
	type Machine,
	type StateDefinition,
	type StateName,
	type TransitionDefinition,
	assertType,
	guard,
	reduce,
	transition,
} from './config-object-kit.ts'

/** The state name is an argument, so `K` is inferred directly rather than
 * recovered from an object key. */
declare function state<
	S extends MachineSpec,
	K extends StateName<S>,
	Handled extends EventName<S>,
>(
	name: K,
	...transitions: TransitionDefinition<S, ContextOf<S, K>, Handled>[]
): StateDefinition<S, K, Handled>

// ---------------------------------------------------------------------------
// Half one: keep the inferred tuple.
//
// Exhaustiveness and `send` narrowing are expressible. The spec is not.
// ---------------------------------------------------------------------------

type Declared<States extends readonly { readonly state: unknown }[]> =
	States[number]['state']

type HandledFor<States extends readonly { readonly state: unknown }[], K> =
	Extract<States[number], { readonly state: K }> extends {
		readonly handles: infer H
	}
		? H
		: never

interface TupleService<
	S extends MachineSpec,
	States extends readonly { readonly state: unknown }[],
> {
	readonly current: {
		[K in StateName<S>]: {
			readonly state: K
			readonly context: ContextOf<S, K>
			readonly send: (
				event: EventObject<S, HandledFor<States, K> & EventName<S>>,
			) => void
		}
	}[StateName<S>]
}

declare function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends readonly StateDefinition<S, StateName<S>, EventName<S>>[],
>(
	config: { readonly types: S; readonly initialState: Initial },
	...states: States &
		([Exclude<StateName<S>, Declared<States>>] extends [never]
			? unknown
			: { readonly missing: Exclude<StateName<S>, Declared<States>> })
): Machine<S, States, Initial>

declare function interpret<
	S extends MachineSpec,
	States extends readonly StateDefinition<S, StateName<S>, EventName<S>>[],
	Initial extends StateName<S>,
>(
	machine: Machine<S, States, Initial>,
	initialContext: ContextOf<S, Initial>,
): TupleService<S, States>

export const machine = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	// @ts-expect-error - S was not inferred; state() produced
	// StateDefinition<MachineSpec, ...> where StateDefinition<AuthSpec, ...> is
	// required.
	state(
		'idle',
		transition(
			'login',
			'authenticating',
			guard((context, event) => {
				// The spec never arrived, exactly as in Option E.
				assertType<Equal<typeof context, unknown>>()
				assertType<Equal<typeof event, unknown>>()
				return true
			}),
			reduce(() => ({})),
		),
	),
	// These two are accepted: with no transitions there is nothing for the
	// missing spec to break, so S is free to come from the contextual type.
	state('authenticating'),
	state('authenticated'),
)

/** Exhaustiveness *is* expressible here - it is the reason for the tuple. */
export const missingState = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	// @ts-expect-error - "authenticated" and "authenticating" are missing
	state('idle'),
)

// ---------------------------------------------------------------------------
// Half two: drop the tuple.
//
// The rest parameter now names S directly, so contextual typing carries it all
// the way into the callbacks. Inference is perfect and the checks are gone.
// ---------------------------------------------------------------------------

interface UntypedService<S extends MachineSpec> {
	readonly current: {
		[K in StateName<S>]: {
			readonly state: K
			readonly context: ContextOf<S, K>
			/** Every event, not just the ones this state handles. */
			readonly send: (event: S['events']) => void
		}
	}[StateName<S>]
}

declare function createLooseMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
>(
	config: { readonly types: S; readonly initialState: Initial },
	...states: StateDefinition<S, StateName<S>, EventName<S>>[]
): { readonly spec: S; readonly initial: Initial }

declare function interpretLoose<
	S extends MachineSpec,
	Initial extends StateName<S>,
>(
	machine: { readonly spec: S; readonly initial: Initial },
	initialContext: ContextOf<S, Initial>,
): UntypedService<S>

export const looseMachine = createLooseMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	state(
		'idle',
		transition(
			'login',
			'authenticating',
			guard((context, event) => {
				// The spec arrives. No annotations, exact types.
				assertType<Equal<typeof context, IdleContextOf>>()
				assertType<Equal<typeof event, LoginEvent>>()
				return true
			}),
			reduce((_context, event) => ({ username: event.username })),
		),
	),
	state('authenticating'),
	state('authenticated'),
)

/** What dropping the tuple costs. Neither of these is an error any more. */
export function lostChecks(): void {
	const service = interpretLoose(looseMachine, { attempts: 0 })
	const current = service.current
	if (current.state === 'idle') {
		assertType<Equal<typeof current.context, IdleContextOf>>()
		// `idle` does not handle "success", but `send` accepts it: without the
		// tuple there is no record of which state handles what.
		current.send({ name: 'success', token: 't' })
	}
}

/** A machine missing two of its three states, accepted. */
export const looseMissingState = createLooseMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	state('idle'),
)

/** The same state declared twice, accepted. No formulation of this shape
 * catches it - the tuple half cannot either. */
export const looseDuplicateState = createLooseMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	state('idle'),
	state('idle'),
	state('authenticating'),
	state('authenticated'),
)
