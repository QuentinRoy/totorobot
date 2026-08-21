import { machine, types } from '../../src/totorobot.ts'

/**
 * Example 1: per-state data.
 *
 * `yellow` carries a `blinking` flag that simply does not exist on the other
 * states — the thing a single flat context could not express. Reading
 * `data.blinking` from the `red` or `green` rows is a compile error rather than
 * a nullable field everyone has to check.
 */
type Inputs = { type: 'next' }

type States =
	| { name: 'red'; changes: number }
	| { name: 'green'; changes: number }
	| { name: 'yellow'; changes: number; blinking: boolean }

export const trafficLight = machine({
	initial: 'red',
	inputs: types<Inputs>(),
	states: types<States>(),

	transitions: {
		'red -next> green': ({ state }) => ({ changes: state.changes + 1 }),
		'green -next> yellow': ({ state }) => ({
			changes: state.changes + 1,
			blinking: true,
		}),
		// `state.blinking` is available here and nowhere else.
		'yellow -next> red': ({ state }) => ({
			changes: state.changes + (state.blinking ? 1 : 0),
		}),
	},
})
