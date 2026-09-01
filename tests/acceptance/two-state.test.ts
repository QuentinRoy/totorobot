/**
 * Case 2: two-state ceremony floor (docs/acceptance-cases.md). `off` and `on`
 * carry no data, and `toggle` enters the other state from each — checking
 * that a typestate without data needs no placeholder object and that the
 * smallest useful machine is not dominated by declarations. `toggle` in
 * fixtures.ts is exactly this case, so it is reused rather than redeclared.
 *
 * Live-runtime trace 1 belongs here rather than with the queue tests: it is
 * the composed version of the same guarantee those tests assert one send at
 * a time — an observer submits a second input while observing the first
 * transition, the first commit-and-observation cycle finishes before the
 * queued input is applied, and the outermost call returns only after the
 * queue drains.
 */

import { describe, expect, test, vi } from 'vitest'

import { toggle } from '../fixtures.ts'

describe('acceptance: two-state ceremony floor', () => {
	test('off and on carry no data, and toggle enters the other state from each', () => {
		const doc = toggle.start()
		expect(doc.current.name).toBe('off')

		doc.send('toggle')
		expect(doc.current.name).toBe('on')

		doc.send('toggle')
		expect(doc.current.name).toBe('off')
	})

	test('live-runtime trace 1: a toggle queued while observing off -> on drains to on -> off before the outer call returns', () => {
		const doc = toggle.start()
		const log = vi.fn()
		let queued = false

		doc.observe('* -> *', (e) => {
			// the first commit-and-observation cycle finishes before the queued
			// input is applied to `on`
			log(`${e.from} -> ${e.to}`)
			if (!queued) {
				queued = true
				doc.send('toggle') // an observer submits a second input while observing the first transition
			}
		})

		doc.send('toggle')

		// the outermost call returns only after the queue drains — no await,
		// no microtask flush, both transitions have already happened
		expect(log).toHaveBeenCalledTimes(2)
		expect(log).toHaveBeenNthCalledWith(1, 'off -> on')
		expect(log).toHaveBeenNthCalledWith(2, 'on -> off')
		expect(doc.current.name).toBe('off')
	})
})
