import { defineMachine } from "../../src/totorobot.ts"

/**
 * Example 1: per-state context.
 *
 * `yellow` carries a `blinking` flag that simply does not exist on the other
 * states - the thing robot3's single flat context could not express.
 */
export interface NextEvent {
	type: "next"
}

type TrafficLightSpec = {
	states: {
		red: { changes: number }
		green: { changes: number }
		yellow: { changes: number; blinking: boolean }
	}
	events: {
		next: Omit<NextEvent, "type">
	}
}

export const trafficLight = defineMachine<TrafficLightSpec>().create(
	"red",
	({ state, transition, reduce }) => ({
		red: state(
			transition(
				"next",
				"green",
				reduce((context) => ({
					changes: context.changes + 1,
				})),
			),
		),
		green: state(
			transition(
				"next",
				"yellow",
				reduce((context) => ({
					changes: context.changes + 1,
					blinking: true,
				})),
			),
		),
		yellow: state(
			transition(
				"next",
				"red",
				// `context.blinking` is available here and nowhere else.
				reduce((context) => ({
					changes: context.changes + (context.blinking ? 1 : 0),
				})),
			),
		),
	}),
)
