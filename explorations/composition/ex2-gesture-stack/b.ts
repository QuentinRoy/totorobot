/**
 * PROTOTYPE — throwaway. Example 2 — gesture stacking — OPTION B.
 *
 * The same two levels. Now BOTH declare outputs, which is what a stack is
 * supposed to look like under Option B: each level publishes its own
 * vocabulary and the next one up consumes it without knowing any states.
 *
 *   `pointing`   emits `tap` / `longPress` / `dragged` — three names for three
 *                meanings that all arrive at the single state `up`. This is
 *                Option B at its best: the output alphabet is genuinely not
 *                the topology, the disambiguation is written once by the
 *                author who knows the answer, and `'* -> up'` is unwritable.
 *   `commanding` emits `moved` — a document command, in the document's words.
 *
 * The counterweight is the views. A view belongs to the app under both models,
 * and the app cannot see states here, so every lifetime becomes a declared
 * PAIR of outputs plus a variable to re-pair them. There are two: the marquee
 * and the context menu. Compare `a.ts`, where each is one residency listener.
 */

import { machine, types } from '../model-b.ts'
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

const pointing = machine({
	initial: 'up',
	inputs: types<{
		press: { point: Point; token: number }
		move: Point
		release: Point
		hold: { token: number }
	}>(),
	states: types<{
		up: void
		down: { origin: Point; token: number }
		held: { origin: Point }
		dragging: { origin: Point; last: Point }
	}>(),
	outputs: types<{
		tap: Point
		longPress: Point
		dragged: { from: Point; to: Point }
		// Only here so the app can bracket a view whose state it cannot see.
		dragStarted: Point
		dragEnded: void
	}>(),

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

	actions: {
		dragging: ({ data, emit }) => {
			emit('dragStarted', data.origin)
			return () => emit('dragEnded')
		},
		held: ({ data, emit }) => emit('longPress', data.origin),
		'down -release> up': ({ input, emit }) => emit('tap', input),
		'dragging -release> up': ({ from, input, emit }) =>
			emit('dragged', { from: from.data.origin, to: input }),
	},
})

/* ==================================================== level 2: commanding */

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

type Commands = {
	moved: { item: string; by: number }
	// Again, a lifetime the app has to bracket: two names for one menu.
	menuShown: { item: string }
	menuHidden: void
}

const commanding = machine({
	initial: 'idle',
	inputs: types<CommandInputs>(),
	states: types<Commanding>(),
	outputs: types<Commands>(),

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

	actions: {
		'selected -dragged> selected': ({ input, to, emit }) =>
			emit('moved', {
				item: to.data.item,
				by: Math.round(input.to.x - input.from.x),
			}),
		menu: ({ data, emit }) => {
			emit('menuShown', { item: data.item })
			return () => emit('menuHidden')
		},
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

	// Views, bracketed by hand. `a.ts` writes each of these as one line.
	let drag: (() => void) | undefined
	pointer.on('dragStarted', (origin) => {
		drag?.()
		drag = marquee(origin)
	})
	pointer.on('dragEnded', () => {
		drag?.()
		drag = undefined
	})

	let context: (() => void) | undefined
	cmd.on('menuShown', (m) => {
		context?.()
		context = contextMenu(m.item)
	})
	cmd.on('menuHidden', () => {
		context?.()
		context = undefined
	})

	// Level 2's command, in the document's words.
	cmd.on('moved', (m) => doc.move(m.item, m.by))

	// The seam, level 1 -> level 2.
	pointer.on('tap', (at) =>
		step('commanding <- tap', () => cmd.send('tap', at)),
	)
	pointer.on('longPress', (at) =>
		step('commanding <- longPress', () => cmd.send('longPress', at)),
	)
	pointer.on('dragged', (d) =>
		step('commanding <- dragged', () => cmd.send('dragged', d)),
	)

	// Diagnostics are the outputs, and only the outputs.
	pointer.on('tap', () => log.log('pointing   !> tap'))
	pointer.on('longPress', () => log.log('pointing   !> longPress'))
	pointer.on('dragged', () => log.log('pointing   !> dragged'))
	cmd.on('moved', () => log.log('commanding !> moved'))
	cmd.on('menuShown', () => log.log('commanding !> menuShown'))

	const at = (dx: number): Point => (cursor = { x: cursor.x + dx, y: cursor.y })
	const press = (x: number) => {
		token += 1
		cursor = { x, y: 50 }
		step('pointing <- press', () =>
			pointer.send('press', { point: cursor, token }),
		)
	}

	return {
		title: 'Ex2 · Gesture stacking · B (encapsulated)',
		note: 'Both levels publish outputs. Each view costs a pair of names.',
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
			{ name: 'pointing', ...pointer.inspect() },
			{ name: 'commanding', ...cmd.inspect() },
			{ name: 'document', state: 'offsets', data: doc.offsets() },
		],
	}
}
