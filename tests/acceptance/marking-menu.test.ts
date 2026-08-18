/**
 * Case 1: Reduced Marking Menu (docs/acceptance-cases.md), the primary
 * acceptance case. `idle`, `startup`, `expert` and `novice` over `down`,
 * `move`, `dwellElapsed`, `up` and `cancel`.
 *
 * The case is specified in terms of effects — "reports start", "schedules
 * dwell", "cancels token", "opens a menu" — but v1 owns no effects; `actions`
 * is deferred (docs/api.md, "Designed, not in v1"). Every effect below is
 * therefore re-expressed as a caller-side `.on()` listener, which is v1's
 * documented answer: "the caller writes a function". This shape is a
 * deferral decided in the design, not a limitation discovered here.
 *
 * Distance calculation, stroke append and the menu itself are ordinary
 * domain helpers, per the spec, rather than library features.
 */

import { describe, expect, test } from 'vitest'

import { machine, types } from 'totorobot'

type Item = { readonly label: string }
type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}
type Point = { x: number; y: number }
type Stroke = readonly Point[]

type MarkingMenuInputs = {
	down: { point: Point }
	move: { point: Point }
	dwellElapsed: { token: number }
	up: { point: Point }
	cancel: { point: Point }
}
type MarkingMenuStates = {
	idle: { nextToken: number }
	startup: {
		origin: Point
		stroke: Stroke
		timerToken: number
		nextToken: number
	}
	expert: { stroke: Stroke; nextToken: number }
	novice: { menu: Menu; center: Point; stroke: Stroke; nextToken: number }
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
	inputs: types<MarkingMenuInputs>(),
	states: types<MarkingMenuStates>(),
	transitions: {
		'idle -down> startup': ({ data, input }) => ({
			origin: input.point,
			stroke: [input.point],
			timerToken: data.nextToken,
			nextToken: data.nextToken + 1,
		}),
		'startup -move> startup': ({ data, input, skip }) =>
			distance(data.origin, input.point) < DWELL_DISTANCE_THRESHOLD
				? { ...data, stroke: appendStroke(data.stroke, input.point) }
				: skip(),
		'startup -move> expert': ({ data, input, skip }) =>
			distance(data.origin, input.point) < DWELL_DISTANCE_THRESHOLD
				? skip()
				: {
						stroke: appendStroke(data.stroke, input.point),
						nextToken: data.nextToken,
					},
		'startup -dwellElapsed> novice': ({ data, input, skip }) =>
			input.token === data.timerToken
				? {
						menu: rootMenu,
						center: data.origin,
						stroke: data.stroke,
						nextToken: data.nextToken,
					}
				: skip(),
		'expert -move> expert': ({ data, input }) => ({
			...data,
			stroke: appendStroke(data.stroke, input.point),
		}),
		'novice -move> novice': ({ data, input }) => ({
			...data,
			stroke: appendStroke(data.stroke, input.point),
		}),
		'startup -up> idle': ({ data }) => ({ nextToken: data.nextToken }),
		'expert -up> idle': ({ data }) => ({ nextToken: data.nextToken }),
		'novice -up> idle': ({ data }) => ({ nextToken: data.nextToken }),
		'startup -cancel> idle': ({ data }) => ({ nextToken: data.nextToken }),
		'expert -cancel> idle': ({ data }) => ({ nextToken: data.nextToken }),
		'novice -cancel> idle': ({ data }) => ({ nextToken: data.nextToken }),
	},
})

const p0: Point = { x: 0, y: 0 }
const p1Near: Point = { x: 1, y: 1 }
const p2Far: Point = { x: 100, y: 100 }

describe('acceptance: Reduced Marking Menu', () => {
	test('trace 1: down enters startup, reports start, and schedules the dwell token', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		const log: string[] = []
		doc.on('idle -down> startup', () => log.push('report:start'))
		doc.on('idle -down> startup', (e) =>
			log.push(`schedule:${e.to.data.timerToken}`),
		)

		doc.send('down', { point: p0 })

		expect(doc.current).toEqual({
			state: 'startup',
			data: { origin: p0, stroke: [p0], timerToken: 0, nextToken: 1 },
		})
		expect(log).toEqual(['report:start', 'schedule:0'])
	})

	test('trace 2: a nearby move commits a same-state stroke update, then a matching dwellElapsed enters novice and reports open', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		doc.send('down', { point: p0 }) // -> startup(timerToken: 0, nextToken: 1)

		doc.send('move', { point: p1Near })
		expect(doc.current).toEqual({
			state: 'startup',
			data: { origin: p0, stroke: [p0, p1Near], timerToken: 0, nextToken: 1 },
		})

		const log: string[] = []
		doc.on('startup -dwellElapsed> novice', () => log.push('open'))

		doc.send('dwellElapsed', { token: 0 }) // matches the scheduled token

		expect(doc.current).toEqual({
			state: 'novice',
			data: { menu: rootMenu, center: p0, stroke: [p0, p1Near], nextToken: 1 },
		})
		expect(log).toEqual(['open'])
	})

	test('trace 3 (fresh execution): a far move enters expert and cancels the dwell token; a later stale dwellElapsed does not enter novice', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		doc.send('down', { point: p0 }) // -> startup(timerToken: 0, nextToken: 1)

		const log: string[] = []
		doc.on('startup -move> expert', (e) =>
			log.push(`cancel:${e.from.data.timerToken}`),
		)

		doc.send('move', { point: p2Far })
		expect(doc.current).toEqual({
			state: 'expert',
			data: { stroke: [p0, p2Far], nextToken: 1 },
		})
		expect(log).toEqual(['cancel:0'])

		const before = doc.current
		doc.send('dwellElapsed', { token: 0 }) // stale: token 0 was already cancelled
		expect(doc.current).toEqual(before)
		expect(doc.current.state).not.toBe('novice')
	})

	test('trace 4: cancel from startup returns to idle, cancels the dwell token, and reports cancellation', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		doc.send('down', { point: p0 }) // -> startup(timerToken: 0, nextToken: 1)

		const log: string[] = []
		doc.on('startup -cancel> idle', (e) => {
			log.push(`cancel:${e.from.data.timerToken}`)
			log.push('report:cancel')
		})

		doc.send('cancel', { point: p0 })

		expect(doc.current).toEqual({ state: 'idle', data: { nextToken: 1 } })
		expect(log).toEqual(['cancel:0', 'report:cancel'])
	})

	test('trace 5: an input unavailable in the current state produces no transition, not a same-state update', () => {
		const doc = markingMenu.start({ nextToken: 0 })
		const before = doc.current
		const log: string[] = []
		doc.on('* -> *', () => log.push('fired'))

		doc.send('move', { point: p1Near }) // idle has no row for move

		expect(doc.current).toEqual(before)
		expect(log).toEqual([])
	})
})
