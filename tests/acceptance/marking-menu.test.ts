/**
 * Case 1: Reduced Marking Menu (docs/acceptance-cases.md), the primary
 * acceptance case. `idle`, `startup`, `expert` and `novice` over `down`,
 * `move`, `dwellElapsed`, `up` and `cancel`.
 *
 * The case is specified in terms of effects — "reports start", "schedules
 * dwell", "cancels token", "opens a menu" — but v1 owns no effects; `actions`
 * is deferred (docs/roadmap.md). Every effect below is therefore re-expressed
 * as a caller-side `.observe()` listener, which is v1's documented answer:
 * "the caller writes a function". This shape is a deferral decided in the
 * design, not a limitation discovered here.
 *
 * Distance calculation, stroke append and the menu itself are ordinary
 * domain helpers, per the spec, rather than library features.
 */

import { describe, expect, test } from 'vitest'

import { machine, type } from 'totorobot'

type Item = { readonly label: string }
type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}
type Point = { x: number; y: number }
type Stroke = readonly Point[]

type MarkingMenuInputs =
	| { type: 'down'; point: Point }
	| { type: 'move'; point: Point }
	| { type: 'dwellElapsed'; token: number }
	| { type: 'up'; point: Point }
	| { type: 'cancel'; point: Point }
type MarkingMenuStates =
	| { name: 'idle'; nextToken: number }
	| {
			name: 'startup'
			origin: Point
			stroke: Stroke
			timerToken: number
			nextToken: number
	  }
	| { name: 'expert'; stroke: Stroke; nextToken: number }
	| {
			name: 'novice'
			menu: Menu
			center: Point
			stroke: Stroke
			nextToken: number
	  }

const DWELL_DISTANCE_THRESHOLD = 10

function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y)
}

function appendStroke(stroke: Stroke, point: Point): Stroke {
	return [...stroke, point]
}

const rootMenu: Menu = {
	label: 'root',
	children: [{ label: 'copy' }, { label: 'paste' }],
}

const markingMenu = machine({
	initial: 'idle',
	inputs: type<MarkingMenuInputs>(),
	states: type<MarkingMenuStates>(),
	transitions: {
		'idle -down> startup': ({ state, input }) => ({
			origin: input.point,
			stroke: [input.point],
			timerToken: state.nextToken,
			nextToken: state.nextToken + 1,
		}),
		'startup -move> startup': ({ state, input, skip }) =>
			distance(state.origin, input.point) < DWELL_DISTANCE_THRESHOLD
				? { ...state, stroke: appendStroke(state.stroke, input.point) }
				: skip(),
		'startup -move> expert': ({ state, input, skip }) =>
			distance(state.origin, input.point) < DWELL_DISTANCE_THRESHOLD
				? skip()
				: {
						stroke: appendStroke(state.stroke, input.point),
						nextToken: state.nextToken,
					},
		'startup -dwellElapsed> novice': ({ state, input, skip }) =>
			input.token === state.timerToken
				? {
						menu: rootMenu,
						center: state.origin,
						stroke: state.stroke,
						nextToken: state.nextToken,
					}
				: skip(),
		'expert -move> expert': ({ state, input }) => ({
			...state,
			stroke: appendStroke(state.stroke, input.point),
		}),
		'novice -move> novice': ({ state, input }) => ({
			...state,
			stroke: appendStroke(state.stroke, input.point),
		}),
		'startup -up> idle': ({ state }) => ({ nextToken: state.nextToken }),
		'expert -up> idle': ({ state }) => ({ nextToken: state.nextToken }),
		'novice -up> idle': ({ state }) => ({ nextToken: state.nextToken }),
		'startup -cancel> idle': ({ state }) => ({ nextToken: state.nextToken }),
		'expert -cancel> idle': ({ state }) => ({ nextToken: state.nextToken }),
		'novice -cancel> idle': ({ state }) => ({ nextToken: state.nextToken }),
	},
})

const p0: Point = { x: 0, y: 0 }
const p1Near: Point = { x: 1, y: 1 }
const p2Far: Point = { x: 100, y: 100 }

describe('acceptance: Reduced Marking Menu', () => {
	test('trace 1: down enters startup, reports start, and schedules the dwell token', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		const log: string[] = []
		doc.observe('idle -down> startup', () => log.push('report:start'))
		doc.observe('idle -down> startup', (e) =>
			log.push(`schedule:${e.to.timerToken}`),
		)

		doc.send({ type: 'down', point: p0 })

		expect(doc.current).toEqual({
			name: 'startup',
			origin: p0,
			stroke: [p0],
			timerToken: 0,
			nextToken: 1,
		})
		expect(log).toEqual(['report:start', 'schedule:0'])
	})

	test('trace 2: a nearby move commits a same-state stroke update, then a matching dwellElapsed enters novice and reports open', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		doc.send({ type: 'down', point: p0 }) // -> startup(timerToken: 0, nextToken: 1)

		doc.send({ type: 'move', point: p1Near })
		expect(doc.current).toEqual({
			name: 'startup',
			origin: p0,
			stroke: [p0, p1Near],
			timerToken: 0,
			nextToken: 1,
		})

		const log: string[] = []
		doc.observe('startup -dwellElapsed> novice', () => log.push('open'))

		doc.send({ type: 'dwellElapsed', token: 0 }) // matches the scheduled token

		expect(doc.current).toEqual({
			name: 'novice',
			menu: rootMenu,
			center: p0,
			stroke: [p0, p1Near],
			nextToken: 1,
		})
		expect(log).toEqual(['open'])
	})

	test('trace 3 (fresh execution): a far move enters expert and cancels the dwell token; a later stale dwellElapsed does not enter novice', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		doc.send({ type: 'down', point: p0 }) // -> startup(timerToken: 0, nextToken: 1)

		const log: string[] = []
		doc.observe('startup -move> expert', (e) =>
			log.push(`cancel:${e.from.timerToken}`),
		)

		doc.send({ type: 'move', point: p2Far })
		expect(doc.current).toEqual({
			name: 'expert',
			stroke: [p0, p2Far],
			nextToken: 1,
		})
		expect(log).toEqual(['cancel:0'])

		const before = doc.current
		doc.send({ type: 'dwellElapsed', token: 0 }) // stale: token 0 was already cancelled
		expect(doc.current).toEqual(before)
		expect(doc.current.name).not.toBe('novice')
	})

	test('trace 4: cancel from startup returns to idle, cancels the dwell token, and reports cancellation', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		doc.send({ type: 'down', point: p0 }) // -> startup(timerToken: 0, nextToken: 1)

		const log: string[] = []
		doc.observe('startup -cancel> idle', (e) => {
			log.push(`cancel:${e.from.timerToken}`)
			log.push('report:cancel')
		})

		doc.send({ type: 'cancel', point: p0 })

		expect(doc.current).toEqual({ name: 'idle', nextToken: 1 })
		expect(log).toEqual(['cancel:0', 'report:cancel'])
	})

	test('trace 5: an input unavailable in the current state produces no transition, not a same-state update', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		const before = doc.current
		const log: string[] = []
		doc.observe('* -> *', () => log.push('fired'))

		doc.send({ type: 'move', point: p1Near }) // idle has no row for move

		expect(doc.current).toEqual(before)
		expect(log).toEqual([])
	})
})
