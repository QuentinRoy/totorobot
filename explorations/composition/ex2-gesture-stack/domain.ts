/**
 * PROTOTYPE — throwaway. Example 2, the non-FSM half.
 *
 * A tiny document: two items laid out on the x axis, and the views that show
 * what is happening to them. Level 2 of the stack owns this; level 1 has never
 * heard of it.
 */

export type Point = { readonly x: number; readonly y: number }

export const far = (a: Point, b: Point): boolean =>
	Math.hypot(a.x - b.x, a.y - b.y) > 20

/** Hit testing. `alpha` spans x 0-99, `beta` spans 100-199, else empty space. */
export const itemAt = (p: Point): string | null =>
	p.x < 0 ? null : p.x < 100 ? 'alpha' : p.x < 200 ? 'beta' : null

let sink: (text: string) => void = () => {}

export const bind = (fn: (text: string) => void): void => {
	sink = fn
}

const offsets: Record<string, number> = { alpha: 0, beta: 0 }

export const doc = {
	move(item: string, by: number): void {
		offsets[item] = (offsets[item] ?? 0) + by
		sink(
			`  doc: ${item} moved ${by > 0 ? '+' : ''}${by} (now ${offsets[item]})`,
		)
	},
	offsets: () => ({ ...offsets }),
	reset(): void {
		offsets['alpha'] = 0
		offsets['beta'] = 0
	},
}

/** A marquee that exists only while a drag does — level 1's feedback. */
export const marquee = (origin: Point): (() => void) => {
	sink(`  marquee: show at ${origin.x},${origin.y}`)
	return () => sink('  marquee: hide')
}

/** A context menu that exists only while level 2 says so. */
export const contextMenu = (item: string): (() => void) => {
	sink(`  menu: open for ${item}`)
	return () => sink('  menu: close')
}
