import { describe, expect, test } from 'vitest'

import { machine, type } from 'totorobot'
import { chain, editor, gate, pending } from './fixtures.ts'

describe('sending', () => {
	test('a handled input commits, and every listener whose pattern matches fires', () => {
		const host = editor.start()
		const broad: string[] = []
		const narrow: string[] = []
		host.observe('* -> *', () => broad.push('broad'))
		host.observe('idle -open> draft', () => narrow.push('narrow'))

		host.send({ type: 'open', text: 'hello' })

		expect(host.current).toEqual({
			name: 'draft',
			text: 'hello',
			revision: 0,
		})
		expect(broad).toEqual(['broad'])
		expect(narrow).toEqual(['narrow'])
	})

	test('an input no row matches changes nothing and fires no listener', () => {
		const host = editor.start()
		const before = host.current
		const log: string[] = []
		host.observe('* -> *', () => log.push('fired'))

		// 'idle' has no row for 'lock'.
		host.send({ type: 'lock' })

		expect(host.current).toEqual(before)
		expect(log).toEqual([])
	})

	// Deliberately mirrors the no-match test above: the all-decline case must be
	// externally indistinguishable from it.
	test('an input whose every candidate row declines changes nothing and fires no listener', () => {
		const host = editor.start()
		host.send({ type: 'open', text: 'hello' })
		const before = host.current
		const log: string[] = []
		host.observe('* -> *', () => log.push('fired'))

		// 'draft -poke> draft' is the only row for 'poke', and it always declines.
		host.send({ type: 'poke' })

		expect(host.current).toEqual(before)
		expect(log).toEqual([])
	})

	test('with several rows for one source/input pair, the first that does not decline wins', () => {
		const priority = machine({
			initial: 'start',
			inputs: type<{ type: 'go' }>(),
			states: type<
				{ name: 'start' } | { name: 'first' } | { name: 'second' }
			>(),
			transitions: {
				// Neither row ever declines, so declaration order alone decides —
				// 'second' is unreachable.
				'start -go> first': () => {},
				'start -go> second': () => {},
			},
		})

		const host = priority.start()
		host.send({ type: 'go' })

		expect(host.current).toEqual({ name: 'first' })
	})

	test('a guarded row that declines falls through to the next row for the same input', () => {
		const host = editor.start()
		host.send({ type: 'open', text: 'hello' })

		// 'draft -submit> review' is declared first and declines because the
		// route is not 'review', so 'draft -submit> published' commits instead.
		host.send({ type: 'submit', route: 'publish' })

		expect(host.current).toEqual({
			name: 'published',
			text: 'hello',
			revision: 0,
		})
	})

	test('a self-transition commits and notifies with the same state on both ends', () => {
		const host = editor.start()
		host.send({ type: 'open', text: 'hello' })

		let event: unknown
		host.observe('draft -revise> draft', (e) => {
			event = e
		})

		host.send({ type: 'revise', text: 'goodbye' })

		expect(event).toEqual({
			input: { type: 'revise', text: 'goodbye' },
			from: { name: 'draft', text: 'hello', revision: 0 },
			to: { name: 'draft', text: 'goodbye', revision: 1 },
			send: expect.any(Function),
		})
		expect(host.current).toEqual({
			name: 'draft',
			text: 'goodbye',
			revision: 1,
		})
	})

	test('a handler receives the source state and the input; a payload-free input carries only its tag', () => {
		const received: unknown[] = []
		const probe = machine({
			initial: 'ready',
			inputs: type<{ type: 'act'; n: number } | { type: 'ping' }>(),
			states: type<{ name: 'ready'; count: number }>(),
			transitions: {
				'ready -act> ready': ({ state, input }) => {
					received.push([state, input])
					return { count: state.count + input.n }
				},
				'ready -ping> ready': ({ state, input }) => {
					received.push([state, input])
					return { ...state }
				},
			},
		})

		const host = probe.start({ count: 1 })
		host.send({ type: 'act', n: 2 })
		host.send({ type: 'ping' })

		expect(received).toEqual([
			[
				{ name: 'ready', count: 1 },
				{ type: 'act', n: 2 },
			],
			[{ name: 'ready', count: 3 }, { type: 'ping' }],
		])
	})

	test('a handler whose target carries no payload returns nothing', () => {
		const host = editor.start()
		host.send({ type: 'open', text: 'hello' })

		host.send({ type: 'lock' })

		expect(host.current).toEqual({ name: 'locked' })
	})

	test('a handler whose target carries no payload may also return {}', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ type: 'go' }>(),
			states: type<{ name: 'a' } | { name: 'b' }>(),
			transitions: {
				'a -go> b': () => ({}),
			},
		})

		const host = relay.start()
		host.send({ type: 'go' })

		expect(host.current).toEqual({ name: 'b' })
	})

	test('send returns undefined, always', () => {
		const host = editor.start()

		expect(host.send({ type: 'open', text: 'hello' })).toBeUndefined() // handled
		expect(host.send({ type: 'poke' })).toBeUndefined() // every candidate row declines
		expect(host.send({ type: 'lock' })).toBeUndefined() // handled
		expect(host.send({ type: 'open', text: 'again' })).toBeUndefined() // no row matches
	})

	describe('immediate transitions', () => {
		test('entering a state by an input runs its immediate row and lands in its target', () => {
			const relay = machine({
				initial: 'draft',
				inputs: type<{ type: 'submit' }>(),
				states: type<
					| { name: 'draft' }
					| { name: 'checking' }
					| { name: 'settled'; via: string }
				>(),
				transitions: {
					'draft -submit> checking': () => {},
					'checking -> settled': () => ({ via: 'immediate' }),
				},
			})

			const host = relay.start()
			host.send({ type: 'submit' })

			expect(host.current).toEqual({
				name: 'settled',
				via: 'immediate',
			})
		})

		test('several immediate rows for one state are tried in declaration order, and skip() falls through', () => {
			const allowed = gate.start()
			allowed.send({ type: 'submit', quota: 3 })
			expect(allowed.current).toEqual({
				name: 'allowed',
				quota: 3,
			})

			const denied = gate.start()
			denied.send({ type: 'submit', quota: 0 })
			expect(denied.current).toEqual({ name: 'denied', quota: 0 })
		})

		test('an immediate row receives input as undefined, not the input that entered the state', () => {
			const received: unknown[] = []
			const relay = machine({
				initial: 'draft',
				inputs: type<{ type: 'submit' }>(),
				states: type<
					{ name: 'draft' } | { name: 'checking' } | { name: 'settled' }
				>(),
				transitions: {
					'draft -submit> checking': () => {},
					'checking -> settled': ({ input }) => {
						received.push(input)
					},
				},
			})

			const host = relay.start()
			host.send({ type: 'submit' })

			expect(received).toEqual([undefined])
		})

		test('a state whose immediate rows all skip stays put, its input rows still live', () => {
			const host = pending.start()
			host.send({ type: 'submit', quota: 0 })

			expect(host.current).toEqual({ name: 'checking', quota: 0 })

			// the immediate row skipping does not disable 'checking's ordinary
			// input rows — 'cancel' still fires from here.
			host.send({ type: 'cancel' })
			expect(host.current).toEqual({ name: 'draft' })
		})

		test('a chain of several immediate hops settles fully before send returns', () => {
			const host = chain.start()
			host.send({ type: 'go' })

			expect(host.current).toEqual({ name: 'd' })
		})
	})

	// State and input names are arbitrary strings, so a name may contain whatever
	// character the index joins a `from`/`input` pair with. Joining them naively
	// files the immediate row of the state `a\0b` and the labelled row `a -b>`
	// under one key, and the immediate — declared first — answers the send.
	test('a state name that spells out a from/input pair does not shadow the labelled row', () => {
		const ran: string[] = []
		const collide = machine({
			initial: 'a',
			inputs: type<{ type: 'b' }>(),
			states: type<
				{ name: 'a' } | { name: 'a\0b' } | { name: 'bad' } | { name: 'good' }
			>(),
			transitions: {
				'a\0b -> bad': () => {
					ran.push('bad')
				},
				'a -b> good': () => {
					ran.push('good')
				},
			},
		})

		const host = collide.start()
		host.send({ type: 'b' })

		expect(ran).toEqual(['good'])
		expect(host.current).toEqual({ name: 'good' })
	})

	// The same hazard between two labelled rows, which uniform joining alone does
	// not fix: `'a\0b' -c>` and `a -b\0c>` join to one key from either side.
	test('two labelled rows whose from/input pairs join alike stay apart', () => {
		const collide = machine({
			initial: 'a',
			inputs: type<{ type: 'c' } | { type: 'b\0c' }>(),
			states: type<
				{ name: 'a' } | { name: 'a\0b' } | { name: 'bad' } | { name: 'good' }
			>(),
			transitions: {
				'a\0b -c> bad': () => {},
				'a -b\0c> good': () => {},
			},
		})

		const host = collide.start()
		host.send({ type: 'b\0c' })

		expect(host.current).toEqual({ name: 'good' })
	})

	test('send returns undefined when it was queued, too', () => {
		const host = editor.start()

		let queued: unknown = 'unset'
		const off = host.observe('idle -> draft', () => {
			// A send from inside a listener is queued rather than run nested;
			// it still returns nothing to its caller.
			queued = host.send({ type: 'touch' })
		})

		host.send({ type: 'open', text: 'hello' })
		off()

		expect(queued).toBeUndefined()
	})
})
