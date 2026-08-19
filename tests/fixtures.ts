/**
 * Machines shared across the v1 test suite. Kept minimal and reused rather
 * than duplicated — most behaviour-list items are exercisable on one small
 * topology. One-off machines needed by a single test stay inline in that
 * test file.
 */

import { machine, types } from 'totorobot'

type ToggleInputs = { toggle: void }
type ToggleStates = { name: 'off' } | { name: 'on' }

/** The smallest useful machine: two payload-free states, one input each way. */
export const toggle = machine({
	initial: 'off',
	inputs: types<ToggleInputs>(),
	states: types<ToggleStates>(),
	transitions: {
		'off -toggle> on': () => {},
		'on -toggle> off': () => {},
	},
})

type EditorInputs = {
	open: { text: string }
	revise: { text: string }
	touch: void
	submit: { route: 'review' | 'publish' }
	poke: void
	lock: void
}
type EditorStates =
	| { name: 'idle' }
	| { name: 'draft'; text: string; revision: number }
	| { name: 'review'; text: string; revision: number }
	| { name: 'published'; text: string; revision: number }
	| { name: 'locked' }

/**
 * A richer topology for the reading and sending behaviour groups: `draft` carries
 * data, has two rows for one input (`submit`), a row that always declines
 * (`poke`), a self-transition (`revise`) and `locked` has no outgoing rows at
 * all.
 */
type GateInputs = { submit: { quota: number }; reset: void }
type GateStates =
	| { name: 'draft' }
	| { name: 'checking'; quota: number }
	| { name: 'allowed'; quota: number }
	| { name: 'denied'; quota: number }

/**
 * A guarded choice, expressed as ordered immediate rows out of a transient
 * state: `checking` decides between `allowed` and `denied` by trying its own
 * rows in declaration order and letting `skip()` fall through.
 */
export const gate = machine({
	initial: 'draft',
	inputs: types<GateInputs>(),
	states: types<GateStates>(),
	transitions: {
		'draft -submit> checking': ({ input }) => ({ quota: input.quota }),
		'checking -> allowed': ({ state, skip }) =>
			state.quota > 0 ? { ...state } : skip(),
		'checking -> denied': ({ state }) => ({ ...state }),
		'allowed -reset> draft': () => {},
		'denied -reset> draft': () => {},
	},
})

/**
 * A single immediate row that can skip, with an ordinary input row left live
 * on the same source. Reaching `checking` with a non-positive quota leaves the
 * machine parked there — "not met yet" — rather than settling anywhere.
 */
export const pending = machine({
	initial: 'draft',
	inputs: types<{ submit: { quota: number }; cancel: void }>(),
	states: types<
		| { name: 'draft' }
		| { name: 'checking'; quota: number }
		| { name: 'allowed'; quota: number }
	>(),
	transitions: {
		'draft -submit> checking': ({ input }) => ({ quota: input.quota }),
		'checking -> allowed': ({ state, skip }) =>
			state.quota > 0 ? { ...state } : skip(),
		'checking -cancel> draft': () => {},
	},
})

/**
 * A self-immediate that never skips: entering `loop` chains into itself
 * forever, which is what a hop-budget test needs. `stop` is a plain input row
 * left on `loop` so a test can show the host still works after the budget
 * throws.
 */
export const spinner = machine({
	initial: 'idle',
	inputs: types<{ go: void; stop: void }>(),
	states: types<{ name: 'idle' } | { name: 'loop'; count: number }>(),
	transitions: {
		'idle -go> loop': () => ({ count: 0 }),
		'loop -> loop': ({ state }) => ({ count: state.count + 1 }),
		'loop -stop> idle': () => {},
	},
})

/** A chain of immediate hops, three deep, off one input. */
export const chain = machine({
	initial: 'a',
	inputs: types<{ go: void }>(),
	states: types<
		{ name: 'a' } | { name: 'b' } | { name: 'c' } | { name: 'd' }
	>(),
	transitions: {
		'a -go> b': () => {},
		'b -> c': () => {},
		'c -> d': () => {},
	},
})

export const editor = machine({
	initial: 'idle',
	inputs: types<EditorInputs>(),
	states: types<EditorStates>(),
	transitions: {
		'idle -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -revise> draft': ({ state, input }) => ({
			text: input.text,
			revision: state.revision + 1,
		}),
		'draft -touch> draft': ({ state }) => ({ ...state }),
		'draft -submit> review': ({ state, input, skip }) =>
			input.route === 'review' ? { ...state } : skip(),
		'draft -submit> published': ({ state, input, skip }) =>
			input.route === 'publish' ? { ...state } : skip(),
		'draft -poke> draft': ({ skip }) => skip(),
		'draft -lock> locked': () => {},
	},
})
