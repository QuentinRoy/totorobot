import { describe, expect, test } from 'vitest'

import { machine, types } from 'totorobot'
import { toggle } from './fixtures.ts'
import { cloneDeep } from './helpers.ts'

describe('construction', () => {
	test('start(data) yields a host whose current is { state: initial, data }', () => {
		const counter = machine({
			initial: 'ready',
			inputs: types<{ increment: void }>(),
			states: types<{ ready: { count: number } }>(),
			transitions: {
				'ready -increment> ready': ({ data }) => ({ count: data.count + 1 }),
			},
		})

		const host = counter.start({ count: 0 })
		expect(host.current).toEqual({ state: 'ready', data: { count: 0 } })
	})

	test('start() takes no argument for a void initial state, and current.data is undefined', () => {
		const host = toggle.start()
		expect(host.current).toEqual({ state: 'off', data: undefined })
	})

	test('types<T>() carries no runtime value and returns undefined', () => {
		// `undefined` rather than `null` or a marker object is what a caller
		// observes — docs/api.md is explicit about which of the three it is.
		expect(types<{ increment: void }>()).toBeUndefined()
		expect(types<{ ready: { count: number } }>()).toBeUndefined()
	})

	test("start() settles the initial state's immediate rows before returning", () => {
		const junction = machine({
			initial: 'checking',
			states: types<{
				checking: { quota: number }
				allowed: { quota: number }
				denied: { quota: number }
			}>(),
			transitions: {
				'checking -> allowed': ({ data, skip }) =>
					data.quota > 0 ? data : skip(),
				'checking -> denied': ({ data }) => data,
			},
		})

		const allowed = junction.start({ quota: 3 })
		expect(allowed.current).toEqual({ state: 'allowed', data: { quota: 3 } })

		const denied = junction.start({ quota: 0 })
		expect(denied.current).toEqual({ state: 'denied', data: { quota: 0 } })
	})

	test('a chain from the initial state settles fully, not one hop', () => {
		const relay = machine({
			initial: 'a',
			inputs: types<{ go: void }>(),
			states: types<{ a: void; b: void; c: void }>(),
			transitions: {
				'a -> b': () => {},
				'b -> c': () => {},
				'c -go> c': () => {},
			},
		})

		const host = relay.start()
		expect(host.current).toEqual({ state: 'c', data: undefined })
	})

	test("the initial state's immediates all skipping leaves the host in the declared initial state", () => {
		const stalled = machine({
			initial: 'checking',
			inputs: types<{ submit: void }>(),
			states: types<{ checking: void; allowed: void }>(),
			transitions: {
				'checking -> allowed': ({ skip }) => skip(),
				'checking -submit> allowed': () => {},
			},
		})

		const host = stalled.start()
		expect(host.current).toEqual({ state: 'checking', data: undefined })
	})

	test("start()'s arity still follows the declared initial state: a void initial that settles into a data-carrying state still takes no argument", () => {
		const promoted = machine({
			initial: 'start',
			states: types<{ start: void; ready: { count: number } }>(),
			transitions: {
				'start -> ready': () => ({ count: 0 }),
			},
		})

		// No argument to `.start()` — `start` is declared `void`, even though it
		// settles into `ready`, which carries data.
		const host = promoted.start()
		expect(host.current).toEqual({ state: 'ready', data: { count: 0 } })
	})

	test('the hop budget spent settling the initial state does not carry over into the first send', () => {
		const twice = machine({
			initial: 'a',
			inputs: types<{ go: void }>(),
			states: types<{ a: number; b: number }>(),
			transitions: {
				// Each chain alone is comfortably under the 1e5 budget; only a
				// shared counter across start() and send() would push their sum
				// over it.
				'a -> a': ({ data, skip }) => (data < 60_000 ? data + 1 : skip()),
				'a -go> b': () => 0,
				'b -> b': ({ data, skip }) => (data < 60_000 ? data + 1 : skip()),
			},
		})

		const host = twice.start(0)
		expect(host.current).toEqual({ state: 'a', data: 60_000 })

		host.send('go')
		expect(host.current).toEqual({ state: 'b', data: 60_000 })
	})

	test("a cycle among the initial state's immediates throws RangeError from start(), naming the state it could not settle", () => {
		const spinningStart = machine({
			initial: 'loop',
			states: types<{ loop: number }>(),
			transitions: {
				'loop -> loop': ({ data }) => data + 1,
			},
		})

		expect(() => spinningStart.start(0)).toThrow(
			new RangeError("maximum transitions reached in 'loop'"),
		)
	})

	test('two hosts from one definition share no current state', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		hostA.send('toggle')

		expect(hostA.current).toEqual({ state: 'on', data: undefined })
		expect(hostB.current).toEqual({ state: 'off', data: undefined })
	})

	test('two hosts from one definition share no listeners', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		const log: string[] = []
		hostA.observe('* -> *', () => log.push('a'))

		hostB.send('toggle')

		expect(log).toEqual([])
	})

	test('nothing ever mutates the definition', () => {
		const before = cloneDeep(toggle)

		const host = toggle.start()
		host.observe('* -> *', () => {})
		host.send('toggle')
		host.send('toggle')

		expect(toggle).toStrictEqual(before)
	})
})
