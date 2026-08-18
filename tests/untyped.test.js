/**
 * Plain JavaScript, deliberately no `@ts-check` — the runtime half of the
 * untyped path (item 16) needs a caller the type checker never sees.
 */

import { describe, expect, test } from 'vitest'

import { machine } from '../src/totorobot.ts'

describe('the untyped path', () => {
	test('a machine with no vocabulary at all works: it starts, transitions and notifies', () => {
		const untyped = machine({
			initial: 'off',
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
		})

		const host = untyped.start()
		const log = []
		host.on('* -> *', (e) => log.push(`${e.from.state}->${e.to.state}`))

		expect(host.current).toEqual({ state: 'off', data: undefined })

		host.send('toggle')
		expect(host.current).toEqual({ state: 'on', data: undefined })

		host.send('toggle')
		expect(host.current).toEqual({ state: 'off', data: undefined })

		expect(log).toEqual(['off->on', 'on->off'])
	})

	test('an input name outside the vocabulary changes nothing', () => {
		const untyped = machine({
			initial: 'off',
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
		})

		const host = untyped.start()
		const log = []
		host.on('* -> *', () => log.push('fired'))

		host.send('bogus')

		expect(host.current).toEqual({ state: 'off', data: undefined })
		expect(log).toEqual([])
	})

	test('a bad state name in a listener pattern does not throw and never fires', () => {
		const untyped = machine({
			initial: 'off',
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
		})

		const host = untyped.start()
		const log = []

		expect(() => host.on('bogus -> *', () => log.push('fired'))).not.toThrow()

		host.send('toggle')

		expect(log).toEqual([])
	})
})
