// Case 1, the reduced Marking Menu, in the Radix lookup-table style.
//
// The table below is the whole machine. Everything the interaction actually
// needs -- origin, stroke, menu, center, and the dwell token -- lives in
// mutable cells beside it, because a Radix-style machine has no context. That
// is exactly how Radix Presence keeps `stylesRef` and `prevAnimationNameRef`.

import { createRef, createStateMachine, type MachineEvent } from './machine.ts'

type Point = readonly [x: number, y: number]
type Item = { readonly label: string }
type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}

// --- the machine -------------------------------------------------------------
// `move` is SPLIT into `moveNear` / `moveFar` in `startup`, because a lookup
// table holds one target per (state, event) pair. The distance test that picks
// the target therefore runs at the call site, below, outside the machine.
const markingMenu = {
	idle: { down: 'startup' },
	startup: {
		moveNear: 'startup',
		moveFar: 'expert',
		dwell: 'novice',
		up: 'idle',
		cancel: 'idle',
	},
	expert: { move: 'expert', up: 'idle', cancel: 'idle' },
	novice: { move: 'novice', up: 'idle', cancel: 'idle' },
} as const

// --- domain helpers ----------------------------------------------------------
const DWELL_RADIUS = 16
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

// --- one interaction instance ------------------------------------------------
function createMarkingMenu(root: Menu) {
	const [getState, send] = createStateMachine('idle', markingMenu)

	// No per-state data exists, so every cell is visible -- and nullable -- from
	// every state, including the states in which it is meaningless.
	const nextToken = createRef(0)
	const timerToken = createRef<number | null>(null)
	const origin = createRef<Point | null>(null)
	const stroke = createRef<readonly Point[]>([])
	const menu = createRef<Menu | null>(null)
	const center = createRef<Point | null>(null)
	const effects: string[] = []

	// The reducer is total, so a refused input is indistinguishable from a
	// same-state commit by its result. Re-reading the table is the only way to
	// know whether the data writes below are allowed to run.
	const can = (event: MachineEvent<typeof markingMenu>) =>
		Object.hasOwn(markingMenu[getState()], event)

	const cancelDwell = () => {
		if (timerToken.current === null) return
		effects.push(`cancelDwell:${timerToken.current}`)
		timerToken.current = null
	}

	const clear = () => {
		origin.current = null
		stroke.current = []
		menu.current = null
		center.current = null
	}

	return {
		getState,
		effects,
		read: () => ({
			nextToken: nextToken.current,
			timerToken: timerToken.current,
			strokeLength: stroke.current.length,
			menuLabel: menu.current?.label ?? null,
			center: center.current,
		}),

		down(point: Point) {
			if (!can('down')) return
			const token = nextToken.current
			send('down')
			origin.current = point
			stroke.current = [point]
			timerToken.current = token
			nextToken.current = token + 1
			effects.push('start')
			effects.push(`scheduleDwell:${token}`)
		},

		move(point: Point) {
			const state = getState()
			if (state === 'startup') {
				const far = distance(origin.current!, point) >= DWELL_RADIUS
				send(far ? 'moveFar' : 'moveNear')
				stroke.current = [...stroke.current, point]
				if (far) cancelDwell()
			} else if (state === 'expert' || state === 'novice') {
				send('move')
				stroke.current = [...stroke.current, point]
			}
			// idle: `move` is unavailable, so nothing happens at all.
		},

		dwellElapsed(token: number) {
			// The dwell token is owned by nothing. Both halves of the staleness
			// test are hand-written here, and no type says the cell is only
			// meaningful in `startup`.
			if (getState() !== 'startup') return
			if (token !== timerToken.current) return
			send('dwell')
			menu.current = root
			center.current = origin.current!
			timerToken.current = null
			effects.push('open')
		},

		up(point: Point) {
			if (!can('up')) return
			if (getState() === 'startup') cancelDwell()
			stroke.current = [...stroke.current, point]
			send('up')
			effects.push(`finish:${stroke.current.length}`)
			clear()
		},

		cancel(point: Point) {
			if (!can('cancel')) return
			if (getState() === 'startup') cancelDwell()
			stroke.current = [...stroke.current, point]
			send('cancel')
			effects.push('cancelled')
			clear()
		},
	}
}

// --- demonstration -----------------------------------------------------------
declare const console: { log: (...args: unknown[]) => void }

const eq = (actual: unknown, expected: unknown, what: string) => {
	if (actual !== expected) {
		throw new Error(
			`${what}: expected ${String(expected)}, got ${String(actual)}`,
		)
	}
}

const root: Menu = {
	label: 'root',
	children: [{ label: 'cut' }, { label: 'copy' }, { label: 'paste' }],
}

const p0: Point = [0, 0]
const near: Point = [3, 4] // 5 px away
const far: Point = [40, 0] // 40 px away

// Trace 1: down from idle enters startup, reports start, schedules token 0.
const a = createMarkingMenu(root)
eq(a.getState(), 'idle', 'T1 initial')
eq(a.read().nextToken, 0, 'T1 initial nextToken')
a.down(p0)
eq(a.getState(), 'startup', 'T1 state')
eq(a.read().timerToken, 0, 'T1 timerToken')
eq(a.read().nextToken, 1, 'T1 nextToken')
eq(a.effects.join('|'), 'start|scheduleDwell:0', 'T1 effects')

// Trace 2: nearby move commits a startup stroke update; matching dwell opens.
a.move(near)
eq(a.getState(), 'startup', 'T2 nearby move stays in startup')
eq(a.read().strokeLength, 2, 'T2 stroke appended')
a.dwellElapsed(0)
eq(a.getState(), 'novice', 'T2 matching dwell enters novice')
eq(a.read().menuLabel, 'root', 'T2 root menu opened')
eq(a.effects.join('|'), 'start|scheduleDwell:0|open', 'T2 effects')

// Trace 3: fresh execution -- a far move enters expert and cancels token 0;
// a later dwellElapsed(0) produces no transition.
const b = createMarkingMenu(root)
b.down(p0)
b.move(far)
eq(b.getState(), 'expert', 'T3 far move enters expert')
eq(b.effects.join('|'), 'start|scheduleDwell:0|cancelDwell:0', 'T3 effects')
b.dwellElapsed(0)
eq(b.getState(), 'expert', 'T3 stale dwell does not move')
eq(b.read().menuLabel, null, 'T3 stale dwell did not open a menu')

// Trace 4: cancel from startup returns to idle and cancels its dwell work.
const c = createMarkingMenu(root)
c.down(p0)
c.cancel(near)
eq(c.getState(), 'idle', 'T4 state')
eq(
	c.effects.join('|'),
	'start|scheduleDwell:0|cancelDwell:0|cancelled',
	'T4 effects',
)

// Trace 5: an input unavailable in the current state produces no transition,
// and no same-state update either.
const d = createMarkingMenu(root)
d.move(near)
eq(d.getState(), 'idle', 'T5 state unchanged')
eq(d.read().strokeLength, 0, 'T5 no same-state update')
eq(d.effects.length, 0, 'T5 no effects')

// What the kernel itself cannot do: its result collapses "no transition" and
// "same-state update" into the same value, and it accepts any event name of the
// machine from any state.
const [getRaw, sendRaw] = createStateMachine('idle', markingMenu)
eq(sendRaw('move'), 'idle', 'raw: refused input returns the current state')
eq(sendRaw('down'), 'startup', 'raw: down')
eq(sendRaw('moveNear'), 'startup', 'raw: same-state commit returns the same')
eq(sendRaw('dwell'), 'novice', 'raw: dwell')
eq(sendRaw('down'), 'novice', 'raw: down is inert in novice, not an error')
eq(getRaw(), 'novice', 'raw: final')

console.log('case1.ts: all assertions passed')
