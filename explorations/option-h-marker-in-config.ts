/**
 * Option H: the spec marker as a property of the config object, sibling to
 * `initialState`. States stay an ordinary second argument - no callback.
 *
 *     createMachine(
 *       { initialState: 'idle', specification: defineMachine<AuthSpec>() },
 *       {
 *         idle: state(transition('login', 'authenticating', reduce(...))),
 *         authenticated: state(),
 *       },
 *     )
 *
 * `defineMachine<S>()` is Option A's phantom marker, called directly with one
 * explicit type argument - no currying. It reads as `defineMachine<S>()`
 * rather than `defineMachine<S>()({...})`, which is the point: currying two
 * calls together was disliked regardless of what it bought.
 *
 * Result: works completely, and inherits every guarantee Option D has -
 * `specification` and `initialState` are two sibling properties in one object
 * literal, exactly Option D's `types`/`initialState` shape with a different
 * carrier for `S`. This is not Option E's failure (state map as a third
 * sibling needing per-key contextual typing); here nothing but `Initial`
 * needs a contextual type, and `Initial extends StateName<S>` is a plain
 * constraint check, not a per-key mapped type.
 *
 * What it does NOT inherit is Option G's fix for the `as const` edge. Without
 * currying there is no earlier call whose `Initial extends StateName<S>`
 * constraint can pin the literal before the object is assigned to a variable,
 * so a hoisted config widens `initialState` to `string` exactly as Option D's
 * does. Trading the curry away brings that cost back - see the hoisting
 * section below, which checks this rather than asserting it.
 *
 * See [Design explorations](../docs/design-explorations.md).
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

/** A phantom marker, exactly Option A's `Spec<S>`. */
interface Spec<S extends MachineSpec> {
	readonly __spec?: S
}

declare function defineMachine<S extends MachineSpec>(): Spec<S>

/** The no-argument overload keeps a terminal state's `Handled` at `never`;
 * see [`option-d-state-map-argument.ts`](option-d-state-map-argument.ts). */
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

declare function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends Record<StateName<S>, unknown>,
>(
	config: {
		readonly initialState: Initial
		readonly specification: Spec<S>
	},
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
// exact event object, exactly as in Option D.
// ---------------------------------------------------------------------------

export const machine = createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
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
// Rejections. Same set as Option D, all reported where the mistake was
// written.
// ---------------------------------------------------------------------------

export const badReducer = createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
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
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
	{
		// @ts-expect-error - idle -> authenticating changes shape, so reduce() is required
		idle: state(transition('login', 'authenticating')),
		authenticating: state(),
		authenticated: state(),
	},
)

export const badInitial = createMachine(
	{
		// @ts-expect-error - "nope" is not a state of AuthSpec
		initialState: 'nope',
		specification: defineMachine<AuthSpec>(),
	},
	{ idle: state(), authenticating: state(), authenticated: state() },
)

export const badEvent = createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
	{
		// @ts-expect-error - "nope" is not an event of AuthSpec
		idle: state(transition('nope', 'idle')),
		authenticating: state(),
		authenticated: state(),
	},
)

export const badTarget = createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
	{
		// @ts-expect-error - "nope" is not a state of AuthSpec
		idle: state(transition('ping', 'nope')),
		authenticating: state(),
		authenticated: state(),
	},
)

export const missingState = createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
	// @ts-expect-error - "authenticated" is missing
	{ idle: state(), authenticating: state() },
)

export const extraState = createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
	{
		idle: state(),
		authenticating: state(),
		authenticated: state(),
		// @ts-expect-error - not a state of AuthSpec
		nope: state(),
	},
)

// ---------------------------------------------------------------------------
// Hoisting: the trade-off this option makes against Option G. `specification`
// carries no literal to widen, but `initialState` does, and there is no
// curried call left to pin it before the object is assigned to a variable.
// ---------------------------------------------------------------------------

const config = {
	initialState: 'idle',
	specification: defineMachine<AuthSpec>(),
}

export const widenedMachine = createMachine(
	// @ts-expect-error - without `as const`, initialState widened to string,
	// same edge Option D has and Option G does not.
	config,
	{ idle: state(), authenticating: state(), authenticated: state() },
)

const constConfig = {
	initialState: 'idle',
	specification: defineMachine<AuthSpec>(),
} as const

export const hoisted = createMachine(constConfig, {
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

export const hoistedAgain = createMachine(constConfig, {
	idle: state(),
	authenticating: state(),
	authenticated: state(),
})
