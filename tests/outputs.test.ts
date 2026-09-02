/**
 * The declared output channel: `outputs`, `emit` and `on`
 * (docs/acceptance-cases.md, case 5). Everything here is asserted through the
 * package entry — which listener was called, with what record, in what order,
 * and relative to which other callbacks — never against the listener store,
 * whose shape must stay free to change.
 */

import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { beacon, toggle } from './fixtures.ts'

describe('outputs', () => {
	test('a listener is handed the output name, its payload and send', () => {
		const doc = beacon.start()
		const listener = vi.fn()

		doc.on('opened', listener)
		doc.send('open', { at: 7 })

		expect(listener).toHaveBeenCalledExactlyOnceWith({
			output: 'opened',
			data: { center: 7 },
			send: doc.send,
		})
	})

	test('an output carrying no payload is announced with data undefined', () => {
		const doc = beacon.start()
		const listener = vi.fn()

		doc.on('ended', listener)
		doc.send('open', { at: 1 })
		doc.send('close')

		expect(listener).toHaveBeenCalledExactlyOnceWith({
			output: 'ended',
			data: undefined,
			send: doc.send,
		})
	})

	test('only the listeners on the emitted name run', () => {
		const doc = beacon.start()
		const opened = vi.fn()
		const ended = vi.fn()

		doc.on('opened', opened)
		doc.on('ended', ended)
		doc.send('open', { at: 1 })

		expect(opened).toHaveBeenCalledOnce()
		expect(ended).not.toHaveBeenCalled()
	})

	test('an output with no listeners is a silent no-op', () => {
		const doc = beacon.start()

		expect(() => doc.send('open', { at: 1 })).not.toThrow()
		expect(doc.current.name).toBe('open')
	})

	test('on returns an unsubscribe function, and calling it more than once is harmless', () => {
		const doc = beacon.start()
		const listener = vi.fn()

		const off = doc.on('opened', listener)
		off()

		expect(() => off()).not.toThrow()

		doc.send('open', { at: 1 })
		expect(listener).not.toHaveBeenCalled()
	})

	test('several listeners on one output fire in registration order', () => {
		const doc = beacon.start()
		const first = vi.fn()
		const second = vi.fn()

		doc.on('opened', first)
		doc.on('opened', second)
		doc.send('open', { at: 1 })

		expect(first).toHaveBeenCalledOnce()
		expect(second).toHaveBeenCalledOnce()
		expect(first).toHaveBeenCalledBefore(second)
	})

	test('a listener registered during an emit of the same output does not run in that pass', () => {
		const doc = beacon.start()
		const late = vi.fn()

		doc.on('opened', () => {
			doc.on('opened', late)
		})

		doc.send('open', { at: 1 })
		expect(late).not.toHaveBeenCalled()

		doc.send('close')
		doc.send('open', { at: 2 })
		expect(late).toHaveBeenCalledOnce()
	})

	test('a listener unsubscribed during an emit of the same output still runs in that pass', () => {
		const doc = beacon.start()
		const second = vi.fn()

		let off: () => void
		doc.on('opened', () => off())
		off = doc.on('opened', second)

		doc.send('open', { at: 1 })
		expect(second).toHaveBeenCalledOnce()

		doc.send('close')
		doc.send('open', { at: 2 })
		expect(second).toHaveBeenCalledOnce()
	})

	test('a listener is called synchronously at the emit call', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'idle',
			inputs: type<{ go: undefined }>(),
			states: type<{ idle: undefined; running: undefined }>(),
			outputs: type<{ started: undefined }>(),
			transitions: { 'idle -go> running': () => {} },
			actions: {
				running: ({ emit }) => {
					emit('started')
					log('after emit')
				},
			},
		}).start()

		doc.on('started', () => log('listener'))
		doc.send('go')

		expect(log).toHaveBeenNthCalledWith(1, 'listener')
		expect(log).toHaveBeenNthCalledWith(2, 'after emit')
	})

	test("a listener's send into the emitting host is queued, not nested", () => {
		const doc = beacon.start()
		const seen = vi.fn()

		doc.on('opened', ({ send }) => {
			send('close')
			// The send is queued under the running drain, so the machine has not
			// moved yet when the listener returns.
			seen(doc.current.name)
		})

		doc.send('open', { at: 1 })
		expect(seen).toHaveBeenCalledExactlyOnceWith('open')
		expect(doc.current.name).toBe('idle')
	})

	test("a listener's send into a second host is queued under the running dispatch", () => {
		const doc = beacon.start()
		const peer = toggle.start()
		const log = vi.fn()

		doc.on('opened', () => {
			log('listener')
			peer.send('toggle')
		})
		doc.observe('* -> *', () => log('observer'))
		peer.observe('* -> *', () => log('peer'))

		doc.send('open', { at: 1 })
		expect(log).toHaveBeenNthCalledWith(1, 'listener')
		expect(log).toHaveBeenNthCalledWith(2, 'observer')
		expect(log).toHaveBeenNthCalledWith(3, 'peer')
		expect(peer.current.name).toBe('on')
	})

	test('one on call wires a peer machine, with no state name crossing the seam', () => {
		const widget = toggle.start()
		const doc = beacon.start()

		doc.on('opened', ({ send: _ }) => widget.send('toggle'))
		doc.send('open', { at: 1 })

		expect(widget.current.name).toBe('on')
	})

	test('emit captured by a residency action still announces after that residency has torn down', () => {
		let announce: (() => void) | undefined
		const doc = machine({
			initial: 'idle',
			inputs: type<{ go: undefined; back: undefined }>(),
			states: type<{ idle: undefined; working: undefined }>(),
			outputs: type<{ done: { late: boolean } }>(),
			transitions: {
				'idle -go> working': () => {},
				'working -back> idle': () => {},
			},
			actions: {
				working: ({ emit }) => {
					announce = () => emit('done', { late: true })
				},
			},
		}).start()

		const listener = vi.fn()
		doc.on('done', listener)

		doc.send('go')
		doc.send('back')
		expect(doc.current.name).toBe('idle')

		announce!()
		expect(listener).toHaveBeenCalledExactlyOnceWith({
			output: 'done',
			data: { late: true },
			send: doc.send,
		})
	})

	test("a throwing listener propagates out of send, and the interrupted residency's teardown is never registered", () => {
		const teardown = vi.fn()
		const doc = machine({
			initial: 'idle',
			inputs: type<{ go: undefined; back: undefined }>(),
			states: type<{ idle: undefined; working: undefined }>(),
			outputs: type<{ started: undefined }>(),
			transitions: {
				'idle -go> working': () => {},
				'working -back> idle': () => {},
			},
			actions: {
				// Emitting before the setup finishes is what strands it: the throw
				// leaves the action before it can return its teardown.
				working: ({ emit }) => {
					emit('started')
					return teardown
				},
			},
		}).start()

		doc.on('started', () => {
			throw new Error('listener failed')
		})

		expect(() => doc.send('go')).toThrow('listener failed')
		expect(doc.current.name).toBe('working')

		doc.send('back')
		expect(teardown).not.toHaveBeenCalled()
		expect(doc.current.name).toBe('idle')
	})

	test('an output emitted during start reaches nobody: no on call can have happened yet', () => {
		const listener = vi.fn()
		const doc = machine({
			initial: 'ready',
			states: type<{ ready: undefined }>(),
			inputs: type<{ poke: undefined }>(),
			outputs: type<{ ready: undefined }>(),
			transitions: { 'ready -poke> ready': () => {} },
			actions: { ready: { run: ({ emit }) => emit('ready'), restart: false } },
		}).start()

		doc.on('ready', listener)
		expect(listener).not.toHaveBeenCalled()
	})

	test('declaring outputs changes nothing about current or observe', () => {
		const doc = beacon.start()
		const observer = vi.fn()

		doc.observe('* -> *', observer)
		expect(doc.current).toStrictEqual({ name: 'idle', data: undefined })

		doc.send('open', { at: 3 })
		expect(doc.current).toStrictEqual({ name: 'open', data: { at: 3 } })
		expect(observer).toHaveBeenCalledExactlyOnceWith({
			input: 'open',
			inputData: { at: 3 },
			from: 'idle',
			fromData: undefined,
			to: 'open',
			toData: { at: 3 },
			send: doc.send,
		})
	})

	test('an output name may collide with a state name and with an input name', () => {
		const doc = machine({
			initial: 'idle',
			inputs: type<{ open: undefined }>(),
			states: type<{ idle: undefined; open: undefined }>(),
			outputs: type<{ open: { collided: true } }>(),
			transitions: { 'idle -open> open': () => {} },
			actions: { open: ({ emit }) => emit('open', { collided: true }) },
		}).start()

		const listener = vi.fn()
		doc.on('open', listener)
		doc.send('open')

		expect(doc.current.name).toBe('open')
		expect(listener).toHaveBeenCalledExactlyOnceWith({
			output: 'open',
			data: { collided: true },
			send: doc.send,
		})
	})

	test('one function registered twice is two subscriptions, and one unsubscribe removes one', () => {
		const doc = beacon.start()
		const listener = vi.fn()

		doc.on('opened', listener)
		const off = doc.on('opened', listener)

		doc.send('open', { at: 1 })
		expect(listener).toHaveBeenCalledTimes(2)

		off()
		doc.send('close')
		doc.send('open', { at: 2 })
		expect(listener).toHaveBeenCalledTimes(3)
	})
})
