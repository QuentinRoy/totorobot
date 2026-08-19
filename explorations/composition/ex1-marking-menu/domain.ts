/**
 * PROTOTYPE — throwaway. Example 1, the non-FSM half.
 *
 * Geometry, a fake widget with a lifetime, and a fake clock. The clock is
 * injectable and hand-advanced so the prototype is deterministic — research
 * note 02, C4: every system that got timing right owns the timer, and an
 * injectable clock is the only route to a deterministic test.
 */

export type Point = { readonly x: number; readonly y: number }

export const far = (a: Point, b: Point): boolean =>
	Math.hypot(a.x - b.x, a.y - b.y) > 30

/** How long the pointer must rest before the novice menu opens. */
export const DWELL = 300

let sink: (text: string) => void = () => {}

/** The TUI points the fake devices' output at the current scenario's trace. */
export const bind = (fn: (text: string) => void): void => {
	sink = fn
}

/* ------------------------------------------------------------------ clock */

type Timer = { readonly at: number; readonly fn: () => void }

let now = 0
const pending = new Set<Timer>()

export const clock = {
	/** Schedules `fn`, and returns the cancel — which is also a teardown. */
	after(ms: number, fn: () => void): () => void {
		const timer: Timer = { at: now + ms, fn }
		pending.add(timer)
		sink(`  clock: dwell scheduled +${ms}`)
		return () => {
			if (pending.delete(timer)) sink('  clock: dwell cancelled')
		}
	},
	advance(ms: number): void {
		now += ms
		for (const timer of [...pending]) {
			if (timer.at <= now) {
				pending.delete(timer)
				sink('  clock: dwell fired')
				timer.fn()
			}
		}
	},
	reset(): void {
		now = 0
		pending.clear()
	},
	waiting: () => pending.size,
}

/* ----------------------------------------------------------------- widget */

export const widget = {
	trail(points: readonly Point[]): () => void {
		sink(`  trail: draw ${points.length} pts`)
		return () => sink('  trail: erase')
	},
	menu(center: Point): () => void {
		sink(`  menu: open at ${center.x},${center.y}`)
		return () => sink('  menu: close')
	},
}
