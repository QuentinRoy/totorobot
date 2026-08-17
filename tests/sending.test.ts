import { describe, expect, test } from 'vitest'

import { machine, types } from '../src/totorobot.ts'
import { editor, toggle } from './fixtures.ts'

describe('sending', () => {
	test('[8] a handled input commits, and every listener whose pattern matches fires', () => {
		const host = editor.start()
		const broad: string[] = []
		const narrow: string[] = []
		host.on('* -> *', () => broad.push('broad'))
		host.on('idle -open> draft', () => narrow.push('narrow'))

		host.send('open', { text: 'hello' })

		expect(host.current).toEqual({
			state: 'draft',
			data: { text: 'hello', revision: 0 },
		})
		expect(broad).toEqual(['broad'])
		expect(narrow).toEqual(['narrow'])
	})

	test('[9] an input no row matches changes nothing and fires no listener', () => {
		const host = editor.start()
		const before = host.current
		const log: string[] = []
		host.on('* -> *', () => log.push('fired'))

		// 'idle' has no row for 'lock'.
		host.send('lock')

		expect(host.current).toEqual(before)
		expect(log).toEqual([])
	})

	// Deliberately mirrors [9]: the all-decline case must be externally
	// indistinguishable from the no-match case.
	test('[10] an input whose every candidate row declines changes nothing and fires no listener', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })
		const before = host.current
		const log: string[] = []
		host.on('* -> *', () => log.push('fired'))

		// 'draft -poke> draft' is the only row for 'poke', and it always declines.
		host.send('poke')

		expect(host.current).toEqual(before)
		expect(log).toEqual([])
	})

	test('[11] with several rows for one source/input pair, the first that does not decline wins', () => {
		const priority = machine({
			initial: 'start',
			inputs: types<{ go: void }>(),
			states: types<{ start: void; first: void; second: void }>(),
			transitions: {
				// Neither row ever declines, so declaration order alone decides —
				// 'second' is unreachable.
				'start -go> first': () => {},
				'start -go> second': () => {},
			},
		})

		const host = priority.start()
		host.send('go')

		expect(host.current).toEqual({ state: 'first', data: undefined })
	})

	test('[11] a guarded row that declines falls through to the next row for the same input', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		// 'draft -submit> review' is declared first and declines because the
		// route is not 'review', so 'draft -submit> published' commits instead.
		host.send('submit', { route: 'publish' })

		expect(host.current).toEqual({
			state: 'published',
			data: { text: 'hello', revision: 0 },
		})
	})

	test('[12] a self-transition commits and notifies with the same state on both ends', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		let event: unknown
		host.on('draft -revise> draft', (e) => {
			event = e
		})

		host.send('revise', { text: 'goodbye' })

		expect(event).toEqual({
			on: 'revise',
			input: { text: 'goodbye' },
			from: { state: 'draft', data: { text: 'hello', revision: 0 } },
			to: { state: 'draft', data: { text: 'goodbye', revision: 1 } },
		})
		expect(host.current).toEqual({
			state: 'draft',
			data: { text: 'goodbye', revision: 1 },
		})
	})

	test("[13] a handler receives the source state's data and the input payload; a void input's payload is undefined", () => {
		const received: unknown[] = []
		const probe = machine({
			initial: 'ready',
			inputs: types<{ act: { n: number }; ping: void }>(),
			states: types<{ ready: { count: number } }>(),
			transitions: {
				'ready -act> ready': ({ data, input }) => {
					received.push([data, input])
					return { count: data.count + input.n }
				},
				'ready -ping> ready': ({ data, input }) => {
					received.push([data, input])
					return data
				},
			},
		})

		const host = probe.start({ count: 1 })
		host.send('act', { n: 2 })
		host.send('ping')

		expect(received).toEqual([
			[{ count: 1 }, { n: 2 }],
			[{ count: 3 }, undefined],
		])
	})

	test('[14] a handler whose target is void returns nothing', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		host.send('lock')

		expect(host.current).toEqual({ state: 'locked', data: undefined })
	})

	test('[15] send returns undefined, always', () => {
		const host = editor.start()

		expect(host.send('open', { text: 'hello' })).toBeUndefined() // handled
		expect(host.send('poke')).toBeUndefined() // every candidate row declines
		expect(host.send('lock')).toBeUndefined() // handled
		expect(host.send('open', { text: 'again' })).toBeUndefined() // no row matches
	})

	test('[16] an input name outside the declared vocabulary, reached from typed code via an explicit cast, changes nothing', () => {
		const host = toggle.start()
		const before = host.current

		host.send('bogus' as never)

		expect(host.current).toEqual(before)
	})
})
