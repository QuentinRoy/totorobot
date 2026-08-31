/**
 * Plain JavaScript, deliberately no `@ts-check` — the runtime half of the
 * untyped path (item 21) needs a caller the type checker never sees.
 */

import { describe, expect, test, vi } from 'vitest'

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
		const log = vi.fn()
		host.observe('* -> *', (e) => log(`${e.from.name}->${e.to.name}`))

		expect(host.current).toEqual({ name: 'off' })

		host.send('toggle')
		expect(host.current).toEqual({ name: 'on' })

		host.send('toggle')
		expect(host.current).toEqual({ name: 'off' })

		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'off->on')
		expect(log).toHaveBeenNthCalledWith(2, 'on->off')
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
		const observer = vi.fn()
		host.observe('* -> *', observer)

		host.send('bogus')

		expect(host.current).toEqual({ name: 'off' })
		expect(observer).not.toHaveBeenCalled()
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
		const observer = vi.fn()

		expect(() => host.observe('bogus -> *', observer)).not.toThrow()

		host.send('toggle')

		expect(observer).not.toHaveBeenCalled()
	})

	describe('immediate transitions', () => {
		test('an immediate row fires on entry with no vocabulary declared, and its handler receives input as undefined', () => {
			const immediate = vi.fn()
			const untyped = machine({
				initial: 'draft',
				transitions: {
					'draft -submit> checking': () => ({ via: 'submit' }),
					'checking -> settled': ({ inputData }) => {
						immediate(inputData)
						return { via: 'immediate' }
					},
				},
			})

			const host = untyped.start()
			host.send('submit')

			expect(host.current).toEqual({
				name: 'settled',
				via: 'immediate',
			})
			expect(immediate).toHaveBeenCalledExactlyOnceWith(undefined)
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
			const observer = vi.fn()
			host.observe('* -> *', observer)

			host.send('')

			expect(host.current).toEqual(before)
			expect(observer).not.toHaveBeenCalled()
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

		// `.observe()` reads a bare key as residency on that state (#76): 'a' and
		// 'a-x>b' have no recognisable arrow either, so both are legal here even
		// though neither is a legal `transitions` key.
		const observeShapes = shapes.map(([pattern, legal]) =>
			pattern === 'a' || pattern === 'a-x>b'
				? [pattern, true]
				: [pattern, legal],
		)

		test.each([
			...observeShapes,
			// `*` stays legal in a pattern's state positions, unlike in a key.
			['* -> *', true],
			['* -go> b', true],
			['a -> *', true],
		])('.observe(): %s', (pattern, legal) => {
			const host = machine({
				initial: 'a',
				transitions: { 'a -x> b': () => {} },
			}).start()
			const subscribe = () => host.observe(pattern, () => {})

			if (legal) {
				expect(subscribe).not.toThrow()
			} else {
				expect(subscribe).toThrow(SyntaxError)
				expect(subscribe).toThrow(`not a transition: '${pattern}'`)
			}
		})
	})
})
