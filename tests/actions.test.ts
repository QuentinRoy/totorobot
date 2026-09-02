import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { activity, chain } from './fixtures.ts'
import { residency } from './helpers.ts'

describe('actions', () => {
	test('a bare-key trigger runs its action on entry to that state', () => {
		const setup = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: setup,
			},
		}).start()

		expect(setup).not.toHaveBeenCalled()
		doc.send('toggle')
		expect(setup).toHaveBeenCalledOnce()
	})

	test("a bare-key trigger's returned teardown runs on exit from that state", () => {
		const teardown = vi.fn()
		const setup = vi.fn(() => teardown)
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: setup,
			},
		}).start()

		doc.send('toggle') // off -> on: setup
		expect(setup).toHaveBeenCalledOnce()
		expect(teardown).not.toHaveBeenCalled()
		doc.send('toggle') // on -> off: teardown
		expect(teardown).toHaveBeenCalledOnce()
	})

	test('an action with no returned teardown is fine: exiting the state calls nothing', () => {
		const setup = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: setup,
			},
		}).start()

		doc.send('toggle')
		expect(() => doc.send('toggle')).not.toThrow()
		expect(setup).toHaveBeenCalledOnce()
	})

	test('a self-transition tears down and sets up again: restart falls out of matching both directions', () => {
		const log = vi.fn()
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: {
				'idle -ping> idle': () => {},
			},
			actions: {
				idle: () => {
					log('setup')
					return () => log('teardown')
				},
			},
		})

		const doc = pinger.start()
		expect(log).toHaveBeenCalledExactlyOnceWith('setup')
		doc.send('ping')
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
		expect(log).toHaveBeenNthCalledWith(3, 'setup')
	})

	test('`restart: false` survives a self-transition: no teardown, no second setup', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: { 'idle -ping> idle': () => {} },
			actions: {
				idle: {
					run: () => {
						log('setup')
						return () => log('teardown')
					},
					restart: false,
				},
			},
		}).start()

		expect(log).toHaveBeenCalledExactlyOnceWith('setup')
		doc.send('ping')
		doc.send('ping')
		expect(log).toHaveBeenCalledExactlyOnceWith('setup')
	})

	test('`restart: false` still tears down on a genuine departure to a different state: the policy only governs self-transitions', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ ping: undefined; toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -ping> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: {
					run: () => {
						log('setup')
						return () => log('teardown')
					},
					restart: false,
				},
			},
		}).start()

		doc.send('toggle') // off -> on: setup
		doc.send('ping') // on -> on: restart: false, survives
		expect(log).toHaveBeenCalledExactlyOnceWith('setup')
		doc.send('toggle') // on -> off: always tears down
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
	})

	test('a `restart` predicate decides case by case from the resident data either side of the self-transition', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'idle',
			inputs: type<{ set: { id: number } }>(),
			states: type<{ idle: { id: number } }>(),
			transitions: {
				'idle -set> idle': ({ inputData }) => ({ id: inputData.id }),
			},
			actions: {
				idle: {
					run: ({ toData }) => {
						log(`setup:${toData.id}`)
						return () => log('teardown')
					},
					restart: ({ fromData, toData }) => fromData.id !== toData.id,
				},
			},
		}).start({ id: 0 })

		expect(log).toHaveBeenCalledExactlyOnceWith('setup:0')
		doc.send('set', { id: 0 }) // same id: survives
		expect(log).toHaveBeenCalledExactlyOnceWith('setup:0')
		doc.send('set', { id: 1 }) // different id: restarts
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'setup:0')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
		expect(log).toHaveBeenNthCalledWith(3, 'setup:1')
	})

	test('the restart predicate is handed the transition facts alone: no send, at runtime as well as in the types', () => {
		const restart = vi.fn(() => true)
		const doc = machine({
			initial: 'idle',
			inputs: type<{ set: { id: number } }>(),
			states: type<{ idle: { id: number } }>(),
			transitions: { 'idle -set> idle': ({ inputData }) => inputData },
			actions: { idle: { run: () => {}, restart } },
		}).start({ id: 0 })

		doc.send('set', { id: 1 })

		expect(restart).toHaveBeenCalledExactlyOnceWith({
			input: 'set',
			inputData: { id: 1 },
			from: 'idle',
			fromData: { id: 0 },
			to: 'idle',
			toData: { id: 1 },
		})
	})

	test('the restart predicate runs exactly once per self-transition, not once for teardown and again for setup', () => {
		const restart = vi.fn(() => true)
		const doc = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: { 'idle -ping> idle': () => {} },
			actions: {
				idle: { run: () => {}, restart }, // no teardown returned: still active for the next decision
			},
		}).start()

		doc.send('ping')
		expect(restart).toHaveBeenCalledTimes(1)
		doc.send('ping')
		doc.send('ping')
		expect(restart).toHaveBeenCalledTimes(3)
	})

	test('two residents of one state each get their own restart decision, not a shared one', () => {
		const restartA = vi.fn(() => true)
		const restartB = vi.fn(() => false)
		const doc = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: { 'idle -ping> idle': () => {} },
			actions: {
				idle: [
					{ run: () => {}, restart: restartA },
					{ run: () => {}, restart: restartB },
				],
			},
		}).start()

		doc.send('ping')
		expect(restartA).toHaveBeenCalledTimes(1)
		expect(restartB).toHaveBeenCalledTimes(1)
	})

	test('a restart predicate that throws prevents the self-transition from committing, without undoing a teardown already run earlier in the same unwind', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: { 'idle -ping> idle': () => {} },
			actions: {
				idle: [
					{
						run: () => {},
						restart: () => {
							throw new Error('boom')
						},
					},
					{ run: () => () => log('teardown'), restart: true },
				],
			},
		}).start()

		// Teardown runs in reverse declaration order, so the second action's
		// teardown completes before the first action's predicate throws.
		expect(() => doc.send('ping')).toThrow('boom')
		expect(log).toHaveBeenCalledExactlyOnceWith('teardown')
		expect(doc.current.name).toBe('idle')
	})

	test('a key containing -> is an edge: it fires once per matching transition', () => {
		const action = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				'off -toggle> on': action,
			},
		}).start()

		doc.send('toggle') // off -> on: matches
		doc.send('toggle') // on -> off: does not match
		doc.send('toggle') // off -> on: matches again
		expect(action).toHaveBeenCalledTimes(2)
	})

	test('an edge trigger is drawn from the same pattern language observe uses: a wildcard matches', () => {
		const action = vi.fn()
		const doc = machine({
			initial: 'a',
			inputs: type<{ x: undefined; y: undefined }>(),
			states: type<{ a: undefined; b: undefined; c: undefined }>(),
			transitions: {
				'a -x> b': () => {},
				'a -y> c': () => {},
			},
			actions: {
				'a -> *': action,
			},
		}).start()

		doc.send('x')
		expect(action).toHaveBeenCalledOnce()
	})

	test('an exact edge trigger and a wildcard edge trigger both matching one transition both fire, in declaration order', () => {
		const wildcard = vi.fn()
		const exact = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				'* -> on': wildcard,
				'off -toggle> on': exact,
			},
		}).start()

		doc.send('toggle')
		expect(wildcard).toHaveBeenCalledOnce()
		expect(exact).toHaveBeenCalledOnce()
		expect(wildcard).toHaveBeenCalledBefore(exact)
	})

	test('startup invokes no edge action, whichever pattern shape declares it: wildcard source, wildcard target, fully wildcard, pinned', () => {
		const wildcardSource = vi.fn()
		const wildcardTarget = vi.fn()
		const fullyWildcard = vi.fn()
		const pinned = vi.fn()
		machine({
			initial: 'a',
			inputs: type<{ x: undefined; y: undefined }>(),
			states: type<{ a: undefined; b: undefined }>(),
			// 'b -y> a' gives every pattern below a real row to match, so none is
			// rejected as statically unreachable (#100); 'y' is never sent, so it
			// stays as unfired at startup as the rest.
			transitions: { 'a -x> b': () => {}, 'b -y> a': () => {} },
			actions: {
				'* -> a': wildcardSource,
				'a -> *': wildcardTarget,
				'* -> *': fullyWildcard,
				'b -> a': pinned,
			},
		}).start()

		expect(wildcardSource).not.toHaveBeenCalled()
		expect(wildcardTarget).not.toHaveBeenCalled()
		expect(fullyWildcard).not.toHaveBeenCalled()
		expect(pinned).not.toHaveBeenCalled()
	})

	test('a residency action receives the arrival that entered its state, the same record shape an edge action gets, with `to` the resident state', () => {
		const action = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				on: action,
			},
		}).start()

		doc.send('toggle')
		expect(action).toHaveBeenCalledExactlyOnceWith({
			input: 'toggle',
			inputData: undefined,
			from: 'off',
			fromData: undefined,
			to: 'on',
			toData: undefined,
			send: expect.any(Function),
			emit: expect.any(Function),
		})
		expect(action.mock.calls[0]?.[0].send).toBe(doc.send)
	})

	test('residency on the initial state receives the one arrival with no transition behind it: from and input are undefined', () => {
		const action = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				off: action,
			},
		}).start()

		expect(action).toHaveBeenCalledExactlyOnceWith({
			input: undefined,
			inputData: undefined,
			from: undefined,
			fromData: undefined,
			to: 'off',
			toData: undefined,
			send: expect.any(Function),
			emit: expect.any(Function),
		})
		expect(action.mock.calls[0]?.[0].send).toBe(doc.send)
	})

	test("an edge action's argument is the transition it fired on, which is what a matching observer receives plus `emit`", () => {
		const action = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
			},
			actions: {
				'off -toggle> on': action,
			},
		}).start()

		doc.send('toggle')
		expect(action).toHaveBeenCalledExactlyOnceWith({
			input: 'toggle',
			inputData: undefined,
			from: 'off',
			fromData: undefined,
			to: 'on',
			toData: undefined,
			send: expect.any(Function),
			emit: expect.any(Function),
		})
		expect(action.mock.calls[0]?.[0].send).toBe(doc.send)
	})

	test('an initial immediate chain still emits each real transition separately, with a defined source, after the initial residency has run', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'a',
			states: type<{ a: undefined; b: undefined }>(),
			transitions: { 'a -> b': () => {} },
			actions: {
				a: () => {
					log('residency a')
				},
				'a -> b': ({ from }) => {
					log(`edge a -> b, from ${from}`)
				},
				b: () => {
					log('residency b')
				},
			},
		}).start()

		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'residency a')
		expect(log).toHaveBeenNthCalledWith(2, 'edge a -> b, from a')
		expect(log).toHaveBeenNthCalledWith(3, 'residency b')
		expect(doc.current.name).toBe('b')
	})

	test('residency runs on every hop of an immediate chain, including a state entered and left within one drain', () => {
		const setup = vi.fn()
		const teardown = vi.fn()
		const doc = activity(setup, teardown).start()

		doc.send('go') // a -go> b (setup), b -> c (teardown), c -> d
		expect(setup).toHaveBeenCalledOnce()
		expect(teardown).toHaveBeenCalledOnce()
		expect(setup).toHaveBeenCalledBefore(teardown)
		expect(doc.current.name).toBe('d')
	})

	test('a declared residency produces the same log as the residency recipe documented in the README', () => {
		const recipeSetup = vi.fn()
		const recipeTeardown = vi.fn()
		const recipeHost = chain.start()
		residency(recipeHost, 'b', () => {
			recipeSetup()
			return recipeTeardown
		})
		recipeHost.send('go')

		const declaredSetup = vi.fn()
		const declaredTeardown = vi.fn()
		activity(declaredSetup, declaredTeardown).start().send('go')

		expect(recipeSetup).toHaveBeenCalledOnce()
		expect(recipeTeardown).toHaveBeenCalledOnce()
		expect(recipeSetup).toHaveBeenCalledBefore(recipeTeardown)
		expect(declaredSetup).toHaveBeenCalledOnce()
		expect(declaredTeardown).toHaveBeenCalledOnce()
		expect(declaredSetup).toHaveBeenCalledBefore(declaredTeardown)
	})

	test('per commit: teardown of the residency being left, then the commit, then the actions in declaration order, then observers', () => {
		const teardown = vi.fn()
		const edgeAction = vi.fn()
		const setup = vi.fn()
		const observer = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				off: () => teardown,
				'off -toggle> on': edgeAction,
				on: setup,
			},
		}).start()

		doc.observe('* -> *', observer)
		doc.send('toggle')

		expect(teardown).toHaveBeenCalledOnce()
		expect(edgeAction).toHaveBeenCalledOnce()
		expect(setup).toHaveBeenCalledOnce()
		expect(observer).toHaveBeenCalledOnce()
		expect(teardown).toHaveBeenCalledBefore(edgeAction)
		expect(edgeAction).toHaveBeenCalledBefore(setup)
		expect(setup).toHaveBeenCalledBefore(observer)
	})

	test('an action that throws propagates, abandoning the rest of that commit: what committed stays committed, and the host is usable afterwards', () => {
		const setup = vi.fn()
		const observer = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				'off -toggle> on': () => {
					throw new Error('boom')
				},
				on: setup, // declared after the throwing edge: must never run
			},
		}).start()

		doc.observe('* -> *', observer) // must never run either

		expect(() => doc.send('toggle')).toThrow('boom')
		expect(doc.current.name).toBe('on') // the transition itself stays committed
		expect(setup).not.toHaveBeenCalled()
		expect(observer).not.toHaveBeenCalled()

		// the host is usable afterwards
		doc.send('toggle')
		expect(doc.current.name).toBe('off')
	})

	test('an array of actions on one trigger sets up in declaration order and tears down in reverse', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: [
					() => {
						log('setup 1')
						return () => log('teardown 1')
					},
					() => {
						log('setup 2')
						return () => log('teardown 2')
					},
				],
			},
		}).start()

		doc.send('toggle') // off -> on
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'setup 1')
		expect(log).toHaveBeenNthCalledWith(2, 'setup 2')
		doc.send('toggle') // on -> off
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'setup 1')
		expect(log).toHaveBeenNthCalledWith(2, 'setup 2')
		expect(log).toHaveBeenNthCalledWith(3, 'teardown 2')
		expect(log).toHaveBeenNthCalledWith(4, 'teardown 1')
	})

	test('an array of actions on an edge trigger all fire, in declaration order', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: { 'off -toggle> on': () => {} },
			actions: {
				'off -toggle> on': [
					() => log('fired 1'),
					{ run: () => log('fired 2') },
				],
			},
		}).start()

		doc.send('toggle')
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'fired 1')
		expect(log).toHaveBeenNthCalledWith(2, 'fired 2')
	})

	test('two residents of one state can hold opposite restart policies: one survives a self-transition, the other restarts', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'on',
			inputs: type<{ ping: undefined }>(),
			states: type<{ on: undefined }>(),
			transitions: { 'on -ping> on': () => {} },
			actions: {
				on: [
					{
						run: () => {
							log('persistent:setup')
							return () => log('persistent:teardown')
						},
						restart: false,
					},
					() => {
						log('restarting:setup')
						return () => log('restarting:teardown')
					},
				],
			},
		}).start()

		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'persistent:setup')
		expect(log).toHaveBeenNthCalledWith(2, 'restarting:setup')
		doc.send('ping')
		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'persistent:setup')
		expect(log).toHaveBeenNthCalledWith(2, 'restarting:setup')
		expect(log).toHaveBeenNthCalledWith(3, 'restarting:teardown')
		expect(log).toHaveBeenNthCalledWith(4, 'restarting:setup')
	})

	test('a throwing teardown, among several actions on one trigger, leaves the later ones (earlier in declaration order) unrun', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: [
					() => () => log('teardown 1'),
					() => () => {
						throw new Error('boom')
					},
				],
			},
		}).start()

		doc.send('toggle') // off -> on

		expect(() => doc.send('toggle')).toThrow('boom')
		expect(log).not.toHaveBeenCalled() // teardown 2 threw before teardown 1 (reverse order) ran
	})

	test('a record with `run` behaves the same as a bare function, for a residency and an edge alike', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: {
				on: { run: () => log('setup') },
				'off -toggle> on': { run: () => log('edge') },
			},
		}).start()

		doc.send('toggle')
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'edge')
	})

	test('an item that is callable *and* carries `run` runs its `run`, deliberately: the record shape wins over the callable', () => {
		const callable = vi.fn()
		const run = vi.fn()
		// Both item shapes in one value. `run` wins by decision, not by accident:
		// this is a record that happens to be callable, not the reverse.
		const both = Object.assign(callable, { run })

		const doc = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: undefined; on: undefined }>(),
			transitions: {
				'off -toggle> on': () => {},
				'on -toggle> off': () => {},
			},
			actions: { on: both, 'off -toggle> on': both },
		}).start()

		doc.send('toggle')
		expect(callable).not.toHaveBeenCalled()
		expect(run).toHaveBeenCalledTimes(2)
	})

	test('an undeclared trigger is silently unreachable at runtime, matching the rest of the library: naming something absent is a no-op', () => {
		expect(() =>
			machine({
				initial: 'off',
				states: type<{ off: undefined; on: undefined }>(),
				transitions: { 'off -toggle> on': () => {} },
				actions: { nonexistent: () => {} } as never,
			}).start(),
		).not.toThrow()
	})

	test('a send from an action is queued like any other: the chain settles before the input lands, and the action is not re-entered', () => {
		const log = vi.fn()
		const doc = machine({
			initial: 'a',
			inputs: type<{ go: undefined; next: undefined }>(),
			states: type<{ a: undefined; b: undefined; c: undefined }>(),
			transitions: {
				'a -go> b': () => {},
				'b -next> c': () => {},
			},
			actions: {
				b: ({ send }) => {
					log('b setup')
					send('next')
					log('b setup returns')
					return () => log('b teardown')
				},
				c: () => {
					log('c setup')
				},
			},
		}).start()
		doc.observe('* -> *', (e) => log(`observer: -> ${e.to}`))

		doc.send('go')

		expect(log).toHaveBeenCalledTimes(6)
		expect(log).toHaveBeenNthCalledWith(1, 'b setup')
		expect(log).toHaveBeenNthCalledWith(2, 'b setup returns')
		expect(log).toHaveBeenNthCalledWith(3, 'observer: -> b')
		expect(log).toHaveBeenNthCalledWith(4, 'b teardown')
		expect(log).toHaveBeenNthCalledWith(5, 'c setup')
		expect(log).toHaveBeenNthCalledWith(6, 'observer: -> c')
		expect(doc.current.name).toBe('c')
	})
})
