/**
 * Case 3: asynchronous request race (docs/acceptance-cases.md). `loading`
 * holds an `AbortController` as a residency: entering starts the request and
 * returns a teardown that aborts it. Tests settle requests themselves, by
 * resolving or rejecting a deferred directly — no timers, no fake clock, no
 * wall-clock dependence.
 *
 * `requestId` stays, unlike Case 1's token. `clearTimeout` retracts a pending
 * callback outright; `abort()` does not retract a promise that has already
 * settled, so a stale `succeed` for a cancelled request can still arrive.
 * `requestId` is what makes that arrival free (the required race, below).
 *
 * Live-runtime trace 2 (disposing while `loading`) needs no separate test:
 * departing `loading` for any reason — cancel, success, failure — already
 * tears the residency down and aborts its work, which is exactly what the
 * required race exercises.
 */

import { describe, expect, test } from 'vitest'

import { machine, type } from 'totorobot'

/** Settled directly by a test — no timers, no wall clock. */
function deferred<T>(): {
	promise: Promise<T>
	resolve: (value: T) => void
	reject: (reason: unknown) => void
} {
	let resolve!: (value: T) => void
	let reject!: (reason: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

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

/** One deferred per request, set by the residency, settled by a test. */
const requests = new Map<number, ReturnType<typeof deferred<string>>>()

const asyncRequest = machine({
	initial: 'idle',
	inputs: type<AsyncInputs>(),
	states: type<AsyncStates>(),
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
	actions: {
		loading: {
			run: ({ to, send }) => {
				const ctrl = new AbortController()
				const work = deferred<string>()
				requests.set(to.requestId, work)
				work.promise.then(
					(result) =>
						send({ type: 'succeed', requestId: to.requestId, result }),
					(error) =>
						send({
							type: 'fail',
							requestId: to.requestId,
							error: String(error),
						}),
				)
				return () => ctrl.abort()
			},
			// A same-state progress update is a self-transition; the request
			// already in flight must not be aborted and restarted by it.
			restart: false,
		},
	},
})

describe('acceptance: asynchronous request race', () => {
	test('a matching progress commits a same-state update; a matching failure enters failure and can reset to idle', async () => {
		requests.clear()
		const doc = asyncRequest.start({ nextRequestId: 0 })

		doc.send({ type: 'start' })
		doc.send({ type: 'progress', requestId: 0, value: 0.5 })
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 0,
			nextRequestId: 1,
			progress: 0.5,
		})

		requests.get(0)!.reject('boom')
		await requests.get(0)!.promise.catch(() => {})
		expect(doc.current).toEqual({
			name: 'failure',
			error: 'boom',
			nextRequestId: 1,
		})

		doc.send({ type: 'reset' })
		expect(doc.current).toEqual({ name: 'idle', nextRequestId: 1 })
	})

	test('the required race: a stale success for a cancelled request is free, and the live request still succeeds', async () => {
		requests.clear()
		const doc = asyncRequest.start({ nextRequestId: 0 })

		doc.send({ type: 'start' }) // 1. start request 0
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 0,
			nextRequestId: 1,
			progress: 0,
		})
		const request0 = requests.get(0)!

		doc.send({ type: 'cancel' }) // 2. cancel request 0: teardown aborts it
		expect(doc.current).toEqual({ name: 'idle', nextRequestId: 1 })

		doc.send({ type: 'start' }) // 3. start request 1
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 1,
			nextRequestId: 2,
			progress: 0,
		})

		// 4. request 0 still settles after cancellation — `abort()` does not
		// retract it — but it matches no row for the current requestId, so it
		// produces no transition: the stale result is free
		request0.resolve('stale')
		await request0.promise
		expect(doc.current).toEqual({
			name: 'loading',
			requestId: 1,
			nextRequestId: 2,
			progress: 0,
		})

		// 5. receive success for request 1: enters success with its result
		requests.get(1)!.resolve('fresh')
		await requests.get(1)!.promise
		expect(doc.current).toEqual({
			name: 'success',
			result: 'fresh',
			nextRequestId: 2,
		})
	})
})
