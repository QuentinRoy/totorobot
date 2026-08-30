import { describe, expect, test } from 'vitest'

import { machine, type } from 'totorobot'
import { activity, activityLog, chain } from './fixtures.ts'
import { residency } from './helpers.ts'

describe('actions', () => {
	test('a bare-key trigger runs its action on entry to that state', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: () => {
					log.push('setup')
				},
			},
		}).start()

		expect(log).toEqual([])
		doc.send({ type: 'toggle' })
		expect(log).toEqual(['setup'])
	})

	test("a bare-key trigger's returned teardown runs on exit from that state", () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: () => {
					log.push('setup')
					return () => log.push('teardown')
				},
			},
		}).start()

		doc.send({ type: 'toggle' }) // off -> on: setup
		expect(log).toEqual(['setup'])
		doc.send({ type: 'toggle' }) // on -> off: teardown
		expect(log).toEqual(['setup', 'teardown'])
	})

	test('an action with no returned teardown is fine: exiting the state calls nothing', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: () => {
					log.push('setup')
				},
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(() => doc.send({ type: 'toggle' })).not.toThrow()
		expect(log).toEqual(['setup'])
	})

	test('a self-transition tears down and sets up again: restart falls out of matching both directions', () => {
		const log: string[] = []
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ type: 'ping' }>(),
			states: type<{ name: 'idle' }>(),
			transitions: {
				'idle -ping> idle': () => {},
			},
			actions: {
				idle: () => {
					log.push('setup')
					return () => log.push('teardown')
				},
			},
		})

		const doc = pinger.start()
		expect(log).toEqual(['setup'])
		doc.send({ type: 'ping' })
		expect(log).toEqual(['setup', 'teardown', 'setup'])
	})

	test('a key containing -> is an edge: it fires once per matching transition', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				'off -toggle> on': () => {
					log.push('fired')
				},
			},
		}).start()

		doc.send({ type: 'toggle' }) // off -> on: matches
		doc.send({ type: 'toggle' }) // on -> off: does not match
		doc.send({ type: 'toggle' }) // off -> on: matches again
		expect(log).toEqual(['fired', 'fired'])
	})

	test('an edge trigger is drawn from the same pattern language observe uses: a wildcard matches', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'a',
			inputs: type<{ type: 'x' } | { type: 'y' }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -x> b': () => {},
				'a -y> c': () => {},
			},
			actions: {
				'a -> *': () => {
					log.push('left a')
				},
			},
		}).start()

		doc.send({ type: 'x' })
		expect(log).toEqual(['left a'])
	})

	test('an exact edge trigger and a wildcard edge trigger both matching one transition both fire, in declaration order', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				'* -> on': () => {
					log.push('wildcard')
				},
				'off -toggle> on': () => {
					log.push('exact')
				},
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(log).toEqual(['wildcard', 'exact'])
	})

	test('a residency bag carries the resident state, tag included, and send', () => {
		let seenState: unknown
		let seenSend: unknown
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				on: ({ state, send }) => {
					seenState = state
					seenSend = send
				},
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(seenState).toEqual({ name: 'on' })
		expect(seenSend).toBe(doc.send)
	})

	test('an edge bag carries the transition and send', () => {
		let seenTransition: unknown
		let seenSend: unknown
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				'off -toggle> on': ({ transition, send }) => {
					seenTransition = transition
					seenSend = send
				},
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(seenTransition).toEqual({
			input: { type: 'toggle' },
			from: { name: 'off' },
			to: { name: 'on' },
			send: expect.any(Function),
		})
		expect((seenTransition as { send: unknown }).send).toBe(doc.send)
		expect(seenSend).toBe(doc.send)
	})

	test('residency runs on every hop of an immediate chain, including a state entered and left within one drain', () => {
		activityLog.length = 0
		const doc = activity.start()

		doc.send({ type: 'go' }) // a -go> b (setup), b -> c (teardown), c -> d
		expect(activityLog).toEqual(['setup', 'teardown'])
		expect(doc.current).toEqual({ name: 'd' })
	})

	test('a declared residency produces the same log as the residency recipe documented in the README', () => {
		const recipeLog: string[] = []
		const recipeHost = chain.start()
		residency(recipeHost, 'b', () => {
			recipeLog.push('setup')
			return () => recipeLog.push('teardown')
		})
		recipeHost.send({ type: 'go' })

		activityLog.length = 0
		activity.start().send({ type: 'go' })

		expect(activityLog).toEqual(recipeLog)
	})

	test('per commit: teardown of the residency being left, then the commit, then the actions in declaration order, then listeners', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				off: () => () => log.push('teardown off'),
				'off -toggle> on': () => {
					log.push('edge action')
				},
				on: () => {
					log.push('setup on')
				},
			},
		}).start()

		doc.observe('* -> *', () => log.push('listener'))
		doc.send({ type: 'toggle' })

		expect(log).toEqual(['teardown off', 'edge action', 'setup on', 'listener'])
	})

	test('an action that throws propagates, abandoning the rest of that commit: what committed stays committed, and the host is usable afterwards', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				'off -toggle> on': () => {
					throw new Error('boom')
				},
				on: () => {
					log.push('setup on') // declared after the throwing edge: must never run
				},
			},
		}).start()

		doc.observe('* -> *', () => log.push('listener')) // must never run either

		expect(() => doc.send({ type: 'toggle' })).toThrow('boom')
		expect(doc.current).toEqual({ name: 'on' }) // the transition itself stays committed
		expect(log).toEqual([])

		// the host is usable afterwards
		doc.send({ type: 'toggle' })
		expect(doc.current).toEqual({ name: 'off' })
	})

	test('an undeclared trigger is silently unreachable at runtime, matching the rest of the library: naming something absent is a no-op', () => {
		expect(() =>
			machine({
				initial: 'off',
				states: type<{ name: 'off' } | { name: 'on' }>(),
				transitions: { 'off -toggle> on': () => {} },
				actions: { nonexistent: () => {} } as never,
			}).start(),
		).not.toThrow()
	})
})
