/**
 * Totorobot — finite state machines declared as a transition table. One
 * definition builder, one host, no dependencies. The API is specified in
 * `README.md` and argued in `docs/design-record.md` (cited as §n); the compiler
 * behaviour behind the type layer is in `docs/implementation-record.md` (cited
 * as In). Comments state the consequence and cite the argument.
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

type InputVocab = { readonly type: string }
type StateVocab = { readonly name: string }

/**
 * Lands an omitted property and an explicit `undefined` on the same type;
 * constraining the raw parameter to bare `T` widens the explicit case instead
 * (I19).
 */
type Declared<Raw, Default> = Raw extends undefined ? Default : Raw

type InputType<I extends InputVocab> = I['type']
type StateName<S extends StateVocab> = S['name']

// ---------------------------------------------------------------------------
// The key grammar, at the type level
// ---------------------------------------------------------------------------

/**
 * A union, not a validating conditional, because a union is what an editor
 * offers as completions — |states|² × |inputs| of them (§12 prices it).
 */
type Key<I extends InputVocab, S extends StateVocab> =
	| `${StateName<S>} -${InputType<I>}> ${StateName<S>}`
	| `${StateName<S>} -> ${StateName<S>}`

/** A leading `infer` stops at the first separator, so these agree with `parse`. */
type From<K> = K extends `${infer F} -${string}> ${string}` ? F : never
type Label<K> = K extends `${string} -${infer L}> ${string}` ? L : never
type To<K> = K extends `${string} -${string}> ${infer T}` ? T : never

/**
 * `*` collides with the pattern wildcard, a padded name with the grammar's own
 * delimiters: a key minting either names a state nothing can address (§5).
 */
type RoundTrips<N extends string> = N extends '*' | ` ${string}` | `${string} `
	? never
	: N

/**
 * The vocabulary when `inputs` is omitted, read off the raw keys `K`, a sibling
 * parameter already inferred. Only inferred names are filtered, never declared.
 */
type InputsFromKeys<K extends string> = {
	[N in RoundTrips<Exclude<Label<K>, ''>>]: { readonly type: N } & Record<
		string,
		unknown
	>
}[RoundTrips<Exclude<Label<K>, ''>>]

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
	I extends InputVocab = InputVocab,
	S extends StateVocab = StateVocab,
> =
	| `${Wildcard<S>} -${InputType<I>}> ${Wildcard<S>}`
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
				readonly input: NoInfer<
					[Label<P>] extends [''] ? undefined : Extract<I, { type: Label<P> }>
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
 * it was notified about does not handle (§12). Spelled into both arms rather
 * than intersected onto the union, so a discriminant still narrows the record.
 */
type Send<I extends InputVocab> = (input: I) => void

/**
 * Narrowed by the listener's own pattern. The immediate hop is a separate arm
 * because the mapped type is indexed by input type; a labelled pattern drops it.
 */
type Transition<
	I extends InputVocab = InputVocab,
	S extends StateVocab = StateVocab,
	P extends string = '* -> *',
> =
	| {
			[N in Select<Label<P>, InputType<I>>]: {
				readonly input: Extract<I, { type: N }>
				readonly from: StateNamed<S, Select<From<P>, StateName<S>>>
				readonly to: StateNamed<S, Select<To<P>, StateName<S>>>
				readonly send: Send<I>
			}
	  }[Select<Label<P>, InputType<I>>]
	| ([Label<P>] extends ['']
			? {
					readonly input: undefined
					readonly from: StateNamed<S, Select<From<P>, StateName<S>>>
					readonly to: StateNamed<S, Select<To<P>, StateName<S>>>
					readonly send: Send<I>
				}
			: never)

type Listener<
	I extends InputVocab = InputVocab,
	S extends StateVocab = StateVocab,
	P extends string = '* -> *',
> = (transition: Transition<I, S, P>) => void

// ---------------------------------------------------------------------------
// Actions
//
// Every action takes the same one argument, whichever kind of trigger fired
// it: the transition record, `send` included, exactly what a matching listener
// receives (§9). A residency trigger is an arrival, so its `to` is the resident
// state; an edge trigger's is whatever its pattern targets. One shape across
// both kinds and `observe`, rather than a bag per kind that would carry `send`
// twice. Only the return types differ, and only to keep a teardown from being
// stranded on an edge.
// ---------------------------------------------------------------------------

/** What a residency action may return, to release what it opened on exit. */
type Teardown = () => void

/**
 * Entering the initial state is the one arrival no transition caused, so
 * `from` and `input` are `undefined` there. Its own arm rather than a widened
 * `Transition`, which `observe` and every edge share: `input: undefined`
 * already discriminates an immediate hop, so `from: undefined` extends that
 * vocabulary instead of inventing a second one (§9).
 */
type Initial<I extends InputVocab, S extends StateVocab, N extends string> = {
	readonly input: undefined
	readonly from: undefined
	readonly to: NoInfer<StateNamed<S, N>>
	readonly send: Send<I>
}

/**
 * Fires on arrival at its state, by any route `* -> N` covers; the teardown it
 * returns runs on exit (§9). The trailing `| void` is not the bivariance hole
 * it looks like — that only opens when a signature's return type *is* `void`,
 * not when `void` is one arm of a union, where an explicit wrong-shaped or
 * `async` return is still rejected (I27). It is what lets a setup with nothing
 * to tear down end in a plain statement rather than an explicit
 * `return undefined`.
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
 * edge (nothing extra) and a residency (`restart`) alike (§9).
 */
type Action<Run, Extra extends object = {}> =
	| Run
	| ({ readonly run: Run } & Extra)
	| readonly (Run | ({ readonly run: Run } & Extra))[]

/**
 * `restart` is consulted only on a self-transition; the default is to restart
 * (§9). `NoInfer` on the predicate's parameters for the same reason `Table`'s
 * handler needs it on `state` (I14): unguarded, a block-bodied predicate
 * reopens `S` as an inference site and the whole table collapses (I28).
 */
type Restart<N extends StateVocab> = {
	readonly restart?: boolean | ((from: NoInfer<N>, to: NoInfer<N>) => boolean)
}

/**
 * Checked row by row, like `Table`: decidable from the string alone (§9), an
 * edge-shaped key (`from -input> to`, wildcards included) against `Pattern`,
 * else a bare key against the declared state names. Either miss reports its
 * own `not a trigger: '…'` rather than poisoning a well-formed neighbour.
 * `restart` has no meaning on an edge, so only the residency arm widens with it.
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
 * everything but the array, which a caller gets by calling `observe` twice (§11).
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
	I extends InputVocab = InputVocab,
	S extends StateVocab = StateVocab,
> {
	readonly current: S
	readonly send: Send<I>
	// Generic in the pattern, so a listener's record is narrowed by it. A bare
	// state key is the second, overloaded form: the same record `actions` takes
	// for a residency, minus the array — call `observe` again for a second one
	// — and minus the third-argument options form, deliberately not added (§11).
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
	I extends InputVocab = InputVocab,
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

/** One shape for every handler: dispatch reads `.name` and `.type`, nothing else (I23). */
type UncheckedHandler = (args: {
	readonly state: StateVocab
	readonly input: InputVocab | undefined
	readonly skip: () => Skip
}) => object | undefined | Skip

type Row = readonly [to: string, handler: UncheckedHandler]

interface UncheckedHost {
	readonly current: StateVocab
	readonly send: (input: InputVocab) => void
	readonly observe: (
		pattern: string,
		action: Listener | ActionItem,
	) => () => void
}

/**
 * Every row of the table, in order, under the pair that reaches it: a labelled
 * row under `from \0 input`, an immediate one under `from` alone. One flat map
 * rather than a map of maps — smaller to build and to read (I16) — and the two
 * key shapes are what keeps an immediate unreachable from `send`, which would
 * otherwise find it by sending the empty input type. Null-prototype, so
 * `send({ type: 'toString' })` finds nothing to call (I16).
 */
type Index = Record<string, Row[] | undefined>

/**
 * Carries a vocabulary at the type level and returns `undefined`, all a caller
 * observes. `T | undefined` needs no cast; `machine` subtracts it back out.
 */
export let type = <T>(): T | undefined => undefined

/**
 * One queue and one flag for every host: peer composition is two machines wired
 * to each other, and rule 4 holds across that wiring (§11). A thunk closes over
 * whichever host queued it.
 */
let queue: (() => void)[] = []
let draining = 0

/**
 * Run `work`, and everything it queues, as one dispatch: the window rule 4 is
 * stated in terms of. Named for that window rather than for the `draining` flag.
 * `start` passes the chain it settles inline; `send` passes a `work` that only
 * pushes. One shape serves both, either side of the flag: inside a window the
 * outermost call drains what was pushed, outside one this call does.
 */
let dispatch = (work: () => void): void => {
	// Already inside a dispatch: the outermost call owns the drain. Raising the
	// flag is the same expression that tests it — only the outermost call reads
	// a zero — and the `finally` below puts it back down.
	if (draining++) return work()
	try {
		work()
		// Live iteration, not a shift loop: the array iterator re-reads `length`
		// every step, so work queued by work already running is picked up in the
		// same pass, and the `finally` below is what empties the queue either way.
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
 * parse identically (§11). A bare key is one with no separator anywhere in it,
 * which is the same test as splitting it and counting one piece, spelled as the
 * match it already is, and `item.run ?? item` reads both item shapes at once —
 * a plain function has no `run`. An arrow row stops at its handler: `key` and
 * `restart` mean nothing on one, and a row that simply ends is as good as a row
 * padded with the blanks nothing reads (I16).
 */
let toRow = (key: string, item: any): Registration => {
	let run = item.run ?? item
	return / -|> /.test(key)
		? ([...parse(key), run] as Registration)
		: ['*', '', key, run, key, item.restart]
}

/**
 * Declare a machine. The result is inert data: the index lives in a closure, the
 * configuration object is never touched, and only `start` is exposed. Keys are
 * parsed once, so dispatch is a lookup rather than a scan (I16).
 *
 * `inputs` and `states` are the vocabulary's only inference sites, and both are
 * optional — omitting one keeps the names `transitions` mentions and widens only
 * their data. `initial` is a `NoInfer` position rather than a third site (I21),
 * intersected with `Init` to recover its name, which is what lets `start` follow
 * the initial state's data. `RawI`/`RawS` are what the properties infer to and
 * `I`/`S` the resolved vocabularies; collapsing each pair into one fails (I19),
 * and the defaults hold only because `Table`'s `NoInfer` closes the handler
 * parameters — as would overloads, at the cost of per-row diagnostics (I14). `K`
 * comes from the mapped type in `transitions`, with no second one beside it (I20).
 * `A` is the same idea again for `actions`: inferred from that block's own
 * keys, contributing nothing back to `I`, `S` or `K` (§9).
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
	readonly inputs?: RawI | undefined
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

		// A labelled row is filed under its `from \0 input` pair, an immediate one
		// under `from` alone: `send` only ever builds the first shape, so an
		// immediate stays unreachable from it even for the empty input type, and
		// one flat map does the work two nested ones used to (I16).
		for (let key in transitions) {
			let [from, input, to] = parse(key)
			;(index[input ? from + '\0' + input : from] ??= []).push([
				to,
				transitions[key]!,
			])
		}

		// Residency on `N` *is* the pattern `* -> N`, so it is stored as one and only
		// the trailing teardown key tells the two kinds apart — which is what lets one
		// loop match both, and listeners besides (I16). A bare key is taken at face
		// value: naming a state nothing declares is a silent no-op, as everywhere else.
		// An arrow means `parse`, which throws on a malformed key like a row does.
		// A value is unwrapped to one row per array element, run and restart alike,
		// so the array arm costs nothing beyond this loop (§9).
		let actionRows: Registration[] = []
		for (let key in actions) {
			for (let item of [actions[key]!].flat()) actionRows.push(toRow(key, item))
		}

		return {
			start: (data?: object): UncheckedHost => {
				// A closure variable behind a getter, not a property `send` mutates:
				// measured smaller (I16). `current` is the whole tagged state.
				let current: StateVocab = { ...data, name: initial }

				// Copy-on-write at registration, iteration at dispatch: allocation lands on
				// the path that runs least, and it measures smaller (I16).
				let listeners: Registration[] = []

				// A fresh row per host: a residency's teardown lives on its own row
				// (below), and `actionRows` is the definition's, shared by every host of
				// it (§9). `listeners` needs no such copy — every row on it is already
				// host-local, built fresh by `observe` below.
				let acts = actionRows.map((row) => [...row] as Registration)

				// `false` survives; a predicate decides from the two full states either
				// side of the self-transition; anything else, including an omitted
				// `restart`, restarts (§9). `.call` is the cheapest thing only a function
				// has, and nothing here is validated anyway.
				let restarts = (
					r: Registration[5],
					from: StateVocab,
					to: StateVocab,
				): boolean => ((r as any)?.call ? (r as any)(from, to) : r !== false)

				// A teardown runs at most once: `void` discards whatever it returned and
				// blanks the slot in the same assignment, so nothing it happened to hand
				// back is ever left there to be called again (I16).
				let clear = (row: Registration) => (row[6] = void row[6]?.())

				// The wildcard rules, once, for actions, `observe`'s residencies and
				// listeners alike: `*` and `''` stand for any. A residency row carries a
				// teardown key and stores what it returns, on the row itself; an edge row
				// and a listener have no such key and do not. `from` is absent only for the
				// initial arrival, which no transition caused, and which this same loop
				// therefore fires without a case of its own (§9). A residency row on a
				// self-transition also consults `restart` here, not only in the departing
				// teardown below, so `restart: false` neither tears down nor sets up again.
				let fire = (list: Registration[], e: Arrival): void => {
					for (let row of list) {
						let [f, l, t, run, key, restart] = row
						if (
							(f === '*' || f === e.from?.name) &&
							(l === '' || l === e.input?.type) &&
							(t === '*' || t === e.to.name) &&
							(!key ||
								e.to.name !== e.from?.name ||
								restarts(restart, e.from!, e.to))
						) {
							let teardown = run(e)
							if (key) row[6] = teardown as Teardown | undefined
						}
					}
				}

				// The arrival no transition caused: `from` and `input` are simply absent,
				// which reads as `undefined` everywhere either is looked at, and which
				// matches no edge row (§9). Shared by `start` and a bare-key `observe`,
				// which is also why that one goes through `fire` rather than calling its
				// own row: the `to === state` test it needs is already the third clause.
				let enter = (list: Registration[]): void =>
					fire(list, { to: current, send } as Arrival)

				// One row-scanning path for both kinds of transition: commit the first row
				// that does not decline, and report whether the machine moved. Fusing this
				// with the chain below, or splitting a `commit` helper out of it, both
				// measured larger (I16).
				let step = (rows: Row[] = [], input?: InputVocab): boolean => {
					for (let [to, handler] of rows) {
						let payload = handler({ state: current, input, skip })
						// Declining is ordinary and silent: try the next row for this pair.
						if (payload !== SKIP) {
							let from = current
							let next: StateVocab = { ...payload, name: to }

							// The residency being left tears down before the commit, actions
							// before listeners and each in reverse declaration order, so several
							// on one trigger unwind like a stack; a throw here abandons the hop —
							// later teardowns unrun — with nothing of it committed yet (§9). A
							// self-transition consults each row's own `restart` instead of always
							// tearing down.
							for (let list of [acts, listeners]) {
								for (let row of list.toReversed()) {
									if (
										row[4] === from.name &&
										(to !== from.name || restarts(row[5], from, next))
									) {
										clear(row)
									}
								}
							}

							// Commit, then notify, so every listener sees a machine that agrees
							// with the record. The tag is spread last, so a handler that spread its
							// source into the return cannot leave the source's tag behind.
							current = next
							// The same `send` the host exposes: a reaction drives the machine
							// without closing over the host it was registered on.
							let record: Transition = { input, from, to: current, send }

							// Actions in block declaration order, then listeners, both given this
							// same record (§9).
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
					while (step(index[current.name])) {
						// Counted down rather than up: the budget is the whole test. Far above
						// any real chain — `'a -> a'` is legal, and a handler rewriting its own
						// data until it declines terminates.
						if (!hops--) {
							throw RangeError(
								`maximum transitions reached in '${current.name}'`,
							)
						}
					}
				}
				// Declared before the first `step` runs, because every transition record
				// carries it; the host below re-exports this one binding. The work is
				// queued rather than run, whether the call came from this host's listener,
				// another host's, or a hop `start` is settling. A block body, not an
				// expression one: `send` returns nothing, while `dispatch` inside a window
				// hands back whatever `work` returned.
				let send = (input: InputVocab): void => {
					dispatch(() =>
						queue.push(() => {
							// Read at drain time, so a queued send may correctly find no row.
							if (step(index[current.name + '\0' + input?.type], input))
								settle()
						}),
					)
				}

				// Under the drain `send` takes, so a send from one of these hops — the
				// initial state's own residency included — runs after the chain settles
				// (§11, "`start` settles under the drain"). Entering `initial` is not a
				// transition, so the arrival carries no `from`, which is also what stops
				// an edge row from matching it (§9).
				dispatch(() => {
					enter(acts)
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
						// as a bare key in `actions`, so the two share one parser (§11).
						let registration = toRow(pattern, action)
						listeners = [...listeners, registration]
						// Already resident when observed: no arrival will announce it, so it
						// runs once here instead — registration order cannot decide whether a
						// residency fires (§11). Only a residency, hence the teardown-key
						// guard; `fire` itself does the rest, `to` against the current state
						// included, so this needs no comparison of its own.
						if (registration[4]) enter([registration])
						// Idempotent, and a residency in flight tears down on the way out,
						// matching the disposer the caller-side recipe returns (§11).
						return () => {
							listeners = listeners.filter((other) => other != registration)
							clear(registration)
						}
					},

					send,
				}
			},
		} as unknown
	}) as any

/**
 * What `fire` hands whatever it matched. The transition record, except that
 * `from` is absent on the initial state's arrival, which no transition caused;
 * only an action can see that one, since a missing `from` matches no edge (§9).
 */
type Arrival = {
	readonly input: InputVocab | undefined
	readonly from: StateVocab | undefined
	readonly to: StateVocab
	readonly send: (input: InputVocab) => void
}

/**
 * One row shape for a listener, an edge action and a residency action alike:
 * a parsed pattern and what to run. `key` is the state a residency is on, and
 * absent on the two kinds that are not one — the only thing telling them apart,
 * which is what lets `fire` serve all three (I16). `teardown` is a residency's
 * own return, read back on departure or on unsubscribing; only a residency ever
 * has that slot, and only it ever writes to one (I23). Not `readonly`:
 * `teardown` is written in place, on the row's own identity, which is why a host
 * copies `actionRows` first rather than writing to the definition's shared rows
 * (§9).
 */
type Registration = [
	from: string,
	input: string,
	to: string,
	run: (arrival: Arrival) => unknown,
	key?: string,
	restart?: boolean | ((from: StateVocab, to: StateVocab) => boolean),
	teardown?: Teardown | undefined,
]

/** One action, unchecked: a run function alone or in a record (I23). */
type ActionItem =
	| Registration[3]
	| { readonly run: Registration[3]; readonly restart?: Registration[5] }
