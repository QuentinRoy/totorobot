/**
 * Option B: `define` handed to a callback.
 *
 *     createMachine(({ define }) =>
 *       define<AuthSpec>()('idle', ({ state, transition, ... }) => ({ ... })),
 *     )
 *
 * `createMachine` becomes the only export; `define` arrives as part of the kit
 * passed to its callback.
 *
 * Result: type-checks, and `createMachine` barely needs its own generics - by
 * the time the callback returns, the inner `define<S>()(...)` call has already
 * produced a complete `Machine<S, States, Initial>`.
 *
 * Its cost is why it was set aside: `define` exists only inside that callback's
 * parameter list, so a spec can never be pulled out to module scope. Every
 * machine must declare its spec inline, and the call nests three levels deep
 * instead of Option A's flat three arguments. The commented-out line at the end
 * is the demonstration - it cannot be uncommented.
 *
 * See [Design explorations](../docs/api-rationale.md).
 */

import type {
	EventName,
	Kit,
	Machine,
	MachineSpec,
	StateDefinition,
	StateName,
} from '../src/totorobot.ts'

interface DefineKit {
	define: <S extends MachineSpec>() => <
		Initial extends StateName<S>,
		States extends Record<StateName<S>, unknown>,
	>(
		initial: Initial,
		build: (kit: Kit<S>) => States & {
			[K in StateName<S>]: StateDefinition<S, K, EventName<S>>
		} & { [K in Exclude<keyof States, StateName<S>>]: never },
	) => Machine<S, States, Initial>
}

// `any` rather than a narrower bound: `M` has to be a supertype of every
// concrete Machine the callback might return, and Machine is covariant in all
// three parameters.
declare function createMachine<M extends Machine<any, any, any>>(
	build: (kit: DefineKit) => M,
): M

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

export const machine = createMachine(({ define }) =>
	define<AuthSpec>()('idle', ({ state, transition, guard, reduce }) => ({
		idle: state(
			transition(
				'login',
				'authenticating',
				guard((_context, event) => event.username.length > 0),
				reduce((context, event) => ({ ...context, username: event.username })),
			),
		),
		authenticating: state(),
		authenticated: state(),
	})),
)

// The capability this design gives up. `define` is not in scope out here, so a
// spec can never be declared ahead of time or shared between two machines:
//
//     const authSpec = define<AuthSpec>()
//     //               ^^^^^^ Cannot find name 'define'.
