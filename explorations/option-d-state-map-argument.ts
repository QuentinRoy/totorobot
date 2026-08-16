/**
 * Option D: `createMachine(config, statesMap)`
 *
 *     createMachine(
 *       { types: {} as AuthSpec, initialState: 'idle' },
 *       { idle: state(transition('login', 'authenticating', reduce(...))) },
 *     )
 *
 * Result: works completely. Every guarantee the current API provides survives,
 * and the two-step curried call disappears - `S` is inferrable from an ordinary
 * argument, so there is nothing left to curry.
 *
 * See [Design explorations](../docs/api-rationale.md).
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

/**
 * The no-argument overload is load-bearing. Without it `Handled` has no
 * inference candidate for `state()` and falls back to its constraint
 * `EventName<S>`, so a terminal state's `send` would accept every declared
 * event. `StateBuilder` in [`src/totorobot.ts`](../src/totorobot.ts) carries
 * the same overload for the same reason.
 */
declare function state<S extends MachineSpec>(): StateDefinition<
	S,
	never,
	never
>
declare function state<
	S extends MachineSpec,
	K extends StateName<S>,
	Handled extends EventName<S>,
>(
	transition: TransitionDefinition<S, ContextOf<S, K>, Handled>,
	...transitions: TransitionDefinition<S, ContextOf<S, K>, Handled>[]
): StateDefinition<S, K, Handled>

type HandledBy<States, K extends keyof States> = States[K] extends {
	readonly handles: infer H
}
	? H
	: never

interface Service<
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

/**
 * `States` is inferred from the second argument while the mapped-type
 * intersection supplies each key's contextual type. That intersection is what
 * makes both work at once: the mapped half types the values, the naked half
 * captures what was written.
 */
declare function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends Record<StateName<S>, unknown>,
>(
	config: { readonly types: S; readonly initialState: Initial },
	states: States & {
		[K in StateName<S>]: StateDefinition<S, K, EventName<S>>
	} & { [K in Exclude<keyof States, StateName<S>>]: never },
): Machine<S, States, Initial>

declare function interpret<
	S extends MachineSpec,
	States extends Record<StateName<S>, unknown>,
	Initial extends StateName<S>,
>(
	machine: Machine<S, States, Initial>,
	initialContext: ContextOf<S, Initial>,
): Service<S, States>

// ---------------------------------------------------------------------------
// Inference reaches every callback with the exact per-state context and the
// exact event object, with nothing annotated by hand.
// ---------------------------------------------------------------------------

export const machine = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		idle: state(
			transition(
				'login',
				'authenticating',
				guard((context, event) => {
					assertType<Equal<typeof context, IdleContextOf>>()
					assertType<Equal<typeof event, LoginEvent>>()
					return true
				}),
				reduce((_context, event) => ({ username: event.username })),
			),
		),
		authenticating: state(
			transition(
				'success',
				'authenticated',
				reduce((_context, event) => ({ token: event.token })),
			),
		),
		authenticated: state(),
	},
)

/** `send` is still narrowed to the events the current state handles. */
export function narrowing(): void {
	const service = interpret(machine, { attempts: 0 })
	const current = service.current
	if (current.state === 'idle') {
		assertType<Equal<typeof current.context, IdleContextOf>>()
		current.send({ name: 'login', username: 'q' })
		// @ts-expect-error - idle does not handle "success"
		current.send({ name: 'success', token: 't' })
	}
	if (current.state === 'authenticated') {
		// @ts-expect-error - a terminal state handles nothing at all
		current.send({ name: 'login', username: 'q' })
	}
}

// ---------------------------------------------------------------------------
// Rejections. Each is reported where the mistake was written.
// ---------------------------------------------------------------------------

/** A wrong reducer output is reported on the `reduce()` call itself. */
export const badReducer = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		idle: state(
			transition(
				'login',
				'authenticating',
				// @ts-expect-error - must produce the target's context
				reduce((_context, event) => ({ nope: event.username })),
			),
		),
		authenticating: state(),
		authenticated: state(),
	},
)

export const missingReducer = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		// @ts-expect-error - idle -> authenticating changes shape, so reduce() is required
		idle: state(transition('login', 'authenticating')),
		authenticating: state(),
		authenticated: state(),
	},
)

export const badInitial = createMachine(
	// @ts-expect-error - "nope" is not a state of AuthSpec
	{ types: {} as AuthSpec, initialState: 'nope' },
	{ idle: state(), authenticating: state(), authenticated: state() },
)

export const badEvent = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		// @ts-expect-error - "nope" is not an event of AuthSpec
		idle: state(transition('nope', 'idle')),
		authenticating: state(),
		authenticated: state(),
	},
)

export const badTarget = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		// @ts-expect-error - "nope" is not a state of AuthSpec
		idle: state(transition('ping', 'nope')),
		authenticating: state(),
		authenticated: state(),
	},
)

export const missingState = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	// @ts-expect-error - "authenticated" is missing
	{ idle: state(), authenticating: state() },
)

export const extraState = createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		idle: state(),
		authenticating: state(),
		authenticated: state(),
		// @ts-expect-error - not a state of AuthSpec
		nope: state(),
	},
)

// ---------------------------------------------------------------------------
// The config can be declared ahead of time and reused - but only with
// `as const`. This is Option D's sharp edge: the hoisted value carries a
// literal that can widen, which the phantom marker in Option A cannot.
// ---------------------------------------------------------------------------

const authConfig = { types: {} as AuthSpec, initialState: 'idle' } as const

export const hoisted = createMachine(authConfig, {
	idle: state(
		transition(
			'login',
			'authenticating',
			reduce((_context, event) => ({ username: event.username })),
		),
	),
	authenticating: state(),
	authenticated: state(),
})

export const hoistedAgain = createMachine(authConfig, {
	idle: state(),
	authenticating: state(),
	authenticated: state(),
})

const widened = { types: {} as AuthSpec, initialState: 'idle' }

export const widenedMachine = createMachine(
	// @ts-expect-error - without `as const`, initialState widened to string
	widened,
	{ idle: state(), authenticating: state(), authenticated: state() },
)
