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

	test('`restart: false` survives a self-transition: no teardown, no second setup', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'idle',
			inputs: type<{ type: 'ping' }>(),
			states: type<{ name: 'idle' }>(),
			transitions: { 'idle -ping> idle': () => {} },
			actions: {
				idle: {
					run: () => {
						log.push('setup')
						return () => log.push('teardown')
					},
					restart: false,
				},
			},
		}).start()

		expect(log).toEqual(['setup'])
		doc.send({ type: 'ping' })
		doc.send({ type: 'ping' })
		expect(log).toEqual(['setup'])
	})

	test('`restart: false` still tears down on a genuine departure to a different state: the policy only governs self-transitions', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'ping' } | { type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -ping> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: {
					run: () => {
						log.push('setup')
						return () => log.push('teardown')
					},
					restart: false,
				},
			},
		}).start()

		doc.send({ type: 'toggle' }) // off -> on: setup
		doc.send({ type: 'ping' }) // on -> on: restart: false, survives
		expect(log).toEqual(['setup'])
		doc.send({ type: 'toggle' }) // on -> off: always tears down
		expect(log).toEqual(['setup', 'teardown'])
	})

	test('a `restart` predicate decides case by case from the resident data either side of the self-transition', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'idle',
			inputs: type<{ type: 'set'; id: number }>(),
			states: type<{ name: 'idle'; id: number }>(),
			transitions: { 'idle -set> idle': ({ input }) => ({ id: input.id }) },
			actions: {
				idle: {
					run: ({ to }) => {
						log.push(`setup:${to.id}`)
						return () => log.push('teardown')
					},
					restart: (from, to) => from.id !== to.id,
				},
			},
		}).start({ id: 0 })

		expect(log).toEqual(['setup:0'])
		doc.send({ type: 'set', id: 0 }) // same id: survives
		expect(log).toEqual(['setup:0'])
		doc.send({ type: 'set', id: 1 }) // different id: restarts
		expect(log).toEqual(['setup:0', 'teardown', 'setup:1'])
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

	test('startup invokes no edge action, whichever pattern shape declares it: wildcard source, wildcard target, fully wildcard, pinned', () => {
		const log: string[] = []
		machine({
			initial: 'a',
			inputs: type<{ type: 'x' }>(),
			states: type<{ name: 'a' } | { name: 'b' }>(),
			transitions: { 'a -x> b': () => {} },
			actions: {
				'* -> a': () => {
					log.push('wildcard source')
				},
				'a -> *': () => {
					log.push('wildcard target')
				},
				'* -> *': () => {
					log.push('fully wildcard')
				},
				'b -> a': () => {
					log.push('pinned')
				},
			},
		}).start()

		expect(log).toEqual([])
	})

	test('a residency action receives the arrival that entered its state, the same record shape an edge action and a listener get, with `to` the resident state', () => {
		let seenArrival: unknown
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				on: (arrival) => {
					seenArrival = arrival
				},
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(seenArrival).toEqual({
			input: { type: 'toggle' },
			from: { name: 'off' },
			to: { name: 'on' },
			send: expect.any(Function),
		})
		expect((seenArrival as { send: unknown }).send).toBe(doc.send)
	})

	test('residency on the initial state receives the one arrival with no transition behind it: from and input are undefined', () => {
		let seenArrival: unknown
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				off: (arrival) => {
					seenArrival = arrival
				},
			},
		}).start()

		expect(seenArrival).toEqual({
			input: undefined,
			from: undefined,
			to: { name: 'off' },
			send: expect.any(Function),
		})
		expect((seenArrival as { send: unknown }).send).toBe(doc.send)
	})

	test("an edge action's argument is the transition it fired on, identical to what a matching listener receives", () => {
		let seenTransition: unknown
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				'off -toggle> on': (transition) => {
					seenTransition = transition
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
	})

	test('an initial immediate chain still emits each real transition separately, with a defined source, after the initial residency has run', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'a',
			states: type<{ name: 'a' } | { name: 'b' }>(),
			transitions: { 'a -> b': () => {} },
			actions: {
				a: () => {
					log.push('residency a')
				},
				'a -> b': ({ from }) => {
					log.push(`edge a -> b, from ${from.name}`)
				},
				b: () => {
					log.push('residency b')
				},
			},
		}).start()

		expect(log).toEqual(['residency a', 'edge a -> b, from a', 'residency b'])
		expect(doc.current).toEqual({ name: 'b' })
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

	test('an array of actions on one trigger sets up in declaration order and tears down in reverse', () => {
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
				on: [
					() => {
						log.push('setup 1')
						return () => log.push('teardown 1')
					},
					() => {
						log.push('setup 2')
						return () => log.push('teardown 2')
					},
				],
			},
		}).start()

		doc.send({ type: 'toggle' }) // off -> on
		expect(log).toEqual(['setup 1', 'setup 2'])
		doc.send({ type: 'toggle' }) // on -> off
		expect(log).toEqual(['setup 1', 'setup 2', 'teardown 2', 'teardown 1'])
	})

	test('an array of actions on an edge trigger all fire, in declaration order', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: { 'off -toggle> on': () => {} },
			actions: {
				'off -toggle> on': [
					() => void log.push('fired 1'),
					{ run: () => void log.push('fired 2') },
				],
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(log).toEqual(['fired 1', 'fired 2'])
	})

	test('two residents of one state can hold opposite restart policies: one survives a self-transition, the other restarts', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'on',
			inputs: type<{ type: 'ping' }>(),
			states: type<{ name: 'on' }>(),
			transitions: { 'on -ping> on': () => {} },
			actions: {
				on: [
					{
						run: () => {
							log.push('persistent:setup')
							return () => log.push('persistent:teardown')
						},
						restart: false,
					},
					() => {
						log.push('restarting:setup')
						return () => log.push('restarting:teardown')
					},
				],
			},
		}).start()

		expect(log).toEqual(['persistent:setup', 'restarting:setup'])
		doc.send({ type: 'ping' })
		expect(log).toEqual([
			'persistent:setup',
			'restarting:setup',
			'restarting:teardown',
			'restarting:setup',
		])
	})

	test('a throwing teardown, among several actions on one trigger, leaves the later ones (earlier in declaration order) unrun', () => {
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
				on: [
					() => () => log.push('teardown 1'),
					() => () => {
						throw new Error('boom')
					},
				],
			},
		}).start()

		doc.send({ type: 'toggle' }) // off -> on

		expect(() => doc.send({ type: 'toggle' })).toThrow('boom')
		expect(log).toEqual([]) // teardown 2 threw before teardown 1 (reverse order) ran
	})

	test('a record with `run` behaves the same as a bare function, for a residency and an edge alike', () => {
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
				on: { run: () => void log.push('setup') },
				'off -toggle> on': { run: () => void log.push('edge') },
			},
		}).start()

		doc.send({ type: 'toggle' })
		expect(log).toEqual(['setup', 'edge'])
	})

	test('an item that is callable *and* carries `run` runs its `run`, deliberately: the record shape wins over the callable', () => {
		const log: string[] = []
		// Both item shapes in one value. `run` wins by decision, not by accident:
		// this is a record that happens to be callable, not the reverse.
		const both = Object.assign(() => void log.push('callable'), {
			run: () => void log.push('run'),
		})

		const doc = machine({
			initial: 'off',
			inputs: type<{ type: 'toggle' }>(),
			states: type<{ name: 'off' } | { name: 'on' }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: { on: both, 'off -toggle> on': both },
		}).start()

		doc.send({ type: 'toggle' })
		expect(log).toEqual(['run', 'run'])
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

	test('a send from an action is queued like any other: the chain settles before the input lands, and the action is not re-entered', () => {
		const log: string[] = []
		const doc = machine({
			initial: 'a',
			inputs: type<{ type: 'go' } | { type: 'next' }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -go> b': () => {},
				'b -next> c': () => {},
			},
			actions: {
				b: ({ send }) => {
					log.push('b setup')
					send({ type: 'next' })
					log.push('b setup returns')
					return () => log.push('b teardown')
				},
				c: () => {
					log.push('c setup')
				},
			},
		}).start()
		doc.observe('* -> *', (e) => log.push(`listener: -> ${e.to.name}`))

		doc.send({ type: 'go' })

		expect(log).toEqual([
			'b setup',
			'b setup returns',
			'listener: -> b',
			'b teardown',
			'c setup',
			'listener: -> c',
		])
		expect(doc.current).toEqual({ name: 'c' })
	})
})
