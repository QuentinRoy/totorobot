/**
 * PROTOTYPE — throwaway. Example 2 — gesture stacking — OPTION A.
 *
 * SwingStates §7.1: device events -> input events -> command events, each
 * machine emitting what the next consumes. Two levels, and they are levels
 * rather than relabelings:
 *
 *   `pointing`   knows about a pointer and nothing else. It has never heard of
 *                the document. It turns presses and moves into gestures.
 *   `commanding` knows about the document and nothing about pointers. It owns
 *                which item is selected, and it is the only thing that can
 *                decide that a long press with an empty selection means
 *                nothing — there is simply no row for it.
 *
 * The thing to look at at level 1 is the state `up`: three edges arrive at it
 * and they mean three different things — a tap, the end of a long press, the
 * end of a drag. Under Option A the app has to know that, and `'* -> up'` is a
 * bug nothing stops anyone writing.
 */

import { machine, types } from '../model-a.ts'
import type { Build } from '../scenario.ts'
import {
	bind,
	contextMenu,
	doc,
	far,
	itemAt,
	marquee,
	type Point,
} from './domain.ts'

/* =============================================== level 1: device pointing */

type PointerInputs = {
	press: { point: Point; token: number }
	move: Point
	release: Point
	hold: { token: number }
}

type Pointing = {
	up: void
	down: { origin: Point; token: number }
	held: { origin: Point }
	dragging: { origin: Point; last: Point }
}

const pointing = machine({
	initial: 'up',
	inputs: types<PointerInputs>(),
	states: types<Pointing>(),

	transitions: {
		'up -press> down': ({ input }) => ({
			origin: input.point,
			token: input.token,
		}),
		'down -move> dragging': ({ data, input, skip }) =>
			far(data.origin, input) ? { origin: data.origin, last: input } : skip(),
		'down -move> down': ({ data }) => data,
		'down -hold> held': ({ data, input, skip }) =>
			input.token === data.token ? { origin: data.origin } : skip(),
		'down -release> up': () => {},
		'held -release> up': () => {},
		'dragging -move> dragging': ({ data, input }) => ({ ...data, last: input }),
		'dragging -release> up': () => {},
	},
})

/* ================================================= level 2: commanding */

type CommandInputs = {
	tap: Point
	longPress: Point
	dragged: { from: Point; to: Point }
	/** From the view, not from the pointer stack — a menu is dismissed by a click. */
	dismiss: void
}

type Commanding = {
	idle: void
	selected: { item: string }
	menu: { item: string }
}

const commanding = machine({
	initial: 'idle',
	inputs: types<CommandInputs>(),
	states: types<Commanding>(),

	transitions: {
		'idle -tap> selected': ({ input, skip }) => {
			const item = itemAt(input)
			return item ? { item } : skip()
		},
		'selected -tap> selected': ({ input, skip }) => {
			const item = itemAt(input)
			return item ? { item } : skip()
		},
		// Tapping empty space clears the selection. (`undefined` rather than `{}`
		// because the target state is `void`.)
		'selected -tap> idle': ({ input, skip }) =>
			itemAt(input) ? skip() : undefined,
		'selected -dragged> selected': ({ data }) => data,
		'selected -longPress> menu': ({ data }) => ({ item: data.item }),
		'menu -tap> selected': ({ input, skip }) => {
			const item = itemAt(input)
			return item ? { item } : skip()
		},
		'menu -dismiss> selected': ({ data }) => ({ item: data.item }),
		// No `idle -longPress>` row: a long press with nothing selected does
		// nothing at all. That decision needs the selection, so it can only be
		// made here — level 1 has no way to know it.
	},
})

/* ================================================================ the app */

export const build: Build = (sched, log) => {
	bind((text) => log.log(text))
	doc.reset()

	const pointer = pointing.start()
	const cmd = commanding.start()

	let token = 0
	let cursor: Point = { x: 0, y: 0 }

	const step = (label: string, run: () => void) =>
		sched.run(() => log.nest(label, run))

	pointer.on('* -> *', (e) =>
		log.log(`pointing:   ${e.from.state} -${e.on ?? ''}> ${e.to.state}`),
	)
	cmd.on('* -> *', (e) =>
		log.log(`commanding: ${e.from.state} -${e.on ?? ''}> ${e.to.state}`),
	)

	// Views: one residency listener each, teardown returned.
	pointer.on('dragging', (s) => marquee(s.data.origin))
	cmd.on('menu', (s) => contextMenu(s.data.item))

	// Level 2's effect on the document.
	cmd.on('selected -dragged> selected', (e) =>
		doc.move(e.to.data.item, Math.round(e.input.to.x - e.input.from.x)),
	)

	// The seam, level 1 -> level 2: three patterns onto ONE target state, and
	// the app supplies the meaning that `pointing` never wrote down.
	pointer.on('down -release> up', (e) =>
		step('commanding <- tap', () => cmd.send('tap', e.input)),
	)
	pointer.on('held -release> up', () =>
		log.log('(long press ended — no command)'),
	)
	pointer.on('dragging -release> up', (e) =>
		step('commanding <- dragged', () =>
			cmd.send('dragged', { from: e.from.data.origin, to: e.input }),
		),
	)
	pointer.on('* -> held', (e) =>
		step('commanding <- longPress', () =>
			cmd.send('longPress', e.to.data.origin),
		),
	)

	const at = (dx: number): Point => (cursor = { x: cursor.x + dx, y: cursor.y })
	const press = (x: number) => {
		token += 1
		cursor = { x, y: 50 }
		step('pointing <- press', () =>
			pointer.send('press', { point: cursor, token }),
		)
	}

	return {
		title: 'Ex2 · Gesture stacking · A (open host)',
		note: 'Three meanings arrive at `up`; the app spells out all three. Views: `.on(state)`.',
		keys: [
			{ key: 'p', label: 'press on alpha', run: () => press(50) },
			{ key: 'P', label: 'press on empty', run: () => press(250) },
			{
				key: 'm',
				label: 'move (near)',
				run: () => step('pointing <- move', () => pointer.send('move', at(4))),
			},
			{
				key: 'M',
				label: 'move (far)',
				run: () => step('pointing <- move', () => pointer.send('move', at(30))),
			},
			{
				key: 'h',
				label: 'hold elapsed',
				run: () =>
					step('pointing <- hold', () => pointer.send('hold', { token })),
			},
			{
				key: 'r',
				label: 'release',
				run: () =>
					step('pointing <- release', () => pointer.send('release', cursor)),
			},
			{
				key: 'x',
				label: 'dismiss menu',
				run: () => step('commanding <- dismiss', () => cmd.send('dismiss')),
			},
		],
		peek: () => [
			{
				name: 'pointing',
				state: pointer.current.state,
				data: pointer.current.data,
			},
			{ name: 'commanding', state: cmd.current.state, data: cmd.current.data },
			{ name: 'document', state: 'offsets', data: doc.offsets() },
		],
	}
}
