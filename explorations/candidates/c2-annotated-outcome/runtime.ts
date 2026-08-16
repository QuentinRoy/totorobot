// A real, minimal runtime for notation B, so the acceptance traces can be
// EXECUTED rather than merely type-checked. Caller-owned evolution only:
// `step` is pure and synchronous, and returns commands as data.

import type { AnyInputs, AnyStates, Machine, Step, StateValue } from './lib.ts'

type AnyOutcome =
	| { kind: 'to'; to: string; data: unknown; commands: readonly unknown[] }
	| { kind: 'keep'; data: unknown; commands: readonly unknown[] }
	| { kind: 'repeat'; data: unknown; commands: readonly unknown[] }
	| { kind: 'none' }

/** The real `machine`: an identity function. All the work is in the types. */
export function defineMachine<T>(def: T): T {
	return def
}

export function step<S extends AnyStates, I extends AnyInputs, C>(
	m: Machine<S, I, C>,
	current: StateValue<S>,
	inputName: string,
	payload?: unknown,
): Step<S, C> {
	const states = m.states as Record<
		string,
		{
			on?: Record<string, unknown>
			enter?: (c: { data: unknown }) => readonly unknown[]
			exit?: (c: { data: unknown }) => readonly unknown[]
		}
	>
	const handler = states[current.state]?.on?.[inputName]
	if (typeof handler !== 'function') {
		return { kind: 'none', reason: 'unavailable', commands: [] }
	}

	const at: Record<
		string,
		(data?: unknown, commands?: readonly unknown[]) => AnyOutcome
	> = {}
	for (const name of Object.keys(states)) {
		at[name] = (data, commands) => ({
			kind: 'to',
			to: name,
			data,
			commands: commands ?? [],
		})
	}

	const outcome = (handler as (ctx: unknown) => AnyOutcome)({
		data: current.data,
		input: payload,
		at,
		keep: (data: unknown, commands?: readonly unknown[]) => ({
			kind: 'keep',
			data,
			commands: commands ?? [],
		}),
		repeat: (data: unknown, commands?: readonly unknown[]) => ({
			kind: 'repeat',
			data,
			commands: commands ?? [],
		}),
		none: () => ({ kind: 'none' }),
	})

	if (outcome.kind === 'none') {
		return { kind: 'none', reason: 'declined', commands: [] }
	}
	const next = (
		outcome.kind === 'to'
			? { state: outcome.to, data: outcome.data }
			: { state: current.state, data: outcome.data }
	) as StateValue<S>

	// Residency. `keep` preserves it, so no enter/exit runs. `to` leaves the
	// source and enters the target. `repeat` deliberately re-runs both for the
	// same state -- this is the whole difference between keep_state and
	// repeat_state (brief section 6, Erlang's two return values).
	const exiting = states[current.state]?.exit
	const entering = states[(next as { state: string }).state]?.enter
	const movesResidency = outcome.kind !== 'keep'
	const exitCmds =
		movesResidency && exiting ? exiting({ data: current.data }) : []
	const enterCmds =
		movesResidency && entering
			? entering({ data: (next as { data: unknown }).data })
			: []

	return {
		kind: outcome.kind,
		next,
		// Exit commands, then the transition's own, then entry commands.
		commands: [...exitCmds, ...outcome.commands, ...enterCmds] as readonly C[],
		residencyRan: exitCmds.length + enterCmds.length > 0,
	} as Step<S, C>
}
