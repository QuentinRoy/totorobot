/**
 * Option G: define the spec once, then pass it to `createMachine`.
 *
 *     const spec = defineMachine<AuthSpec>()({ initialState: 'idle' })
 *
 *     createMachine(spec, {
 *       idle: state(transition('login', 'authenticating', reduce(...))),
 *       authenticated: state(),
 *     })
 *
 * This is Option D with the config lifted into its own constructor call. The
 * question it answers is whether hoisting the spec costs anything: Option D can
 * hoist its config too, but only with `as const`, because a bare object literal
 * assigned to a variable widens `initialState` to `string`.
 *
 * Result: works, and removes that sharp edge. Passing the config through a
 * function whose `Initial extends StateName<S>` constraint is in scope pins the
 * literal, so no `as const` is needed. A bad `initialState` is also reported at
 * the `defineMachine` call rather than at `createMachine`'s first argument.
 *
 * One thing does not work, and it is the exact spelling the idea was written
 * in: `defineMachine<AuthSpec>({ initialState: 'idle' })`, a single call with
 * the spec explicit and the initial state inferred. TypeScript has no partial
 * type-argument inference - supplying one type argument means supplying all -
 * so `Initial` cannot be inferred alongside an explicit `S`. Two spellings work
 * instead, and both are below: currying (`defineMachine<AuthSpec>()({...})`) or
 * carrying the spec as a value (`defineMachine({ types: {} as AuthSpec, ... })`).
 *
 * See [the design record](../docs/api-rationale.md).
 */

import {
	type AuthSpec,
	type ContextOf,
	type Equal,
	type EventName,
	type EventObject,
	type IdleContextOf,
	type LoginEvent,
	type Machine,
	type MachineSpec,
	type StateDefinition,
	type StateName,
	type TransitionDefinition,
	assertType,
	guard,
	reduce,
	transition,
} from './config-object-kit.ts'

/** The no-argument overload keeps a terminal state's `Handled` at `never`
 * rather than letting it fall back to `EventName<S>`; see
 * [`option-d-state-map-argument.ts`](option-d-state-map-argument.ts). */
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
 * What `defineMachine` returns. `S` sits in a covariant readonly position, as
 * it already does on `Machine`.
 */
interface Spec<S extends MachineSpec, Initial extends StateName<S>> {
	readonly types: S
	readonly initialState: Initial
}

/**
 * Identical to Option D's, except the first argument is now a `Spec` produced
 * elsewhere rather than an object literal written in place. `S` is still
 * inferred in the same call that infers `States`; that is fine, because the
 * state map is a plain argument rather than a builder callback. (Option A is
 * the same signature with a callback, and that is what breaks it.)
 */
declare function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends Record<StateName<S>, unknown>,
>(
	spec: Spec<S, Initial>,
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
// The spelling that does not work: one call, `S` explicit, `Initial` inferred.
// ---------------------------------------------------------------------------

declare function defineMachineInOneCall<
	S extends MachineSpec,
	Initial extends StateName<S>,
>(config: { readonly initialState: Initial }): Spec<S, Initial>

export const oneCall =
	// @ts-expect-error - Expected 2 type arguments, but got 1. Naming `S`
	// explicitly switches the whole call to explicit type arguments, so
	// `Initial` is no longer inferred from `config`.
	defineMachineInOneCall<AuthSpec>({ initialState: 'idle' })

// ---------------------------------------------------------------------------
// Spelling 1: curry. `S` explicit in the first call, `Initial` inferred in the
// second.
// ---------------------------------------------------------------------------

interface SpecBuilder<S extends MachineSpec> {
	<Initial extends StateName<S>>(config: {
		readonly initialState: Initial
	}): Spec<S, Initial>
}

declare function defineMachine<S extends MachineSpec>(): SpecBuilder<S>

const authSpec = defineMachine<AuthSpec>()({ initialState: 'idle' })

/** No `as const`: the constraint pinned the literal on the way through. */
assertType<Equal<(typeof authSpec)['initialState'], 'idle'>>()

export const machine = createMachine(authSpec, {
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
})

/** The hoisted spec is reusable, unlike Option D's un-`as const`ed config. */
export const secondMachine = createMachine(authSpec, {
	idle: state(),
	authenticating: state(),
	authenticated: state(),
})

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

/** The initial state is checked where it is written, not at `createMachine`. */
export const badInitial = defineMachine<AuthSpec>()({
	// @ts-expect-error - "nope" is not a state of AuthSpec
	initialState: 'nope',
})

// ---------------------------------------------------------------------------
// Spelling 2: the spec as a value, so nothing is explicit and one call is
// enough. This is Option D's config object, hoisted.
// ---------------------------------------------------------------------------

declare function defineMachineFromValue<
	S extends MachineSpec,
	Initial extends StateName<S>,
>(config: {
	readonly types: S
	readonly initialState: Initial
}): Spec<S, Initial>

const valueSpec = defineMachineFromValue({
	types: {} as AuthSpec,
	initialState: 'idle',
})

assertType<Equal<(typeof valueSpec)['initialState'], 'idle'>>()

export const fromValue = createMachine(valueSpec, {
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

// ---------------------------------------------------------------------------
// Rejections. Unchanged from Option D - hoisting the spec costs no checking.
// ---------------------------------------------------------------------------

export const badReducer = createMachine(authSpec, {
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
})

export const missingReducer = createMachine(authSpec, {
	// @ts-expect-error - idle -> authenticating changes shape, so reduce() is required
	idle: state(transition('login', 'authenticating')),
	authenticating: state(),
	authenticated: state(),
})

export const badEvent = createMachine(authSpec, {
	// @ts-expect-error - "nope" is not an event of AuthSpec
	idle: state(transition('nope', 'idle')),
	authenticating: state(),
	authenticated: state(),
})

export const badTarget = createMachine(authSpec, {
	// @ts-expect-error - "nope" is not a state of AuthSpec
	idle: state(transition('ping', 'nope')),
	authenticating: state(),
	authenticated: state(),
})

export const missingState = createMachine(
	authSpec,
	// @ts-expect-error - "authenticated" is missing
	{ idle: state(), authenticating: state() },
)

export const extraState = createMachine(authSpec, {
	idle: state(),
	authenticating: state(),
	authenticated: state(),
	// @ts-expect-error - not a state of AuthSpec
	nope: state(),
})
