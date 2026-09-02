import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { chain, editor, gate, pending } from './fixtures.ts'

describe('sending', () => {
	test('actions and observers receive the input name and unchanged reference data', () => {
		const action = vi.fn()
		const observer = vi.fn()
		const payload = new Map([['answer', 42]])
		const host = machine({
			initial: 'idle',
			transitions: { 'idle -set> ready': () => {} },
			actions: { 'idle -set> ready': action },
		}).start()
		host.observe('idle -set> ready', observer)

		host.send('set', payload)

		const facts = {
			input: 'set',
			inputData: payload,
			from: 'idle',
			fromData: undefined,
			to: 'ready',
			toData: undefined,
			send: host.send,
		}
		// An action carries `emit` beside the facts; an observer does not.
		expect(action).toHaveBeenCalledExactlyOnceWith({
			...facts,
			emit: expect.any(Function),
		})
		expect(observer).toHaveBeenCalledExactlyOnceWith(facts)
		for (const callback of [action, observer]) {
			expect(callback.mock.calls[0]![0].inputData).toBe(payload)
		}
	})

	test('sending a name passes arbitrary data separately to the handler', () => {
		for (const value of [
			42,
			() => 42,
			Symbol('value'),
			{ name: 'domain name', type: 'domain type' },
		]) {
			const handler = vi.fn(() => {})
			const host = machine({
				initial: 'idle',
				transitions: { 'idle -set> ready': handler },
			}).start()

			host.send('set', value)

			expect(host.current.name).toBe('ready')
			expect(handler).toHaveBeenCalledExactlyOnceWith({
				input: 'set',
				inputData: value,
				from: 'idle',
				fromData: undefined,
				to: 'ready',
				skip: expect.any(Function),
			})
		}
	})

	test('a returned payload is stored as supplied, whatever it is', () => {
		for (const value of [
			42,
			null,
			() => 42,
			Symbol('value'),
			new Map([['answer', 42]]),
			{ name: 'domain name', type: 'domain type' },
		]) {
			const host = machine({
				initial: 'idle',
				transitions: { 'idle -set> ready': () => value },
			}).start()

			host.send('set')

			expect(host.current.data).toBe(value)
		}
	})

	test('a handled input commits, and every observer whose pattern matches fires', () => {
		const host = editor.start()
		const broad = vi.fn()
		const narrow = vi.fn()
		host.observe('* -> *', broad)
		host.observe('idle -open> draft', narrow)

		host.send('open', { text: 'hello' })

		expect(host.current).toEqual({
			name: 'draft',
			data: { text: 'hello', revision: 0 },
		})
		expect(broad).toHaveBeenCalledOnce()
		expect(narrow).toHaveBeenCalledOnce()
	})

	test('an input no row matches changes nothing and fires no observer', () => {
		const host = editor.start()
		const before = host.current
		const observer = vi.fn()
		host.observe('* -> *', observer)

		// 'idle' has no row for 'lock'.
		host.send('lock')

		expect(host.current).toEqual(before)
		expect(observer).not.toHaveBeenCalled()
	})

	// Deliberately mirrors the no-match test above: the all-decline case must be
	// externally indistinguishable from it.
	test('an input whose every candidate row declines changes nothing and fires no observer', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })
		const before = host.current
		const observer = vi.fn()
		host.observe('* -> *', observer)

		// 'draft -poke> draft' is the only row for 'poke', and it always declines.
		host.send('poke')

		expect(host.current).toEqual(before)
		expect(observer).not.toHaveBeenCalled()
	})

	test('with several rows for one source/input pair, the first that does not decline wins', () => {
		const priority = machine({
			initial: 'start',
			inputs: type<{ go: undefined }>(),
			states: type<{ start: undefined; first: undefined; second: undefined }>(),
			transitions: {
				// Neither row ever declines, so declaration order alone decides —
				// 'second' is unreachable.
				'start -go> first': () => {},
				'start -go> second': () => {},
			},
		})

		const host = priority.start()
		host.send('go')

		expect(host.current.name).toBe('first')
	})

	test('a guarded row that declines falls through to the next row for the same input', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		// 'draft -submit> review' is declared first and declines because the
		// route is not 'review', so 'draft -submit> published' commits instead.
		host.send('submit', { route: 'publish' })

		expect(host.current).toEqual({
			name: 'published',
			data: { text: 'hello', revision: 0 },
		})
	})

	test('a self-transition commits and notifies with the same name on both ends', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		const observer = vi.fn()
		host.observe('draft -revise> draft', observer)

		host.send('revise', { text: 'goodbye' })

		expect(observer).toHaveBeenCalledExactlyOnceWith({
			input: 'revise',
			inputData: { text: 'goodbye' },
			from: 'draft',
			fromData: { text: 'hello', revision: 0 },
			to: 'draft',
			toData: { text: 'goodbye', revision: 1 },
			send: expect.any(Function),
		})
		expect(host.current).toEqual({
			name: 'draft',
			data: { text: 'goodbye', revision: 1 },
		})
	})

	test('a handler receives the source name and data, and the input name and data', () => {
		const act = vi.fn()
		const ping = vi.fn()
		const probe = machine({
			initial: 'ready',
			inputs: type<{ act: { n: number }; ping: undefined }>(),
			states: type<{ ready: { count: number } }>(),
			transitions: {
				'ready -act> ready': ({ from, fromData, input, inputData }) => {
					act(from, fromData, input, inputData)
					return { count: fromData.count + inputData.n }
				},
				'ready -ping> ready': ({ from, fromData, input, inputData }) => {
					ping(from, fromData, input, inputData)
					return fromData
				},
			},
		})

		const host = probe.start({ count: 1 })
		host.send('act', { n: 2 })
		host.send('ping')

		expect(act).toHaveBeenCalledExactlyOnceWith('ready', { count: 1 }, 'act', {
			n: 2,
		})
		expect(ping).toHaveBeenCalledExactlyOnceWith(
			'ready',
			{ count: 3 },
			'ping',
			undefined,
		)
	})

	test('a handler whose target carries no payload returns nothing, and the snapshot keeps an undefined data', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		host.send('lock')

		expect(host.current).toStrictEqual({ name: 'locked', data: undefined })
	})

	test('the row, not the return, decides the destination', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ go: undefined }>(),
			states: type<{ a: undefined; b: { name: string } }>(),
			transitions: {
				// A payload with its own `name` is ordinary domain data; it cannot
				// redirect the hop the row declares.
				'a -go> b': () => ({ name: 'c' }),
			},
		})

		const host = relay.start()
		host.send('go')

		expect(host.current).toEqual({ name: 'b', data: { name: 'c' } })
	})

	test('send returns undefined, always', () => {
		const host = editor.start()

		expect(host.send('open', { text: 'hello' })).toBeUndefined() // handled
		expect(host.send('poke')).toBeUndefined() // every candidate row declines
		expect(host.send('lock')).toBeUndefined() // handled
		expect(host.send('open', { text: 'again' })).toBeUndefined() // no row matches
	})

	describe('immediate transitions', () => {
		test('entering a state by an input runs its immediate row and lands in its target', () => {
			const relay = machine({
				initial: 'draft',
				inputs: type<{ submit: undefined }>(),
				states: type<{
					draft: undefined
					checking: undefined
					settled: { via: string }
				}>(),
				transitions: {
					'draft -submit> checking': () => {},
					'checking -> settled': () => ({ via: 'immediate' }),
				},
			})

			const host = relay.start()
			host.send('submit')

			expect(host.current).toEqual({
				name: 'settled',
				data: { via: 'immediate' },
			})
		})

		test('several immediate rows for one state are tried in declaration order, and skip() falls through', () => {
			const allowed = gate.start()
			allowed.send('submit', { quota: 3 })
			expect(allowed.current).toEqual({
				name: 'allowed',
				data: { quota: 3 },
			})

			const denied = gate.start()
			denied.send('submit', { quota: 0 })
			expect(denied.current).toEqual({ name: 'denied', data: { quota: 0 } })
		})

		test('an immediate row receives input as undefined, not the input that entered the state', () => {
			const immediate = vi.fn()
			const relay = machine({
				initial: 'draft',
				inputs: type<{ submit: undefined }>(),
				states: type<{
					draft: undefined
					checking: undefined
					settled: undefined
				}>(),
				transitions: {
					'draft -submit> checking': () => {},
					'checking -> settled': ({ input, inputData }) =>
						immediate(input, inputData),
				},
			})

			const host = relay.start()
			host.send('submit')

			expect(immediate).toHaveBeenCalledExactlyOnceWith(undefined, undefined)
		})

		test('a state whose immediate rows all skip stays put, its input rows still live', () => {
			const host = pending.start()
			host.send('submit', { quota: 0 })

			expect(host.current).toEqual({ name: 'checking', data: { quota: 0 } })

			// the immediate row skipping does not disable 'checking's ordinary
			// input rows — 'cancel' still fires from here.
			host.send('cancel')
			expect(host.current.name).toBe('draft')
		})

		test('a chain of several immediate hops settles fully before send returns', () => {
			const host = chain.start()
			host.send('go')

			expect(host.current.name).toBe('d')
		})
	})

	// Names are arbitrary strings, so a state name may spell out a `from`/`input`
	// pair joined by whatever character the index joins one with.
	test('a state name that spells out a from/input pair does not shadow the labelled row', () => {
		const bad = vi.fn()
		const good = vi.fn()
		const collide = machine({
			initial: 'a',
			inputs: type<{ b: undefined }>(),
			states: type<{
				a: undefined
				'a\0b': undefined
				bad: undefined
				good: undefined
			}>(),
			transitions: {
				'a\0b -> bad': bad,
				'a -b> good': good,
			},
		})

		const host = collide.start()
		host.send('b')

		expect(bad).not.toHaveBeenCalled()
		expect(good).toHaveBeenCalledOnce()
		expect(host.current.name).toBe('good')
	})

	// The same hazard between two labelled rows: `'a\0b' -c>` and `a -b\0c>`.
	test('two labelled rows whose from/input pairs join alike stay apart', () => {
		const collide = machine({
			initial: 'a',
			inputs: type<{ c: undefined; 'b\0c': undefined }>(),
			states: type<{
				a: undefined
				'a\0b': undefined
				bad: undefined
				good: undefined
			}>(),
			transitions: {
				'a\0b -c> bad': () => {},
				'a -b\0c> good': () => {},
			},
		})

		const host = collide.start()
		host.send('b\0c')

		expect(host.current.name).toBe('good')
	})

	test('send returns undefined when it was queued, too', () => {
		const host = editor.start()

		const queued = vi.fn()
		const off = host.observe('idle -> draft', () => {
			// A send from inside an observer is queued rather than run nested;
			// it still returns nothing to its caller.
			queued(host.send('touch'))
		})

		host.send('open', { text: 'hello' })
		off()

		expect(queued).toHaveBeenCalledExactlyOnceWith(undefined)
	})
})
