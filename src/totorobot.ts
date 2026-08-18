/**
 * Totorobot — finite state machines declared as a transition table.
 *
 *     const publication = machine({
 *       initial: 'empty',
 *       inputs: types<Inputs>(),
 *       states: types<States>(),
 *       transitions: {
 *         'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
 *         'draft -cancel> empty': () => {},
 *       },
 *     })
 *
 *     const doc = publication.start()
 *     doc.on('* -> published', (e) => notify(e.to.data))
 *     doc.send('open', { text: 'hello' })
 *
 * The API is specified in `docs/api.md` and argued in `docs/api-rationale.md`.
 * This module is the whole library: one definition builder, one host, and no
 * dependencies.
 *
 * ## On size
 *
 * The shipped file is minified, so short identifiers and terse formatting buy
 * nothing — every local is renamed and every comment stripped. What moves the
 * number is how many distinct code shapes exist, whether helpers are shared,
 * and closures versus objects. The comments below record which alternative was
 * rejected and why, so the shape is not re-litigated blindly. Measure with
 * `pnpm size` before changing any of them.
 *
 * ## On validation
 *
 * There is none, anywhere. Nothing throws, nothing warns, nothing checks its
 * arguments: the specification makes every malformed input a silent no-op, so
 * validation code would be bytes spent contradicting it. An input name outside
 * the table finds no row; a pattern naming a state that does not exist parses
 * fine and never matches.
 */

// ---------------------------------------------------------------------------
// Declining
// ---------------------------------------------------------------------------

/**
 * The sentinel a handler returns to decline its row. A module-level `const`
 * symbol types as `unique symbol`, so `Skip` needs no brand machinery.
 *
 * Rejected: `const skip = () => skip`, which makes the function its own
 * sentinel and saves a binding. It silently accepts a handler that returns
 * `skip` *without calling it*. The byte difference is single digits.
 */
const SKIP = Symbol()

/** What `skip()` returns. Part of every handler's return type. */
export type Skip = typeof SKIP

/**
 * One shared function for every handler call, rather than a closure built per
 * call — the sentinel carries no per-call information, so there is nothing for
 * a fresh closure to capture.
 */
const skip = (): Skip => SKIP

// ---------------------------------------------------------------------------
// The key grammar
// ---------------------------------------------------------------------------

/**
 * `from -input> to`, and its pattern form with coordinates left open. Spacing
 * is load-bearing and nothing is trimmed or normalised: the grammar admits
 * exactly one spelling, and the type layer rejects the rest on the offending
 * row.
 *
 * Splitting on the two separators leaves the label as the empty string in an
 * unlabelled arrow (`'* -> *'`), which is what makes the empty string the
 * wildcard in the label position for free. A bare key contains neither
 * separator and parses to a single coordinate whose `undefined` label fails
 * every comparison — so a state name registered as a pattern never matches,
 * and never throws.
 */
const parse = (key: string) =>
	key.split(/ -|> /) as [from: string, input?: string, to?: string]

// ---------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------

/**
 * The vocabulary maps and the handler arguments are widened here: the checked
 * surface — per-state data, the key grammar, `start` and `send` arity — is the
 * type layer's, and lands with it. Only the runtime contract is expressed
 * below.
 */
type Data = any

/** A handler: the source state's data and the input payload in, the target state's data out. */
type Handler = (args: {
	readonly data: Data
	readonly input: Data
	readonly skip: () => Skip
}) => Data | Skip

/** A candidate row, parsed: where it goes, and what it projects. */
type Row = readonly [to: string, handler: Handler]

/**
 * Source state to input name to the rows declared for that pair, in
 * declaration order.
 *
 * Null-prototype at both levels so an untyped `send('toString')` finds nothing
 * rather than finding `Object.prototype`'s method and calling it as a handler.
 * A name outside the table has to change nothing rather than throw, and +10 B
 * brotli over plain object literals is the whole cost of honouring it.
 */
type Index = Record<string, Record<string, Row[] | undefined> | undefined>

/** What a machine is declared from. */
export interface Definition {
	readonly initial: string
	readonly inputs?: unknown
	readonly states?: unknown
	readonly transitions: Readonly<Record<string, Handler>>
}

/**
 * Carries a vocabulary at the type level and nothing at all at runtime: it
 * **returns `null`**, which is what a caller observes. Nothing reads the
 * fields it fills in.
 */
export const types = <T>(): T => null as unknown as T

/**
 * Declare a machine. The result is inert data — it holds the index in a
 * closure, never touches or annotates the configuration object it was given,
 * and exposes `start` only, because observation is a property of a running
 * machine and an imported definition stays inert.
 *
 * Every key is parsed **once**, here. Rejected: storing nothing and
 * prefix-scanning the raw keys on every dispatch, which came within 1.6% in the
 * pre-implementation prototypes — not a basis for choosing. The index wins on
 * behaviour: dispatch is a lookup rather than a scan, `available` falls out of
 * key insertion order (declaration order and de-duplication for free, deleting
 * the `Set` a scan needs), and a malformed key arriving from untyped code
 * cannot accidentally prefix-match.
 */
export function machine(definition: Definition): Machine {
	const { initial, transitions } = definition
	const index: Index = Object.create(null)

	for (const key in transitions) {
		const [from, input, to] = parse(key)
		const bySource = (index[from] ??= Object.create(null))
		// A key too malformed to carry a label lands under `undefined` and is
		// simply unreachable — no row, and no complaint.
		;(bySource[input as string] ??= []).push([to as string, transitions[key]!])
	}

	return {
		start: (data?: unknown): Host => {
			// Host state lives in closure variables rather than on an object, and
			// `current` is one of them rather than a `state`/`data` pair: a
			// transition record needs both ends as `{ state, data }`, so keeping the
			// pair already boxed hands `from` and `to` over as references instead of
			// building two more objects per commit. Separate `state` and `data`
			// variables with a getter that builds the pair fresh measured 1 B
			// smaller — noise — and allocates three objects per commit rather than
			// one.
			let current: Snapshot = { state: initial, data }

			// Copy-on-write, so a dispatch iterates the array it captured and needs
			// no `.slice()` of its own: a listener unsubscribed by an earlier one
			// still runs for the current transition, and one registered during
			// dispatch does not. Rejected: a mutable list snapshotted with `.slice()`
			// per dispatch, which measured 13 B larger and allocates on the path
			// that runs most.
			let listeners: Registration[] = []

			const queue: [name: string, payload: unknown][] = []
			let draining = false

			return {
				get current(): Snapshot {
					return current
				},

				// Straight off the index, so the answer is the table's rather than
				// the handlers': an input whose every row would decline is still
				// advertised, and no handler runs to produce this list.
				get available(): readonly string[] {
					return Object.keys(index[current.state] ?? {})
				},

				on: (pattern: string, listener: Listener): (() => void) => {
					// Parsed once, here, rather than kept as an opaque string and
					// matched by generating the eight patterns each transition could
					// answer to — 4.8% larger in the pre-implementation prototypes, and
					// a `Set` allocated per transition. Parsing at registration also
					// shares `parse` with the index build, which is part of why it
					// compresses better.
					const registration: Registration = [...parse(pattern), listener]
					listeners = [...listeners, registration]
					// Idempotent because removing what is already gone is a no-op.
					return () => {
						listeners = listeners.filter((other) => other !== registration)
					}
				},

				send: (name: string, payload?: unknown): void => {
					queue.push([name, payload])
					// Already inside a dispatch: this call was made from a listener, so
					// it waits its turn rather than running nested. The outermost call
					// owns the drain.
					if (draining) return
					draining = true
					try {
						while (queue.length) {
							const [on, input] = queue.shift()!
							// Evaluated against the state at drain time, so a queued send
							// may correctly find no row and do nothing.
							for (const [to, handler] of index[current.state]?.[on] ?? []) {
								const data = handler({ data: current.data, input, skip })
								// Declining is an ordinary, silent outcome: fall through to
								// the next row declared for the same source and input.
								if (data === SKIP) continue

								// Commit, then notify — so every listener sees a machine that
								// agrees with the record it was handed.
								const from = current
								current = { state: to, data }
								const record: Transition = { on, input, from, to: current }
								for (const [f, l, t, listener] of listeners) {
									if (
										(f === '*' || f === from.state) &&
										(l === '' || l === on) &&
										(t === '*' || t === to)
									) {
										listener(record)
									}
								}
								// One input yields at most one transition.
								break
							}
						}
					} finally {
						// In a `finally` so a throwing listener leaves the host usable and
						// the flag correct. The queue is abandoned rather than drained:
						// the transition stays committed, but nothing further runs.
						draining = false
						queue.length = 0
					}
				},
			}
		},
	}
}

// ---------------------------------------------------------------------------
// What a running machine is
// ---------------------------------------------------------------------------

/** A state and the data it carries. Never mutated: a value read from `current` stays valid. */
export interface Snapshot {
	readonly state: string
	readonly data: Data
}

/** What a listener is handed. Discriminated by `on`. */
export interface Transition {
	readonly on: string
	readonly input: Data
	readonly from: Snapshot
	readonly to: Snapshot
}

export type Listener = (transition: Transition) => void

/** A pattern parsed into its three coordinates, with the listener alongside. */
type Registration = readonly [
	from: string,
	input: string | undefined,
	to: string | undefined,
	listener: Listener,
]

/** A running machine: the only mutable thing in the design. */
export interface Host {
	readonly current: Snapshot
	readonly available: readonly string[]
	readonly send: (name: string, payload?: unknown) => void
	readonly on: (pattern: string, listener: Listener) => () => void
}

/** A declared machine. Inert, shareable, and never mutated by running one. */
export interface Machine {
	readonly start: (data?: unknown) => Host
}
