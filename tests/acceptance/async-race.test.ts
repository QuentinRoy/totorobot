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

import { machine, types } from 'totorobot'

type AsyncInputs =
	| { type: 'start' }
	| { type: 'progress'; requestId: number; value: number }
	| { type: 'succeed'; requestId: number; result: string }
	| { type: 'fail'; requestId: number; error: string }
	| { type: 'cancel' }
	| { type: 'reset' }
type AsyncStates =
	| { name: 'idle'; nextRequestId: number }
	| {
			name: 'loading'
			requestId: number
			nextRequestId: number
			progress: number
	  }
	| { name: 'success'; result: string; nextRequestId: number }
	| { name: 'failure'; error: string; nextRequestId: number }

const asyncRequest = machine({
	initial: 'idle',
	inputs: types<AsyncInputs>(),
	states: types<AsyncStates>(),
	transitions: {
		'idle -start> loading': ({ state }) => ({
			requestId: state.nextRequestId,
			nextRequestId: state.nextRequestId + 1,
			progress: 0,
		}),
		'loading -progress> loading': ({ state, input, skip }) =>
			input.requestId === state.requestId
				? { ...state, progress: input.value }
				: skip(),
		'loading -succeed> success': ({ state, input, skip }) =>
			input.requestId === state.requestId
				? { result: input.result, nextRequestId: state.nextRequestId }
				: skip(),
		'loading -fail> failure': ({ state, input, skip }) =>
			input.requestId === state.requestId
				? { error: input.error, nextRequestId: state.nextRequestId }
				: skip(),
		// nextRequestId was already incremented on entering `loading`
		'loading -cancel> idle': ({ state }) => ({
			nextRequestId: state.nextRequestId,
		}),
		'success -reset> idle': ({ state }) => ({
			nextRequestId: state.nextRequestId,
		}),
		'failure -reset> idle': ({ state }) => ({
			nextRequestId: state.nextRequestId,
		}),
	},
})

describe('acceptance: asynchronous request race', () => {
	test('a matching progress commits a same-state update; a matching failure enters failure and can reset to idle', () => {
		const doc = asyncRequest.start({ nextRequestId: 0 })

		doc.send({ type: 'start' })
		doc.send({ type: 'progress', requestId: 0, value: 0.5 })
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 0,
			nextRequestId: 1,
			progress: 0.5,
		})

		doc.send({ type: 'fail', requestId: 0, error: 'boom' })
		expect(doc.current).toEqual({
			name: 'failure',
			error: 'boom',
			nextRequestId: 1,
		})

		doc.send({ type: 'reset' })
		expect(doc.current).toEqual({ name: 'idle', nextRequestId: 1 })
	})

	test('the required race: a stale success for a cancelled request is free, and the live request still succeeds', () => {
		const doc = asyncRequest.start({ nextRequestId: 0 })

		doc.send({ type: 'start' }) // 1. start request 0
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 0,
			nextRequestId: 1,
			progress: 0,
		})

		doc.send({ type: 'cancel' }) // 2. cancel request 0
		expect(doc.current).toEqual({ name: 'idle', nextRequestId: 1 })

		doc.send({ type: 'start' }) // 3. start request 1
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 1,
			nextRequestId: 2,
			progress: 0,
		})

		// 4. receive success for request 0: matches no row for the current
		// requestId, so it produces no transition — the stale result is free
		doc.send({ type: 'succeed', requestId: 0, result: 'stale' })
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 1,
			nextRequestId: 2,
			progress: 0,
		})

		// 5. receive success for request 1: enters success with its result
		doc.send({ type: 'succeed', requestId: 1, result: 'fresh' })
		expect(doc.current).toEqual({
			name: 'success',
			result: 'fresh',
			nextRequestId: 2,
		})
	})
})
