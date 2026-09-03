/**
 * The same Reduced Marking Menu machine as `marking-menu.test.ts`
 * (docs/acceptance-cases.md, Case 1), rewritten with a wildcard source: the
 * six `up`/`cancel` rows repeated once per state (`startup`, `expert`,
 * `novice`) collapse to two, `'* -up> idle'` and `'* -cancel> idle'` (#142).
 * Everything else — states, other rows, actions — is unchanged. The traces
 * below are the same ones `marking-menu.test.ts` runs against the spelled-out
 * table, so a difference here would mean the wildcard rewrite changed
 * behavior, not just spelling.
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
		// The six `startup`/`expert`/`novice` × `up`/`cancel` rows the spelled-out
		// table repeats, one row apiece, collapse to these two: `idle` is not a
		// source either input reaches from, so nothing declines here.
		'* -up> idle': () => {},
		'* -cancel> idle': () => {},
	},
	actions: {
		startup: {
			run: ({ send }) => {
				const timer = setTimeout(() => send('dwellElapsed'), DWELL_DELAY)
				return () => clearTimeout(timer)
			},
			restart: false,
		},
	},
})

const p0: Point = { x: 0, y: 0 }
const p1Near: Point = { x: 1, y: 1 }
const p2Far: Point = { x: 100, y: 100 }

describe('acceptance: Reduced Marking Menu, with a wildcard source', () => {
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

	test('trace 2: the dwell elapsing enters novice', () => {
		using _timers = fakeTimers()
		const doc = markingMenu.start()
		doc.send('down', { point: p0 })
		doc.send('move', { point: p1Near })

		vi.advanceTimersByTime(DWELL_DELAY)

		expect(doc.current).toEqual({
			name: 'novice',
			data: { menu: rootMenu, center: p0, stroke: [p0, p1Near] },
		})
	})

	test('trace 4: up from startup returns to idle by the wildcard row, cancels the dwell, and reports it', () => {
		using _timers = fakeTimers()
		const doc = markingMenu.start()
		doc.send('down', { point: p0 })

		const reported = vi.fn()
		doc.observe('startup -up> idle', reported)

		doc.send('up', { point: p0 })

		expect(doc.current.name).toBe('idle')
		expect(reported).toHaveBeenCalledOnce()
		expect(vi.getTimerCount()).toBe(0)
	})

	test('up from expert and cancel from novice both return to idle through the same two wildcard rows', () => {
		using _timers = fakeTimers()
		const fromExpert = markingMenu.start()
		fromExpert.send('down', { point: p0 })
		fromExpert.send('move', { point: p2Far }) // -> expert
		expect(fromExpert.current.name).toBe('expert')
		fromExpert.send('up', { point: p2Far })
		expect(fromExpert.current.name).toBe('idle')

		const fromNovice = markingMenu.start()
		fromNovice.send('down', { point: p0 })
		fromNovice.send('move', { point: p1Near })
		vi.advanceTimersByTime(DWELL_DELAY) // -> novice
		expect(fromNovice.current.name).toBe('novice')
		fromNovice.send('cancel', { point: p0 })
		expect(fromNovice.current.name).toBe('idle')
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
