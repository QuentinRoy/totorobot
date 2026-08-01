/**
 * Option A: the spec as a value.
 *
 *     createMachine(
 *       defineMachine<AuthSpec>(),
 *       'idle',
 *       ({ state, transition, ... }) => ({ ... }),
 *     )
 *
 * `defineMachine<S>()` returns a phantom `Spec<S>` marker instead of an object
 * carrying a `.create` method, and `createMachine(spec, initial, build)` infers
 * `S` from that marker.
 *
 * Result: as written, does not compile. Inferring `S` in the same call that
 * infers `States` starves the builder's return of the per-key contextual type
 * `state()` needs, so `K` falls back to `StateName<S>` and every source context
 * degrades to `never`.
 *
 * The second half of this file is the control: the identical body with `S`
 * already concrete compiles clean. That isolates the cause, and it is why the
 * current API splits into two calls.
 *
 * The likely mechanism is the *builder callback*. Its unannotated parameter
 * makes the arrow context-sensitive, so it is deferred to a later inference
 * round; there the returned object literal must be both the source `States` is
 * inferred from and the site where `state()` reads its contextual `K`, and `K`
 * loses. Option D has no callback - the state map is a plain argument,
 * contextually typed property by property - which is why it can infer `S` in
 * the same call.
 *
 * Scope of the claim: this formulation fails, not necessarily the shape.
 * Untried levers that might rescue it include making `StateDefinition`'s
 * `state?: K` required (Option D's equivalent is, and inference through
 * optional properties is weaker), `NoInfer<>` on the mapped member, and moving
 * the exactness check off the callback's return type. Not pursued, because a
 * repaired version would still carry the callback and the extra step that
 * Option D does without.
 *
 * See [Design explorations](../docs/design-explorations.md).
 */

import type {
	EventName,
	Kit,
	Machine,
	MachineSpec,
	StateDefinition,
	StateName,
} from '../src/totorobot.ts'

/**
 * A phantom marker. `S` appears only in a covariant readonly position, the same
 * risk profile `Machine<S, ...>` already carries.
 */
interface Spec<S extends MachineSpec> {
	readonly __spec: S
}

declare function defineMachine<S extends MachineSpec>(): Spec<S>

interface AuthSpec extends MachineSpec {
	states: {
		idle: { attempts: number }
		authenticating: { attempts: number; username: string }
		authenticated: { username: string }
	}
	events: {
		login: { username: string }
		success: object
		failure: object
	}
}

// ---------------------------------------------------------------------------
// The proposal: S inferred from the first argument.
// ---------------------------------------------------------------------------

declare function createMachine<
	S extends MachineSpec,
	Initial extends StateName<S>,
	States extends Record<StateName<S>, unknown>,
>(
	spec: Spec<S>,
	initial: Initial,
	build: (kit: Kit<S>) => States & {
		[K in StateName<S>]: StateDefinition<S, K, EventName<S>>
	} & { [K in Exclude<keyof States, StateName<S>>]: never },
): Machine<S, States, Initial>

export const machine = createMachine(
	defineMachine<AuthSpec>(),
	'idle',
	({ state, transition, reduce }) => ({
		// @ts-expect-error - state() inferred K as StateName<AuthSpec> rather than
		// "idle", so this StateDefinition does not match the key it was written
		// under.
		idle: state(
			// @ts-expect-error - the source context degraded to `never`
			transition(
				'login',
				'authenticating',
				reduce((context, event: { username: string }) => ({
					// @ts-expect-error - `context` is `never`, so it cannot be spread
					...context,
					username: event.username,
				})),
			),
		),
		authenticating: state(),
		authenticated: state(),
	}),
)

// ---------------------------------------------------------------------------
// The control: identical body, but S is already concrete. No errors.
// ---------------------------------------------------------------------------

declare function createMachineWithFixedSpec<
	Initial extends StateName<AuthSpec>,
	States extends Record<StateName<AuthSpec>, unknown>,
>(
	spec: Spec<AuthSpec>,
	initial: Initial,
	build: (kit: Kit<AuthSpec>) => States & {
		[K in StateName<AuthSpec>]: StateDefinition<
			AuthSpec,
			K,
			EventName<AuthSpec>
		>
	} & { [K in Exclude<keyof States, StateName<AuthSpec>>]: never },
): Machine<AuthSpec, States, Initial>

export const control = createMachineWithFixedSpec(
	defineMachine<AuthSpec>(),
	'idle',
	({ state, transition, guard, reduce }) => ({
		idle: state(
			transition(
				'login',
				'authenticating',
				guard((_context, event) => event.username.length > 0),
				reduce((context, event) => ({ ...context, username: event.username })),
			),
		),
		authenticating: state(
			transition(
				'success',
				'authenticated',
				reduce((c) => ({ username: c.username })),
			),
			transition(
				'failure',
				'idle',
				reduce((c) => ({ attempts: c.attempts + 1 })),
			),
		),
		authenticated: state(),
	}),
)

/** `initial` is narrowed to the literal, as it is today. */
export const initialIsNarrowed: 'idle' = control.initial

/** A wrong reducer output is reported on the `reduce()` call itself. */
export const badReducer = createMachineWithFixedSpec(
	defineMachine<AuthSpec>(),
	'idle',
	({ state, transition, reduce }) => ({
		idle: state(
			transition(
				'login',
				'authenticating',
				// @ts-expect-error - must produce authenticating's context, not idle's
				reduce((context) => ({ attempts: context.attempts })),
			),
		),
		authenticating: state(),
		authenticated: state(),
	}),
)
