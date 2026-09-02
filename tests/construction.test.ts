import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { beacon, toggle } from './fixtures.ts'
import { cloneDeep } from './helpers.ts'

describe('construction', () => {
	test('start(data) yields a host whose current is the initial name and its data', () => {
		const counter = machine({
			initial: 'ready',
			inputs: type<{ increment: undefined }>(),
			states: type<{ ready: { count: number } }>(),
			transitions: {
				'ready -increment> ready': ({ fromData }) => ({
					count: fromData.count + 1,
				}),
			},
		})

		const host = counter.start({ count: 0 })
		expect(host.current).toEqual({ name: 'ready', data: { count: 0 } })
	})

	test('start() takes no argument for a payload-free initial state, and data is undefined', () => {
		const host = toggle.start()
		expect(host.current).toStrictEqual({ name: 'off', data: undefined })
	})

	test('the initial payload is stored as supplied, not copied', () => {
		const carrier = machine({
			initial: 'ready',
			states: type<{ ready: Map<string, number> }>(),
			transitions: {},
		})

		const data = new Map([['a', 1]])
		expect(carrier.start(data).current.data).toBe(data)
	})

	test('type<T>() carries no runtime value and returns undefined', () => {
		// `undefined` rather than `null` or a marker object is what a caller
		// observes — the README is explicit about which of the three it is.
		expect(type<{ increment: undefined }>()).toBeUndefined()
		expect(type<{ ready: { count: number } }>()).toBeUndefined()
	})

	// The hops settled here are unobservable by construction (item 6): there is
	// no host to call `.observe()` on until `start()` returns, so that half of
	// item 6 has no public entry point to exercise.
	test("start() settles the initial state's immediate rows before returning", () => {
		const junction = machine({
			initial: 'checking',
			states: type<{
				checking: { quota: number }
				allowed: { quota: number }
				denied: { quota: number }
			}>(),
			transitions: {
				'checking -> allowed': ({ fromData, skip }) =>
					fromData.quota > 0 ? fromData : skip(),
				'checking -> denied': ({ fromData }) => fromData,
			},
		})

		const allowed = junction.start({ quota: 3 })
		expect(allowed.current).toEqual({ name: 'allowed', data: { quota: 3 } })

		const denied = junction.start({ quota: 0 })
		expect(denied.current).toEqual({ name: 'denied', data: { quota: 0 } })
	})

	test('a chain from the initial state settles fully, not one hop', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ go: undefined }>(),
			states: type<{ a: undefined; b: undefined; c: undefined }>(),
			transitions: {
				'a -> b': () => {},
				'b -> c': () => {},
				'c -go> c': () => {},
			},
		})

		const host = relay.start()
		expect(host.current.name).toBe('c')
	})

	test("the initial state's immediates all skipping leaves the host in the declared initial state", () => {
		const stalled = machine({
			initial: 'checking',
			inputs: type<{ submit: undefined }>(),
			states: type<{ checking: undefined; allowed: undefined }>(),
			transitions: {
				'checking -> allowed': ({ skip }) => skip(),
				'checking -submit> allowed': () => {},
			},
		})

		const host = stalled.start()
		expect(host.current.name).toBe('checking')
	})

	test("start()'s arity still follows the declared initial state: a payload-free initial that settles into a data-carrying state still takes no argument", () => {
		const promoted = machine({
			initial: 'start',
			states: type<{ start: undefined; ready: { count: number } }>(),
			transitions: {
				'start -> ready': () => ({ count: 0 }),
			},
		})

		// No argument to `.start()` — `start` carries no payload, even though it
		// settles into `ready`, which carries data.
		const host = promoted.start()
		expect(host.current).toEqual({ name: 'ready', data: { count: 0 } })
	})

	test('the hop budget spent settling the initial state does not carry over into the first send', () => {
		const twice = machine({
			initial: 'a',
			inputs: type<{ go: undefined }>(),
			states: type<{ a: { count: number }; b: { count: number } }>(),
			transitions: {
				// Each chain alone is comfortably under the 1e5 budget; only a
				// shared counter across start() and send() would push their sum
				// over it.
				'a -> a': ({ fromData, skip }) =>
					fromData.count < 60_000 ? { count: fromData.count + 1 } : skip(),
				'a -go> b': () => ({ count: 0 }),
				'b -> b': ({ fromData, skip }) =>
					fromData.count < 60_000 ? { count: fromData.count + 1 } : skip(),
			},
		})

		const host = twice.start({ count: 0 })
		expect(host.current).toEqual({ name: 'a', data: { count: 60_000 } })

		host.send('go')
		expect(host.current).toEqual({ name: 'b', data: { count: 60_000 } })
	})

	test("a cycle among the initial state's immediates throws RangeError from start(), naming the state it could not settle", () => {
		const spinningStart = machine({
			initial: 'loop',
			states: type<{ loop: { count: number } }>(),
			transitions: {
				'loop -> loop': ({ fromData }) => ({ count: fromData.count + 1 }),
			},
		})

		expect(() => spinningStart.start({ count: 0 })).toThrow(
			new RangeError("maximum transitions reached in 'loop'"),
		)
	})

	test('two hosts from one definition share no current state', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		hostA.send('toggle')

		expect(hostA.current.name).toBe('on')
		expect(hostB.current.name).toBe('off')
	})

	test('two hosts from one definition share no observers', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		const observer = vi.fn()
		hostA.observe('* -> *', observer)

		hostB.send('toggle')

		expect(observer).not.toHaveBeenCalled()
	})

	test('two hosts from one definition share no listeners', () => {
		const hostA = beacon.start()
		const hostB = beacon.start()

		const listener = vi.fn()
		hostA.on('opened', listener)

		hostB.send('open', { at: 1 })

		expect(listener).not.toHaveBeenCalled()
	})

	test('nothing ever mutates the definition', () => {
		const before = cloneDeep(toggle)

		const host = toggle.start()
		host.observe('* -> *', () => {})
		host.send('toggle')
		host.send('toggle')

		expect(toggle).toStrictEqual(before)
	})

	test('declaring outputs leaves the definition just as inert', () => {
		const before = cloneDeep(beacon)

		const host = beacon.start()
		host.on('opened', () => {})
		host.send('open', { at: 1 })
		host.send('close')

		expect(beacon).toStrictEqual(before)
	})
})
