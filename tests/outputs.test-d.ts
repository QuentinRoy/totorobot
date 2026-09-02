/**
 * The output vocabulary at the type level: what `emit` accepts, what `on`
 * accepts, where `emit` is and is not present, and what the exported helpers
 * resolve to.
 *
 * Every assertion is paired with `not.toBeAny()`, for the reason
 * `tests/vocabulary.test-d.ts` gives: `toEqualTypeOf` compares `any` against
 * anything without complaint, so the pairing is what holds a broken type red.
 */

import { expectTypeOf, test } from 'vitest'

import {
	machine,
	type,
	type Listener,
	type Observer,
	type OutputsOf,
} from 'totorobot'

type Inputs = { press: { at: number }; release: undefined }
type States = { idle: undefined; open: { at: number } }
type Outputs = { opened: { center: number }; ended: undefined }

const menu = machine({
	initial: 'idle',
	inputs: type<Inputs>(),
	states: type<States>(),
	outputs: type<Outputs>(),
	transitions: {
		'idle -press> open': ({ inputData }) => ({ at: inputData.at }),
		'open -release> idle': () => {},
	},
	actions: {
		open: ({ toData, emit }) => emit('opened', { center: toData.at }),
		'open -release> idle': ({ emit }) => emit('ended'),
	},
})

/** As in `vocabulary.test-d.ts`: reads the inferred type, not the expression. */
function read<T>(value: T): T {
	return value
}

test('emit takes a declared name, and the payload rule follows the declaration', () => {
	machine({
		initial: 'idle',
		inputs: type<Inputs>(),
		states: type<States>(),
		outputs: type<Outputs>(),
		transitions: {
			'idle -press> open': ({ inputData }) => ({ at: inputData.at }),
			'open -release> idle': () => {},
		},
		actions: {
			open: ({ emit }) => {
				emit('opened', { center: 1 })
				emit('ended')
				// @ts-expect-error - `opened` declares a payload
				emit('opened')
				// @ts-expect-error - the payload is the wrong shape
				emit('opened', { center: 'one' })
				// @ts-expect-error - `ended` declares no payload
				emit('ended', { center: 1 })
				// @ts-expect-error - no such output
				emit('closed')
			},
		},
	})
})

test('emit is present on an edge action and on a residency action alike', () => {
	machine({
		initial: 'idle',
		inputs: type<Inputs>(),
		states: type<States>(),
		outputs: type<Outputs>(),
		transitions: {
			'idle -press> open': ({ inputData }) => ({ at: inputData.at }),
			'open -release> idle': () => {},
		},
		actions: {
			idle: ({ emit }) => {
				expectTypeOf(emit).not.toBeAny()
				expectTypeOf(emit).toBeFunction()
			},
			'idle -press> open': ({ emit }) => {
				expectTypeOf(emit).not.toBeAny()
				expectTypeOf(emit).toBeFunction()
			},
		},
	})
})

test('emit is absent from a transitions handler and from an observe callback', () => {
	machine({
		initial: 'idle',
		inputs: type<Inputs>(),
		states: type<States>(),
		outputs: type<Outputs>(),
		transitions: {
			// @ts-expect-error - a handler may skip, so it cannot announce a hop
			'idle -press> open': ({ inputData, emit }) => ({ at: inputData.at }),
			'open -release> idle': () => {},
		},
	})

	const host = menu.start()
	// @ts-expect-error - an observer is outside the machine
	host.observe('* -> *', ({ emit }) => {})
	// @ts-expect-error - a residency registered through observe is too
	host.observe('open', ({ emit }) => {})
})

test('on takes a declared output name, and its record is narrowed by that name', () => {
	const host = menu.start()

	host.on('opened', (announcement) => {
		expectTypeOf(announcement).not.toBeAny()
		expectTypeOf(announcement.output).toEqualTypeOf<'opened'>()
		expectTypeOf(announcement.data).toEqualTypeOf<{ center: number }>()
		expectTypeOf(announcement.send).not.toBeAny()
		announcement.send('press', { at: 1 })
		announcement.send('release')
		// @ts-expect-error - not a declared input
		announcement.send('wiggle')
	})

	host.on('ended', (announcement) => {
		expectTypeOf(announcement).not.toBeAny()
		expectTypeOf(announcement.output).toEqualTypeOf<'ended'>()
		expectTypeOf(announcement.data).toEqualTypeOf<undefined>()
	})

	// @ts-expect-error - no such output
	host.on('closed', () => {})
})

test('on returns an unsubscribe function', () => {
	const off = read(menu.start().on('opened', () => {}))

	expectTypeOf(off).not.toBeAny()
	expectTypeOf(off).toEqualTypeOf<() => void>()
})

test('with outputs omitted and a vocabulary declared, the channel is unusable', () => {
	const quiet = machine({
		initial: 'idle',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'idle -press> open': ({ inputData }) => ({ at: inputData.at }),
			'open -release> idle': () => {},
		},
		actions: {
			// @ts-expect-error - nothing was declared to announce
			open: ({ emit }) => emit('opened', { center: 1 }),
		},
	})

	// @ts-expect-error - and nothing can be subscribed to either
	quiet.start().on('opened', () => {})
})

test('with no vocabulary at all, emit and on widen rather than disappear', () => {
	const untyped = machine({
		initial: 'idle',
		transitions: {
			'idle -press> open': () => {},
			'open -release> idle': () => {},
		},
		actions: {
			open: ({ emit }) => {
				expectTypeOf(emit).not.toBeAny()
				emit('anything')
				emit('anything', { at: 1 })
			},
		},
	})

	untyped.start().on('anything', (announcement) => {
		expectTypeOf(announcement).not.toBeAny()
		expectTypeOf(announcement.output).toEqualTypeOf<'anything'>()
		expectTypeOf(announcement.data).toEqualTypeOf<unknown>()
	})
})

test('OutputsOf reads the declared vocabulary back out', () => {
	expectTypeOf<OutputsOf<typeof menu>>().not.toBeAny()
	expectTypeOf<OutputsOf<typeof menu>>().toEqualTypeOf<Outputs>()
})

test('Listener names a listener written away from its on call', () => {
	const opened: Listener<typeof menu, 'opened'> = (announcement) => {
		expectTypeOf(announcement).not.toBeAny()
		expectTypeOf(announcement.data).toEqualTypeOf<{ center: number }>()
	}
	menu.start().on('opened', opened)

	// Omitting the name covers the whole vocabulary, so a name check narrows.
	const any: Listener<typeof menu> = (announcement) => {
		expectTypeOf(announcement).not.toBeAny()
		if (announcement.output === 'opened') {
			expectTypeOf(announcement.data).toEqualTypeOf<{ center: number }>()
		}
		if (announcement.output === 'ended') {
			expectTypeOf(announcement.data).toEqualTypeOf<undefined>()
		}
	}
	expectTypeOf(any).not.toBeAny()
})

test('Observer is unchanged by a machine declaring outputs', () => {
	const observer: Observer<typeof menu, '* -> open'> = (transition) => {
		expectTypeOf(transition).not.toBeAny()
		expectTypeOf(transition.to).toEqualTypeOf<'open'>()
		expectTypeOf(transition.toData).toEqualTypeOf<{ at: number }>()
		// @ts-expect-error - an observer record carries no emit
		transition.emit
	}
	menu.start().observe('* -> open', observer)
})
