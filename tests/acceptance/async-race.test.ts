/**
 * Case 3: asynchronous request race (docs/acceptance-cases.md). Settlement is
 * an ordinary `send` — there is no library-owned request lifecycle, so these
 * tests use no timers, no fake clock and have no wall-clock dependence.
 *
 * Live-runtime trace 2 — disposing this machine while `loading` and asserting
 * its work can no longer affect later evolution — is deliberately not
 * implemented here. It assumes disposal, and v1 has no `stop()`.
 */

import { describe, expect, test } from 'vitest'

import { machine, types } from '../../src/totorobot.ts'

type AsyncInputs = {
	start: void
	progress: { requestId: number; value: number }
	succeed: { requestId: number; result: string }
	fail: { requestId: number; error: string }
	cancel: void
	reset: void
}
type AsyncStates = {
	idle: { nextRequestId: number }
	loading: { requestId: number; nextRequestId: number; progress: number }
	success: { result: string; nextRequestId: number }
	failure: { error: string; nextRequestId: number }
}

const asyncRequest = machine({
	initial: 'idle',
	inputs: types<AsyncInputs>(),
	states: types<AsyncStates>(),
	transitions: {
		'idle -start> loading': ({ data }) => ({
			requestId: data.nextRequestId,
			nextRequestId: data.nextRequestId + 1,
			progress: 0,
		}),
		'loading -progress> loading': ({ data, input, skip }) =>
			input.requestId === data.requestId
				? { ...data, progress: input.value }
				: skip(),
		'loading -succeed> success': ({ data, input, skip }) =>
			input.requestId === data.requestId
				? { result: input.result, nextRequestId: data.nextRequestId }
				: skip(),
		'loading -fail> failure': ({ data, input, skip }) =>
			input.requestId === data.requestId
				? { error: input.error, nextRequestId: data.nextRequestId }
				: skip(),
		// nextRequestId was already incremented on entering `loading`
		'loading -cancel> idle': ({ data }) => ({
			nextRequestId: data.nextRequestId,
		}),
		'success -reset> idle': ({ data }) => ({
			nextRequestId: data.nextRequestId,
		}),
		'failure -reset> idle': ({ data }) => ({
			nextRequestId: data.nextRequestId,
		}),
	},
})

describe('acceptance: asynchronous request race', () => {
	test('a matching progress commits a same-state update; a matching failure enters failure and can reset to idle', () => {
		const doc = asyncRequest.start({ nextRequestId: 0 })

		doc.send('start')
		doc.send('progress', { requestId: 0, value: 0.5 })
		expect(doc.current).toEqual({
			state: 'loading',
			data: { requestId: 0, nextRequestId: 1, progress: 0.5 },
		})

		doc.send('fail', { requestId: 0, error: 'boom' })
		expect(doc.current).toEqual({
			state: 'failure',
			data: { error: 'boom', nextRequestId: 1 },
		})

		doc.send('reset')
		expect(doc.current).toEqual({ state: 'idle', data: { nextRequestId: 1 } })
	})

	test('the required race: a stale success for a cancelled request is free, and the live request still succeeds', () => {
		const doc = asyncRequest.start({ nextRequestId: 0 })

		doc.send('start') // 1. start request 0
		expect(doc.current).toEqual({
			state: 'loading',
			data: { requestId: 0, nextRequestId: 1, progress: 0 },
		})

		doc.send('cancel') // 2. cancel request 0
		expect(doc.current).toEqual({ state: 'idle', data: { nextRequestId: 1 } })

		doc.send('start') // 3. start request 1
		expect(doc.current).toEqual({
			state: 'loading',
			data: { requestId: 1, nextRequestId: 2, progress: 0 },
		})

		// 4. receive success for request 0: matches no row for the current
		// requestId, so it produces no transition — the stale result is free
		doc.send('succeed', { requestId: 0, result: 'stale' })
		expect(doc.current).toEqual({
			state: 'loading',
			data: { requestId: 1, nextRequestId: 2, progress: 0 },
		})

		// 5. receive success for request 1: enters success with its result
		doc.send('succeed', { requestId: 1, result: 'fresh' })
		expect(doc.current).toEqual({
			state: 'success',
			data: { result: 'fresh', nextRequestId: 2 },
		})
	})
})
