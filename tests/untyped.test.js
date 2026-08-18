/**
 * Plain JavaScript, deliberately no `@ts-check` — the runtime half of the
 * untyped path (item 16) needs a caller the type checker never sees.
 */

import { describe, expect, test } from 'vitest'

import { machine } from 'totorobot'

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

	describe('immediate transitions', () => {
		test('an immediate row fires on entry with no vocabulary declared', () => {
			const untyped = machine({
				initial: 'draft',
				transitions: {
					'draft -submit> checking': () => ({ via: 'submit' }),
					'checking -> settled': () => ({ via: 'immediate' }),
				},
			})

			const host = untyped.start()
			host.send('submit')

			expect(host.current).toEqual({
				state: 'settled',
				data: { via: 'immediate' },
			})
			expect(host.available).toEqual([])
		})
	})

	describe('an unlabelled arrow in the transitions table (#7)', () => {
		test('available reports only the labelled input name, not the empty string', () => {
			const untyped = machine({
				initial: 'draft',
				transitions: {
					'draft -submit> published': () => ({ via: 'submit' }),
					'draft -> published': () => ({ via: 'unlabelled arrow' }),
				},
			})

			const host = untyped.start()

			expect(host.available).toEqual(['submit'])
		})

		test("send('') changes nothing and fires no listener", () => {
			const untyped = machine({
				initial: 'draft',
				transitions: {
					'draft -submit> published': () => ({ via: 'submit' }),
					'draft -> published': () => ({ via: 'unlabelled arrow' }),
				},
			})

			const host = untyped.start()
			const before = host.current
			const log = []
			host.on('* -> *', () => log.push('fired'))

			host.send('')

			expect(host.current).toEqual(before)
			expect(log).toEqual([])
		})

		test('a key too malformed to carry a label still lands where it lands today', () => {
			// A bare key parses with an *absent* label (`undefined`), not an empty
			// one — it must not be swept in with the unlabelled-arrow rows above.
			// Today it lands under the literal input name `'undefined'`, which is
			// what this pins down: a fix that splits on falsy rather than on
			// exactly `''` would instead make it disappear from `available`.
			const untyped = machine({
				initial: 'off',
				transitions: {
					'off -toggle> on': () => {},
					off: () => {},
				},
			})

			const host = untyped.start()

			expect(host.available).toEqual(['toggle', 'undefined'])
		})
	})
})
