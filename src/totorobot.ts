/**
 * Totorobot — finite state machines declared as a transition table. One
 * definition builder, one host, no dependencies. The API is specified in
 * `README.md` and argued in `docs/design-record.md`, whose sections are cited
 * by number and title (§9 Actions); the compiler behaviour behind the type
 * layer is in `docs/implementation-record.md`, cited as In. Comments state the
 * consequence and cite the argument.
 *
 * The runtime is golfed (I15): minification strips comments and renames locals,
 * so only code *shape* is left to spend (I16), and `pnpm size` arbitrates. The
 * type layer is erased and free. The export list is the API; the rest is
 * module-local — in the emitted declarations, so signatures resolve, but not
 * importable. Data is never validated: naming something absent is a silent
 * no-op, and only a malformed key or a chain that never settles throws.
 */

// ---------------------------------------------------------------------------
// Declining
// ---------------------------------------------------------------------------

/** A module-level `const` symbol types as `unique symbol`: `Skip` needs no brand. */
const SKIP = Symbol()

/** What `skip()` returns. Part of every handler's return type. */
export type Skip = typeof SKIP

/** One shared function for every call: the sentinel captures nothing (I16). */
let skip = (): Skip => SKIP

// ---------------------------------------------------------------------------
// The key grammar
// ---------------------------------------------------------------------------

/**
 * Both separators carry their space, which is what fixes the spelling and what
 * leaves an unlabelled arrow's label empty: hence `''` as the label wildcard.
 * Shared by `machine()` and `observe()`, so the two cannot drift.
 */
let parse = (
	key: string,
	parts = key.split(/ -|> /),
): [from: string, input: string, to: string] => {
	if (parts.length !== 3 || !parts[0] || !parts[2]) {
		throw SyntaxError(`not a transition: '${key}'`)
	}
	return parts as [string, string, string]
}

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

type InputVocab = object
type AnyInputs = Record<string, unknown>
type StateVocab = { readonly name: string }

type IsUnion<T, Whole = T> = T extends Whole
	? [Whole] extends [T]
		? false
		: true
	: never

/** `object` admits interfaces; this check rejects non-map shapes (I30). */
type InputMap<I extends InputVocab> = true extends IsUnion<I>
	? never
	: I extends readonly unknown[] | Function
		? never
		: Exclude<keyof I, string> extends never
			? unknown
			: never

/**
 * Lands an omitted property and an explicit `undefined` on the same type;
 * constraining the raw parameter to bare `T` widens the explicit case instead
 * (I19).
 */
type Declared<Raw, Default> = Raw extends undefined ? Default : Raw

type InputName<I extends InputVocab> = keyof I & string
type StateName<S extends StateVocab> = S['name']

// ---------------------------------------------------------------------------
// The key grammar, at the type level
// ---------------------------------------------------------------------------

/**
 * A union, not a validating conditional, because a union is what an editor
 * offers as completions — |states|² × |inputs| of them, priced in §12 Sending
 * inputs.
 */
type Key<I extends InputVocab, S extends StateVocab> =
	| `${StateName<S>} -${InputName<I>}> ${StateName<S>}`
	| `${StateName<S>} -> ${StateName<S>}`

/** A leading `infer` stops at the first separator, so these agree with `parse`. */
type From<K> = K extends `${infer F} -${string}> ${string}` ? F : never
type Label<K> = K extends `${string} -${infer L}> ${string}` ? L : never
type To<K> = K extends `${string} -${string}> ${infer T}` ? T : never

/**
 * `*` collides with the pattern wildcard, a padded name with the grammar's own
 * delimiters: a key minting either names a state nothing can address (§5 The
 * declared vocabulary).
 */
type RoundTrips<N extends string> = N extends '*' | ` ${string}` | `${string} `
	? never
	: N

/**
 * The vocabulary when `inputs` is omitted, read off the raw keys `K`, a sibling
 * parameter already inferred. Only inferred names are filtered, never declared.
 */
type InputsFromKeys<K extends string> = {
	[N in RoundTrips<Exclude<Label<K>, ''>>]: unknown
}

/** The same for state names: map, then immediately index. */
type StatesFromKeys<K extends string> = {
	[N in RoundTrips<From<K> | To<K>>]: { readonly name: N } & Record<
		string,
		unknown
	>
}[RoundTrips<From<K> | To<K>>]

/** No `-*>`: the unlabelled arrow is the broad form, and a bare key is not one. */
type Wildcard<S extends StateVocab> = StateName<S> | '*'
type Pattern<
	I extends InputVocab = AnyInputs,
	S extends StateVocab = StateVocab,
> =
	| `${Wildcard<S>} -${InputName<I>}> ${Wildcard<S>}`
	| `${Wildcard<S>} -> ${Wildcard<S>}`

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * A handler's return for a payload-free target; an index-signature form is as
 * strict but reports through machinery the caller never wrote (I17).
 */
declare const emptyObjectTag: unique symbol
type EmptyObject = { readonly [emptyObjectTag]?: never }

/**
 * Checked row by row: a malformed key poisons its own value type, so
 * `not a transition: '…'` lands on that row, not on the whole table. The handler
 * is typed inline, not behind an alias over `S`, so a wrong-shaped return names
 * the one state the row targets (I18). `NoInfer` closes both handler parameters
 * as inference sites; without it every row is rejected (I14).
 */
type Table<I extends InputVocab, S extends StateVocab, K extends string> = {
	readonly [P in K]: P extends Key<I, S>
		? (args: {
				readonly state: NoInfer<Extract<S, { name: From<P> }>>
				readonly input: NoInfer<[Label<P>] extends [''] ? undefined : Label<P>>
				readonly inputData: NoInfer<
					[Label<P>] extends [''] ? undefined : I[Label<P> & keyof I]
				>
				readonly skip: () => Skip
			}) =>
				| (keyof Omit<Extract<S, { name: To<P> }>, 'name'> extends never
						? EmptyObject | void
						: string extends keyof Omit<Extract<S, { name: To<P> }>, 'name'>
							? Omit<Extract<S, { name: To<P> }>, 'name'> | void
							: Omit<Extract<S, { name: To<P> }>, 'name'>)
				| Skip
		: `not a transition: '${P}'`
}

// ---------------------------------------------------------------------------
// What a running machine is
// ---------------------------------------------------------------------------

type StateNamed<S extends StateVocab, N extends string> = Extract<
	S,
	{ name: N }
>

/** The wildcard rules of the runtime's own comparison, at the type level. */
type Select<Coordinate extends string, All extends string> = [
	Coordinate,
] extends ['*' | '']
	? All
	: Coordinate & All

/**
 * `send` is the whole declared vocabulary from every state, never narrowed to
 * what `from` or `to` handles: a queued input is read at drain time, by which
 * point the machine has moved, so the normal reaction sends something the state
 * it was notified about does not handle (§12 Sending inputs). Spelled into both
 * arms rather than intersected onto the union, so a discriminant still narrows
 * the record.
 */
type Send<I extends InputVocab> = (
	...args: {
		[N in InputName<I>]: undefined extends I[N]
			? [input: N, inputData?: I[N]]
			: [input: N, inputData: I[N]]
	}[InputName<I>]
) => void

/**
 * Narrowed by the listener's own pattern. The immediate hop is a separate arm
 * because the mapped type is indexed by input name; a labelled pattern drops it.
 */
type Transition<
	I extends InputVocab = AnyInputs,
	S extends StateVocab = StateVocab,
	P extends string = '* -> *',
> =
	| {
			[N in Select<Label<P>, InputName<I>>]: {
				readonly input: N
				readonly inputData: I[N]
				readonly from: StateNamed<S, Select<From<P>, StateName<S>>>
				readonly to: StateNamed<S, Select<To<P>, StateName<S>>>
				readonly send: Send<I>
			}
	  }[Select<Label<P>, InputName<I>>]
	| ([Label<P>] extends ['']
			? {
					readonly input: undefined
					readonly inputData: undefined
					readonly from: StateNamed<S, Select<From<P>, StateName<S>>>
					readonly to: StateNamed<S, Select<To<P>, StateName<S>>>
					readonly send: Send<I>
				}
			: never)

type Listener<
	I extends InputVocab = AnyInputs,
	S extends StateVocab = StateVocab,
	P extends string = '* -> *',
> = (transition: Transition<I, S, P>) => void

// ---------------------------------------------------------------------------
// Actions
//
// Every action takes the same one argument, whichever kind of trigger fired it:
// the transition record, `send` included, exactly what a matching listener
// receives (§9 Actions). A residency trigger is an arrival, so its `to` is the
// resident state; an edge trigger's is whatever its pattern targets. One shape
// across both kinds and `observe`, rather than a bag per
// kind that would carry `send` twice. Only the return types differ, and only to
// keep a teardown from being stranded on an edge.
// ---------------------------------------------------------------------------

/** What a residency action may return, to release what it opened on exit. */
type Teardown = () => void

/**
 * Entering the initial state is the one arrival no transition caused, so
 * `from` and `input` are `undefined` there. Its own arm rather than a widened
 * `Transition`, which `observe` and every edge share: `input: undefined`
 * already discriminates an immediate hop, so `from: undefined` extends that
 * vocabulary instead of inventing a second one (§9 Actions).
 */
type Initial<I extends InputVocab, S extends StateVocab, N extends string> = {
	readonly input: undefined
	readonly inputData: undefined
	readonly from: undefined
	readonly to: NoInfer<StateNamed<S, N>>
	readonly send: Send<I>
}

/**
 * Fires on arrival at its state, by any route `* -> N` covers; the teardown it
 * returns runs on exit (§9 Actions). The trailing `| void` is not the
 * bivariance hole it looks like — that only opens when a signature's return
 * type *is* `void`, not when `void` is one arm of a union, where an explicit
 * wrong-shaped or `async` return is still rejected (I27). It is what lets a
 * setup with nothing to tear down end in a plain statement rather than an
 * explicit `return undefined`.
 */
type ResidencyAction<
	I extends InputVocab,
	S extends StateVocab,
	N extends string,
> = (
	arrival: NoInfer<Transition<I, S, `* -> ${N}`>> | Initial<I, S, N>,
) => undefined | Teardown | void

/**
 * Not bare `void`: that alone lets a function return anything, `Teardown`
 * included, stranding it uncalled on every matching edge. Unioned with
 * `undefined` the hole closes — an explicit `Teardown` return is still
 * rejected (I27) — while still taking a plain block body with nothing to
 * return.
 */
type EdgeAction<
	I extends InputVocab,
	S extends StateVocab,
	P extends string,
> = (transition: NoInfer<Transition<I, S, P>>) => undefined | void

/**
 * An action is its run function alone, a record with `run`, or an array of
 * either — declaration order for setup, reverse for teardown. `Extra` widens
 * the record with fields only some kinds take, so the same shape serves an
 * edge (nothing extra) and a residency (`restart`) alike (§9 Actions).
 */
type Action<Run, Extra extends object = {}> =
	| Run
	| ({ readonly run: Run } & Extra)
	| readonly (Run | ({ readonly run: Run } & Extra))[]

/**
 * `restart` is consulted only on a self-transition; the default is to restart
 * (§9 Actions). `NoInfer` on the predicate's parameters for the same reason
 * `Table`'s handler needs it on `state` (I14): unguarded, a block-bodied
 * predicate reopens `S` as an inference site and the whole table collapses
 * (I28).
 */
type Restart<N extends StateVocab> = {
	readonly restart?: boolean | ((from: NoInfer<N>, to: NoInfer<N>) => boolean)
}

/**
 * Checked row by row, like `Table`: decidable from the string alone (§9
 * Actions), an edge-shaped key (`from -input> to`, wildcards included) against
 * `Pattern`, else a bare key against the declared state names. Either miss
 * reports its own `not a trigger: '…'` rather than poisoning a well-formed
 * neighbour. `restart` has no meaning on an edge, so only the residency arm
 * widens with it.
 */
type Actions<I extends InputVocab, S extends StateVocab, A extends string> = {
	readonly [P in A]: P extends `${string} -${string}> ${string}`
		? P extends Pattern<I, S>
			? Action<EdgeAction<I, S, P>>
			: `not a trigger: '${P}'`
		: P extends StateName<S>
			? Action<ResidencyAction<I, S, P>, Restart<StateNamed<S, P>>>
			: `not a trigger: '${P}'`
}

/**
 * What `observe` takes for a bare state key: a residency action alone or in a
 * `{ run, restart }` record, the same two shapes `Actions` allows for one —
 * everything but the array, which a caller gets by calling `observe` twice (§11
 * The host).
 */
type ObserveAction<
	I extends InputVocab,
	S extends StateVocab,
	N extends string,
> =
	| ResidencyAction<I, S, N>
	| ({ readonly run: ResidencyAction<I, S, N> } & Restart<StateNamed<S, N>>)

/** Arity follows the initial state's payload, by `Table`'s three-way rule. */
type Start<S extends StateVocab, Init extends string> = keyof Omit<
	Extract<S, { name: Init }>,
	'name'
> extends never
	? []
	: string extends keyof Omit<Extract<S, { name: Init }>, 'name'>
		? [data?: Omit<Extract<S, { name: Init }>, 'name'>]
		: [data: Omit<Extract<S, { name: Init }>, 'name'>]

/** A running machine: the only mutable thing in the design. */
interface Host<
	I extends InputVocab = AnyInputs,
	S extends StateVocab = StateVocab,
> {
	readonly current: S
	readonly send: Send<I>
	// Generic in the pattern, so a listener's record is narrowed by it. A bare
	// state key is the second, overloaded form: the same record `actions` takes
	// for a residency, minus the array — call `observe` again for a second one —
	// and minus the third-argument options form, deliberately not added (§11 The
	// host).
	readonly observe: {
		<P extends Pattern<I, S>>(
			pattern: P,
			listener: Listener<I, S, P>,
		): () => void
		<N extends StateName<S>>(
			pattern: N,
			action: ObserveAction<I, S, N>,
		): () => void
	}
}

/** Nothing at runtime; a function position keeps the three inferable together. */
declare const vocabulary: unique symbol
interface Vocabulary<
	I extends InputVocab,
	S extends StateVocab,
	K extends string,
> {
	readonly [vocabulary]?: (declared: readonly [I, S, K]) => void
}

/** A declared machine. Inert, shareable, and never mutated by running one. */
interface Machine<
	I extends InputVocab = AnyInputs,
	S extends StateVocab = StateVocab,
	K extends string = string,
	Init extends string = string,
> extends Vocabulary<I, S, K> {
	readonly start: (...data: Start<S, Init>) => Host<I, S>
}

// ---------------------------------------------------------------------------
// Reading a machine type back out
// ---------------------------------------------------------------------------

/** All three at once, because matching `Machine` itself simply fails (I22). */
type Carried<M> =
	M extends Vocabulary<infer I, infer S, infer K>
		? { inputs: I; states: S; keys: K }
		: never

/** The input vocabulary a machine was declared with. */
export type InputsOf<M> = Carried<M>['inputs']

/** The state vocabulary a machine was declared with. */
export type StatesOf<M> = Carried<M>['states']

/** The inputs state `S` has rows for; `Exclude<…, ''>` drops immediate rows. */
export type Handled<M, S extends string> = Exclude<
	Label<Extract<Carried<M>['keys'], `${S} -${string}> ${string}`>>,
	''
>

/** The states that can reach `S`: the reverse index, from the same keys. */
export type Sources<M, S extends string> = From<
	Extract<Carried<M>['keys'], `${string} -${string}> ${S}`>
>

// ---------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------

/** One shape for every handler; input data is opaque to dispatch (I23). */
type UncheckedHandler = (args: {
	readonly state: StateVocab
	readonly input: string | undefined
	readonly inputData: unknown
	readonly skip: () => Skip
}) => object | undefined | Skip

type Row = readonly [to: string, handler: UncheckedHandler]

interface UncheckedHost {
	readonly current: StateVocab
	readonly send: (input: string, inputData?: unknown) => void
	readonly observe: (
		pattern: string,
		action: Listener | ActionItem,
	) => () => void
}

/**
 * Every row of the table, in order, under the pair that reaches it; an immediate
 * row's input half is empty, and `send` never builds an empty one, so it stays
 * unreachable from there. One flat map rather than a map of maps, and
 * null-prototype, so `send('toString')` finds nothing to call (I16).
 */
type Index = Record<string, Row[] | undefined>

/**
 * Carries a vocabulary at the type level and returns `undefined`, all a caller
 * observes. `T | undefined` needs no cast; `machine` subtracts it back out.
 */
export let type = <T>(): T | undefined => undefined

/**
 * One queue and one flag for every host: peer composition is two machines wired
 * to each other, and rule 4 holds across that wiring (§11 The host). A thunk
 * closes over whichever host queued it.
 */
let queue: (() => void)[] = []
let draining = 0

/**
 * Run `work`, and everything it queues, as one dispatch: the window rule 4 is
 * stated in terms of. Named for that window rather than for the `draining` flag.
 * `start` passes the chain it settles inline; `send` has queued its work already
 * and passes nothing, hence the optional parameter (I16). Inside a window the
 * outermost call drains what was pushed; outside one, this call does.
 */
let dispatch = (work?: () => void): void => {
	// Already inside a dispatch: the outermost call owns the drain. Raising the
	// flag is the same expression that tests it; only the outermost reads a zero.
	if (draining++) return work?.()
	try {
		work?.()
		// Live iteration, not a shift loop: the iterator re-reads `length`, so work
		// queued by running work is picked up in the same pass. The `finally`
		// empties the queue either way.
		for (let run of queue) run()
	} finally {
		// In a `finally` so a throwing listener leaves every host usable; the queue is
		// abandoned, not drained, and what committed stays committed.
		queue.length = draining = 0
	}
}

/**
 * One row from a key and an item, bare or arrow alike: shared by the `actions`
 * block and a bare-key `observe`, so a caller-side residency and a declared one
 * parse identically (§11 The host). `item.run ?? item` reads both item shapes
 * at once: a plain function has no `run`, and a value carrying one is a record
 * that happens to be callable, not the reverse. An arrow row stops at its
 * handler, `key` and `restart` meaning nothing on one (I16).
 */
let toRow = (key: string, item: UncheckedItem): Registration => {
	let run = item.run ?? item
	return / -|> /.test(key)
		? ([...parse(key), run] as Registration)
		: (['*', '', key, run, key, item.restart] as Registration)
}

/**
 * Declare a machine. The result is inert data: the index lives in a closure,
 * the configuration object is never touched, and only `start` is exposed. Keys
 * are parsed once, so dispatch is a lookup rather than a scan (I16).
 *
 * `inputs` and `states` are the vocabulary's only inference sites, both optional
 * — omitting one keeps the names `transitions` mentions and widens only their
 * data. `initial` is a `NoInfer` position rather than a third site (I21),
 * intersected with `Init` to recover its name, which is what lets `start`
 * follow the initial state's data. `RawI`/`RawS` are what the properties infer
 * to and `I`/`S` the resolved vocabularies; collapsing each pair into one fails
 * (I19), and the defaults hold only because `Table`'s `NoInfer` closes the
 * handler parameters — as would overloads, at the cost of per-row diagnostics
 * (I14). `K` comes from the mapped type in `transitions`, with no second one
 * beside it (I20). `A` is the same idea again for `actions`: inferred from that
 * block's own keys, contributing nothing back to `I`, `S` or `K` (§9 Actions).
 */
export let machine: <
	Init extends string,
	K extends string,
	RawI extends InputVocab | undefined = undefined,
	RawS extends StateVocab | undefined = undefined,
	I extends InputVocab = Declared<RawI, InputsFromKeys<K>>,
	S extends StateVocab = Declared<RawS, StatesFromKeys<K>>,
	A extends string = never,
>(definition: {
	readonly initial: Init & StateName<NoInfer<S>>
	// `| undefined` is what `type()` returns, and inference subtracts it. Spelled
	// out because `exactOptionalPropertyTypes` makes `?:` a different thing.
	readonly inputs?:
		| (RawI & InputMap<Exclude<RawI, undefined>>)
		| undefined
	readonly states?: RawS | undefined
	readonly transitions: Table<I, S, K>
	readonly actions?: Actions<I, S, A> | undefined
}) => Machine<I, S, K, Init> =
	// The implementation, never seen by a caller through the annotation above.
	// `unknown` because a row's value can be the poison string literal, which no
	// concrete type implements (I23).
	((definition: unknown): unknown => {
		let { initial, transitions, actions } = definition as unknown as {
			readonly initial: string
			readonly transitions: Readonly<Record<string, UncheckedHandler>>
			readonly actions?: Readonly<
				Record<string, ActionItem | readonly ActionItem[]>
			>
		}
		let index: Index = Object.create(null)

		// One flat keyspace for both kinds of row, keyed by the `from`/`input` pair
		// with the length of `from` in front. Names are arbitrary strings, so no
		// character is free to be a separator; a length is (I16). Spelled out at all
		// three sites rather than shared, which measures smaller (I16).
		for (let key in transitions) {
			let [from, input, to] = parse(key)
			;(index[from.length + '\0' + from + input] ??= []).push([
				to,
				transitions[key]!,
			])
		}

		// Residency on `N` is stored as the pattern `* -> N`, the teardown key alone
		// telling the two kinds apart, so one loop matches both and listeners
		// besides (I16). A bare key naming nothing declared is a silent no-op, as
		// everywhere else; an arrow goes through `parse`, which throws on a
		// malformed one. An array is unwrapped to one row per element (§9 Actions).
		let actionRows: Registration[] = []
		for (let key in actions) {
			for (let item of [actions[key]!].flat())
				actionRows.push(toRow(key, item as UncheckedItem))
		}

		return {
			start: (data?: object): UncheckedHost => {
				// A closure variable behind a getter, not a property `send` mutates:
				// measured smaller (I16). `current` is the whole tagged state.
				let current: StateVocab = { ...data, name: initial }

				// Copy-on-write at registration, iteration at dispatch: allocation lands on
				// the path that runs least, and it measures smaller (I16).
				let listeners: Registration[] = []

				// A fresh row per host: a teardown is written on the row itself, and
				// `actionRows` belongs to the definition (§9 Actions). `listeners` needs no
				// copy; `observe` builds its rows host-local already.
				let acts = actionRows.map((row) => [...row] as Registration)

				// A teardown runs at most once: `void` blanks the slot in the same
				// assignment that calls it (I16).
				let clear = (row: Registration) => (row[6] = void row[6]?.())

				// The wildcard rules once, for actions, residencies and listeners alike:
				// `*` and `''` stand for any, and a missing `from` — the initial arrival,
				// which no transition caused — matches no edge row, so that case needs no
				// branch of its own (§9 Actions). Only a residency has a teardown key,
				// stores what it returns, and gates setup on a self-transition by
				// `row[7]`, the decision `step` already made below: one call to
				// `restart` serves both halves of the same residency's hop (§9 Actions).
				let fire = (list: Registration[], e: Arrival): void => {
					for (let row of list) {
						let [f, l, t, run, key] = row
						if (
							(f === '*' || f === e.from?.name) &&
							(l === '' || l === e.input) &&
							(t === '*' || t === e.to.name) &&
							(!key || e.to.name !== e.from?.name || row[7])
						) {
							let teardown = run(e)
							if (key) row[6] = teardown as Teardown | undefined
						}
					}
				}

				// The arrival no transition caused: `from` and `input` are simply absent
				// (§9 Actions). Shared by `start` and a bare-key `observe`, which goes
				// through `fire` for the `to === state` test its third clause already does.
				let enter = (list: Registration[]): void =>
					fire(list, { to: current, send } as Arrival)

				// One scanning path for both kinds of transition: commit the first row
				// that does not decline, report whether the machine moved. Fusing it with
				// the chain below, or splitting a `commit` out of it, measured larger (I16).
				let step = (
					rows: Row[] = [],
					input?: string,
					inputData?: unknown,
				): boolean => {
					for (let [to, handler] of rows) {
						let payload = handler({ state: current, input, inputData, skip })
						// Declining is ordinary and silent: try the next row for this pair.
						if (payload !== SKIP) {
							let from = current
							let next: StateVocab = { ...payload, name: to }

							// The residency being left tears down before the commit, actions
							// before listeners, each in reverse declaration order, so several on
							// one trigger unwind like a stack. A throw here abandons the hop with
							// nothing committed and the later teardowns unrun (§9 Actions). `false`
							// survives, a predicate decides from the two states either side,
							// anything else restarts, an omitted `restart` included; `.call` is the
							// cheapest thing only a function has. `row[7]` banks that one decision
							// for `fire` to reuse below, on that same row's setup, so a predicate
							// the caller wrote once is asked once (§9 Actions).
							for (let list of [acts, listeners]) {
								for (let row of list.toReversed()) {
									if (
										row[4] === from.name &&
										(to !== from.name ||
											(row[7] = (row[5] as Predicate)?.call
												? (row[5] as Predicate)(from, next)
												: row[5] !== false))
									) {
										clear(row)
									}
								}
							}

							// Commit, then notify, so every listener sees a machine that agrees
							// with the record. The tag is spread last, so a handler that spread
							// its source in cannot leave the source's tag behind.
							current = next
							// The same `send` the host exposes: a reaction drives the machine
							// without closing over the host it was registered on.
							let record: Arrival = {
								input,
								inputData,
								from,
								to: current,
								send,
							}

							// Actions in declaration order, then listeners (§9 Actions).
							fire(acts, record)
							fire(listeners, record)
							// One input yields at most one transition.
							return true
						}
					}
					return false
				}

				// A chain is one arrival's worth of work, however many hops; the budget is
				// per call, so settling the initial state does not spend the first send's.
				let settle = (): void => {
					let hops = 1e5
					while (step(index[current.name.length + '\0' + current.name])) {
						// Counted down rather than up: the budget is the whole test. Far above
						// any real chain, and `'a -> a'` rewriting its own data terminates.
						if (!hops--) {
							throw RangeError(
								`maximum transitions reached in '${current.name}'`,
							)
						}
					}
				}
				// Declared before the first `step` runs, because every transition record
				// carries it; the host below re-exports this binding. The work is queued
				// rather than run, wherever the call came from. Pushed before `dispatch`
				// rather than inside a `work` closure, which measures smaller (I16).
				let send = (input: string, inputData?: unknown): void => {
					queue.push(() => {
						// Read at drain time, so a queued send may correctly find no row.
						if (
							step(
								index[current.name.length + '\0' + current.name + input],
								input,
								inputData,
							)
						)
							settle()
					})
					dispatch()
				}

				// Under the drain `send` takes, so a send from one of these hops runs after
				// the chain settles (§11 The host, "`start` settles under the drain").
				// Entering `initial` is not a transition, so no `from` — which is what an
				// edge row, wildcard source included, needs to fire (§9 Actions, "the
				// startup slice"); `row[4]` is the teardown key only a residency row has,
				// so filtering on it is what keeps startup residency-only.
				dispatch(() => {
					enter(acts.filter((row) => row[4]))
					settle()
				})

				return {
					get current(): StateVocab {
						return current
					},

					observe: (
						pattern: string,
						action: Listener | ActionItem,
					): (() => void) => {
						// `toRow` reads a bare `pattern` as residency on that state, the same
						// as a bare key in `actions`, so the two share one parser (§11 The
						// host).
						let registration = toRow(pattern, action as UncheckedItem)
						listeners = [...listeners, registration]
						// Already resident when observed: no arrival will announce it, so it runs
						// once here instead, registration order never deciding whether a
						// residency fires (§11 The host). The teardown key is the residency
						// guard; `fire` tests `to` against the current state itself.
						if (registration[4]) enter([registration])
						// Idempotent (§11 The host), and a residency in flight tears down on
						// the way out.
						return () => {
							listeners = listeners.filter((other) => other != registration)
							clear(registration)
						}
					},

					send,
				}
			},
		} as unknown
	}) as typeof machine

/**
 * What `fire` hands whatever it matched. The transition record, except that
 * `from` is absent on the initial state's arrival, which no transition caused;
 * only an action can see that one, since a missing `from` matches no edge (§9
 * Actions).
 */
type Arrival = {
	readonly input: string | undefined
	readonly inputData: unknown
	readonly from: StateVocab | undefined
	readonly to: StateVocab
	readonly send: (input: string, inputData?: unknown) => void
}

/**
 * One row shape for a listener, an edge action and a residency action alike: a
 * parsed pattern and what to run. `key` is the state a residency is on, absent
 * on the other two, and the only thing telling them apart, which is what lets
 * `fire` serve all three (I16). `teardown` is a residency's own return, read
 * back on departure or on unsubscribing. `restarted` is `step`'s self-transition
 * decision, banked for `fire` to reuse: the row's own scratch slot, since a
 * shared cache would mix up two residents of one state (§9 Actions). Not
 * `readonly`: both are written in place, on the row's identity, which is why a
 * host copies `actionRows` first (§9 Actions).
 */
type Registration = [
	from: string,
	input: string,
	to: string,
	run: (arrival: Arrival) => unknown,
	key?: string,
	restart?: boolean | ((from: StateVocab, to: StateVocab) => boolean),
	teardown?: Teardown | undefined,
	restarted?: boolean,
]

/** One action, unchecked: a run function alone or in a record (I23). */
type ActionItem =
	| Registration[3]
	| { readonly run: Registration[3]; readonly restart?: Registration[5] }

/** The two item shapes as one: a union hides `run` on the function arm (I23). */
type UncheckedItem = Registration[3] & {
	readonly run?: Registration[3]
	readonly restart?: Registration[5]
}

/** The predicate arm of `restart`, the only arm with a `.call` to test (I23). */
type Predicate = Extract<Registration[5], Function>
