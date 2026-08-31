import { describe, expect, test } from 'vitest'

import { machine, type } from 'totorobot'
import { activity, activityLog, chain, gate, toggle } from './fixtures.ts'
import { residency } from './helpers.ts'

describe('observing', () => {
	test('on returns an unsubscribe function, and calling it more than once is harmless', () => {
		const doc = toggle.start()
		const log: string[] = []

		const off = doc.observe('* -> *', () => log.push('fired'))
		off()

		expect(() => off()).not.toThrow()

		doc.send({ type: 'toggle' })
		expect(log).toEqual([])
	})

	test('listeners fire after the commit, in registration order', () => {
		const doc = toggle.start()
		const log: string[] = []

		doc.observe('* -> *', () => log.push('first'))
		doc.observe('* -> *', () => log.push('second'))

		doc.send({ type: 'toggle' })
		expect(log).toEqual(['first', 'second'])
	})

	test("inside a listener, the record's target end deep-equals current", () => {
		const doc = toggle.start()
		let seenTo: unknown
		let seenCurrent: unknown

		doc.observe('* -> *', (e) => {
			seenTo = e.to
			seenCurrent = doc.current
		})

		doc.send({ type: 'toggle' })
		expect(seenTo).toEqual(seenCurrent)
	})

	test('* matches any state, an unlabelled arrow matches any input, and a labelled one matches only that input', () => {
		const fork = machine({
			initial: 'a',
			inputs: type<{ type: 'x' } | { type: 'y' }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -x> b': () => {},
				'a -y> c': () => {},
			},
		})

		// sending 'x': any-state:b matches, unlabelled matches, labelled-x matches
		const docX = fork.start()
		const logX: string[] = []
		docX.observe('* -> b', () => logX.push('any-state:b'))
		docX.observe('* -> c', () => logX.push('any-state:c'))
		docX.observe('a -> *', () => logX.push('any-input'))
		docX.observe('a -x> *', () => logX.push('labelled-x'))
		docX.send({ type: 'x' })
		expect(logX).toEqual(['any-state:b', 'any-input', 'labelled-x'])

		// sending 'y': any-state:c matches, unlabelled matches, labelled-x does not
		const docY = fork.start()
		const logY: string[] = []
		docY.observe('* -> b', () => logY.push('any-state:b'))
		docY.observe('* -> c', () => logY.push('any-state:c'))
		docY.observe('a -> *', () => logY.push('any-input'))
		docY.observe('a -x> *', () => logY.push('labelled-x'))
		docY.send({ type: 'y' })
		expect(logY).toEqual(['any-state:c', 'any-input'])
	})

	test('the listener list is snapshotted before dispatch: unsubscribed-during still runs, registered-during does not', () => {
		// a listener unsubscribed by an earlier one still runs for the current transition
		const docA = toggle.start()
		const logA: string[] = []
		let offSecond: () => void
		docA.observe('* -> *', () => {
			logA.push('first')
			offSecond()
		})
		offSecond = docA.observe('* -> *', () => logA.push('second'))
		docA.send({ type: 'toggle' })
		expect(logA).toEqual(['first', 'second'])

		// a listener registered during dispatch does not run for the current transition
		const docB = toggle.start()
		const logB: string[] = []
		docB.observe('* -> *', () => {
			logB.push('only')
			docB.observe('* -> *', () => logB.push('late'))
		})
		docB.send({ type: 'toggle' })
		expect(logB).toEqual(['only'])
	})

	test("an immediate transition's record carries input: undefined, distinguishable from a payload-free input", () => {
		const host = gate.start()
		const records: unknown[] = []
		host.observe('* -> *', (e) => records.push(e))

		// draft -submit> checking (input-driven), then checking -> allowed (immediate)
		host.send({ type: 'submit', quota: 1 })
		// allowed -reset> draft — a payload-free input, not an immediate
		host.send({ type: 'reset' })

		expect(records).toEqual([
			{
				input: { type: 'submit', quota: 1 },
				from: { name: 'draft' },
				to: { name: 'checking', quota: 1 },
				send: expect.any(Function),
			},
			{
				input: undefined,
				from: { name: 'checking', quota: 1 },
				to: { name: 'allowed', quota: 1 },
				send: expect.any(Function),
			},
			{
				input: { type: 'reset' },
				from: { name: 'allowed', quota: 1 },
				to: { name: 'draft' },
				send: expect.any(Function),
			},
		])
	})

	test('unlabelled patterns match an immediate hop at both ends; a labelled pattern never matches it', () => {
		const host = gate.start()
		const log: string[] = []
		host.observe('* -> allowed', () => log.push('entry'))
		host.observe('checking -> *', () => log.push('exit'))
		host.observe('checking -submit> *', () => log.push('labelled'))
		host.observe('* -> *', () => log.push('broad'))

		// draft -submit> checking (matches only the broad pattern), then
		// checking -> allowed, immediate (matches entry, exit and broad — never
		// the labelled pattern, even though its state coordinates would).
		host.send({ type: 'submit', quota: 1 })

		expect(log).toEqual(['broad', 'entry', 'exit', 'broad'])
	})

	test('every hop in a chain notifies, in order, and e.to agrees with current on every hop', () => {
		const host = chain.start()
		const seen: { to: string; agreesWithCurrent: boolean }[] = []
		host.observe('* -> *', (e) => {
			seen.push({
				to: e.to.name,
				agreesWithCurrent: e.to.name === host.current.name,
			})
		})

		host.send({ type: 'go' })

		expect(seen).toEqual([
			{ to: 'b', agreesWithCurrent: true },
			{ to: 'c', agreesWithCurrent: true },
			{ to: 'd', agreesWithCurrent: true },
		])
	})

	test('the residency recipe runs setup and teardown for a state entered and left immediately, mid-chain', () => {
		const host = chain.start()
		const log: string[] = []
		residency(host, 'c', () => {
			log.push('setup')
			return () => log.push('teardown')
		})

		// a -go> b, then b -> c and c -> d immediately: 'c' is occupied only
		// mid-chain, and residency must still see both the arrival and the
		// departure.
		host.send({ type: 'go' })

		expect(log).toEqual(['setup', 'teardown'])
	})

	test('a bare state key passed to observe scopes setup and teardown to residency, like a declared action', () => {
		const host = chain.start()
		const log: string[] = []

		host.observe('c', () => {
			log.push('setup')
			return () => log.push('teardown')
		})

		host.send({ type: 'go' })
		expect(log).toEqual(['setup', 'teardown'])
	})

	test('observe(state, fn) residency produces the same log as an actions-declared residency, for the same machine', () => {
		const recipeLog: string[] = []
		const recipeHost = chain.start()
		recipeHost.observe('b', () => {
			recipeLog.push('setup')
			return () => recipeLog.push('teardown')
		})
		recipeHost.send({ type: 'go' })

		activityLog.length = 0
		activity.start().send({ type: 'go' })

		expect(activityLog).toEqual(recipeLog)
	})

	test('a residency attached while the host already occupies its state runs immediately: registration order does not decide it', () => {
		const host = toggle.start()
		const log: string[] = []

		// The equivalent entry pattern never fires: the arrival already happened.
		host.observe('* -> off', () => log.push('never'))
		host.observe('off', () => {
			log.push('setup')
		})

		expect(log).toEqual(['setup'])
	})

	test('unsubscribing a residency tears down the one currently in flight, and more than once stays harmless', () => {
		const host = toggle.start()
		const log: string[] = []

		const off = host.observe('off', () => {
			log.push('setup')
			return () => log.push('teardown')
		})
		off()

		expect(() => off()).not.toThrow()
		expect(log).toEqual(['setup', 'teardown'])
	})

	test('observe(state, { run, restart: false }) survives a self-transition: no teardown, no second setup', () => {
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ type: 'ping' }>(),
			states: type<{ name: 'idle' }>(),
			transitions: { 'idle -ping> idle': () => {} },
		})
		const host = pinger.start()
		const log: string[] = []

		host.observe('idle', {
			run: () => {
				log.push('setup')
				return () => log.push('teardown')
			},
			restart: false,
		})

		host.send({ type: 'ping' })
		host.send({ type: 'ping' })
		expect(log).toEqual(['setup'])
	})

	test('observe(state, { run, restart }) decides a self-transition case by case, from the resident data either side', () => {
		const setter = machine({
			initial: 'idle',
			inputs: type<{ type: 'set'; id: number }>(),
			states: type<{ name: 'idle'; id: number }>(),
			transitions: {
				'idle -set> idle': ({ input }) => ({ id: input.id }),
			},
		})
		const host = setter.start({ id: 0 })
		const log: string[] = []

		host.observe('idle', {
			run: (e) => {
				log.push(`setup:${e.to.id}`)
				return () => log.push(`teardown:${e.to.id}`)
			},
			restart: (from, to) => from.id !== to.id,
		})

		host.send({ type: 'set', id: 0 }) // same id: no restart
		host.send({ type: 'set', id: 1 }) // different id: restarts
		expect(log).toEqual(['setup:0', 'teardown:0', 'setup:1'])
	})

	test('a self-transition matches both the exit pattern and the entry pattern', () => {
		const pinger = machine({
			initial: 'idle',
			inputs: type<{ type: 'ping' }>(),
			states: type<{ name: 'idle' }>(),
			transitions: {
				'idle -ping> idle': () => {},
			},
		})

		const doc = pinger.start()
		const log: string[] = []
		doc.observe('idle -> *', () => log.push('exit'))
		doc.observe('* -> idle', () => log.push('entry'))

		doc.send({ type: 'ping' })
		expect(log).toEqual(['exit', 'entry'])
	})

	test("a record's send is the host's own: a reaction drives the machine without closing over it", () => {
		const host = toggle.start()
		let seen: unknown

		host.observe('* -> on', (e) => {
			seen = e.send
		})

		host.send({ type: 'toggle' })
		expect(seen).toBe(host.send)
	})

	test('a send from a listener is queued: the listener is not re-entered, and the machine settles afterwards', () => {
		const relay = machine({
			initial: 'a',
			inputs: type<{ type: 'x' } | { type: 'y' }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'c' }>(),
			transitions: {
				'a -x> b': () => {},
				'b -y> c': () => {},
			},
		})

		const host = relay.start()
		const log: string[] = []

		host.observe('* -> b', (e) => {
			log.push(`fired in ${host.current.name}`)
			e.send({ type: 'y' })
			// Queued, not nested: the send has not moved the machine yet.
			log.push(`after send, still ${host.current.name}`)
		})

		host.send({ type: 'x' })

		expect(log).toEqual(['fired in b', 'after send, still b'])
		expect(host.current).toEqual({ name: 'c' })
	})

	test('a send from a listener is read at drain time, so it may correctly find no row', () => {
		const fork = machine({
			initial: 'a',
			inputs: type<{ type: 'x' } | { type: 'z' }>(),
			states: type<{ name: 'a' } | { name: 'b' } | { name: 'd' }>(),
			transitions: {
				'a -x> b': () => {},
				'a -z> d': () => {},
			},
		})

		const host = fork.start()
		const log: string[] = []
		host.observe('* -> *', (e) => log.push(e.to.name))

		// `z` is a row on `a`, the state the listener is told about — but the
		// machine is in `b` by the time the queue reads it, and `b` has no rows.
		host.observe('a -x> b', (e) => e.send({ type: 'z' }))
		host.send({ type: 'x' })

		expect(log).toEqual(['b'])
		expect(host.current).toEqual({ name: 'b' })
	})

	test('a listener that sends its own trigger is not re-entered within the dispatch that notified it', () => {
		const host = toggle.start()
		let depth = 0
		let maxDepth = 0
		let fired = 0

		host.observe('* -> *', (e) => {
			fired++
			maxDepth = Math.max(maxDepth, ++depth)
			// Runs after this listener returns, so the next notification is a fresh
			// call rather than a nested one.
			if (fired < 3) e.send({ type: 'toggle' })
			depth--
		})

		host.send({ type: 'toggle' })

		// off -> on -> off -> on: three transitions, each notified at depth 1.
		expect(fired).toBe(3)
		expect(maxDepth).toBe(1)
		expect(host.current).toEqual({ name: 'on' })
	})
})
