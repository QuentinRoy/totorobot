import { describe, expect, test, vi } from 'vitest'

import { machine, type } from 'totorobot'
import { activity, chain, gate, toggle } from './fixtures.ts'
import { residency } from './helpers.ts'

describe('observing', () => {
	test('on returns an unsubscribe function, and calling it more than once is harmless', () => {
		const doc = toggle.start()
		const observer = vi.fn()

		const off = doc.observe('* -> *', observer)
		off()

		expect(() => off()).not.toThrow()

		doc.send('toggle')
		expect(observer).not.toHaveBeenCalled()
	})

	test('observers fire after the commit, in registration order', () => {
		const doc = toggle.start()
		const first = vi.fn()
		const second = vi.fn()

		doc.observe('* -> *', first)
		doc.observe('* -> *', second)

		doc.send('toggle')
		expect(first).toHaveBeenCalledOnce()
		expect(second).toHaveBeenCalledOnce()
		expect(first).toHaveBeenCalledBefore(second)
	})

	test("inside an observer, the record's target end agrees with current", () => {
		const doc = toggle.start()
		const observer = vi.fn()

		doc.observe('* -> *', (e) => {
			observer(e.to, e.toData, doc.current)
		})

		doc.send('toggle')
		expect(observer).toHaveBeenCalledExactlyOnceWith(
			doc.current.name,
			doc.current.data,
			doc.current,
		)
	})

	test('* matches any state, an unlabelled arrow matches any input, and a labelled one matches only that input', () => {
		const fork = machine({
			initial: 'a',
			inputs: type<{ x: undefined; y: undefined }>(),
			states: type<{ a: undefined; b: undefined; c: undefined }>(),
			transitions: {
				'a -x> b': () => {},
				'a -y> c': () => {},
			},
		})

		// sending 'x': any-state:b matches, unlabelled matches, labelled-x matches
		const docX = fork.start()
		const logX = vi.fn()
		docX.observe('* -> b', () => logX('any-state:b'))
		docX.observe('* -> c', () => logX('any-state:c'))
		docX.observe('a -> *', () => logX('any-input'))
		docX.observe('a -x> *', () => logX('labelled-x'))
		docX.send('x')
		expect(logX).toHaveBeenCalledTimes(3)
		expect(logX).toHaveBeenNthCalledWith(1, 'any-state:b')
		expect(logX).toHaveBeenNthCalledWith(2, 'any-input')
		expect(logX).toHaveBeenNthCalledWith(3, 'labelled-x')

		// sending 'y': any-state:c matches, unlabelled matches, labelled-x does not
		const docY = fork.start()
		const logY = vi.fn()
		docY.observe('* -> b', () => logY('any-state:b'))
		docY.observe('* -> c', () => logY('any-state:c'))
		docY.observe('a -> *', () => logY('any-input'))
		docY.observe('a -x> *', () => logY('labelled-x'))
		docY.send('y')
		expect(logY).toHaveBeenCalledTimes(2)
		expect(logY).toHaveBeenNthCalledWith(1, 'any-state:c')
		expect(logY).toHaveBeenNthCalledWith(2, 'any-input')
	})

	test('the observer list is snapshotted before dispatch: unsubscribed-during still runs, registered-during does not', () => {
		// an observer unsubscribed by an earlier one still runs for the current transition
		const docA = toggle.start()
		const logA = vi.fn()
		let offSecond: () => void
		docA.observe('* -> *', () => {
			logA('first')
			offSecond()
		})
		offSecond = docA.observe('* -> *', () => logA('second'))
		docA.send('toggle')
		expect(logA).toHaveBeenCalledTimes(2)
		expect(logA).toHaveBeenNthCalledWith(1, 'first')
		expect(logA).toHaveBeenNthCalledWith(2, 'second')

		// an observer registered during dispatch does not run for the current transition
		const docB = toggle.start()
		const logB = vi.fn()
		docB.observe('* -> *', () => {
			logB('only')
			docB.observe('* -> *', () => logB('late'))
		})
		docB.send('toggle')
		expect(logB).toHaveBeenCalledExactlyOnceWith('only')
	})

	test("an immediate transition's record carries input: undefined, distinguishable from a payload-free input", () => {
		const host = gate.start()
		const observer = vi.fn()
		host.observe('* -> *', observer)

		// draft -submit> checking (input-driven), then checking -> allowed (immediate)
		host.send('submit', { quota: 1 })
		// allowed -reset> draft — a payload-free input, not an immediate
		host.send('reset')

		expect(observer).toHaveBeenCalledTimes(3)
		expect(observer).toHaveBeenNthCalledWith(1, {
			input: 'submit',
			inputData: { quota: 1 },
			from: 'draft',
			fromData: undefined,
			to: 'checking',
			toData: { quota: 1 },
			send: expect.any(Function),
		})
		expect(observer).toHaveBeenNthCalledWith(2, {
			input: undefined,
			inputData: undefined,
			from: 'checking',
			fromData: { quota: 1 },
			to: 'allowed',
			toData: { quota: 1 },
			send: expect.any(Function),
		})
		expect(observer).toHaveBeenNthCalledWith(3, {
			input: 'reset',
			inputData: undefined,
			from: 'allowed',
			fromData: { quota: 1 },
			to: 'draft',
			toData: undefined,
			send: expect.any(Function),
		})
		expect(observer.mock.calls[0]?.[0].send).toBe(host.send)
		expect(observer.mock.calls[1]?.[0].send).toBe(host.send)
		expect(observer.mock.calls[2]?.[0].send).toBe(host.send)
	})

	test('unlabelled patterns match an immediate hop at both ends; a labelled pattern never matches it', () => {
		const host = gate.start()
		const log = vi.fn()
		host.observe('* -> allowed', () => log('entry'))
		host.observe('checking -> *', () => log('exit'))
		host.observe('* -submit> *', () => log('labelled'))
		host.observe('* -> *', () => log('broad'))

		// draft -submit> checking, labelled (matches the labelled and the broad
		// pattern), then checking -> allowed, immediate (matches entry, exit and
		// broad — never the labelled pattern, even though its state coordinates
		// would, since an immediate hop carries no label to match).
		host.send('submit', { quota: 1 })

		expect(log).toHaveBeenCalledTimes(5)
		expect(log).toHaveBeenNthCalledWith(1, 'labelled')
		expect(log).toHaveBeenNthCalledWith(2, 'broad')
		expect(log).toHaveBeenNthCalledWith(3, 'entry')
		expect(log).toHaveBeenNthCalledWith(4, 'exit')
		expect(log).toHaveBeenNthCalledWith(5, 'broad')
	})

	test('every hop in a chain notifies, in order, and e.to agrees with current on every hop', () => {
		const host = chain.start()
		const seen = vi.fn()
		host.observe('* -> *', (e) => {
			seen({
				to: e.to,
				agreesWithCurrent: e.to === host.current.name,
			})
		})

		host.send('go')

		expect(seen).toHaveBeenCalledTimes(3)
		expect(seen).toHaveBeenNthCalledWith(1, {
			to: 'b',
			agreesWithCurrent: true,
		})
		expect(seen).toHaveBeenNthCalledWith(2, {
			to: 'c',
			agreesWithCurrent: true,
		})
		expect(seen).toHaveBeenNthCalledWith(3, {
			to: 'd',
			agreesWithCurrent: true,
		})
	})

	test('the residency recipe runs setup and teardown for a state entered and left immediately, mid-chain', () => {
		const host = chain.start()
		const log = vi.fn()
		residency(host, 'c', () => {
			log('setup')
			return () => log('teardown')
		})

		// a -go> b, then b -> c and c -> d immediately: 'c' is occupied only
		// mid-chain, and residency must still see both the arrival and the
		// departure.
		host.send('go')

		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
	})

	test('a bare state key passed to observe scopes setup and teardown to residency, like a declared action', () => {
		const host = chain.start()
		const log = vi.fn()

		host.observe('c', () => {
			log('setup')
			return () => log('teardown')
		})

		host.send('go')
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
	})

	test('observe(state, fn) residency produces the same log as an actions-declared residency, for the same machine', () => {
		const recipeSetup = vi.fn()
		const recipeTeardown = vi.fn()
		const recipeHost = chain.start()
		recipeHost.observe('b', () => {
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

	test('a residency attached while the host already occupies its state runs immediately: registration order does not decide it', () => {
		const host = toggle.start()
		const entryPattern = vi.fn()
		const setup = vi.fn()

		// The equivalent entry pattern never fires: the arrival already happened.
		host.observe('* -> off', entryPattern)
		host.observe('off', setup)

		expect(entryPattern).not.toHaveBeenCalled()
		expect(setup).toHaveBeenCalledOnce()
	})

	test('unsubscribing a residency tears down the one currently in flight, and more than once stays harmless', () => {
		const host = toggle.start()
		const log = vi.fn()

		const off = host.observe('off', () => {
			log('setup')
			return () => log('teardown')
		})
		off()

		expect(() => off()).not.toThrow()
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
	})

	test('a residency attached to a noninitial current state runs immediately too: current, not initial, decides it', () => {
		const host = toggle.start()
		host.send('toggle') // off -> on: 'on' is current now, and it is not the initial state

		const setup = vi.fn()
		host.observe('on', setup)

		expect(setup).toHaveBeenCalledExactlyOnceWith({
			input: undefined,
			inputData: undefined,
			from: undefined,
			fromData: undefined,
			to: 'on',
			toData: undefined,
			send: expect.any(Function),
		})
		expect(setup.mock.calls[0]?.[0].send).toBe(host.send)
	})

	test("a registration arrival carries the current state data, not a previous transition's", () => {
		const setter = machine({
			initial: 'idle',
			inputs: type<{ set: { id: number } }>(),
			states: type<{ idle: { id: number }; done: { id: number } }>(),
			transitions: { 'idle -set> done': ({ inputData }) => inputData },
		})
		const host = setter.start({ id: 0 })
		host.send('set', { id: 7 })

		const setup = vi.fn()
		host.observe('done', setup)

		expect(setup).toHaveBeenCalledExactlyOnceWith({
			input: undefined,
			inputData: undefined,
			from: undefined,
			fromData: undefined,
			to: 'done',
			toData: { id: 7 },
			send: expect.any(Function),
		})
	})

	test('a bare-state observer for a state no row reaches still receives its registration arrival while resident: eligible through the arrival alone, with no incoming row to match (#100)', () => {
		const host = machine({
			initial: 'off',
			inputs: type<{ toggle: undefined }>(),
			states: type<{ off: { count: number }; on: undefined }>(),
			// Nothing transitions into "off": the initial state's own startup
			// arrival is the only way `observe('off', …)` can ever fire here.
			transitions: { 'off -toggle> on': () => {} },
		}).start({ count: 3 })
		const observer = vi.fn()

		host.observe('off', observer)

		expect(observer).toHaveBeenCalledExactlyOnceWith({
			input: undefined,
			inputData: undefined,
			from: undefined,
			fromData: undefined,
			to: 'off',
			toData: { count: 3 },
			send: expect.any(Function),
		})
	})

	test('a residency attached while resident receives an arrival with no source or input, the same as machine startup', () => {
		const host = toggle.start()
		const observer = vi.fn()

		host.observe('off', observer)

		expect(observer).toHaveBeenCalledExactlyOnceWith({
			input: undefined,
			inputData: undefined,
			from: undefined,
			fromData: undefined,
			to: 'off',
			toData: undefined,
			send: expect.any(Function),
		})
		expect(observer.mock.calls[0]?.[0].send).toBe(host.send)
	})

	test('restart does not gate registration setup: a false-returning predicate still runs setup and is never called for a synthetic arrival', () => {
		const host = toggle.start()
		const setup = vi.fn()
		const restart = vi.fn(() => false)

		host.observe('off', { run: setup, restart })

		expect(setup).toHaveBeenCalledOnce()
		expect(restart).not.toHaveBeenCalled()
	})

	test('unsubscribing a residency registered outside its state, before it is ever entered, is harmless', () => {
		const host = toggle.start()
		const teardown = vi.fn()
		const setup = vi.fn(() => teardown)

		const off = host.observe('on', setup)
		off()

		host.send('toggle') // off -> on: would have entered, had it stayed subscribed
		expect(setup).not.toHaveBeenCalled()
		expect(teardown).not.toHaveBeenCalled()
	})

	test('observe(state, fn) tears down and sets up again on a self-transition: restart falls out of matching both directions, same as a declared residency', () => {
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: { 'idle -ping> idle': () => {} },
		})
		const host = pinger.start()
		const log = vi.fn()

		host.observe('idle', () => {
			log('setup')
			return () => log('teardown')
		})

		expect(log).toHaveBeenCalledExactlyOnceWith('setup')
		host.send('ping')
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'setup')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown')
		expect(log).toHaveBeenNthCalledWith(3, 'setup')
	})

	test('observe(state, { run, restart: false }) survives a self-transition: no teardown, no second setup', () => {
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: { 'idle -ping> idle': () => {} },
		})
		const host = pinger.start()
		const teardown = vi.fn()
		const setup = vi.fn(() => teardown)

		host.observe('idle', {
			run: setup,
			restart: false,
		})

		host.send('ping')
		host.send('ping')
		expect(setup).toHaveBeenCalledOnce()
		expect(teardown).not.toHaveBeenCalled()
	})

	test('observe(state, { run, restart }) decides a self-transition case by case, from the resident data either side', () => {
		const setter = machine({
			initial: 'idle',
			inputs: type<{ set: { id: number } }>(),
			states: type<{ idle: { id: number } }>(),
			transitions: {
				'idle -set> idle': ({ inputData }) => ({ id: inputData.id }),
			},
		})
		const host = setter.start({ id: 0 })
		const log = vi.fn()

		host.observe('idle', {
			run: (e) => {
				log(`setup:${e.toData.id}`)
				return () => log(`teardown:${e.toData.id}`)
			},
			restart: ({ fromData, toData }) => fromData.id !== toData.id,
		})

		host.send('set', { id: 0 }) // same id: no restart
		host.send('set', { id: 1 }) // different id: restarts
		expect(log).toHaveBeenCalledTimes(3)
		expect(log).toHaveBeenNthCalledWith(1, 'setup:0')
		expect(log).toHaveBeenNthCalledWith(2, 'teardown:0')
		expect(log).toHaveBeenNthCalledWith(3, 'setup:1')
	})

	test('observe takes an item that is callable *and* carries `run` the same way an actions block does: `run` wins', () => {
		const callable = vi.fn()
		const run = vi.fn()
		const host = toggle.start()
		// The same precedence on the public path: `observe` and the actions block
		// share one parser.
		const both = Object.assign(callable, {
			run,
		})

		host.observe('on', both)
		host.send('toggle')

		expect(callable).not.toHaveBeenCalled()
		expect(run).toHaveBeenCalledOnce()
	})

	test('a declared residency and an observe-attached one on the same state: actions before observers, entry and exit alike', () => {
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
				on: () => {
					log('action:setup')
					return () => log('action:teardown')
				},
			},
		}).start()

		doc.observe('on', () => {
			log('observe:setup')
			return () => log('observe:teardown')
		})

		doc.send('toggle') // off -> on: both enter
		doc.send('toggle') // on -> off: both leave

		expect(log).toHaveBeenCalledTimes(4)
		expect(log).toHaveBeenNthCalledWith(1, 'action:setup')
		expect(log).toHaveBeenNthCalledWith(2, 'observe:setup')
		expect(log).toHaveBeenNthCalledWith(3, 'action:teardown')
		expect(log).toHaveBeenNthCalledWith(4, 'observe:teardown')
	})

	test('a self-transition matches both the exit pattern and the entry pattern', () => {
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ ping: undefined }>(),
			states: type<{ idle: undefined }>(),
			transitions: {
				'idle -ping> idle': () => {},
			},
		})

		const doc = pinger.start()
		const exit = vi.fn()
		const entry = vi.fn()
		doc.observe('idle -> *', exit)
		doc.observe('* -> idle', entry)

		doc.send('ping')
		expect(exit).toHaveBeenCalledOnce()
		expect(entry).toHaveBeenCalledOnce()
		expect(exit).toHaveBeenCalledBefore(entry)
	})

	test("a record's send is the host's own: a reaction drives the machine without closing over it", () => {
		const host = toggle.start()
		const observer = vi.fn()

		host.observe('* -> on', (e) => {
			observer(e.send)
		})

		host.send('toggle')
		expect(observer).toHaveBeenCalledExactlyOnceWith(host.send)
	})

	test('a send from an observer is queued: the observer is not re-entered, and the machine settles afterwards', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ x: undefined; y: undefined }>(),
			states: type<{ a: undefined; b: undefined; c: undefined }>(),
			transitions: {
				'a -x> b': () => {},
				'b -y> c': () => {},
			},
		})

		const host = relay.start()
		const log = vi.fn()

		host.observe('* -> b', (e) => {
			log(`fired in ${host.current.name}`)
			e.send('y')
			// Queued, not nested: the send has not moved the machine yet.
			log(`after send, still ${host.current.name}`)
		})

		host.send('x')

		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'fired in b')
		expect(log).toHaveBeenNthCalledWith(2, 'after send, still b')
		expect(host.current.name).toBe('c')
	})

	test('a send from an observer is read at drain time, so it may correctly find no row', () => {
		const fork = machine({
			initial: 'a',
			inputs: type<{ x: undefined; z: undefined }>(),
			states: type<{ a: undefined; b: undefined; d: undefined }>(),
			transitions: {
				'a -x> b': () => {},
				'a -z> d': () => {},
			},
		})

		const host = fork.start()
		const observer = vi.fn()
		host.observe('* -> *', (e) => observer(e.to))

		// `z` is a row on `a`, the state the observer is told about — but the
		// machine is in `b` by the time the queue reads it, and `b` has no rows.
		host.observe('a -x> b', (e) => e.send('z'))
		host.send('x')

		expect(observer).toHaveBeenCalledExactlyOnceWith('b')
		expect(host.current.name).toBe('b')
	})

	test('an observer that sends its own trigger is not re-entered within the dispatch that notified it', () => {
		const host = toggle.start()
		let depth = 0
		let maxDepth = 0
		const observer = vi.fn()

		host.observe('* -> *', (e) => {
			observer()
			maxDepth = Math.max(maxDepth, ++depth)
			// Runs after this observer returns, so the next notification is a fresh
			// call rather than a nested one.
			if (observer.mock.calls.length < 3) e.send('toggle')
			depth--
		})

		host.send('toggle')

		// off -> on -> off -> on: three transitions, each notified at depth 1.
		expect(observer).toHaveBeenCalledTimes(3)
		expect(maxDepth).toBe(1)
		expect(host.current.name).toBe('on')
	})
})
