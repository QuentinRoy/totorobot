import { describe, expect, test } from 'vitest'

import { machine, types } from '../src/totorobot.ts'
import { toggle } from './fixtures.ts'

describe('observing', () => {
	test('[17] on returns an unsubscribe function, and calling it more than once is harmless', () => {
		const doc = toggle.start()
		const log: string[] = []

		const off = doc.on('* -> *', () => log.push('fired'))
		off()

		expect(() => off()).not.toThrow()

		doc.send('toggle')
		expect(log).toEqual([])
	})

	test('[18] listeners fire after the commit, in registration order', () => {
		const doc = toggle.start()
		const log: string[] = []

		doc.on('* -> *', () => log.push('first'))
		doc.on('* -> *', () => log.push('second'))

		doc.send('toggle')
		expect(log).toEqual(['first', 'second'])
	})

	test("[19] inside a listener, the record's target end deep-equals current", () => {
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

	test('[20] * matches any state, an unlabelled arrow matches any input, and a labelled one matches only that input', () => {
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

	test('[21] the listener list is snapshotted before dispatch: unsubscribed-during still runs, registered-during does not', () => {
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

	test('[rationale] a self-transition matches both the exit pattern and the entry pattern', () => {
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
