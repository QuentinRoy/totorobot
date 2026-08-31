import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { spinner, toggle } from './fixtures.ts'

describe('commit ordering', () => {
	test('a send from inside a listener does not take effect before the remaining listeners for the current transition have run', () => {
		const doc = toggle.start()
		const log = vi.fn()
		let queued = false
		const secondListenerState = vi.fn()

		doc.observe('* -> *', () => {
			log('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // must not take effect before the listener below runs
			}
		})
		doc.observe('* -> *', () => {
			log('second')
			secondListenerState(doc.current.name)
		})

		doc.send('toggle')
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'first')
		expect(log).toHaveBeenNthCalledWith(2, 'second')
		expect(log).toHaveBeenNthCalledWith(3, 'first')
		expect(log).toHaveBeenNthCalledWith(4, 'second')
		expect(secondListenerState).toHaveBeenNthCalledWith(1, 'on')
	})

	test('the queue drains before the outermost send returns — synchronously, not on a microtask', () => {
		const doc = toggle.start()
		let queued = false

		doc.observe('* -> *', () => {
			if (!queued) {
				queued = true
				doc.send('toggle')
			}
		})

		doc.send('toggle')
		// no await, no microtask flush: the queued send has already drained
		expect(doc.current).toEqual({ name: 'off' })
	})

	test('several queued sends drain first-in-first-out', () => {
		const counter = machine({
			initial: 'ready',
			inputs: type<{ push: { value: number } }>(),
			states: type<{ name: 'ready'; order: number[] }>(),
			transitions: {
				'ready -push> ready': ({ state, inputData }) => ({
					order: [...state.order, inputData.value],
				}),
			},
		})

		const doc = counter.start({ order: [] })
		let queued = false
		doc.observe('* -> *', () => {
			if (!queued) {
				queued = true
				doc.send('push', { value: 1 })
				doc.send('push', { value: 2 })
			}
		})

		doc.send('push', { value: 0 })
		expect(doc.current.order).toEqual([0, 1, 2])
	})

	test('a queued send is evaluated against the state at drain time, so it may correctly find no row and do nothing', () => {
		const stepper = machine({
			initial: 'a',
			inputs: type<{ go: undefined }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -go> b': () => {},
				'b -go> c': () => {},
			},
		})

		const doc = stepper.start()
		const log = vi.fn()
		let queued = false
		doc.observe('* -> *', (e) => {
			log(e.to.name)
			if (!queued) {
				queued = true
				doc.send('go') // drains at b -> c
				doc.send('go') // drains at c, no row, does nothing
			}
		})

		doc.send('go')
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'b')
		expect(log).toHaveBeenNthCalledWith(2, 'c')
		expect(doc.current).toEqual({ name: 'c' })
	})

	test('a listener that throws propagates out of send; later listeners and the queue are abandoned, but the transition stays committed', () => {
		const doc = toggle.start()
		const log = vi.fn()
		let queued = false
		let thrown = false

		doc.observe('* -> *', () => {
			log('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // queued; must never drain
			}
		})
		doc.observe('* -> *', () => {
			log('second')
			if (!thrown) {
				thrown = true
				throw new Error('boom')
			}
		})
		doc.observe('* -> *', () => log('third'))

		expect(() => doc.send('toggle')).toThrow('boom')
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'first')
		expect(log).toHaveBeenNthCalledWith(2, 'second')
		expect(doc.current).toEqual({ name: 'on' })

		// the host still works afterwards
		log.mockClear()
		doc.send('toggle')
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'first')
		expect(log).toHaveBeenNthCalledWith(2, 'second')
		expect(log).toHaveBeenNthCalledWith(3, 'third')
		expect(doc.current).toEqual({ name: 'off' })
	})

	test('the drain flag resets after a throw, so a send from inside a listener still queues and drains afterwards', () => {
		const doc = toggle.start()
		const offThrow = doc.observe('* -> *', () => {
			throw new Error('boom')
		})
		expect(() => doc.send('toggle')).toThrow('boom')
		offThrow()

		const log = vi.fn()
		let queued = false
		doc.observe('* -> *', () => {
			log('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // sent from inside a listener, not top-level
			}
		})
		doc.observe('* -> *', () => log('second'))

		doc.send('toggle')
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'first')
		expect(log).toHaveBeenNthCalledWith(2, 'second')
		expect(log).toHaveBeenNthCalledWith(3, 'first')
		expect(log).toHaveBeenNthCalledWith(4, 'second')
	})

	test('a listener is never re-entered while an earlier call for it is still running', () => {
		const doc = toggle.start()
		let active = 0
		let reentered = false
		let queued = false

		doc.observe('* -> *', () => {
			active++
			if (active > 1) reentered = true
			if (!queued) {
				queued = true
				doc.send('toggle') // would re-enter this same listener if nested rather than queued
			}
			active--
		})

		doc.send('toggle')
		expect(reentered).toBe(false)
		expect(queued).toBe(true)
	})

	test('a send from inside a listener mid-chain waits for the whole chain to settle, not just the current hop', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ go: undefined; peek: undefined }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -go> b': () => {},
				'b -> c': () => {},
				// exists only so a 'peek' drained too early — while still in 'b',
				// before the immediate 'b -> c' hop — would be observable
				'b -peek> b': () => {},
			},
		})

		const doc = relay.start()
		const log = vi.fn()
		doc.observe('* -> b', () => {
			log('entered b')
			doc.send('peek') // must not be drained until the chain is fully settled
		})
		doc.observe('* -> *', (e) => log(`-> ${e.to.name}`))

		doc.send('go')

		expect(doc.current).toEqual({ name: 'c' })
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'entered b')
		expect(log).toHaveBeenNthCalledWith(2, '-> b')
		expect(log).toHaveBeenNthCalledWith(3, '-> c')
	})

	test('a chain that never settles throws RangeError after the hop budget, naming the state it could not settle', () => {
		const doc = spinner.start()

		expect(() => doc.send('go')).toThrow(
			new RangeError("maximum transitions reached in 'loop'"),
		)
		// no rollback: the 1e5 hops already committed stay committed
		expect(doc.current.name).toBe('loop')
	})

	test('the host is usable after a budget throw', () => {
		const doc = spinner.start()
		expect(() => doc.send('go')).toThrow(RangeError)

		doc.send('stop')
		expect(doc.current).toEqual({ name: 'idle' })
	})

	test('an immediate self-loop that rewrites its data and eventually skips terminates normally, well inside the budget', () => {
		const counter = machine({
			initial: 'idle',
			inputs: type<{ go: undefined }>(),
			states: type<{ name: 'idle' } | { name: 'counting'; count: number }>(),
			transitions: {
				'idle -go> counting': () => ({ count: 0 }),
				'counting -> counting': ({ state, skip }) =>
					state.count < 5 ? { count: state.count + 1 } : skip(),
			},
		})

		const doc = counter.start()
		doc.send('go')

		expect(doc.current).toEqual({ name: 'counting', count: 5 })
	})

	test('every submitted input is considered exactly once', () => {
		const doc = toggle.start()
		const log = vi.fn()
		let queued = false

		doc.observe('* -> *', (e) => {
			log(e.to.name)
			if (!queued) {
				queued = true
				doc.send('toggle')
				doc.send('toggle')
				doc.send('toggle')
			}
		})

		doc.send('toggle')
		// one outer send plus three queued sends: exactly four transitions, none skipped or doubled
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'on')
		expect(log).toHaveBeenNthCalledWith(2, 'off')
		expect(log).toHaveBeenNthCalledWith(3, 'on')
		expect(log).toHaveBeenNthCalledWith(4, 'off')
	})
})

// Two machines wired to each other are how peer composition works today, before
// any composition feature exists. The dispatch queue is module scope, not per
// host, so these must hold across hosts exactly as the single-host tests above
// hold within one — see `docs/design-record.md`, "Module scope, not per host".
describe('commit ordering across hosts', () => {
	test("a send from one host into another queues rather than nesting: the second host runs only after the first host's remaining listeners for the current transition", () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		const log = vi.fn()
		let queued = false

		hostA.observe('* -> *', () => {
			log('A-first')
			if (!queued) {
				queued = true
				hostB.send('toggle') // must queue, not nest
			}
		})
		hostA.observe('* -> *', () => log('A-second'))
		hostB.observe('* -> *', () => log('B'))

		hostA.send('toggle')
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'A-first')
		expect(log).toHaveBeenNthCalledWith(2, 'A-second')
		expect(log).toHaveBeenNthCalledWith(3, 'B')
	})

	test('the whole thing drains before the outermost send returns, synchronously, across hosts', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		let queued = false

		hostA.observe('* -> *', () => {
			if (!queued) {
				queued = true
				hostB.send('toggle')
			}
		})

		hostA.send('toggle')
		// no await, no microtask flush: hostB has already drained
		expect(hostB.current).toEqual({ name: 'on' })
	})

	test('several sends from listeners across hosts drain first-in-first-out', () => {
		const counter = machine({
			initial: 'ready',
			inputs: type<{ push: { value: number } }>(),
			states: type<{ name: 'ready'; order: number[] }>(),
			transitions: {
				'ready -push> ready': ({ state, inputData }) => ({
					order: [...state.order, inputData.value],
				}),
			},
		})

		const hostA = counter.start({ order: [] })
		const hostB = counter.start({ order: [] })
		const log = vi.fn()
		let queued = false

		hostA.observe('* -> *', (e) => {
			log(`A${e.to.order.at(-1)}`)
			if (!queued) {
				queued = true
				hostB.send('push', { value: 1 }) // queued first
				hostA.send('push', { value: 2 }) // queued second
			}
		})
		hostB.observe('* -> *', (e) => log(`B${e.to.order.at(-1)}`))

		hostA.send('push', { value: 0 })
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'A0')
		expect(log).toHaveBeenNthCalledWith(2, 'B1')
		expect(log).toHaveBeenNthCalledWith(3, 'A2')
	})

	test('a send from inside a listener into another host, issued mid-chain, drains only once the chain has settled, never mid-hop', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ go: undefined }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -go> b': () => {},
				'b -> c': () => {},
			},
		})

		const hostA = relay.start()
		const hostB = toggle.start()
		const log = vi.fn()

		hostA.observe('* -> b', () => {
			log('A entered b')
			hostB.send('toggle') // must not drain until hostA's chain is fully settled
		})
		hostA.observe('* -> *', (e) => log(`A -> ${e.to.name}`))
		hostB.observe('* -> *', () => log('B toggled'))

		hostA.send('go')

		expect(hostA.current).toEqual({ name: 'c' })
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'A entered b')
		expect(log).toHaveBeenNthCalledWith(2, 'A -> b')
		expect(log).toHaveBeenNthCalledWith(3, 'A -> c')
		expect(log).toHaveBeenNthCalledWith(4, 'B toggled')
	})

	test('a listener throwing in a second host unwinds out of the send that started the chain, discarding everything still queued across both hosts, and both stay usable afterwards', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		const log = vi.fn()
		let queued = false
		let thrown = false

		hostA.observe('* -> *', () => {
			log('A1')
			if (!queued) {
				queued = true
				hostB.send('toggle') // will throw once drained
				hostA.send('toggle') // queued after it; must be discarded, never runs
			}
		})
		hostB.observe('* -> *', () => {
			log('B')
			if (!thrown) {
				thrown = true
				throw new Error('boom')
			}
		})

		expect(() => hostA.send('toggle')).toThrow('boom')
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'A1')
		expect(log).toHaveBeenNthCalledWith(2, 'B')
		// the throwing transition itself stays committed; the discarded one never ran
		expect(hostA.current).toEqual({ name: 'on' })
		expect(hostB.current).toEqual({ name: 'on' })

		// both hosts still work afterwards
		hostA.send('toggle')
		hostB.send('toggle')
		expect(hostA.current).toEqual({ name: 'off' })
		expect(hostB.current).toEqual({ name: 'off' })
	})

	test('a runaway immediate chain in one host discards queued sends in another host the same way a throwing listener does', () => {
		const hostA = spinner.start()
		const hostB = toggle.start()
		let queued = false

		hostA.observe('* -> loop', () => {
			if (!queued) {
				queued = true
				hostB.send('toggle') // queued; must be discarded when the chain overflows
			}
		})

		expect(() => hostA.send('go')).toThrow(RangeError)
		expect(hostB.current).toEqual({ name: 'off' }) // never drained

		// both hosts still work afterwards
		hostA.send('stop')
		hostB.send('toggle')
		expect(hostA.current).toEqual({ name: 'idle' })
		expect(hostB.current).toEqual({ name: 'on' })
	})

	test("reading a machine's current state right after sending to it from inside any dispatch shows the old state, even when the target is a different host", () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		const stateRightAfterSend = vi.fn()

		hostA.observe('* -> *', () => {
			hostB.send('toggle')
			stateRightAfterSend(hostB.current.name) // deferred: still the old state
		})

		hostA.send('toggle')
		expect(stateRightAfterSend).toHaveBeenCalledExactlyOnceWith('off')
		// drained by the time the outermost send returns
		expect(hostB.current).toEqual({ name: 'on' })
	})
})

// `start` settles the initial state's immediate chain, and that chain is a
// dispatch like any other: it runs under the same drain ownership `send` takes,
// so a send issued from one of its hops queues rather than nesting. Nothing on
// the host being started can issue one — it has no listeners yet — so these go
// through a handler reaching into another host. See `docs/design-record.md`,
// "`start` settles under the drain".
describe('commit ordering while `start` settles', () => {
	test('a send issued while the initial chain settles queues rather than nesting, and drains after the chain has settled', () => {
		const sink = toggle.start()
		const log = vi.fn()
		sink.observe('* -> *', (e) => log(`sink listener: -> ${e.to.name}`))

		const started = machine({
			initial: 'a',
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -> b': () => {
					log('hop a->b')
					sink.send('toggle')
					// deferred: the queue belongs to the drain `start` is holding
					log(`sink right after send: ${sink.current.name}`)
				},
				// A block body keeps this handler's return value undefined.
				'b -> c': () => {
					log('hop b->c')
				},
			},
		}).start()

		expect(started.current).toEqual({ name: 'c' })
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'hop a->b')
		expect(log).toHaveBeenNthCalledWith(2, 'sink right after send: off')
		expect(log).toHaveBeenNthCalledWith(3, 'hop b->c')
		expect(log).toHaveBeenNthCalledWith(4, 'sink listener: -> on')
		// drained before `start` returned
		expect(sink.current).toEqual({ name: 'on' })
	})

	test('`start` called from inside a dispatch settles inline but leaves the queue to the outer drain', () => {
		const driver = toggle.start()
		const sink = toggle.start()
		const log = vi.fn()
		sink.observe('* -> *', (e) => log(`sink listener: -> ${e.to.name}`))

		const late = machine({
			initial: 'a',
			states: type<{ name: 'a' } | { name: 'b' }>(),
			transitions: {
				'a -> b': () => {
					sink.send('toggle')
					log(`sink right after send: ${sink.current.name}`)
				},
			},
		})

		driver.observe('* -> *', () => {
			// settled inline: the caller cannot be handed an unsettled host
			expect(late.start().current).toEqual({ name: 'b' })
			log('driver listener done')
		})

		driver.send('toggle')
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'sink right after send: off')
		expect(log).toHaveBeenNthCalledWith(2, 'driver listener done')
		expect(log).toHaveBeenNthCalledWith(3, 'sink listener: -> on')
	})

	test('a runaway initial chain discards what its own hops queued, and every host stays usable', () => {
		const sink = toggle.start()
		const runaway = machine({
			initial: 'spin',
			states: type<{ name: 'spin' }>(),
			transitions: {
				'spin -> spin': () => {
					sink.send('toggle') // queued; discarded when the chain overflows
				},
			},
		})

		expect(() => runaway.start()).toThrow(
			new RangeError("maximum transitions reached in 'spin'"),
		)
		expect(sink.current).toEqual({ name: 'off' }) // never drained

		// the drain was released: an ordinary send still works
		sink.send('toggle')
		expect(sink.current).toEqual({ name: 'on' })
	})
})

// The first action a machine ever runs is residency on the initial state (or on
// whatever its immediate chain settles into, since actions run on every hop).
// `start` settles that chain under the same drain `send` takes, so an action
// sending from one of those hops queues like any other send and lands only once
// the chain has settled — the same assertions the two describe blocks above make
// for a handler, made here for a declared residency. See `docs/design-record.md`,
// "What to test when it lands: actions fired by `start()`".
describe('actions fired by `start()`', () => {
	test('residency on the initial state, sending synchronously, lands after the initial chain has settled — even with no chain to settle beyond the state itself', () => {
		const sink = toggle.start()
		const log = vi.fn()
		sink.observe('* -> *', (e) => log(`sink listener: -> ${e.to.name}`))

		machine({
			initial: 'a',
			states: type<{ name: 'a' }>(),
			transitions: {},
			actions: {
				a: () => {
					log('residency on a')
					sink.send('toggle')
					// deferred: the queue belongs to the drain `start` is holding
					log(`sink right after send: ${sink.current.name}`)
				},
			},
		}).start()

		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'residency on a')
		expect(log).toHaveBeenNthCalledWith(2, 'sink right after send: off')
		expect(log).toHaveBeenNthCalledWith(3, 'sink listener: -> on')
		// drained before `start` returned
		expect(sink.current).toEqual({ name: 'on' })
	})

	test('the same, over two or more hops: the send still lands only once every hop has run', () => {
		const sink = toggle.start()
		const log = vi.fn()
		sink.observe('* -> *', (e) => log(`sink listener: -> ${e.to.name}`))

		const started = machine({
			initial: 'a',
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -> b': () => {},
				'b -> c': () => {},
			},
			actions: {
				a: () => {
					log('residency on a')
					sink.send('toggle')
					log(`sink right after send: ${sink.current.name}`)
				},
				c: () => {
					log('residency on c')
				},
			},
		}).start()

		expect(started.current).toEqual({ name: 'c' })
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'residency on a')
		expect(log).toHaveBeenNthCalledWith(2, 'sink right after send: off')
		expect(log).toHaveBeenNthCalledWith(3, 'residency on c')
		expect(log).toHaveBeenNthCalledWith(4, 'sink listener: -> on')
		// drained before `start` returned, after every hop had already run
		expect(sink.current).toEqual({ name: 'on' })
	})

	test('`start` called from inside a dispatch settles its residency inline but leaves the queue to the outer drain', () => {
		const driver = toggle.start()
		const sink = toggle.start()
		const log = vi.fn()
		sink.observe('* -> *', (e) => log(`sink listener: -> ${e.to.name}`))

		const late = machine({
			initial: 'a',
			states: type<{ name: 'a' }>(),
			transitions: {},
			actions: {
				a: () => {
					sink.send('toggle')
					log(`sink right after send: ${sink.current.name}`)
				},
			},
		})

		driver.observe('* -> *', () => {
			// settled inline: the caller cannot be handed a host whose residency
			// has not yet run
			late.start()
			log('driver listener done')
		})

		driver.send('toggle')
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'sink right after send: off')
		expect(log).toHaveBeenNthCalledWith(2, 'driver listener done')
		expect(log).toHaveBeenNthCalledWith(3, 'sink listener: -> on')
	})

	test('a self-send from the initial residency drains before `start` returns, so the host it hands back already reflects it — with no listener able to have missed the hop, since none could yet exist', () => {
		const selfSender = machine({
			initial: 'a',
			inputs: type<{ go: undefined }>(),
			states: type<{ name: 'a' } | { name: 'b' }>(),
			transitions: {
				'a -go> b': () => {},
			},
			actions: {
				a: ({ send }) => {
					send('go')
				},
			},
		})

		const host = selfSender.start()
		// drained inside `start`'s own dispatch, before it returned
		expect(host.current).toEqual({ name: 'b' })
	})
})
