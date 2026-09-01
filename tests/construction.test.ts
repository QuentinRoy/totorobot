import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { toggle } from './fixtures.ts'
import { cloneDeep } from './helpers.ts'

describe('construction', () => {
	test('start(data) yields a host whose current is the initial state, tag included', () => {
		const counter = machine({
			initial: 'ready',
			inputs: type<{ increment: undefined }>(),
			states: type<{ name: 'ready'; count: number }>(),
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

	test('type<T>() carries no runtime value and returns undefined', () => {
		// `undefined` rather than `null` or a marker object is what a caller
		// observes — the README is explicit about which of the three it is.
		expect(type<{ type: 'increment' }>()).toBeUndefined()
		expect(type<{ name: 'ready'; count: number }>()).toBeUndefined()
	})

	// The hops settled here are unobservable by construction (item 6): there is
	// no host to call `.observe()` on until `start()` returns, so that half of
	// item 6 has no public entry point to exercise.
	test("start() settles the initial state's immediate rows before returning", () => {
		const junction = machine({
			initial: 'checking',
			states: type<
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
			inputs: type<{ go: undefined }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
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
			inputs: type<{ submit: undefined }>(),
			states: type<{ name: 'checking' } | { name: 'allowed' }>(),
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
			states: type<{ name: 'start' } | { name: 'ready'; count: number }>(),
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
			inputs: type<{ go: undefined }>(),
			states: type<
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

		host.send('go')
		expect(host.current).toEqual({ name: 'b', count: 60_000 })
	})

	test("a cycle among the initial state's immediates throws RangeError from start(), naming the state it could not settle", () => {
		const spinningStart = machine({
			initial: 'loop',
			states: type<{ name: 'loop'; count: number }>(),
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

		hostA.send('toggle')

		expect(hostA.current).toEqual({ name: 'on' })
		expect(hostB.current).toEqual({ name: 'off' })
	})

	test('two hosts from one definition share no listeners', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		const observer = vi.fn()
		hostA.observe('* -> *', observer)

		hostB.send('toggle')

		expect(observer).not.toHaveBeenCalled()
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
