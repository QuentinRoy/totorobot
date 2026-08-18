import { describe, expect, test } from 'vitest'

import { machine, types } from 'totorobot'
import { chain, gate, toggle } from './fixtures.ts'
import { residency } from './helpers.ts'

describe('observing', () => {
	test('on returns an unsubscribe function, and calling it more than once is harmless', () => {
		const doc = toggle.start()
		const log: string[] = []

		const off = doc.on('* -> *', () => log.push('fired'))
		off()

		expect(() => off()).not.toThrow()

		doc.send('toggle')
		expect(log).toEqual([])
	})

	test('listeners fire after the commit, in registration order', () => {
		const doc = toggle.start()
		const log: string[] = []

		doc.on('* -> *', () => log.push('first'))
		doc.on('* -> *', () => log.push('second'))

		doc.send('toggle')
		expect(log).toEqual(['first', 'second'])
	})

	test("inside a listener, the record's target end deep-equals current", () => {
		const doc = toggle.start()
		let seenTo: unknown
		let seenCurrent: unknown

		doc.on('* -> *', (e) => {
			seenTo = e.to
			seenCurrent = doc.current
		})

		doc.send('toggle')
		expect(seenTo).toEqual(seenCurrent)
	})

	test('* matches any state, an unlabelled arrow matches any input, and a labelled one matches only that input', () => {
		const fork = machine({
			initial: 'a',
			inputs: types<{ x: void; y: void }>(),
			states: types<{ a: void; b: void; c: void }>(),
			transitions: {
				'a -x> b': () => {},
				'a -y> c': () => {},
			},
		})

		// sending 'x': any-state:b matches, unlabelled matches, labelled-x matches
		const docX = fork.start()
		const logX: string[] = []
		docX.on('* -> b', () => logX.push('any-state:b'))
		docX.on('* -> c', () => logX.push('any-state:c'))
		docX.on('a -> *', () => logX.push('any-input'))
		docX.on('a -x> *', () => logX.push('labelled-x'))
		docX.send('x')
		expect(logX).toEqual(['any-state:b', 'any-input', 'labelled-x'])

		// sending 'y': any-state:c matches, unlabelled matches, labelled-x does not
		const docY = fork.start()
		const logY: string[] = []
		docY.on('* -> b', () => logY.push('any-state:b'))
		docY.on('* -> c', () => logY.push('any-state:c'))
		docY.on('a -> *', () => logY.push('any-input'))
		docY.on('a -x> *', () => logY.push('labelled-x'))
		docY.send('y')
		expect(logY).toEqual(['any-state:c', 'any-input'])
	})

	test('the listener list is snapshotted before dispatch: unsubscribed-during still runs, registered-during does not', () => {
		// a listener unsubscribed by an earlier one still runs for the current transition
		const docA = toggle.start()
		const logA: string[] = []
		let offSecond: () => void
		docA.on('* -> *', () => {
			logA.push('first')
			offSecond()
		})
		offSecond = docA.on('* -> *', () => logA.push('second'))
		docA.send('toggle')
		expect(logA).toEqual(['first', 'second'])

		// a listener registered during dispatch does not run for the current transition
		const docB = toggle.start()
		const logB: string[] = []
		docB.on('* -> *', () => {
			logB.push('only')
			docB.on('* -> *', () => logB.push('late'))
		})
		docB.send('toggle')
		expect(logB).toEqual(['only'])
	})

	test("an immediate transition's record carries on: undefined and input: undefined, distinguishable from a void input", () => {
		const host = gate.start()
		const records: unknown[] = []
		host.on('* -> *', (e) => records.push(e))

		// draft -submit> checking (input-driven), then checking -> allowed (immediate)
		host.send('submit', { quota: 1 })
		// allowed -reset> draft — a void input, not an immediate
		host.send('reset')

		expect(records).toEqual([
			{
				on: 'submit',
				input: { quota: 1 },
				from: { state: 'draft', data: undefined },
				to: { state: 'checking', data: { quota: 1 } },
			},
			{
				on: undefined,
				input: undefined,
				from: { state: 'checking', data: { quota: 1 } },
				to: { state: 'allowed', data: { quota: 1 } },
			},
			{
				on: 'reset',
				input: undefined,
				from: { state: 'allowed', data: { quota: 1 } },
				to: { state: 'draft', data: undefined },
			},
		])
	})

	test('unlabelled patterns match an immediate hop at both ends; a labelled pattern never matches it', () => {
		const host = gate.start()
		const log: string[] = []
		host.on('* -> allowed', () => log.push('entry'))
		host.on('checking -> *', () => log.push('exit'))
		host.on('checking -submit> *', () => log.push('labelled'))
		host.on('* -> *', () => log.push('broad'))

		// draft -submit> checking (matches only the broad pattern), then
		// checking -> allowed, immediate (matches entry, exit and broad — never
		// the labelled pattern, even though its state coordinates would).
		host.send('submit', { quota: 1 })

		expect(log).toEqual(['broad', 'entry', 'exit', 'broad'])
	})

	test('every hop in a chain notifies, in order, and e.to agrees with current on every hop', () => {
		const host = chain.start()
		const seen: { to: string; agreesWithCurrent: boolean }[] = []
		host.on('* -> *', (e) => {
			seen.push({
				to: e.to.state,
				agreesWithCurrent: e.to.state === host.current.state,
			})
		})

		host.send('go')

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
		host.send('go')

		expect(log).toEqual(['setup', 'teardown'])
	})

	test('a self-transition matches both the exit pattern and the entry pattern', () => {
		const pinger = machine({
			initial: 'idle',
			inputs: types<{ ping: void }>(),
			states: types<{ idle: void }>(),
			transitions: {
				'idle -ping> idle': () => {},
			},
		})

		const doc = pinger.start()
		const log: string[] = []
		doc.on('idle -> *', () => log.push('exit'))
		doc.on('* -> idle', () => log.push('entry'))

		doc.send('ping')
		expect(log).toEqual(['exit', 'entry'])
	})
})
