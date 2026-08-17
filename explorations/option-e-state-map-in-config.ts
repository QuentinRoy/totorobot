/**
 * Option E: the state map nested inside the config object.
 *
 *     createMachine({
 *       types: {} as AuthSpec,
 *       initialState: 'idle',
 *       states: { idle: state(...), ... },
 *     })
 *
 * Result: does not work. `types` and `states` are siblings in one object
 * literal, so when TypeScript computes the contextual type for `states` it has
 * not yet fixed `S` from `types`. `S` falls back to its constraint and every
 * callback parameter lands as `unknown`.
 *
 * The failure is quiet in the worst way: the state *keys* still check, so the
 * machine's shape is validated while its contexts silently are not.
 *
 * This is the ordinary same-object-literal inference limitation, and nothing
 * about the surrounding design avoids it. One level of nesting costs all
 * per-state typing.
 *
 * Everything below is written so the file compiles: the degraded types are
 * asserted rather than described, and each genuine error carries a
 * `@ts-expect-error`. If a future TypeScript release fixes this, those
 * directives become "unused '@ts-expect-error'" errors and this file will fail
 * loudly - which is the point.
 *
 * See [the design record](../docs/api-rationale.md).
 */

import {
	type AuthSpec,
	type Equal,
	type EventName,
	type MachineSpec,
	type Machine,
	type StateDefinition,
	type StateName,
	type ContextOf,
	type TransitionDefinition,
	assertType,
	guard,
	reduce,
	transition,
} from './config-object-kit.ts'

declare function state<
	S extends MachineSpec,
	K extends StateName<S>,
	Handled extends EventName<S>,
>(
	...transitions: TransitionDefinition<S, ContextOf<S, K>, Handled>[]
): StateDefinition<S, K, Handled>

declare function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends Record<StateName<S>, unknown>,
>(config: {
	readonly types: S
	readonly initialState: Initial
	readonly states: States & {
		[K in StateName<S>]: StateDefinition<S, K, EventName<S>>
	} & { [K in Exclude<keyof States, StateName<S>>]: never }
}): Machine<S, States, Initial>

// ---------------------------------------------------------------------------

export const machine = createMachine({
	types: {} as AuthSpec,
	initialState: 'idle',
	states: {
		// @ts-expect-error - S was not inferred, so state() produced
		// StateDefinition<MachineSpec, ...> where StateDefinition<AuthSpec, ...>
		// is required.
		idle: state(
			transition(
				'login',
				'authenticating',
				guard((context, event) => {
					// The spec never arrived. Both parameters are `unknown`, so no
					// property of either can be read.
					assertType<Equal<typeof context, unknown>>()
					assertType<Equal<typeof event, unknown>>()
					return true
				}),
				reduce(() => ({})),
			),
		),
		// @ts-expect-error - same, for every remaining state
		authenticating: state(),
		// @ts-expect-error - same, for every remaining state
		authenticated: state(),
	},
})

/**
 * What still works, and why it is misleading: the *keys* of the state map are
 * checked against the spec even though the values are not.
 */
export const missingState = createMachine({
	types: {} as AuthSpec,
	initialState: 'idle',
	// @ts-expect-error - "authenticated" is missing
	states: { idle: state(), authenticating: state() },
})

export const badInitial = createMachine({
	types: {} as AuthSpec,
	// @ts-expect-error - "nope" is not a state of AuthSpec
	initialState: 'nope',
	states: {
		// @ts-expect-error - S was not inferred
		idle: state(),
		// @ts-expect-error - S was not inferred
		authenticating: state(),
		// @ts-expect-error - S was not inferred
		authenticated: state(),
	},
})
