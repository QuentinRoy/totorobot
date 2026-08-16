// The Radix kernel, transcribed from radix-ui/primitives
// packages/react/presence/src/use-state-machine.tsx.
//
// `React.useReducer` and `React.useRef` are modelled as plain closures so the
// baseline runs without React. Nothing else is changed: the reducer is still
// `machine[state][event] ?? state`, there is still no context, no guards, and
// no actions.

type Machine<S extends string> = { [k: string]: { [k: string]: S } }

export type MachineState<M> = keyof M & string

// https://fettblog.eu/typescript-union-to-intersection/ (Radix's own comment)
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (
	x: infer R,
) => any
	? R
	: never

export type MachineEvent<M> = keyof UnionToIntersection<M[keyof M]> & string

export function createStateMachine<M>(
	initialState: MachineState<M>,
	machine: M & Machine<MachineState<M>>,
): readonly [
	() => MachineState<M>,
	(event: MachineEvent<M>) => MachineState<M>,
] {
	let state = initialState
	const send = (event: MachineEvent<M>): MachineState<M> => {
		// Radix writes `(machine[state] as any)[event]`; the indexed access on
		// `M & Machine<...>` is not resolvable without it.
		const next = (machine[state] as any)[event] as MachineState<M> | undefined
		state = next ?? state
		return state
	}
	return [() => state, send]
}

// React.useRef, modelled as a plain mutable cell.
export function createRef<T>(initial: T): { current: T } {
	return { current: initial }
}
