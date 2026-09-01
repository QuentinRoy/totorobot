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
 * importable. Payloads are stored as supplied — never spread, cloned, frozen or
 * validated (§5 The declared vocabulary): naming something absent is a silent
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
//
// One shape for both: a map from a name to what that name carries, and
// `undefined` for a name that carries nothing (§5 The declared vocabulary).
// ---------------------------------------------------------------------------

type Vocab = object
type AnyVocab = Record<string, unknown>

type IsUnion<T, Whole = T> = T extends Whole
	? [Whole] extends [T]
		? false
		: true
	: never

/** `object` admits interfaces; this check rejects non-map shapes (I30). */
type VocabMap<V extends Vocab> =
	true extends IsUnion<V>
		? never
		: V extends readonly unknown[] | Function
			? never
			: Exclude<keyof V, string> extends never
				? unknown
				: never

/**
 * Lands an omitted property and an explicit `undefined` on the same type;
 * constraining the raw parameter to bare `T` widens the explicit case instead
 * (I19).
 */
type Declared<Raw, Default> = Raw extends undefined ? Default : Raw

type Name<V extends Vocab> = keyof V & string

/** The payload a name carries. `& keyof V` is the constraint, never a filter. */
type Payload<V extends Vocab, N extends string> = V[N & keyof V]

// ---------------------------------------------------------------------------
// The key grammar, at the type level
// ---------------------------------------------------------------------------

/**
 * A union, not a validating conditional, because a union is what an editor
 * offers as completions — |states|² × |inputs| of them, priced in §12 Sending
 * inputs.
 */
type Key<I extends Vocab, S extends Vocab> =
	`${Name<S>} -${Name<I>}> ${Name<S>}` | `${Name<S>} -> ${Name<S>}`

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

/** The same for state names, read off both ends of every key. */
type StatesFromKeys<K extends string> = {
	[N in RoundTrips<From<K> | To<K>>]: unknown
}

/** No `-*>`: the unlabelled arrow is the broad form, and a bare key is not one. */
type Wildcard<S extends Vocab> = Name<S> | '*'
type Pattern<I extends Vocab = AnyVocab, S extends Vocab = AnyVocab> =
	| `${Wildcard<S>} -${Name<I>}> ${Wildcard<S>}`
	| `${Wildcard<S>} -> ${Wildcard<S>}`

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * Checked row by row: a malformed key poisons its own value type, so
 * `not a transition: '…'` lands on that row, not on the whole table. The return
 * is the destination's payload, resolved inline rather than behind an alias over
 * `S`, so a wrong-shaped return names the one state the row targets (I18); the
 * row stays the authority for the name, which no return can redirect (§5 The
 * declared vocabulary). The `void` arm accepts an empty body, and only where the
 * payload already admits `undefined`, so a destination that carries something
 * still rejects a handler that returns nothing (I27). `NoInfer` guards the
 * parameters (I14).
 */
type Table<I extends Vocab, S extends Vocab, K extends string> = {
	readonly [P in K]: P extends Key<I, S>
		? (args: {
				readonly input: NoInfer<[Label<P>] extends [''] ? undefined : Label<P>>
				readonly inputData: NoInfer<
					[Label<P>] extends [''] ? undefined : Payload<I, Label<P>>
				>
				readonly from: From<P>
				readonly fromData: NoInfer<Payload<S, From<P>>>
				readonly to: To<P>
				readonly skip: () => Skip
			}) =>
				| (undefined extends S[To<P> & keyof S]
						? S[To<P> & keyof S] | void
						: S[To<P> & keyof S])
				| Skip
		: `not a transition: '${P}'`
}

// ---------------------------------------------------------------------------
// What a running machine is
// ---------------------------------------------------------------------------

/**
 * The name and the payload as one union member, so a name check narrows the data
 * beside it (§5 The declared vocabulary). A state carrying nothing keeps its
 * `data`, valued `undefined`, rather than dropping the property.
 */
type Current<S extends Vocab> = {
	[N in Name<S>]: { readonly name: N; readonly data: S[N] }
}[Name<S>]

/**
 * `send` is the whole declared vocabulary from every state, never narrowed to
 * what `from` or `to` handles: a queued input is read at drain time, by which
 * point the machine has moved, so the normal reaction sends something the state
 * it was notified about does not handle (§12 Sending inputs). A tuple union
 * keeps each input name paired with its data when callers hold unions of both
 * fields (I29).
 */
type Send<I extends Vocab> = (
	...args: {
		[N in Name<I>]: undefined extends I[N]
			? [input: N, inputData?: I[N]]
			: [input: N, inputData: I[N]]
	}[Name<I>]
) => void

/**
 * A declared row matches a pattern when every coordinate agrees: `*` in a
 * pattern's state position admits any name; a pattern's label position has no
 * wildcard spelling (line 127) — the omitted, unlabelled form is the broad one
 * already, so it admits a row's label, named or absent alike (I31, I32).
 */
type Matches<Row extends string, P extends string> = (
	From<P> extends '*' ? true : From<Row> extends From<P> ? true : false
) extends true
	? (
			Label<P> extends '' ? true : Label<Row> extends Label<P> ? true : false
		) extends true
		? To<P> extends '*'
			? true
			: To<Row> extends To<P>
				? true
				: false
		: false
	: false

/** The declared rows a pattern admits, one member of `K` per match. */
type MatchingRows<K extends string, P extends string> = K extends unknown
	? Matches<K, P> extends true
		? K
		: never
	: never

/**
 * A pattern with no declared row it could ever fire from — the same
 * `string extends K` gate `Transition`'s own fallback uses (I34), so a
 * genuinely widened `K` is left unchecked rather than falsely rejected.
 */
type NoMatch<K extends string, P extends string> = string extends K
	? false
	: [MatchingRows<K, P>] extends [never]
		? true
		: false

/**
 * The matchable subset of `Pattern<I, S>`: every member with at least one
 * declared row, filtered against the table the same way `NoMatch` rejects a
 * dead one — but computed from `I`, `S` and `K` alone, with no call-site
 * pattern in the formula. `observe`'s edge overload intersects its parameter
 * with this rather than gating on `NoMatch<K, P>` at the top: a pattern this
 * checks *offers*, `NoMatch` still decides what it *accepts* (I37).
 */
type MatchedPattern<
	I extends Vocab,
	S extends Vocab,
	K extends string,
> = string extends K
	? Pattern<I, S>
	: { [P in Pattern<I, S>]: NoMatch<K, P> extends true ? never : P }[Pattern<
			I,
			S
		>]

/** The wildcard rules of the runtime's own comparison, at the type level. */
type Select<Coordinate extends string, All extends string> = [
	Coordinate,
] extends ['*' | '']
	? All
	: Coordinate & All

/**
 * The pattern-only construction `Transition` built before #99 (I31): the
 * fallback for a widened `K`, where the exact row keys are unavailable (I34).
 */
type PatternFacts<
	I extends Vocab,
	S extends Vocab,
	P extends string,
	X extends object,
> = {
	[F in Select<From<P>, Name<S>>]: {
		[T in Select<To<P>, Name<S>>]:
			| {
					[N in Select<Label<P>, Name<I>>]: X & {
						readonly input: N
						readonly inputData: I[N]
						readonly from: F
						readonly fromData: S[F]
						readonly to: T
						readonly toData: S[T]
					}
			  }[Select<Label<P>, Name<I>>]
			| ([Label<P>] extends ['']
					? X & {
							readonly input: undefined
							readonly inputData: undefined
							readonly from: F
							readonly fromData: S[F]
							readonly to: T
							readonly toData: S[T]
						}
					: never)
	}[Select<To<P>, Name<S>>]
}[Select<From<P>, Name<S>>]

/**
 * Three names and their three payloads, narrowed by the listener's own
 * pattern. One member per declared row `K` the pattern admits, filtered
 * against the table rather than built from the pattern's own wildcards, so a
 * source, an input or a destination this table never pairs cannot appear
 * together in one record — a check on any one name narrows the payload
 * beside it, and also narrows the other two, to only what that name actually
 * reaches (I31, I32). `string extends K` falls back to `PatternFacts` for a
 * widened `K`, which would otherwise collapse every field to `never` (I34).
 * `X` is what the record carries beyond the facts — `send` for a committed
 * transition, nothing for a restart decision (§9 Actions).
 */
type Transition<
	I extends Vocab = AnyVocab,
	S extends Vocab = AnyVocab,
	K extends string = string,
	P extends string = '* -> *',
	X extends object = { readonly send: Send<I> },
> = string extends K
	? PatternFacts<I, S, P, X>
	: {
			[R in MatchingRows<K, P>]: X & {
				readonly input: [Label<R>] extends [''] ? undefined : Label<R>
				readonly inputData: [Label<R>] extends ['']
					? undefined
					: Payload<I, Label<R>>
				readonly from: From<R>
				readonly fromData: Payload<S, From<R>>
				readonly to: To<R>
				readonly toData: Payload<S, To<R>>
			}
		}[MatchingRows<K, P>]

type Listener<
	I extends Vocab = AnyVocab,
	S extends Vocab = AnyVocab,
	K extends string = string,
	P extends string = '* -> *',
> = (transition: Transition<I, S, K, P>) => void

// ---------------------------------------------------------------------------
// Actions
//
// Every action takes the same one argument, whichever kind of trigger fired it:
// the transition record, `send` included, exactly what a matching listener
// receives (§9 Actions). A residency trigger is an arrival, so its `to` is the
// resident state; an edge trigger's is whatever its pattern targets. Edge and
// residency share this shape with `observe` too, except that a residency
// action's own arrival member is live only on the initial state, the one
// state `enter` can ever hand it to; `observe`'s is live everywhere, since a
// late registration can find any state already occupied (I32, I33). Only the
// return types otherwise differ, and only to keep a teardown from being
// stranded on an edge.
// ---------------------------------------------------------------------------

/** What a residency action may return, to release what it opened on exit. */
type Teardown = () => void

/**
 * The arrival no transition caused: entering the initial state, and finding a
 * state already occupied when a residency is registered on it. Source and input
 * are absent on both, names and payloads alike; `to` is wherever the machine
 * stands, which registration can reach in a noninitial state (§9 Actions). Its
 * own arm rather than a widened `Transition`, which `observe` and every edge
 * share: `input: undefined` already discriminates an immediate hop, so
 * `from: undefined` extends that vocabulary instead of inventing a second one.
 */
type Arrived<I extends Vocab, S extends Vocab, N extends string> = {
	readonly input: undefined
	readonly inputData: undefined
	readonly from: undefined
	readonly fromData: undefined
	readonly to: NoInfer<N>
	readonly toData: NoInfer<Payload<S, N>>
	readonly send: Send<I>
}

/**
 * What a residency action and a residency observer for the same bare state
 * share: every declared row landing on `N`, correlated per row like any other
 * `Transition`, plus the arrival no transition caused (I31, I32).
 */
type Residency<
	I extends Vocab,
	S extends Vocab,
	K extends string,
	N extends string,
> = Transition<I, S, K, `* -> ${N}`> | Arrived<I, S, N>

/**
 * What a declared action sees on its own bare state, as opposed to what
 * `observe` always sees: the arrival member only where it can actually fire.
 * `enter` runs once, at startup, gated on `to === initial` — the only place a
 * declared action, fixed before the host starts, is ever handed the
 * synthetic arrival. Every other residency action is reachable only by a real
 * transition, so its argument is a plain `Transition`, real rows alone. This
 * is `observe`'s own late-registration case with no equivalent here (I33).
 */
type ActionArrival<
	I extends Vocab,
	S extends Vocab,
	K extends string,
	Init extends string,
	N extends string,
> = [N] extends [Init]
	? Residency<I, S, K, N>
	: Transition<I, S, K, `* -> ${N}`>

/**
 * Fires on arrival at its state, by any route `* -> N` covers; the teardown it
 * returns runs on exit (§9 Actions). Generic in the argument itself, rather
 * than in `I, S, K, N`, so `Actions` and `ObserveAction` can each hand it a
 * differently-scoped arrival (`ActionArrival`, `Residency`) without a second
 * signature. The trailing `| void` is not the bivariance hole it looks like —
 * that only opens when a signature's return type *is* `void`, not when
 * `void` is one arm of a union, where an explicit wrong-shaped or `async`
 * return is still rejected (I27). It is what lets a setup with nothing to
 * tear down end in a plain statement rather than an explicit
 * `return undefined`.
 */
type ResidencyAction<Arrival> = (
	arrival: NoInfer<Arrival>,
) => undefined | Teardown | void

/**
 * Not bare `void`: that alone lets a function return anything, `Teardown`
 * included, stranding it uncalled on every matching edge. Unioned with
 * `undefined` the hole closes — an explicit `Teardown` return is still
 * rejected (I27) — while still taking a plain block body with nothing to
 * return.
 */
type EdgeAction<
	I extends Vocab,
	S extends Vocab,
	K extends string,
	P extends string,
> = (transition: NoInfer<Transition<I, S, K, P>>) => undefined | void

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
 * `restart` is consulted only on a self-transition, so its facts are that hop's:
 * the same six a committed record carries, minus `send`, which is what keeps the
 * decision pure in the types and at runtime alike (§9 Actions). No arrival
 * member: a predicate is never invoked for one (I31, I32). The default is to
 * restart. Without `NoInfer` the predicate reopens `S` and the table collapses
 * (I28).
 */
type Restart<
	I extends Vocab,
	S extends Vocab,
	K extends string,
	N extends string,
> = {
	readonly restart?:
		| boolean
		| ((facts: NoInfer<Transition<I, S, K, `${N} -> ${N}`, {}>>) => boolean)
}

/**
 * Checked row by row, like `Table`: decidable from the string alone (§9
 * Actions), an edge-shaped key (`from -input> to`, wildcards included) against
 * `Pattern`, else a bare key against the declared state names. Either miss
 * reports its own `not a trigger: '…'` rather than poisoning a well-formed
 * neighbour. `restart` has no meaning on an edge, so only the residency arm
 * widens with it.
 *
 * A name-valid key naming no declared row (or, for a noninitial bare state,
 * no incoming row at all) reports `no row matches '…'` instead: an edge with
 * no matching row can never run, and neither can a noninitial residency with
 * none, since `enter` hands the synthetic arrival only to `initial`'s own
 * action (#100). This is a second, independent check alongside
 * `ActionArrival`'s own `Init` comparison, not a replacement for it: a
 * noninitial action's argument still excludes the arrival member it can
 * never receive, precise as I33 left it, and eligibility is checked on top of
 * that, not by widening it.
 */
type Actions<
	I extends Vocab,
	S extends Vocab,
	K extends string,
	Init extends string,
	A extends string,
> = {
	readonly [P in A]: P extends `${string} -${string}> ${string}`
		? P extends Pattern<I, S>
			? NoMatch<K, P> extends true
				? `no row matches '${P}'`
				: Action<EdgeAction<I, S, K, P>>
			: `not a trigger: '${P}'`
		: P extends Name<S>
			? [P] extends [Init]
				? Action<
						ResidencyAction<ActionArrival<I, S, K, Init, P>>,
						Restart<I, S, K, P>
					>
				: NoMatch<K, `* -> ${P}`> extends true
					? `no row matches '${P}'`
					: Action<
							ResidencyAction<ActionArrival<I, S, K, Init, P>>,
							Restart<I, S, K, P>
						>
			: `not a trigger: '${P}'`
}

/**
 * What `observe` takes for a bare state key: a residency action alone or in a
 * `{ run, restart }` record, the same two shapes `Actions` allows for one —
 * everything but the array, which a caller gets by calling `observe` twice
 * (§11 The host). Always arrival-capable, whichever state: a late
 * registration can find any state already occupied, `initial` or not (I32).
 */
type ObserveAction<
	I extends Vocab,
	S extends Vocab,
	K extends string,
	N extends string,
> =
	| ResidencyAction<Residency<I, S, K, N>>
	| ({ readonly run: ResidencyAction<Residency<I, S, K, N>> } & Restart<
			I,
			S,
			K,
			N
	  >)

/** The initial payload, omitted exactly when `send` would omit one (§5). */
type Start<S extends Vocab, Init extends string> =
	undefined extends Payload<S, Init>
		? [data?: Payload<S, Init>]
		: [data: Payload<S, Init>]

/** A running machine: the only mutable thing in the design. */
interface Host<
	I extends Vocab = AnyVocab,
	S extends Vocab = AnyVocab,
	K extends string = string,
> {
	readonly current: Current<S>
	readonly send: Send<I>
	// Generic in the pattern, so a listener's record is narrowed by it. A
	// name-valid edge pattern with no declared row it could ever fire from is
	// rejected the same way `Table` rejects a malformed key — the pattern
	// parameter's own type, not the listener's (#100). A bare state key is
	// the second, overloaded form: always eligible, since a late registration
	// can find any declared state already occupied, and takes the same record
	// `actions` does for a residency, minus the array — call `observe` again
	// for a second one — and minus the third-argument options form,
	// deliberately not added (§11 The host).
	readonly observe: {
		<P extends Pattern<I, S>>(
			pattern: NoMatch<K, P> extends true
				? `no row matches '${P}'`
				: P & MatchedPattern<I, S, K>,
			listener: Listener<I, S, K, P>,
		): () => void
		<N extends Name<S>>(
			pattern: N,
			action: ObserveAction<I, S, K, N>,
		): () => void
	}
}

/** Nothing at runtime; a function position keeps the three inferable together. */
declare const vocabulary: unique symbol
interface Vocabulary<I extends Vocab, S extends Vocab, K extends string> {
	readonly [vocabulary]?: (declared: readonly [I, S, K]) => void
}

/** A declared machine. Inert, shareable, and never mutated by running one. */
interface Machine<
	I extends Vocab = AnyVocab,
	S extends Vocab = AnyVocab,
	K extends string = string,
	Init extends string = string,
> extends Vocabulary<I, S, K> {
	readonly start: (...data: Start<S, Init>) => Host<I, S, K>
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

/**
 * The patterns `observe` accepts on `M`: the public face of `MatchedPattern`,
 * for a caller wrapping `observe` who wants the same constraint on their own
 * pattern argument — neither `Pattern` nor `Host` is exported to name
 * directly (I37).
 */
export type Patterns<M> = MatchedPattern<
	Carried<M>['inputs'],
	Carried<M>['states'],
	Carried<M>['keys']
>

// ---------------------------------------------------------------------------
// The definition
// ---------------------------------------------------------------------------

/** What a handler is told: three names, and payloads dispatch never reads (I23). */
type UncheckedSource = {
	readonly input: string | undefined
	readonly inputData: unknown
	readonly from: string | undefined
	readonly fromData: unknown
	readonly to: string
}

/** The whole hop, once a handler has produced the destination's payload. */
type UncheckedFacts = UncheckedSource & { readonly toData: unknown }

type UncheckedSend = (
	input: Exclude<UncheckedSource['input'], undefined>,
	inputData?: unknown,
) => void

/** One shape for every handler; a payload is opaque, in and out (I23). */
type UncheckedHandler = (
	args: UncheckedSource & { readonly skip: () => Skip },
) => unknown

type Row = readonly [to: string, handler: UncheckedHandler]

/** The snapshot, unchecked: the name dispatch keys on, and what it carries. */
type Snapshot = { readonly name: string; readonly data: unknown }

interface UncheckedHost {
	readonly current: Snapshot
	readonly send: UncheckedSend
	readonly observe: (
		pattern: string,
		action: Listener | ActionItem,
	) => () => void
}

/**
 * Every row of the table, in order, under the pair that reaches it. A marker
 * separates named inputs from immediate rows. One flat, null-prototype map, so
 * `send('toString')` finds nothing to call (I16).
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
 * payloads to `unknown`. `initial` is a `NoInfer` position rather than a third
 * site (I21), intersected with `Init` to recover its name, which is what lets
 * `start` follow the initial state's payload. `RawI`/`RawS` are what the
 * properties infer to and `I`/`S` the resolved vocabularies; collapsing each
 * pair into one fails (I19), and the defaults hold only because `Table`'s
 * `NoInfer` closes the handler parameters — as would overloads, at the cost of
 * per-row diagnostics (I14). `K` comes from the mapped type in `transitions`,
 * with no second one beside it (I20). `A` is the same idea again for `actions`:
 * inferred from that block's own keys, contributing nothing back to `I`, `S` or
 * `K` (§9 Actions).
 */
export let machine: <
	Init extends string,
	K extends string,
	RawI extends Vocab | undefined = undefined,
	RawS extends Vocab | undefined = undefined,
	I extends Vocab = Declared<RawI, InputsFromKeys<K>>,
	S extends Vocab = Declared<RawS, StatesFromKeys<K>>,
	A extends string = never,
>(definition: {
	readonly initial: Init & Name<NoInfer<S>>
	// `| undefined` is what `type()` returns, and inference subtracts it. Spelled
	// out because `exactOptionalPropertyTypes` makes `?:` a different thing.
	readonly inputs?: (RawI & VocabMap<Exclude<RawI, undefined>>) | undefined
	readonly states?: (RawS & VocabMap<Exclude<RawS, undefined>>) | undefined
	readonly transitions: Table<I, S, K>
	readonly actions?: Actions<I, S, K, Init, A> | undefined
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

		// One flat keyspace for both kinds of row. The source length separates the
		// source from its input; a marker distinguishes a named input from no input.
		// Spelled out at all three sites rather than shared, which measures smaller
		// (I16).
		for (let key in transitions) {
			let [from, input, to] = parse(key)
			;(index[from.length + '\0' + from + (input && 1 + input)] ??= []).push([
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
			start: (data?: unknown): UncheckedHost => {
				// A closure variable behind a getter, not a property `send` mutates:
				// measured smaller (I16). The payload is stored as handed over, so a
				// caller's reference is what a snapshot reads back (§5).
				let current: Snapshot = { name: initial, data }

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
				// `*` and `''` stand for any, and a missing `from` — an arrival no
				// transition caused — matches no edge row, so that case needs no branch
				// of its own (§9 Actions). Only a residency has a teardown key, stores
				// what it returns, and gates setup on a self-transition by `row[7]`, the
				// decision `step` already made below: one call to `restart` serves both
				// halves of the same residency's hop (§9 Actions).
				let fire = (list: Registration[], facts: UncheckedFacts): void => {
					// The facts plus the one capability a committed record carries: the
					// same `send` the host exposes, so a reaction drives the machine
					// without closing over the host it was registered on. Once per call,
					// so the allocation stays off the path that runs most (I16).
					let e: Arrival = { ...facts, send }
					for (let row of list) {
						let [f, l, t, run, key] = row
						if (
							(f === '*' || f === e.from) &&
							(l === '' || l === e.input) &&
							(t === '*' || t === e.to) &&
							(!key || e.to !== e.from || row[7])
						) {
							let teardown = run(e)
							if (key) row[6] = teardown as Teardown | undefined
						}
					}
				}

				// The arrival no transition caused: source and input are simply absent
				// (§9 Actions). Shared by `start` and a bare-key `observe`, which goes
				// through `fire` for the `to === state` test its third clause already does.
				let enter = (list: Registration[]): void =>
					fire(list, {
						to: current.name,
						toData: current.data,
					} as UncheckedFacts)

				// One scanning path for both kinds of transition: commit the first row
				// that does not decline, report whether the machine moved. Fusing it with
				// the chain below, or splitting a `commit` out of it, measured larger (I16).
				let step = (
					rows: Row[] = [],
					input?: UncheckedFacts['input'],
					inputData?: unknown,
				): boolean => {
					// The source, read once for the whole scan: only a commit moves the
					// machine, and a commit returns.
					let { name: from, data: fromData } = current
					for (let [to, handler] of rows) {
						let toData = handler({ input, inputData, from, fromData, to, skip })
						// Declining is ordinary and silent: try the next row for this pair.
						if (toData !== SKIP) {
							// The hop's own facts, built before the commit so a restart
							// predicate sees what it is deciding about, and carrying no `send`:
							// a pure decision is one at runtime too, not only in the types (§9
							// Actions).
							let facts: UncheckedFacts = {
								input,
								inputData,
								from,
								fromData,
								to,
								toData,
							}

							// The residency being left tears down before the commit, actions
							// before listeners, each in reverse declaration order, so several on
							// one trigger unwind like a stack. A throw here abandons the hop with
							// nothing committed and the later teardowns unrun (§9 Actions). `false`
							// survives, a predicate decides from the transition's own facts,
							// anything else restarts, an omitted `restart` included; `.call` is the
							// cheapest thing only a function has. `row[7]` banks that one decision
							// for `fire` to reuse below, on that same row's setup, so a predicate
							// the caller wrote once is asked once (§9 Actions).
							for (let list of [acts, listeners]) {
								for (let row of list.toReversed()) {
									if (
										row[4] === from &&
										(to !== from ||
											(row[7] = (row[5] as Predicate)?.call
												? (row[5] as Predicate)(facts)
												: row[5] !== false))
									) {
										clear(row)
									}
								}
							}

							// Commit, then notify, so every listener sees a machine that agrees
							// with the record. The payload is stored exactly as returned (§5).
							current = { name: to, data: toData }

							// Actions in declaration order, then listeners (§9 Actions).
							fire(acts, facts)
							fire(listeners, facts)
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
				let send: UncheckedSend = (input, inputData) => {
					queue.push(() => {
						// Read at drain time, so a queued send may correctly find no row.
						if (
							step(
								index[current.name.length + '\0' + current.name + 1 + input],
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
					get current(): Snapshot {
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
 * What `fire` hands whatever it matched. The transition record, except that the
 * source is absent on an arrival no transition caused; only a residency can see
 * that one, since a missing `from` matches no edge (§9 Actions).
 */
type Arrival = UncheckedFacts & { readonly send: UncheckedSend }

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
	restart?: boolean | ((facts: UncheckedFacts) => boolean),
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
