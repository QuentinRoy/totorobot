// Case 1, the reduced Marking Menu, in notation B.
//
// This is PRESSURE on the vocabulary established by the neutral machine, not
// the design target. The question this file answers is: does the primary
// interaction case force any change to how a transition is written?

import {
	type Keep,
	type None,
	type To,
	command,
	data,
	input,
	machine,
} from './lib.ts'

// --- ordinary domain types and helpers, not library features ----------------

type Point = readonly [x: number, y: number]
type Item = { readonly label: string }
type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}
type Stroke = readonly Point[]

const FAR = 10

const dist = (a: Point, b: Point): number =>
	Math.hypot(a[0] - b[0], a[1] - b[1])
const append = (s: Stroke, p: Point): Stroke => [...s, p]

const rootMenu: Menu = {
	label: 'root',
	children: [
		{ label: 'cut' },
		{ label: 'copy' },
		{ label: 'paste' },
		{ label: 'more', children: [{ label: 'undo' }, { label: 'redo' }] },
	],
}

// --- effects, as returned data ----------------------------------------------

type Cmd =
	| { readonly do: 'startInteraction' }
	| { readonly do: 'scheduleDwell'; readonly token: number }
	| { readonly do: 'cancelDwell'; readonly token: number }
	| { readonly do: 'openMenu'; readonly menu: Menu; readonly center: Point }
	| { readonly do: 'finish'; readonly stroke: Stroke }
	| { readonly do: 'cancelled' }

export const markingMenu = machine({
	initial: 'idle',
	commands: command<Cmd>(),
	inputs: {
		down: input<{ readonly point: Point }>(),
		move: input<{ readonly point: Point }>(),
		up: input<{ readonly point: Point }>(),
		cancel: input<{ readonly point: Point }>(),
		dwellElapsed: input<{ readonly token: number }>(),
	},
	states: {
		idle: {
			data: data<{ readonly nextToken: number }>(),
			on: {
				down: ({ data, input, at }): To<'startup'> =>
					at.startup(
						{
							origin: input.point,
							stroke: [input.point],
							timerToken: data.nextToken,
							nextToken: data.nextToken + 1,
						},
						[{ do: 'startInteraction' }],
					),
			},
		},

		startup: {
			data: data<{
				readonly origin: Point
				readonly stroke: Stroke
				readonly timerToken: number
				readonly nextToken: number
			}>(),
			// The dwell belongs to `startup`, not to the four edges that leave it.
			enter: ({ data }): readonly Cmd[] => [
				{ do: 'scheduleDwell', token: data.timerToken },
			],
			exit: ({ data }): readonly Cmd[] => [
				{ do: 'cancelDwell', token: data.timerToken },
			],
			on: {
				move: ({ data, input, at, keep }): Keep | To<'expert'> =>
					dist(data.origin, input.point) < FAR
						? keep({ ...data, stroke: append(data.stroke, input.point) })
						: at.expert({
								stroke: append(data.stroke, input.point),
								nextToken: data.nextToken,
							}),

				dwellElapsed: ({ data, input, at, none }): To<'novice'> | None =>
					input.token !== data.timerToken
						? none()
						: at.novice(
								{
									menu: rootMenu,
									center: data.origin,
									stroke: data.stroke,
									nextToken: data.nextToken,
								},
								[{ do: 'openMenu', menu: rootMenu, center: data.origin }],
							),

				up: ({ data, at }): To<'idle'> =>
					at.idle({ nextToken: data.nextToken }, [
						{ do: 'finish', stroke: data.stroke },
					]),

				cancel: ({ data, at }): To<'idle'> =>
					at.idle({ nextToken: data.nextToken }, [{ do: 'cancelled' }]),
			},
		},

		expert: {
			data: data<{ readonly stroke: Stroke; readonly nextToken: number }>(),
			on: {
				move: ({ data, input, keep }): Keep =>
					keep({ ...data, stroke: append(data.stroke, input.point) }),

				up: ({ data, at }): To<'idle'> =>
					at.idle({ nextToken: data.nextToken }, [
						{ do: 'finish', stroke: data.stroke },
					]),

				cancel: ({ data, at }): To<'idle'> =>
					at.idle({ nextToken: data.nextToken }, [{ do: 'cancelled' }]),
			},
		},

		novice: {
			data: data<{
				readonly menu: Menu
				readonly center: Point
				readonly stroke: Stroke
				readonly nextToken: number
			}>(),
			on: {
				move: ({ data, input, keep }): Keep =>
					keep({ ...data, stroke: append(data.stroke, input.point) }),

				up: ({ data, at }): To<'idle'> =>
					at.idle({ nextToken: data.nextToken }, [
						{ do: 'finish', stroke: data.stroke },
					]),

				cancel: ({ data, at }): To<'idle'> =>
					at.idle({ nextToken: data.nextToken }, [{ do: 'cancelled' }]),
			},
		},
	},
})
