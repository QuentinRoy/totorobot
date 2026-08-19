/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The queue in `src/totorobot.ts:641` is per host. Two peers therefore have two
 * queues, so a send from host A's listener into host B settles *nested* inside
 * A's notify loop — flat within a machine, nested across machines. This module
 * is the fix, and it is needed under Option A and Option B alike: it is
 * orthogonal to whether the protocol is named.
 */

export type Scheduler = { run(fn: () => void): void }

/** One queue shared by several hosts. Cross-machine sends drain flat. */
export function shared(): Scheduler {
	const queue: (() => void)[] = []
	let draining = false
	return {
		run(fn) {
			queue.push(fn)
			if (draining) return
			draining = true
			try {
				while (queue.length) queue.shift()!()
			} finally {
				draining = false
				queue.length = 0
			}
		},
	}
}

/** The control: no shared queue, every send runs where it was called. */
export const nested: Scheduler = {
	run(fn) {
		fn()
	},
}
