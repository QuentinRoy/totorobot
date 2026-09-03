/**
 * `*` as a transitions row's own source (#142): one row firing from every
 * declared state, declaration order among concrete and wildcard rows alike,
 * the opt-out by `skip()`, and how the rest of the host — observation,
 * actions, residency — sees a hop the row created.
 */

import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'

type Inputs = { up: undefined; go: undefined }
type States = {
	startup: { deps: string[] }
	expert: { deps: string[] }
	novice: { deps: string[] }
	idle: { deps: string[] }
}

function navigation() {
	return machine({
		initial: 'startup',
		inputs: type<Inputs>(),
		states: type<States>(),
		transitions: {
			'* -up> idle': ({ from, fromData, skip }) =>
				from === 'idle' ? skip() : { deps: fromData.deps },
		},
	})
}

describe('wildcard sources', () => {
	test('one wildcard-sourced row fires the same edge from every declared state', () => {
		for (const from of ['startup', 'expert', 'novice'] as const) {
			const doc = navigation().start({ deps: [from] })
			doc.send('up')
			expect(doc.current).toEqual({ name: 'idle', data: { deps: [from] } })
		}
	})

	test('a wildcard row covers its own target too, and `skip()` is how it opts out there', () => {
		const doc = navigation().start({ deps: [] })
		doc.send('up')
		expect(doc.current.name).toBe('idle')

		// Declines for 'idle', so the machine does not move and does not throw.
		doc.send('up')
		expect(doc.current.name).toBe('idle')
	})

	test('a concrete row declared before a wildcard row for the same input wins, in declaration order', () => {
		const doc = machine({
			initial: 'startup',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				'startup -up> expert': () => ({ deps: ['special-cased'] }),
				'* -up> idle': ({ fromData }) => fromData,
			},
		}).start({ deps: [] })

		doc.send('up')
		expect(doc.current).toEqual({
			name: 'expert',
			data: { deps: ['special-cased'] },
		})
	})

	test('a wildcard row declared before a concrete row for the same input still lets the concrete one run if the wildcard declines', () => {
		const doc = machine({
			initial: 'startup',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				'* -up> idle': ({ from, skip }) =>
					from === 'startup' ? skip() : { deps: [] },
				'startup -up> expert': ({ fromData }) => fromData,
			},
		}).start({ deps: ['carried'] })

		doc.send('up')
		expect(doc.current).toEqual({
			name: 'expert',
			data: { deps: ['carried'] },
		})
	})

	test('an observer sees the real source the machine left, correlated with its own payload — never the wildcard token', () => {
		const doc = navigation().start({ deps: ['x'] })
		const observed = vi.fn()
		doc.observe('* -up> idle', observed)

		doc.send('up')

		expect(observed).toHaveBeenCalledExactlyOnceWith({
			input: 'up',
			inputData: undefined,
			from: 'startup',
			fromData: { deps: ['x'] },
			to: 'idle',
			toData: { deps: ['x'] },
			send: expect.any(Function),
		})
	})

	test('a pattern naming a concrete source is admitted by a wildcard row: the table and the pattern language agree on what exists', () => {
		// Only 'startup -up> idle' fires here. Observing that exact edge by its
		// own concrete pattern works even though no row spells it that way —
		// only the wildcard row does.
		const notObserved = vi.fn()
		const observed = vi.fn()
		const doc = navigation().start({ deps: [] })
		doc.observe('expert -up> idle', notObserved)
		doc.observe('startup -up> idle', observed)

		doc.send('up')

		expect(notObserved).not.toHaveBeenCalled()
		expect(observed).toHaveBeenCalledOnce()
	})

	test('an edge action declared on a concrete edge fires when a wildcard row creates that hop', () => {
		const onArrival = vi.fn()
		const doc = machine({
			initial: 'expert',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				'* -up> idle': ({ fromData }) => fromData,
			},
			actions: {
				'expert -up> idle': onArrival,
			},
		}).start({ deps: [] })

		doc.send('up')

		expect(onArrival).toHaveBeenCalledOnce()
		expect(doc.current.name).toBe('idle')
	})

	test("a residency on the wildcard row's target tears down and sets up again on a self-transition it creates", () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'expert',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				'* -up> idle': ({ from, fromData }) =>
					from === 'idle' ? { deps: [...fromData.deps, 'again'] } : fromData,
			},
			actions: {
				idle: () => {
					log('setup')
					return () => log('teardown')
				},
			},
		}).start({ deps: [] })

		log.mockClear()
		doc.send('up') // expert -> idle: first arrival
		expect(log).toHaveBeenCalledExactlyOnceWith('setup')

		log.mockClear()
		doc.send('up') // idle -> idle: the wildcard row's own self-transition
		expect(log).toHaveBeenNthCalledWith(1, 'teardown')
		expect(log).toHaveBeenNthCalledWith(2, 'setup')
	})

	test("a restart predicate on a wildcard-created self-transition is asked once, with that hop's own facts", () => {
		const restart = vi.fn(() => true)
		const doc = machine({
			initial: 'expert',
			inputs: type<Inputs>(),
			states: type<States>(),
			transitions: {
				'* -up> idle': ({ from, fromData }) =>
					from === 'idle' ? { deps: [...fromData.deps, 'again'] } : fromData,
			},
			actions: {
				idle: { run: () => {}, restart },
			},
		}).start({ deps: [] })

		doc.send('up') // expert -> idle: arrival, restart not consulted
		expect(restart).not.toHaveBeenCalled()

		doc.send('up') // idle -> idle: the wildcard row's own self-transition
		expect(restart).toHaveBeenCalledExactlyOnceWith({
			input: 'up',
			inputData: undefined,
			from: 'idle',
			fromData: { deps: [] },
			to: 'idle',
			toData: { deps: ['again'] },
		})
	})

	describe('the unlabelled wildcard form: an immediate that applies from every state', () => {
		test('guarded on its own target, it settles', () => {
			// Declining everywhere but 'startup' guards both the row's own target
			// ('idle') and every other state the machine can reach afterwards
			// ('expert'): an unlabelled wildcard row applies to whichever state the
			// machine is in on every settle-loop pass, not only to the state it
			// first fired from.
			const doc = machine({
				initial: 'startup',
				inputs: type<Inputs>(),
				states: type<States>(),
				transitions: {
					'* -> idle': ({ from, fromData, skip }) =>
						from === 'startup' ? fromData : skip(),
					'idle -go> expert': ({ fromData }) => fromData,
				},
			}).start({ deps: ['x'] })

			expect(doc.current).toEqual({ name: 'idle', data: { deps: ['x'] } })

			// Settled, not spinning: a further input still dispatches normally.
			doc.send('go')
			expect(doc.current).toEqual({ name: 'expert', data: { deps: ['x'] } })
		})

		test('left unguarded on its own target, it never settles and throws', () => {
			expect(() =>
				machine({
					initial: 'startup',
					inputs: type<Inputs>(),
					states: type<States>(),
					transitions: {
						'* -> idle': ({ fromData }) => fromData,
					},
				}).start({ deps: [] }),
			).toThrow(RangeError)
		})
	})
})
