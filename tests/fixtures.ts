/**
 * Machines shared across the v1 test suite. Kept minimal and reused rather
 * than duplicated — most behaviour-list items are exercisable on one small
 * topology. One-off machines needed by a single test stay inline in that
 * test file.
 */

import { machine, types } from '../src/totorobot.ts'

type ToggleInputs = { toggle: void }
type ToggleStates = { off: void; on: void }

/** The smallest useful machine: two `void` states, one input each way. */
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
type EditorStates = {
	idle: void
	draft: { text: string; revision: number }
	review: { text: string; revision: number }
	published: { text: string; revision: number }
	locked: void
}

/**
 * A richer topology for the reading and sending behaviour groups: `draft` carries
 * data, has two rows for one input (`submit`, deduplicated in `available`), a row
 * that always declines (`poke`), a self-transition (`revise`) and `locked` has no
 * outgoing rows at all.
 */
export const editor = machine({
	initial: 'idle',
	inputs: types<EditorInputs>(),
	states: types<EditorStates>(),
	transitions: {
		'idle -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -revise> draft': ({ data, input }) => ({
			text: input.text,
			revision: data.revision + 1,
		}),
		'draft -touch> draft': ({ data }) => ({ ...data }),
		'draft -submit> review': ({ data, input, skip }) =>
			input.route === 'review' ? { ...data } : skip(),
		'draft -submit> published': ({ data, input, skip }) =>
			input.route === 'publish' ? { ...data } : skip(),
		'draft -poke> draft': ({ skip }) => skip(),
		'draft -lock> locked': () => {},
	},
})
