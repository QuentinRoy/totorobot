// Case 1, the reduced Marking Menu, written as un-inverted sequential code.
//
// This is the shape the sequential baseline is built for: press, then move
// repeatedly, then release. The machine reads `down`, loops, ends on `up`.
//
// Two spec artefacts disappear entirely, and that is the finding:
//
//  * `dwellElapsed` is NOT an input. The dwell is a timer the code owns and
//    races against the input channel, so it is a *value awaited at one lexical
//    place* rather than an event that can arrive anywhere.
//  * There is therefore no `timerToken` and no `nextToken`. Staleness is not
//    filtered, it is structurally impossible: once control leaves the startup
//    block nothing is awaiting the dwell any more, so a late timer resolves a
//    promise that no one reads. The demo proves this by firing an already
//    cancelled timer.
//
// The price is visible below. `startup` has three outgoing edges to three
// different targets, and `break` has exactly one destination, so `opened` had
// to be introduced to say which of `expert`/`novice` was entered -- a state tag
// under another name. And `expert` and `novice` collapse into one `active`
// loop, because their control flow is identical and only their data differs.
// That is a genuine deduplication and a genuine loss of legibility at once:
// nothing in the source says there are two states there.

import {
	check,
	createChannel,
	createManualClock,
	log,
	settle,
} from './harness.ts'
import type { Channel, Clock } from './harness.ts'

export type Point = readonly [number, number]
export type Item = { readonly label: string }
export type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}

export type MenuInput =
	| { readonly type: 'down'; readonly point: Point }
	| { readonly type: 'move'; readonly point: Point }
	| { readonly type: 'up'; readonly point: Point }
	| { readonly type: 'cancel'; readonly point: Point }

export type Effects = {
	start(origin: Point): void
	stroke(points: readonly Point[]): void
	open(menu: Menu, center: Point): void
	highlight(label: string | null): void
	finish(selection: string | null, points: readonly Point[]): void
	cancel(): void
}

const DWELL_MS = 300
const EXPERT_RADIUS = 20

// Ordinary domain helpers, not library features.
function far(a: Point, b: Point): boolean {
	return Math.hypot(b[0] - a[0], b[1] - a[1]) >= EXPERT_RADIUS
}

function hit(menu: Menu, center: Point, point: Point): string | null {
	if (!far(center, point)) return null
	const turn = Math.PI * 2
	const angle =
		(Math.atan2(point[1] - center[1], point[0] - center[0]) + turn) % turn
	const slice = Math.floor(angle / (turn / menu.children.length))
	return menu.children[slice]?.label ?? null
}

// >>> MACHINE START
export async function runMarkingMenu(
	input: Channel<MenuInput>,
	root: Menu,
	clock: Clock,
	effects: Effects,
): Promise<never> {
	interaction: for (;;) {
		const press = await input.next()
		if (press.type !== 'down') continue interaction // unavailable: no transition

		const origin = press.point
		let points: readonly Point[] = [origin]
		let opened: Menu | null = null
		effects.start(origin)

		const dwell = clock(DWELL_MS)
		try {
			startup: for (;;) {
				const winner = await Promise.race([
					input.peek().then(() => 'input' as const),
					dwell.elapsed.then(() => 'dwell' as const),
				])
				if (winner === 'dwell') {
					opened = root
					effects.open(root, origin)
					break startup // -> novice
				}
				const ev = await input.next()
				if (ev.type === 'move') {
					points = [...points, ev.point]
					effects.stroke(points)
					if (far(origin, ev.point)) break startup // -> expert
					continue startup // same-state stroke update
				}
				if (ev.type === 'up') {
					effects.finish(null, points)
					continue interaction // -> idle
				}
				if (ev.type === 'cancel') {
					effects.cancel()
					continue interaction // -> idle
				}
				// `down` is unavailable in startup: no transition.
			}
		} finally {
			dwell.cancel()
		}

		// `expert` when `opened === null`, `novice` otherwise. Same inputs, same
		// outcomes, different data -- so one loop, and no state name in sight.
		active: for (;;) {
			const ev = await input.next()
			if (ev.type === 'move') {
				points = [...points, ev.point]
				effects.stroke(points)
				if (opened !== null) effects.highlight(hit(opened, origin, ev.point))
				continue active // same-state stroke update
			}
			if (ev.type === 'up') {
				effects.finish(
					opened === null ? null : hit(opened, origin, ev.point),
					points,
				)
				continue interaction // -> idle
			}
			if (ev.type === 'cancel') {
				effects.cancel()
				continue interaction // -> idle
			}
			// `down` is unavailable in expert/novice: no transition.
		}
	}
}
// <<< MACHINE END

// ------------------------------------------------------------------ DEMO --

const root: Menu = {
	label: 'root',
	children: [
		{ label: 'east' },
		{ label: 'south' },
		{ label: 'west' },
		{ label: 'north' },
	],
}

type Run = {
	input: Channel<MenuInput>
	timers: { ms: number; cancelled: boolean; fire(): void }[]
	seen: string[]
}

function start(): Run {
	const input = createChannel<MenuInput>()
	const { clock, timers } = createManualClock()
	const seen: string[] = []
	const effects: Effects = {
		start: (o) => void seen.push(`start(${o[0]},${o[1]})`),
		stroke: (p) => void seen.push(`stroke(${p.length})`),
		open: (m, c) => void seen.push(`open(${m.label}@${c[0]},${c[1]})`),
		highlight: (l) => void seen.push(`highlight(${l})`),
		finish: (s) => void seen.push(`finish(${s})`),
		cancel: () => void seen.push('cancel'),
	}
	void runMarkingMenu(input, root, clock, effects)
	return { input, timers, seen }
}

// Trace 5 (checked first, because it needs a pristine idle): an input
// unavailable in the current state produces no transition.
{
	const run = start()
	await settle()
	run.input.push({ type: 'move', point: [9, 9] })
	run.input.push({ type: 'up', point: [9, 9] })
	await settle()
	check(run.seen, [], 'trace 5: unavailable inputs in idle do nothing')
	check(run.timers.length, 0, 'trace 5: no dwell scheduled')
}

// Traces 1 and 2: down enters startup and schedules the dwell; a nearby move
// commits a same-state stroke update; the dwell then opens the root menu.
{
	const run = start()
	await settle()
	run.input.push({ type: 'down', point: [0, 0] })
	await settle()
	check(run.seen, ['start(0,0)'], 'trace 1: down reports start')
	check(run.timers.length, 1, 'trace 1: one dwell scheduled')
	check(run.timers[0]?.ms, DWELL_MS, 'trace 1: dwell duration')

	run.input.push({ type: 'move', point: [5, 0] })
	await settle()
	check(run.seen[1], 'stroke(2)', 'trace 2: nearby move updates the stroke')

	run.timers[0]?.fire()
	await settle()
	check(run.seen[2], 'open(root@0,0)', 'trace 2: matching dwell opens the menu')

	run.input.push({ type: 'move', point: [0, 100] })
	await settle()
	check(run.seen[4], 'highlight(south)', 'novice move highlights')

	run.input.push({ type: 'up', point: [0, 100] })
	await settle()
	check(run.seen[5], 'finish(south)', 'novice up finishes with a selection')
}

// Trace 3: a far move enters expert and cancels the dwell; a late dwell
// produces no transition. The manual clock fires even after cancel(), so this
// really does exercise a stale timer callback.
{
	const run = start()
	await settle()
	run.input.push({ type: 'down', point: [0, 0] })
	run.input.push({ type: 'move', point: [100, 0] })
	await settle()
	check(run.seen, ['start(0,0)', 'stroke(2)'], 'trace 3: far move, no open')
	check(run.timers[0]?.cancelled, true, 'trace 3: dwell cancelled on leaving')

	run.timers[0]?.fire()
	await settle()
	check(run.seen.length, 2, 'trace 3: stale dwell produces no transition')

	run.input.push({ type: 'up', point: [100, 0] })
	await settle()
	check(run.seen[2], 'finish(null)', 'trace 3: expert up finishes')
}

// Trace 4: cancel from startup returns to idle, cancels the dwell work and
// reports cancellation.
{
	const run = start()
	await settle()
	run.input.push({ type: 'down', point: [0, 0] })
	run.input.push({ type: 'cancel', point: [1, 1] })
	await settle()
	check(run.seen, ['start(0,0)', 'cancel'], 'trace 4: cancel reports')
	check(run.timers[0]?.cancelled, true, 'trace 4: dwell cancelled')

	// And the machine is back at idle, ready for a fresh press.
	run.input.push({ type: 'down', point: [7, 7] })
	await settle()
	check(run.seen[2], 'start(7,7)', 'trace 4: idle again')
}

log('case1.ts: all traces passed')
