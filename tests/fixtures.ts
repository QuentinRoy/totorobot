/**
 * Machines shared across the v1 test suite. Kept minimal and reused rather
 * than duplicated — most behaviour-list items are exercisable on one small
 * topology. One-off machines needed by a single test stay inline in that
 * test file.
 */

import { machine, type } from 'totorobot'

type ToggleInputs = { toggle: undefined }
type ToggleStates = { off: undefined; on: undefined }

/** The smallest useful machine: two payload-free states, one input each way. */
export const toggle = machine({
	initial: 'off',
	inputs: type<ToggleInputs>(),
	states: type<ToggleStates>(),
	transitions: {
		'off -toggle> on': () => {},
		'on -toggle> off': () => {},
	},
})

type EditorInputs = {
	open: { text: string }
	revise: { text: string }
	touch: undefined
	submit: { route: 'review' | 'publish' }
	poke: undefined
	lock: undefined
}
type Draft = { text: string; revision: number }
type EditorStates = {
	idle: undefined
	draft: Draft
	review: Draft
	published: Draft
	locked: undefined
}

/**
 * A richer topology for the reading and sending behaviour groups: `draft` carries
 * data, has two rows for one input (`submit`), a row that always declines
 * (`poke`), a self-transition (`revise`) and `locked` has no outgoing rows at
 * all.
 */
export const editor = machine({
	initial: 'idle',
	inputs: type<EditorInputs>(),
	states: type<EditorStates>(),
	transitions: {
		'idle -open> draft': ({ inputData }) => ({
			text: inputData.text,
			revision: 0,
		}),
		'draft -revise> draft': ({ fromData, inputData }) => ({
			text: inputData.text,
			revision: fromData.revision + 1,
		}),
		'draft -touch> draft': ({ fromData }) => fromData,
		'draft -submit> review': ({ fromData, inputData, skip }) =>
			inputData.route === 'review' ? fromData : skip(),
		'draft -submit> published': ({ fromData, inputData, skip }) =>
			inputData.route === 'publish' ? fromData : skip(),
		'draft -poke> draft': ({ skip }) => skip(),
		'draft -lock> locked': () => {},
	},
})

type GateInputs = { submit: { quota: number }; reset: undefined }
type GateStates = {
	draft: undefined
	checking: { quota: number }
	allowed: { quota: number }
	denied: { quota: number }
}

/**
 * A guarded choice, expressed as ordered immediate rows out of a transient
 * state: `checking` decides between `allowed` and `denied` by trying its own
 * rows in declaration order and letting `skip()` fall through.
 */
export const gate = machine({
	initial: 'draft',
	inputs: type<GateInputs>(),
	states: type<GateStates>(),
	transitions: {
		'draft -submit> checking': ({ inputData }) => inputData,
		'checking -> allowed': ({ fromData, skip }) =>
			fromData.quota > 0 ? fromData : skip(),
		'checking -> denied': ({ fromData }) => fromData,
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
	inputs: type<{ submit: { quota: number }; cancel: undefined }>(),
	states: type<{
		draft: undefined
		checking: { quota: number }
		allowed: { quota: number }
	}>(),
	transitions: {
		'draft -submit> checking': ({ inputData }) => inputData,
		'checking -> allowed': ({ fromData, skip }) =>
			fromData.quota > 0 ? fromData : skip(),
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
	inputs: type<{ go: undefined; stop: undefined }>(),
	states: type<{ idle: undefined; loop: { count: number } }>(),
	transitions: {
		'idle -go> loop': () => ({ count: 0 }),
		'loop -> loop': ({ fromData }) => ({ count: fromData.count + 1 }),
		'loop -stop> idle': () => {},
	},
})

type Steps = { a: undefined; b: undefined; c: undefined; d: undefined }

/** A chain of immediate hops, three deep, off one input. */
export const chain = machine({
	initial: 'a',
	inputs: type<{ go: undefined }>(),
	states: type<Steps>(),
	transitions: {
		'a -go> b': () => {},
		'b -> c': () => {},
		'c -> d': () => {},
	},
})

/**
 * A resource-shaped residency — kind 3 in §9's table, the one activation and
 * teardown alone cannot express — on `b`, in the middle of the same three-hop
 * chain as `chain`: `b` is occupied only mid-chain, so a host that sends `go`
 * enters and leaves it within one drain. Callers provide its setup and teardown
 * callbacks so each test can inspect its own activity.
 */
export function activity(setup: () => void, teardown: () => void) {
	return machine({
		initial: 'a',
		inputs: type<{ go: undefined }>(),
		states: type<Steps>(),
		transitions: {
			'a -go> b': () => {},
			'b -> c': () => {},
			'c -> d': () => {},
		},
		actions: {
			b: () => {
				setup()
				return teardown
			},
		},
	})
}
