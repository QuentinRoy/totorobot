/**
 * Plain JavaScript, deliberately no `@ts-check` — the runtime half of the
 * untyped path (item 21) needs a caller the type checker never sees.
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
		})
	})

	describe('an unlabelled arrow in the transitions table (#7)', () => {
		test("send('') changes nothing and fires no listener", () => {
			const untyped = machine({
				initial: 'draft',
				transitions: {
					'draft -submit> published': () => ({ via: 'submit' }),
					// Guarded to skip so `.start()` settling the initial state's
					// immediates does not carry `draft` away before the test below
					// gets to observe it.
					'draft -> published': ({ skip }) => skip(),
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

		test('a bare key throws instead of quietly building a live row (#16)', () => {
			// A bare key parses with an *absent* label, not an empty one — it must
			// not be swept in with the unlabelled-arrow rows above. It used to land
			// under the literal input name `'undefined'`, reachable through
			// `send('undefined')`; now `machine()` rejects it outright.
			expect(() =>
				machine({
					initial: 'off',
					transitions: {
						'off -toggle> on': () => {},
						off: () => {},
					},
				}),
			).toThrow(SyntaxError)
		})
	})

	describe('malformed keys and patterns (#16)', () => {
		// Exhaustive over the grammar's boundary: every shape a key or pattern can
		// take, legal ones as negative controls sitting next to the illegal ones
		// they are one character away from.
		const shapes = [
			['a -x> b', true],
			['a -> b', true],
			['a', false],
			['a-x>b', false],
			['a -x>b', false],
			['a -x> ', false],
			[' -x> b', false],
			['a -x> b -y> c', false],
			['a -x>  b', true],
		]

		test.each(shapes)('machine(): %s', (key, legal) => {
			const build = () =>
				machine({ initial: 'a', transitions: { [key]: () => {} } })

			if (legal) {
				expect(build).not.toThrow()
			} else {
				expect(build).toThrow(SyntaxError)
				expect(build).toThrow(`not a transition: '${key}'`)
			}
		})

		test.each([
			...shapes,
			// `*` stays legal in a pattern's state positions, unlike in a key.
			['* -> *', true],
			['* -go> b', true],
			['a -> *', true],
		])('.on(): %s', (pattern, legal) => {
			const host = machine({
				initial: 'a',
				transitions: { 'a -x> b': () => {} },
			}).start()
			const subscribe = () => host.on(pattern, () => {})

			if (legal) {
				expect(subscribe).not.toThrow()
			} else {
				expect(subscribe).toThrow(SyntaxError)
				expect(subscribe).toThrow(`not a transition: '${pattern}'`)
			}
		})
	})
})
