import { describe, expect, test } from 'vitest'

import { machine, types } from '../src/totorobot.ts'
import { toggle } from './fixtures.ts'

/** Clones plain objects and arrays; leaves functions and other values by reference. */
function cloneDeep<T>(value: T): T {
	if (Array.isArray(value)) return value.map(cloneDeep) as T
	if (
		value !== null &&
		typeof value === 'object' &&
		value.constructor === Object
	) {
		return Object.fromEntries(
			Object.entries(value).map(([key, v]) => [key, cloneDeep(v)]),
		) as T
	}
	return value
}

describe('construction', () => {
	test('[1] start(data) yields a host whose current is { state: initial, data }', () => {
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

	test('[1] start() takes no argument for a void initial state, and current.data is undefined', () => {
		const host = toggle.start()
		expect(host.current).toEqual({ state: 'off', data: undefined })
	})

	test('[2] two hosts from one definition share no current state', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		hostA.send('toggle')

		expect(hostA.current).toEqual({ state: 'on', data: undefined })
		expect(hostB.current).toEqual({ state: 'off', data: undefined })
	})

	test('[2] two hosts from one definition share no listeners', () => {
		const hostA = toggle.start()
		const hostB = toggle.start()

		const log: string[] = []
		hostA.on('* -> *', () => log.push('a'))

		hostB.send('toggle')

		expect(log).toEqual([])
	})

	test('[3] nothing ever mutates the definition', () => {
		const before = cloneDeep(toggle)

		const host = toggle.start()
		host.on('* -> *', () => {})
		host.send('toggle')
		host.send('toggle')

		expect(toggle).toStrictEqual(before)
	})
})
