// An optional library-owned live execution over the same kernel.
//
// Commit order is XState v5's, which the research recommends copying:
//   snapshot -> deferred effects -> observers
// all inside a mailbox flush, so a submission made from an effect or an
// observer is QUEUED and never nested. That is the fix for the class of bug
// XState v4 shipped as `predictableActionArguments`.

import type { AnyInputs, AnyStates, Machine, StateValue, Step } from './lib.ts'
import { step } from './runtime.ts'

export type Disposition<S extends AnyStates, C> =
	| { readonly kind: 'processed'; readonly outcome: Step<S, C> }
	| { readonly kind: 'queued' }
	| { readonly kind: 'disposed' }

export interface Execution<S extends AnyStates, C> {
	readonly current: StateValue<S>
	submit(input: string, payload?: unknown): Disposition<S, C>
	dispose(): void
	readonly isDisposed: boolean
}

export function createExecution<S extends AnyStates, I extends AnyInputs, C>(
	m: Machine<S, I, C>,
	initial: StateValue<S>,
	options?: {
		run?: (command: C) => void
		observe?: (outcome: Step<S, C>) => void
	},
): Execution<S, C> {
	let current = initial
	let disposed = false
	let flushing = false
	const queue: Array<[string, unknown]> = []
	let last: Step<S, C> | undefined

	const self: Execution<S, C> = {
		get current() {
			return current
		},
		get isDisposed() {
			return disposed
		},
		submit(input, payload) {
			if (disposed) return { kind: 'disposed' }
			queue.push([input, payload])

			// Reentrant submission: queued, applied after the current cycle.
			if (flushing) return { kind: 'queued' }

			flushing = true
			try {
				while (queue.length > 0 && !disposed) {
					const entry = queue.shift()
					if (!entry) break
					const outcome = step(m, current, entry[0], entry[1])
					last = outcome
					if (outcome.kind === 'none') continue

					// 1. commit the snapshot
					current = outcome.next
					// 2. deferred effects
					for (const command of outcome.commands) options?.run?.(command)
					// 3. observers
					options?.observe?.(outcome)
				}
			} finally {
				flushing = false
			}
			// The outermost submission returns only after the queue has drained.
			return last
				? { kind: 'processed', outcome: last }
				: {
						kind: 'processed',
						outcome: { kind: 'none', reason: 'unavailable', commands: [] },
					}
		},
		dispose() {
			disposed = true
			queue.length = 0
		},
	}
	return self
}
