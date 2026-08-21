import { describe, expect, test } from 'vitest'

import { machine, types } from 'totorobot'
import { toggle } from './fixtures.ts'
import { cloneDeep } from './helpers.ts'

describe('construction', () => {
	test('start(data) yields a host whose current is the initial state, tag included', () => {
		const counter = machine({
			initial: 'ready',
			inputs: types<{ type: 'increment' }>(),
			states: types<{ name: 'ready'; count: number }>(),
			transitions: {
				'ready -increment> ready': ({ state }) => ({
					count: state.count + 1,
				}),
			},
		})

		const host = counter.start({ count: 0 })
		expect(host.current).toEqual({ name: 'ready', count: 0 })
	})

	test('start() takes no argument for a payload-free initial state', () => {
		const host = toggle.start()
		expect(host.current).toEqual({ name: 'off' })
	})

	test('types<T>() carries no runtime value and returns undefined', () => {
		// `undefined` rather than `null` or a marker object is what a caller
		// observes — docs/api.md is explicit about which of the three it is.
		expect(types<{ type: 'increment' }>()).toBeUndefined()
		expect(types<{ name: 'ready'; count: number }>()).toBeUndefined()
	})

	test("start() settles the initial state's immediate rows before returning", () => {
		const junction = machine({
			initial: 'checking',
			states: types<
				| { name: 'checking'; quota: number }
				| { name: 'allowed'; quota: number }
				| { name: 'denied'; quota: number }
			>(),
			transitions: {
				'checking -> allowed': ({ state, skip }) =>
					state.quota > 0 ? { quota: state.quota } : skip(),
				'checking -> denied': ({ state }) => ({ quota: state.quota }),
			},
		})

		const allowed = junction.start({ quota: 3 })
		expect(allowed.current).toEqual({ name: 'allowed', quota: 3 })

		const denied = junction.start({ quota: 0 })
		expect(denied.current).toEqual({ name: 'denied', quota: 0 })
	})

	test('a chain from the initial state settles fully, not one hop', () => {
		const relay = machine({
			initial: 'a',
			inputs: types<{ type: 'go' }>(),
			states: types<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -> b': () => {},
				'b -> c': () => {},
				'c -go> c': () => {},
			},
		})

		const host = relay.start()
		expect(host.current).toEqual({ name: 'c' })
	})

	test("the initial state's immediates all skipping leaves the host in the declared initial state", () => {
		const stalled = machine({
			initial: 'checking',
			inputs: types<{ type: 'submit' }>(),
			states: types<{ name: 'checking' } | { name: 'allowed' }>(),
			transitions: {
				'checking -> allowed': ({ skip }) => skip(),
				'checking -submit> allowed': () => {},
			},
		})

		const host = stalled.start()
		expect(host.current).toEqual({ name: 'checking' })
	})

	test("start()'s arity still follows the declared initial state: a payload-free initial that settles into a data-carrying state still takes no argument", () => {
		const promoted = machine({
			initial: 'start',
			states: types<{ name: 'start' } | { name: 'ready'; count: number }>(),
			transitions: {
				'start -> ready': () => ({ count: 0 }),
			},
		})

		// No argument to `.start()` — `start` carries no payload, even though it
		// settles into `ready`, which carries data.
		const host = promoted.start()
		expect(host.current).toEqual({ name: 'ready', count: 0 })
	})

	test('the hop budget spent settling the initial state does not carry over into the first send', () => {
		const twice = machine({
			initial: 'a',
			inputs: types<{ type: 'go' }>(),
			states: types<
				{ name: 'a'; count: number } | { name: 'b'; count: number }
			>(),
			transitions: {
				// Each chain alone is comfortably under the 1e5 budget; only a
				// shared counter across start() and send() would push their sum
				// over it.
				'a -> a': ({ state, skip }) =>
					state.count < 60_000 ? { count: state.count + 1 } : skip(),
				'a -go> b': () => ({ count: 0 }),
				'b -> b': ({ state, skip }) =>
					state.count < 60_000 ? { count: state.count + 1 } : skip(),
			},
		})

		const host = twice.start({ count: 0 })
		expect(host.current).toEqual({ name: 'a', count: 60_000 })

		host.send({ type: 'go' })
		expect(host.current).toEqual({ name: 'b', count: 60_000 })
	})

	test("a cycle among the initial state's immediates throws RangeError from start(), naming the state it could not settle", () => {
		const spinningStart = machine({
			initial: 'loop',
			states: types<{ name: 'loop'; count: number }>(),
			transitions: {
				'loop -> loop': ({ state }) => ({ count: state.count + 1 }),
			},
		})

		expect(() => spinningStart.start({ count: 0 })).toThrow(
			new RangeError("maximum transitions reached in 'loop'"),
		)
	})

	test('two hosts from one definition share no current state', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		hostA.send({ type: 'toggle' })

		expect(hostA.current).toEqual({ name: 'on' })
		expect(hostB.current).toEqual({ name: 'off' })
	})

	test('two hosts from one definition share no listeners', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		const log: string[] = []
		hostA.observe('* -> *', () => log.push('a'))

		hostB.send({ type: 'toggle' })

		expect(log).toEqual([])
	})

	test('nothing ever mutates the definition', () => {
		const before = cloneDeep(toggle)

		const host = toggle.start()
		host.observe('* -> *', () => {})
		host.send({ type: 'toggle' })
		host.send({ type: 'toggle' })

		expect(toggle).toStrictEqual(before)
	})
})
