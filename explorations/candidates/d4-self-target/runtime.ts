// Runtime for notation D. Branches are tried in declaration order; the first
// that does not `skip()` wins.

import type { AnyInputs, AnyStates, Machine, StateValue, Step } from './lib.ts'

const SKIP: unique symbol = Symbol('skip')
const skipValue = { [SKIP]: true } as const
const isSkip = (v: unknown): boolean =>
	typeof v === 'object' && v !== null && SKIP in v

export function step<S extends AnyStates, I extends AnyInputs, C>(
	m: Machine<S, I, C>,
	current: StateValue<S>,
	inputName: string,
	payload?: unknown,
): Step<S, C> {
	const states = m.states as Record<
		string,
		{
			on?: Record<string, Record<string, unknown> | string>
			enter?: (c: { data: unknown }) => readonly unknown[]
			exit?: (c: { data: unknown }) => readonly unknown[]
		}
	>
	const edge = states[current.state]?.on?.[inputName]
	if (!edge) return { kind: 'none', reason: 'unavailable', commands: [] }

	// Bare shorthand. `'&'` is handled-but-unchanged: no data written, and no
	// residency run, because we never left.
	if (typeof edge === 'string') {
		if (edge === '&') return { kind: 'keep', next: current, commands: [] }
		const next = { state: edge, data: undefined } as StateValue<S>
		const exitCmds = states[current.state]?.exit?.({ data: current.data }) ?? []
		const enterCmds = states[edge]?.enter?.({ data: undefined }) ?? []
		return {
			kind: 'to',
			next,
			commands: [...exitCmds, ...enterCmds] as readonly C[],
		}
	}

	const emitted: unknown[] = []
	const ctx = {
		data: current.data,
		input: payload,
		skip: () => skipValue,
		emit: (...cs: readonly unknown[]) => {
			emitted.push(...cs)
		},
	}

	// Declaration order decides priority.
	for (const key of Object.keys(edge)) {
		const branch = edge[key]
		if (typeof branch !== 'function') continue
		const result = (branch as (c: unknown) => unknown)(ctx)
		if (isSkip(result)) {
			emitted.length = 0 // a skipped branch's effects do not happen
			continue
		}

		// `'&'` stays; naming the current state RE-ENTERS it; anything else moves.
		const kind = key === '&' ? 'keep' : key === current.state ? 'repeat' : 'to'
		const targetName = key === '&' ? current.state : key
		const next = { state: targetName, data: result } as StateValue<S>

		// Residency: `keep` preserves it, `to` and `repeat` re-run exit/enter.
		const movesResidency = kind !== 'keep'
		const exitCmds =
			movesResidency && states[current.state]?.exit
				? states[current.state]!.exit!({ data: current.data })
				: []
		const enterCmds =
			movesResidency && states[targetName]?.enter
				? states[targetName]!.enter!({ data: result })
				: []

		return {
			kind,
			next,
			commands: [...exitCmds, ...emitted, ...enterCmds] as readonly C[],
		}
	}

	// Every branch skipped: a handled refusal.
	return { kind: 'none', reason: 'declined', commands: [] }
}
