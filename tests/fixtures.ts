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
