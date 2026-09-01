/**
 * Case 1: Reduced Marking Menu (docs/acceptance-cases.md), the primary
 * acceptance case. `idle`, `startup`, `expert` and `novice` over `down`,
 * `move`, `dwellElapsed`, `up` and `cancel`.
 *
 * The dwell is internal — nothing outside the machine needs to know it is
 * pending — so it is a `startup` residency: scheduled on entry, cancelled by
 * its teardown. Everything else the case asks for (interaction feedback, menu
 * display, selection and cancellation reporting) is external, and stays a
 * caller-side `.observe()` listener, same as the residency draws the
 * internal/external line in the doc.
 *
 * Distance calculation, stroke append and the menu itself are ordinary
 * domain helpers, per the spec, rather than library features.
 */

import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'

function fakeTimers() {
	vi.useFakeTimers()
	return { [Symbol.dispose]: () => vi.useRealTimers() }
}

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
	dwellElapsed: undefined
	up: { point: Point }
	cancel: { point: Point }
}
type MarkingMenuStates = {
	idle: undefined
	startup: { origin: Point; stroke: Stroke }
	expert: { stroke: Stroke }
	novice: { menu: Menu; center: Point; stroke: Stroke }
}

const DWELL_DISTANCE_THRESHOLD = 10
const DWELL_DELAY = 500

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
		'idle -down> startup': ({ inputData }) => ({
			origin: inputData.point,
			stroke: [inputData.point],
		}),
		'startup -move> startup': ({ fromData, inputData, skip }) =>
			distance(fromData.origin, inputData.point) < DWELL_DISTANCE_THRESHOLD
				? {
						...fromData,
						stroke: appendStroke(fromData.stroke, inputData.point),
					}
				: skip(),
		'startup -move> expert': ({ fromData, inputData, skip }) =>
			distance(fromData.origin, inputData.point) < DWELL_DISTANCE_THRESHOLD
				? skip()
				: { stroke: appendStroke(fromData.stroke, inputData.point) },
		'startup -dwellElapsed> novice': ({ fromData }) => ({
			menu: rootMenu,
			center: fromData.origin,
			stroke: fromData.stroke,
		}),
		'expert -move> expert': ({ fromData, inputData }) => ({
			...fromData,
			stroke: appendStroke(fromData.stroke, inputData.point),
		}),
		'novice -move> novice': ({ fromData, inputData }) => ({
			...fromData,
			stroke: appendStroke(fromData.stroke, inputData.point),
		}),
		'startup -up> idle': () => {},
		'expert -up> idle': () => {},
		'novice -up> idle': () => {},
		'startup -cancel> idle': () => {},
		'expert -cancel> idle': () => {},
		'novice -cancel> idle': () => {},
	},
	actions: {
		// The dwell is internal: nothing outside the machine needs to know it
		// is pending. Owning the timer deletes the token — cancelling it on
		// exit is what makes a stale `dwellElapsed` unable to arrive at all,
		// not a guard against one that does.
		startup: {
			run: ({ send }) => {
				let timer = setTimeout(() => send('dwellElapsed'), DWELL_DELAY)
				return () => clearTimeout(timer)
			},
			// A wiggle within the threshold is a self-transition; `restart: false`
			// keeps the dwell's deadline from being pushed away by it.
			restart: false,
		},
	},
})

const p0: Point = { x: 0, y: 0 }
const p1Near: Point = { x: 1, y: 1 }
const p2Far: Point = { x: 100, y: 100 }

describe('acceptance: Reduced Marking Menu', () => {
	test('trace 1: down enters startup, reports start, and schedules the dwell', () => {
		using _timers = fakeTimers()
		const doc = markingMenu.start()
		const reportedStart = vi.fn()
		doc.observe('idle -down> startup', reportedStart)

		doc.send('down', { point: p0 })

		expect(doc.current).toEqual({
			name: 'startup',
			data: { origin: p0, stroke: [p0] },
		})
		expect(reportedStart).toHaveBeenCalledOnce()
		expect(vi.getTimerCount()).toBe(1)
	})

	test('trace 2: a nearby move commits a same-state stroke update, then the dwell elapsing enters novice and reports open', () => {
		using _timers = fakeTimers()
		const doc = markingMenu.start()
		doc.send('down', { point: p0 }) // -> startup(origin: p0, stroke: [p0])

		doc.send('move', { point: p1Near })
		expect(doc.current).toEqual({
			name: 'startup',
			data: { origin: p0, stroke: [p0, p1Near] },
		})

		const opened = vi.fn()
		doc.observe('startup -dwellElapsed> novice', opened)

		vi.advanceTimersByTime(DWELL_DELAY)

		expect(doc.current).toEqual({
			name: 'novice',
			data: { menu: rootMenu, center: p0, stroke: [p0, p1Near] },
		})
		expect(opened).toHaveBeenCalledOnce()
	})

	test("trace 3 (fresh execution): a far move enters expert, and the startup residency's teardown cancels the dwell so no stale dwellElapsed can arrive", () => {
		using _timers = fakeTimers()
		const doc = markingMenu.start()
		doc.send('down', { point: p0 }) // -> startup(origin: p0, stroke: [p0])

		doc.send('move', { point: p2Far })
		expect(doc.current).toEqual({
			name: 'expert',
			data: { stroke: [p0, p2Far] },
		})

		expect(vi.getTimerCount()).toBe(0) // the residency's teardown ran on the way out

		const before = doc.current
		vi.advanceTimersByTime(DWELL_DELAY) // nothing to fire: no stale dwell can arrive
		expect(doc.current).toEqual(before)
		expect(doc.current.name).not.toBe('novice')
	})

	test('trace 4: cancel from startup returns to idle, cancels the dwell, and reports cancellation', () => {
		using _timers = fakeTimers()
		const doc = markingMenu.start()
		doc.send('down', { point: p0 }) // -> startup(origin: p0, stroke: [p0])

		const reportedCancellation = vi.fn()
		doc.observe('startup -cancel> idle', reportedCancellation)

		doc.send('cancel', { point: p0 })

		expect(doc.current.name).toBe('idle')
		expect(reportedCancellation).toHaveBeenCalledOnce()
		expect(vi.getTimerCount()).toBe(0)
	})

	test('trace 5: an input unavailable in the current state produces no transition, not a same-state update', () => {
		const doc = markingMenu.start()
		const before = doc.current
		const observer = vi.fn()
		doc.observe('* -> *', observer)

		doc.send('move', { point: p1Near }) // idle has no row for move

		expect(doc.current).toEqual(before)
		expect(observer).not.toHaveBeenCalled()
	})
})
