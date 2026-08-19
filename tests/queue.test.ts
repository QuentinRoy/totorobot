import { describe, expect, test } from 'vitest'

import { machine, types } from 'totorobot'
import { spinner, toggle } from './fixtures.ts'

describe('commit ordering', () => {
	test('a send from inside a listener does not take effect before the remaining listeners for the current transition have run', () => {
		const doc = toggle.start()
		const log: string[] = []
		let queued = false
		let stateWhenSecondRan: string | undefined

		doc.observe('* -> *', () => {
			log.push('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // must not take effect before the listener below runs
			}
		})
		doc.observe('* -> *', () => {
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

		doc.observe('* -> *', () => {
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
		doc.observe('* -> *', () => {
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
		doc.observe('* -> *', (e) => {
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

		doc.observe('* -> *', () => {
			log.push('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // queued; must never drain
			}
		})
		doc.observe('* -> *', () => {
			log.push('second')
			if (!thrown) {
				thrown = true
				throw new Error('boom')
			}
		})
		doc.observe('* -> *', () => log.push('third'))

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
		const offThrow = doc.observe('* -> *', () => {
			throw new Error('boom')
		})
		expect(() => doc.send('toggle')).toThrow('boom')
		offThrow()

		const log: string[] = []
		let queued = false
		doc.observe('* -> *', () => {
			log.push('first')
			if (!queued) {
				queued = true
				doc.send('toggle') // sent from inside a listener, not top-level
			}
		})
		doc.observe('* -> *', () => log.push('second'))

		doc.send('toggle')
		expect(log).toEqual(['first', 'second', 'first', 'second'])
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
		doc.observe('* -> b', () => {
			log.push('entered b')
			doc.send('peek') // must not be drained until the chain is fully settled
		})
		doc.observe('* -> *', (e) => log.push(`-> ${e.to.state}`))

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

		doc.observe('* -> *', (e) => {
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
