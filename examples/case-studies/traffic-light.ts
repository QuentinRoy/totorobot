import { machine, types } from '../../src/totorobot.ts'

/**
 * Example 1: per-state data.
 *
 * `yellow` carries a `blinking` flag that simply does not exist on the other
 * states — the thing a single flat context could not express. Reading
 * `data.blinking` from the `red` or `green` rows is a compile error rather than
 * a nullable field everyone has to check.
 */
type Inputs = { next: void }

type States = {
	red: { changes: number }
	green: { changes: number }
	yellow: { changes: number; blinking: boolean }
}

export const trafficLight = machine({
	initial: 'red',
	inputs: types<Inputs>(),
	states: types<States>(),

	transitions: {
		'red -next> green': ({ data }) => ({ changes: data.changes + 1 }),
		'green -next> yellow': ({ data }) => ({
			changes: data.changes + 1,
			blinking: true,
		}),
		// `data.blinking` is available here and nowhere else.
		'yellow -next> red': ({ data }) => ({
			changes: data.changes + (data.blinking ? 1 : 0),
		}),
	},
})
