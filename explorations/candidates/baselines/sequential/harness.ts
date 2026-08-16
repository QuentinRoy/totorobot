// Harness for the sequential (un-inverted) baseline.
//
// None of this is behaviour. It is the fixed cost of writing control flow as
// ordinary sequential code: sequential code can only exist if something turns
// pushed events into awaitable values, and if something owns the timers that
// the code races against. Both are charged to the baseline.
//
// Line accounting (see README): CHANNEL and CLOCK are baseline cost; DEMO
// SCAFFOLDING is test-only and is not charged.

// ---------------------------------------------------------------- CHANNEL --

export type Channel<T> = {
	/** Hand a value to a waiting reader, or queue it. */
	push(value: T): void
	/**
	 * The next value. Repeated calls return the *same* promise until `drop()`,
	 * so it is safe for a `peek()` to lose a `Promise.race` — without this the
	 * losing read would silently swallow the following input.
	 */
	peek(): Promise<T>
	/** Discard the peeked value so the next `peek()` reads a fresh one. */
	drop(): void
	/** `peek()` then `drop()`. */
	next(): Promise<T>
}

export function createChannel<T>(): Channel<T> {
	const queued: T[] = []
	const waiting: ((value: T) => void)[] = []
	let pending: Promise<T> | null = null

	function push(value: T): void {
		const waiter = waiting.shift()
		if (waiter === undefined) queued.push(value)
		else waiter(value)
	}

	function peek(): Promise<T> {
		if (pending === null) {
			pending =
				queued.length > 0
					? // `shift()` cannot prove non-emptiness to the checker.
						Promise.resolve(queued.shift() as T)
					: new Promise<T>((resolve) => {
							waiting.push(resolve)
						})
		}
		return pending
	}

	function drop(): void {
		pending = null
	}

	async function next(): Promise<T> {
		const value = await peek()
		drop()
		return value
	}

	return { push, peek, drop, next }
}

// ------------------------------------------------------------------ CLOCK --

export type Timer = { readonly elapsed: Promise<void>; cancel(): void }
export type Clock = (ms: number) => Timer

export type ManualTimer = { ms: number; cancelled: boolean; fire(): void }
export type ManualClock = { clock: Clock; timers: ManualTimer[] }

/**
 * Timers fired by hand so demos never depend on wall-clock timing.
 *
 * `cancel()` deliberately only records the cancellation: `fire()` still
 * resolves afterwards. That lets a demo prove that an abandoned dwell cannot
 * affect the machine even when the underlying timer really does fire late.
 */
export function createManualClock(): ManualClock {
	const timers: ManualTimer[] = []
	function clock(ms: number): Timer {
		let fire = (): void => {}
		const elapsed = new Promise<void>((resolve) => {
			fire = () => resolve()
		})
		const record: ManualTimer = { ms, cancelled: false, fire }
		timers.push(record)
		return {
			elapsed,
			cancel() {
				record.cancelled = true
			},
		}
	}
	return { clock, timers }
}

// ------------------------------------------------------ DEMO SCAFFOLDING --

declare const console: { log(...args: readonly unknown[]): void }
declare function setTimeout(callback: () => void, ms: number): unknown

export function log(message: string): void {
	console.log(message)
}

/** Let every pending microtask and the async machine make progress. */
export function settle(): Promise<void> {
	return new Promise<void>((resolve) => {
		setTimeout(() => resolve(), 0)
	})
}

export function check(actual: unknown, expected: unknown, label: string): void {
	const a = JSON.stringify(actual)
	const b = JSON.stringify(expected)
	if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`)
}
