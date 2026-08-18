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
		hostA.on('* -> *', () => log.push('a'))

		hostB.send('toggle')

		expect(log).toEqual([])
	})

	test('nothing ever mutates the definition', () => {
		const before = cloneDeep(toggle)

		const host = toggle.start()
		host.on('* -> *', () => {})
		host.send('toggle')
		host.send('toggle')

		expect(toggle).toStrictEqual(before)
	})
})
