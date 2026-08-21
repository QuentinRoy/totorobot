/**
 * PROTOTYPE — throwaway. Example 1 — Marking Menu as peers — OPTION A.
 *
 * Two machines, written out in full, plus the dwell timer — the operational
 * effect the machine genuinely owns (rationale §9's kind 3: "the test any
 * proposition must pass is expressing a socket"). It is scheduled on entering
 * `startup` and cancelled on leaving, so `clock.after`'s cancel IS the
 * residency teardown.
 *
 * Two residents in this file want opposite restart policies, which is §9's
 * argument for putting the policy on the action rather than in the notation:
 *
 *   `startup` dwell   `persistent` — a stroke that wiggles inside the
 *                     threshold must not keep pushing the deadline away.
 *   `trail`           restarts — every `track` erases and redraws.
 *
 * Under Option A all of it is wired by the app. Nothing about the timer is
 * declared, so an app that forgets these two lines gets a machine that simply
 * never reaches `novice`, silently.
 */

import { machine, persistent, type } from '../model-a.ts'
import type { Build } from '../scenario.ts'
import { bind, clock, DWELL, far, widget, type Point } from './domain.ts'

/* ============================================================ recognition */

type PointerInputs = {
	down: Point
	move: Point
	up: Point
	/** Sent by whoever owns the dwell timer — here, the app. */
	dwell: void
}

type Recognizing = {
	idle: void
	startup: { origin: Point; stroke: readonly Point[] }
	expert: { stroke: readonly Point[] }
	novice: { center: Point; stroke: readonly Point[] }
}

const recognition = machine({
	initial: 'idle',
	inputs: type<PointerInputs>(),
	states: type<Recognizing>(),

	transitions: {
		'idle -down> startup': ({ input }) => ({ origin: input, stroke: [input] }),
		'startup -move> startup': ({ data, input, skip }) =>
			far(data.origin, input)
				? skip()
				: { ...data, stroke: [...data.stroke, input] },
		'startup -move> expert': ({ data, input, skip }) =>
			far(data.origin, input) ? { stroke: [...data.stroke, input] } : skip(),
		// No token check: the timer is cancelled when `startup` is left, so a
		// stale `dwell` cannot arrive. Owning the timer deletes the bookkeeping
		// (note 08 F7, as corrected by note 02).
		'startup -dwell> novice': ({ data }) => ({
			center: data.origin,
			stroke: data.stroke,
		}),
		'startup -up> idle': () => {},
		'expert -move> expert': ({ data, input }) => ({
			stroke: [...data.stroke, input],
		}),
		'expert -up> idle': () => {},
		'novice -move> novice': ({ data, input }) => ({
			...data,
			stroke: [...data.stroke, input],
		}),
		'novice -up> idle': () => {},
	},
})

/* ============================================================== feedback */

type FeedbackInputs = {
	begin: { points: readonly Point[] }
	track: { points: readonly Point[] }
	open: { center: Point; points: readonly Point[] }
	end: void
}

type Feedback = {
	off: void
	trail: { points: readonly Point[] }
	menu: { center: Point; points: readonly Point[] }
}

const feedback = machine({
	initial: 'off',
	inputs: type<FeedbackInputs>(),
	states: type<Feedback>(),

	transitions: {
		'off -begin> trail': ({ input }) => ({ points: input.points }),
		'trail -track> trail': ({ input }) => ({ points: input.points }),
		'trail -open> menu': ({ input }) => ({
			center: input.center,
			points: input.points,
		}),
		'menu -track> menu': ({ data, input }) => ({
			...data,
			points: input.points,
		}),
		'trail -end> off': () => {},
		'menu -end> off': () => {},
	},
})

/* ================================================================ the app */

export const build: Build = (sched, log) => {
	bind((text) => log.log(text))
	clock.reset()

	const rec = recognition.start()
	const fb = feedback.start()

	let cursor: Point = { x: 0, y: 0 }

	const step = (label: string, run: () => void) =>
		sched.run(() => log.nest(label, run))

	// The machine's own behaviour, attached from outside. One line, and the
	// cancel returned by `clock.after` is the teardown.
	rec.on(
		'startup',
		persistent(() =>
			clock.after(DWELL, () =>
				step('recognition <- dwell', () => rec.send('dwell')),
			),
		),
	)

	// Views: also residency, also app-side. This one restarts on re-entry.
	fb.on('trail', (s) => widget.trail(s.data.points))
	fb.on('menu', (s) => widget.menu(s.data.center))

	// Diagnostics: the same mechanism as the seam below. Under Option A you
	// cannot tell a debugging subscription from a structural one.
	rec.on('* -> *', (e) =>
		log.log(`recognition: ${e.from.state} -${e.on ?? ''}> ${e.to.state}`),
	)
	fb.on('* -> *', (e) =>
		log.log(`feedback:    ${e.from.state} -${e.on ?? ''}> ${e.to.state}`),
	)

	// The seam: six patterns, every one naming a state of `recognition`.
	rec.on('* -> startup', (e) =>
		step('feedback <- begin', () =>
			fb.send('begin', { points: e.to.data.stroke }),
		),
	)
	rec.on('startup -move> startup', (e) =>
		step('feedback <- track', () =>
			fb.send('track', { points: e.to.data.stroke }),
		),
	)
	rec.on('expert -move> expert', (e) =>
		step('feedback <- track', () =>
			fb.send('track', { points: e.to.data.stroke }),
		),
	)
	rec.on('novice -move> novice', (e) =>
		step('feedback <- track', () =>
			fb.send('track', { points: e.to.data.stroke }),
		),
	)
	rec.on('* -> novice', (e) =>
		step('feedback <- open', () =>
			fb.send('open', { center: e.to.data.center, points: e.to.data.stroke }),
		),
	)
	rec.on('* -> idle', () => step('feedback <- end', () => fb.send('end')))

	const at = (dx: number): Point => (cursor = { x: cursor.x + dx, y: cursor.y })

	return {
		title: 'Ex1 · Marking Menu as peers · A (open host)',
		note: 'Dwell timer + views: `.on(state)` residency, app-wired. Seam: 6 patterns.',
		keys: [
			{
				key: 'd',
				label: 'pointer down',
				run: () => {
					cursor = { x: 100, y: 100 }
					step('recognition <- down', () => rec.send('down', cursor))
				},
			},
			{
				key: 'm',
				label: 'move (near)',
				run: () => step('recognition <- move', () => rec.send('move', at(5))),
			},
			{
				key: 'M',
				label: 'move (far)',
				run: () => step('recognition <- move', () => rec.send('move', at(40))),
			},
			{ key: 't', label: `clock +${DWELL}`, run: () => clock.advance(DWELL) },
			{
				key: 'u',
				label: 'pointer up',
				run: () => step('recognition <- up', () => rec.send('up', cursor)),
			},
		],
		peek: () => [
			{ name: 'recognition', state: rec.current.state, data: rec.current.data },
			{ name: 'feedback', state: fb.current.state, data: fb.current.data },
			{ name: 'clock', state: 'timers', data: { pending: clock.waiting() } },
		],
	}
}
