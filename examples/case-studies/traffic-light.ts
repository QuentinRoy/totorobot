import { machine, type } from '../../src/totorobot.ts'

/**
 * Example 1: per-state data.
 *
 * `yellow` carries a `blinking` flag that simply does not exist on the other
 * states — the thing a single flat context could not express. Reading
 * `fromData.blinking` from the `red` or `green` rows is a compile error rather
 * than a nullable field everyone has to check.
 */
type Inputs = { next: undefined }

type States = {
	red: { changes: number }
	green: { changes: number }
	yellow: { changes: number; blinking: boolean }
}

export const trafficLight = machine({
	inputs: type<Inputs>(),
	states: type<States>(),
	initial: 'red',

	transitions: {
		'red -next> green': ({ fromData }) => ({ changes: fromData.changes + 1 }),
		'green -next> yellow': ({ fromData }) => ({
			changes: fromData.changes + 1,
			blinking: true,
		}),
		// `fromData.blinking` is available here and nowhere else.
		'yellow -next> red': ({ fromData }) => ({
			changes: fromData.changes + (fromData.blinking ? 1 : 0),
		}),
	},
})
