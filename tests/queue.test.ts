import { describe, expect, test } from 'vitest'

import { machine, types } from 'totorobot'
import { spinner, toggle } from './fixtures.ts'

describe('commit ordering', () => {
	test('a send from inside a listener does not take effect before the remaining listeners for the current transition have run', () => {
		const doc = toggle.start()
		const log: string[] = []
		let queued = false
		let stateWhenSecondRan: string | undefined

		doc.on('* -> *', () => {
			log.push('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // must not take effect before the listener below runs
			}
		})
		doc.on('* -> *', () => {
			log.push('second')
			if (stateWhenSecondRan === undefined)
				stateWhenSecondRan = doc.current.state
		})

		doc.send('toggle')
		expect(log).toEqual(['first', 'second', 'first', 'second'])
		expect(stateWhenSecondRan).toBe('on')
	})

	test('the queue drains before the outermost send returns — synchronously, not on a microtask', () => {
		const doc = toggle.start()
		let queued = false

		doc.on('* -> *', () => {
			if (!queued) {
				queued = true
				doc.send('toggle')
			}
		})

		doc.send('toggle')
		// no await, no microtask flush: the queued send has already drained
		expect(doc.current).toEqual({ state: 'off', data: undefined })
	})

	test('several queued sends drain first-in-first-out', () => {
		const counter = machine({
			initial: 'ready',
			inputs: types<{ push: { value: number } }>(),
			states: types<{ ready: { order: number[] } }>(),
			transitions: {
				'ready -push> ready': ({ data, input }) => ({
					order: [...data.order, input.value],
				}),
			},
		})

		const doc = counter.start({ order: [] })
		let queued = false
		doc.on('* -> *', () => {
			if (!queued) {
				queued = true
				doc.send('push', { value: 1 })
				doc.send('push', { value: 2 })
			}
		})

		doc.send('push', { value: 0 })
		expect(doc.current.data.order).toEqual([0, 1, 2])
	})

	test('a queued send is evaluated against the state at drain time, so it may correctly find no row and do nothing', () => {
		const stepper = machine({
			initial: 'a',
			inputs: types<{ go: void }>(),
			states: types<{ a: void; b: void; c: void }>(),
			transitions: {
				'a -go> b': () => {},
				'b -go> c': () => {},
			},
		})

		const doc = stepper.start()
		const log: string[] = []
		let queued = false
		doc.on('* -> *', (e) => {
			log.push(e.to.state)
			if (!queued) {
				queued = true
				doc.send('go') // drains at b -> c
				doc.send('go') // drains at c, no row, does nothing
			}
		})

		doc.send('go')
		expect(log).toEqual(['b', 'c'])
		expect(doc.current).toEqual({ state: 'c', data: undefined })
	})

	test('a listener that throws propagates out of send; later listeners and the queue are abandoned, but the transition stays committed', () => {
		const doc = toggle.start()
		const log: string[] = []
		let queued = false
		let thrown = false

		doc.on('* -> *', () => {
			log.push('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // queued; must never drain
			}
		})
		doc.on('* -> *', () => {
			log.push('second')
			if (!thrown) {
				thrown = true
				throw new Error('boom')
			}
		})
		doc.on('* -> *', () => log.push('third'))

		expect(() => doc.send('toggle')).toThrow('boom')
		expect(log).toEqual(['first', 'second'])
		expect(doc.current).toEqual({ state: 'on', data: undefined })

		// the host still works afterwards
		log.length = 0
		doc.send('toggle')
		expect(log).toEqual(['first', 'second', 'third'])
		expect(doc.current).toEqual({ state: 'off', data: undefined })
	})

	test('the drain flag resets after a throw, so a send from inside a listener still queues and drains afterwards', () => {
		const doc = toggle.start()
		const offThrow = doc.on('* -> *', () => {
			throw new Error('boom')
		})
		expect(() => doc.send('toggle')).toThrow('boom')
		offThrow()

		const log: string[] = []
		let queued = false
		doc.on('* -> *', () => {
			log.push('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // sent from inside a listener, not top-level
			}
		})
		doc.on('* -> *', () => log.push('second'))

		doc.send('toggle')
		expect(log).toEqual(['first', 'second', 'first', 'second'])
	})

	test('a listener is never re-entered while an earlier call for it is still running', () => {
		const doc = toggle.start()
		let active = 0
		let reentered = false
		let queued = false

		doc.on('* -> *', () => {
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
			inputs: types<{ go: void; peek: void }>(),
			states: types<{ a: void; b: void; c: void }>(),
			transitions: {
				'a -go> b': () => {},
				'b -> c': () => {},
				// exists only so a 'peek' drained too early — while still in 'b',
				// before the immediate 'b -> c' hop — would be observable
				'b -peek> b': () => {},
			},
		})

		const doc = relay.start()
		const log: string[] = []
		doc.on('* -> b', () => {
			log.push('entered b')
			doc.send('peek') // must not be drained until the chain is fully settled
		})
		doc.on('* -> *', (e) => log.push(`-> ${e.to.state}`))

		doc.send('go')

		expect(doc.current).toEqual({ state: 'c', data: undefined })
		expect(log).toEqual(['entered b', '-> b', '-> c'])
	})

	test('a chain that never settles throws RangeError after the hop budget, naming the state it could not settle', () => {
		const doc = spinner.start()

		expect(() => doc.send('go')).toThrow(
			new RangeError("maximum transitions reached in 'loop'"),
		)
		// no rollback: the 1e5 hops already committed stay committed
		expect(doc.current.state).toBe('loop')
	})

	test('the host is usable after a budget throw', () => {
		const doc = spinner.start()
		expect(() => doc.send('go')).toThrow(RangeError)

		doc.send('stop')
		expect(doc.current).toEqual({ state: 'idle', data: undefined })
	})

	test('an immediate self-loop that rewrites its data and eventually skips terminates normally, well inside the budget', () => {
		const counter = machine({
			initial: 'idle',
			inputs: types<{ go: void }>(),
			states: types<{ idle: void; counting: number }>(),
			transitions: {
				'idle -go> counting': () => 0,
				'counting -> counting': ({ data, skip }) =>
					data < 5 ? data + 1 : skip(),
			},
		})

		const doc = counter.start()
		doc.send('go')

		expect(doc.current).toEqual({ state: 'counting', data: 5 })
	})

	test('every submitted input is considered exactly once', () => {
		const doc = toggle.start()
		const log: string[] = []
		let queued = false

		doc.on('* -> *', (e) => {
			log.push(e.to.state)
			if (!queued) {
				queued = true
				doc.send('toggle')
				doc.send('toggle')
				doc.send('toggle')
			}
		})

		doc.send('toggle')
		// one outer send plus three queued sends: exactly four transitions, none skipped or doubled
		expect(log).toEqual(['on', 'off', 'on', 'off'])
	})
})

// Two machines wired to each other are how peer composition works today, before
// any composition feature exists. The dispatch queue is module scope, not per
// host, so these must hold across hosts exactly as the single-host tests above
// hold within one — see `docs/api-rationale.md`, "Module scope, not per host".
describe('commit ordering across hosts', () => {
	test("a send from one host into another queues rather than nesting: the second host runs only after the first host's remaining listeners for the current transition", () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		const log: string[] = []
		let queued = false

		hostA.on('* -> *', () => {
			log.push('A-first')
			if (!queued) {
				queued = true
				hostB.send('toggle') // must queue, not nest
			}
		})
		hostA.on('* -> *', () => log.push('A-second'))
		hostB.on('* -> *', () => log.push('B'))

		hostA.send('toggle')
		expect(log).toEqual(['A-first', 'A-second', 'B'])
	})

	test('the whole thing drains before the outermost send returns, synchronously, across hosts', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		let queued = false

		hostA.on('* -> *', () => {
			if (!queued) {
				queued = true
				hostB.send('toggle')
			}
		})

		hostA.send('toggle')
		// no await, no microtask flush: hostB has already drained
		expect(hostB.current).toEqual({ state: 'on', data: undefined })
	})

	test('several sends from listeners across hosts drain first-in-first-out', () => {
		const counter = machine({
			initial: 'ready',
			inputs: types<{ push: { value: number } }>(),
			states: types<{ ready: { order: number[] } }>(),
			transitions: {
				'ready -push> ready': ({ data, input }) => ({
					order: [...data.order, input.value],
				}),
			},
		})

		const hostA = counter.start({ order: [] })
		const hostB = counter.start({ order: [] })
		const log: string[] = []
		let queued = false

		hostA.on('* -> *', (e) => {
			log.push(`A${e.to.data.order.at(-1)}`)
			if (!queued) {
				queued = true
				hostB.send('push', { value: 1 }) // queued first
				hostA.send('push', { value: 2 }) // queued second
			}
		})
		hostB.on('* -> *', (e) => log.push(`B${e.to.data.order.at(-1)}`))

		hostA.send('push', { value: 0 })
		expect(log).toEqual(['A0', 'B1', 'A2'])
	})

	test('a send from inside a listener into another host, issued mid-chain, drains only once the chain has settled, never mid-hop', () => {
		const relay = machine({
			initial: 'a',
			inputs: types<{ go: void }>(),
			states: types<{ a: void; b: void; c: void }>(),
			transitions: {
				'a -go> b': () => {},
				'b -> c': () => {},
			},
		})

		const hostA = relay.start()
		const hostB = toggle.start()
		const log: string[] = []

		hostA.on('* -> b', () => {
			log.push('A entered b')
			hostB.send('toggle') // must not drain until hostA's chain is fully settled
		})
		hostA.on('* -> *', (e) => log.push(`A -> ${e.to.state}`))
		hostB.on('* -> *', () => log.push('B toggled'))

		hostA.send('go')

		expect(hostA.current).toEqual({ state: 'c', data: undefined })
		expect(log).toEqual(['A entered b', 'A -> b', 'A -> c', 'B toggled'])
	})

	test('a listener throwing in a second host unwinds out of the send that started the chain, discarding everything still queued across both hosts, and both stay usable afterwards', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		const log: string[] = []
		let queued = false
		let thrown = false

		hostA.on('* -> *', () => {
			log.push('A1')
			if (!queued) {
				queued = true
				hostB.send('toggle') // will throw once drained
				hostA.send('toggle') // queued after it; must be discarded, never runs
			}
		})
		hostB.on('* -> *', () => {
			log.push('B')
			if (!thrown) {
				thrown = true
				throw new Error('boom')
			}
		})

		expect(() => hostA.send('toggle')).toThrow('boom')
		expect(log).toEqual(['A1', 'B'])
		// the throwing transition itself stays committed; the discarded one never ran
		expect(hostA.current).toEqual({ state: 'on', data: undefined })
		expect(hostB.current).toEqual({ state: 'on', data: undefined })

		// both hosts still work afterwards
		hostA.send('toggle')
		hostB.send('toggle')
		expect(hostA.current).toEqual({ state: 'off', data: undefined })
		expect(hostB.current).toEqual({ state: 'off', data: undefined })
	})

	test('a runaway immediate chain in one host discards queued sends in another host the same way a throwing listener does', () => {
		const hostA = spinner.start()
		const hostB = toggle.start()
		let queued = false

		hostA.on('* -> loop', () => {
			if (!queued) {
				queued = true
				hostB.send('toggle') // queued; must be discarded when the chain overflows
			}
		})

		expect(() => hostA.send('go')).toThrow(RangeError)
		expect(hostB.current).toEqual({ state: 'off', data: undefined }) // never drained

		// both hosts still work afterwards
		hostA.send('stop')
		hostB.send('toggle')
		expect(hostA.current).toEqual({ state: 'idle', data: undefined })
		expect(hostB.current).toEqual({ state: 'on', data: undefined })
	})

	test("reading a machine's current state right after sending to it from inside any dispatch shows the old state, even when the target is a different host", () => {
		const hostA = toggle.start()
		const hostB = toggle.start()
		let seenRightAfterSend: string | undefined

		hostA.on('* -> *', () => {
			hostB.send('toggle')
			seenRightAfterSend = hostB.current.state // deferred: still the old state
		})

		hostA.send('toggle')
		expect(seenRightAfterSend).toBe('off')
		// drained by the time the outermost send returns
		expect(hostB.current).toEqual({ state: 'on', data: undefined })
	})
})
