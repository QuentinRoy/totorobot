/**
 * PROTOTYPE — throwaway. Example 1 — Marking Menu as peers — OPTION B.
 *
 * The same two machines. What `actions` buys here is not the emitting — it is
 * the dwell timer. `recognition` schedules it on entering `startup` and the
 * teardown cancels it, so the machine is self-contained: import it, start it,
 * and dwelling works. In `a.ts` the identical code exists, but in the app,
 * where an importer has to know to write it.
 *
 * That is rationale §9's kind 3 — "the test any proposition must pass is
 * expressing a socket" — and it is the argument `emit` alone does not make.
 *
 * The views stay OUT of the definition: a machine emits what happened, the
 * view decides what to draw. The app pays for that, because it cannot see that
 * `feedback` is in `trail`, so each lifetime becomes a declared PAIR of
 * outputs plus a variable to re-pair them by hand.
 */

import { machine, persistent, type } from '../model-b.ts'
import type { Build } from '../scenario.ts'
import { bind, clock, DWELL, far, widget, type Point } from './domain.ts'

/* ============================================================ recognition */

type PointerInputs = {
	down: Point
	move: Point
	up: Point
	/** Sent by the machine's own dwell action — never by the app. */
	dwell: void
}

type Recognizing = {
	idle: void
	startup: { origin: Point; stroke: readonly Point[] }
	expert: { stroke: readonly Point[] }
	novice: { center: Point; stroke: readonly Point[] }
}

type Recognized = {
	began: { points: readonly Point[] }
	moved: { points: readonly Point[] }
	opened: { center: Point; points: readonly Point[] }
	ended: void
}

const recognition = machine({
	initial: 'idle',
	inputs: type<PointerInputs>(),
	states: type<Recognizing>(),
	outputs: type<Recognized>(),

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

	actions: {
		// The socket, and the reason `actions` exists. `persistent` because a
		// stroke that wiggles inside the threshold must not keep pushing the
		// deadline away — and the trail below wants the opposite answer, which
		// is §9's argument for putting the policy on the action.
		startup: persistent(({ data, send, emit }) => {
			emit('began', { points: data.stroke })
			return clock.after(DWELL, () => send('dwell'))
		}),
		// `persistent` again, and for a different reason: without it a
		// `novice -move> novice` self-transition restarts the resident and
		// `opened` fires a second time. Every "announce this once, on entry"
		// output needs the wrapper, and forgetting it duplicates silently.
		novice: persistent(({ data, emit }) =>
			emit('opened', { center: data.center, points: data.stroke }),
		),
		idle: ({ emit }) => emit('ended'),
		'startup -move> startup': ({ to, emit }) =>
			emit('moved', { points: to.data.stroke }),
		'expert -move> expert': ({ to, emit }) =>
			emit('moved', { points: to.data.stroke }),
		'novice -move> novice': ({ to, emit }) =>
			emit('moved', { points: to.data.stroke }),
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

/** Every view lifetime needs two names, because the app cannot see the state. */
type Shown = {
	trailShown: { points: readonly Point[] }
	trailHidden: void
	menuShown: { center: Point }
	menuHidden: void
}

const feedback = machine({
	initial: 'off',
	inputs: type<FeedbackInputs>(),
	states: type<Feedback>(),
	outputs: type<Shown>(),

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

	// Residency that only announces. No widget is touched here. This one
	// restarts on re-entry, so every `track` re-emits and the app redraws.
	actions: {
		trail: ({ data, emit }) => {
			emit('trailShown', { points: data.points })
			return () => emit('trailHidden')
		},
		menu: ({ data, emit }) => {
			emit('menuShown', { center: data.center })
			return () => emit('menuHidden')
		},
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

	// The views. `a.ts` writes these as two residency listeners; here each
	// lifetime is a pair of outputs and a variable kept in step by hand.
	let trail: (() => void) | undefined
	let menu: (() => void) | undefined
	fb.on('trailShown', (p) => {
		trail?.()
		trail = widget.trail(p.points)
	})
	fb.on('trailHidden', () => {
		trail?.()
		trail = undefined
	})
	fb.on('menuShown', (p) => {
		menu?.()
		menu = widget.menu(p.center)
	})
	fb.on('menuHidden', () => {
		menu?.()
		menu = undefined
	})

	// The seam: four output names, no internal state named anywhere.
	rec.on('began', (p) => step('feedback <- begin', () => fb.send('begin', p)))
	rec.on('moved', (p) => step('feedback <- track', () => fb.send('track', p)))
	rec.on('opened', (p) => step('feedback <- open', () => fb.send('open', p)))
	rec.on('ended', () => step('feedback <- end', () => fb.send('end')))

	// Diagnostics are the outputs, and only the outputs. `startup -move> expert`
	// has nothing to subscribe to.
	rec.on('began', () => log.log('recognition !> began'))
	rec.on('moved', () => log.log('recognition !> moved'))
	rec.on('opened', () => log.log('recognition !> opened'))
	rec.on('ended', () => log.log('recognition !> ended'))

	const at = (dx: number): Point => (cursor = { x: cursor.x + dx, y: cursor.y })

	return {
		title: 'Ex1 · Marking Menu as peers · B (encapsulated)',
		note: 'Dwell timer: definition-owned. Views: 4 outputs the app re-pairs.',
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
		// Rendering a machine is a debugging act under Option B.
		peek: () => [
			{ name: 'recognition', ...rec.inspect() },
			{ name: 'feedback', ...fb.inspect() },
			{ name: 'clock', state: 'timers', data: { pending: clock.waiting() } },
		],
	}
}
