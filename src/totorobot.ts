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
 * ## On what is exported
 *
 * An exported type is a promise, so the list is the one `docs/api.md` publishes
 * and nothing more: `machine`, `types`, the derived `InputsOf`, `StatesOf`,
 * `Handled` and `Sources`, and `Skip`, which is unavoidably public because it
 * is in every handler's return type.
 *
 * Everything else — `Machine`, `Host`, `Snapshot`, `Transition`, `Listener`,
 * `Pattern` and the machinery under them — is module-local **on purpose**. The
 * emitted declarations still carry them, so every public signature resolves and
 * hover text reads normally; they simply cannot be imported, which is what
 * leaves them free to change. A caller who needs to name one names it through
 * what it came from — `typeof publication`,
 * `ReturnType<typeof publication.start>` — rather than through a type whose
 * parameter list would then be frozen. Adding an `export` here widens the API;
 * do it deliberately, and say so in `docs/api.md`.
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
 * The type layer is free: every one of the types below is erased, so the
 * checking it does costs a consumer nothing at runtime.
 *
 * ## On validation
 *
 * Almost none, anywhere. A malformed input is still a silent no-op rather than
 * a checked argument: an input name outside the table finds no row, and a
 * pattern naming a state that does not exist parses fine and never matches.
 *
 * One exception. A chain of immediate transitions that never settles — `'a ->
 * b'` declared alongside `'b -> a'` — throws a `RangeError` after 1e5
 * consecutive hops, naming the state it could not settle in. This is not
 * argument validation; it is the one place the library cannot make an
 * unbounded loop a silent no-op, because a hang is worse than a loud failure.
 * Everything else keeps the no-validation rule.
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
// The vocabulary
// ---------------------------------------------------------------------------

/**
 * The constraint both vocabulary maps carry, and the fallback default for the
 * generic utilities below that describe a vocabulary in the abstract (`Host`,
 * `Pattern`, `Listener`, …) rather than one particular call.
 *
 * `machine` itself does not default `I`/`S` to `Vocab`: see
 * `StatesFromKeys`/`InputsFromKeys` above, which it defaults to instead.
 */
type Vocab = Record<string, unknown>

/**
 * Resolves one of `machine`'s two raw vocabulary parameters to the default
 * once it is `undefined` — which a raw parameter is both when its property is
 * omitted and when it is passed the marker's `undefined` explicitly, since
 * `Raw extends Vocab | undefined` (rather than `Raw extends Vocab = Default`)
 * takes `undefined` itself as a legal, non-widening inference target instead
 * of a constraint violation. Constraining to bare `Vocab` was tried first and
 * rejected: a candidate of `undefined` against that narrower constraint is
 * invalid, and TypeScript's fallback for an invalid candidate is the
 * constraint itself — `Vocab`, not the default — so an explicit
 * `inputs: undefined` widened every name to `string` where an omitted
 * property correctly inferred `InputsFromKeys<K>`. Two call sites that were
 * meant to be indistinguishable were not; this is what makes them the same
 * again.
 */
type Declared<
	Raw extends Vocab | undefined,
	Default extends Vocab,
> = Raw extends undefined ? Default : Raw

/** The names a vocabulary declares — every name mentioned in `transitions` when it declares none. */
type Name<V> = keyof V & string

/**
 * `void` is how a vocabulary spells "carries no data"; `undefined` is how that
 * data arrives. The tuples stop a union of state data from distributing, which
 * would turn `A | void` into `A | undefined` one member at a time.
 *
 * Applied where data is *read* — `current.data`, a handler's `data` and
 * `input`, the record's two ends — and deliberately **not** to a handler's
 * return type, where `void` itself is what lets `() => {}` satisfy a data-free
 * target.
 */
type Value<T> = [T] extends [void] ? undefined : T

// ---------------------------------------------------------------------------
// The key grammar, at the type level
// ---------------------------------------------------------------------------

/**
 * Every legal transition key, as one union rather than a conditional that
 * merely validates: a union is what an editor can offer as completions. It is
 * |states|² × |inputs| members, which is the measured cost of completions
 * recorded in the rationale.
 *
 * Spacing is load-bearing, and this is the whole of the enforcement: the
 * literal ` -` and `> ` in the template admit exactly one spelling. With no
 * vocabulary declared the coordinates widen to `string` and the two separators
 * are all that is left — which is why a malformed key is still a compile error
 * on the untyped path.
 */
type Key<I extends Vocab, S extends Vocab> =
	`${Name<S>} -${Name<I>}> ${Name<S>}` | `${Name<S>} -> ${Name<S>}`

/**
 * The three coordinates of a key, read back out of the string.
 *
 * A leading `infer` matches up to the *first* occurrence of the literal that
 * follows it, so these agree with the runtime's split on the same two
 * separators. They are only ever applied to a key that has already passed
 * `Key`, so the `never` branches are unreachable from checked code.
 */
type From<K> = K extends `${infer F} -${string}> ${string}` ? F : never
type Label<K> = K extends `${string} -${infer L}> ${string}` ? L : never
type To<K> = K extends `${string} -${string}> ${infer T}` ? T : never

/**
 * The default state and input vocabularies, used when `machine` is called
 * with `states`/`inputs` omitted: every name mentioned anywhere in
 * `transitions`, each mapped to `unknown` — the names narrow to what the
 * table says, but the data each one carries is still unknown rather than
 * assumed absent, since nothing declares it one way or the other.
 *
 * `K` is inferred from `transitions` before either default is applied — `K`
 * precedes `I` and `S` in `machine`'s own parameter list, and a later default
 * may reference an earlier parameter — so this reads back the *raw* table
 * keys rather than reverse-inferring from a single field the way `initial`
 * once did. A malformed key drops out silently: `From`/`Label`/`To` only
 * match the well-formed template, so a key that fails it contributes no name,
 * and its row is still rejected on its own by `Table` below.
 */
type StatesFromKeys<K extends string> = { [N in From<K> | To<K>]: unknown }
type InputsFromKeys<K extends string> = {
	[N in Exclude<Label<K>, ''>]: unknown
}

/**
 * Every legal `.on()` pattern: the key grammar with the state coordinates left
 * open. `*` is a state name that no vocabulary can shadow, and the unlabelled
 * arrow is the broad form — so there is no `-*>`, and a bare key, which names a
 * state, is not a pattern.
 */
type Wildcard<S extends Vocab> = Name<S> | '*'
type Pattern<I extends Vocab = Vocab, S extends Vocab = Vocab> =
	| `${Wildcard<S>} -${Name<I>}> ${Wildcard<S>}`
	| `${Wildcard<S>} -> ${Wildcard<S>}`

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * A handler, typed from its own row: the **source** state's data and the input
 * named by the arrow's label in, the **target** state's data out.
 *
 * `Skip` rides alongside the target's data rather than replacing it, so
 * declining costs no type safety — a wrong-shaped return is still rejected on
 * a row that could also `skip()`.
 *
 * One limitation, and it is TypeScript's rather than this notation's: a handler
 * that destructures nothing — `() => ({ … })` — is not context-sensitive, so
 * the compiler types it in the same pass that infers `states:` from the sibling
 * property, before `S` is known. Its return expression therefore has no
 * contextual type and its literals widen, which a target state pinning a
 * literal field then rejects. Reading `data` or `input` defers the handler to
 * the pass after the vocabulary is known and needs no annotation; an
 * argument-free handler returning a pinned literal needs `as const` or a return
 * type. Nothing the library can express moves this: the vocabulary and the
 * table are properties of one object literal, and one is inferred from the
 * other.
 */
type Handler<I extends Vocab, S extends Vocab, K> = (args: {
	readonly data: Value<S[From<K> & Name<S>]>
	readonly input: Value<I[Label<K> & Name<I>]>
	readonly skip: () => Skip
}) => S[To<K> & Name<S>] | Skip

/**
 * The transitions table, checked row by row.
 *
 * A malformed key **poisons its own value type**: the row is typed as a string
 * literal no function can satisfy, so the error reads
 * `not a transition: '…'` and lands on the offending row. Rejected: reporting
 * through an intersected missing property, which is an object-level error and
 * would land on the whole table instead — failing the one promise the notation
 * makes about its own diagnostics.
 */
type Table<I extends Vocab, S extends Vocab, K extends string> = {
	readonly [P in K]: P extends Key<I, S>
		? Handler<I, S, P>
		: `not a transition: '${P}'`
}

// ---------------------------------------------------------------------------
// What a running machine is
// ---------------------------------------------------------------------------

/**
 * The states in `N`, each paired with its own data, as a union discriminated by
 * `state`. Mapping and immediately indexing is what builds the union: an
 * interface with both fields could only intersect them.
 */
type At<S extends Vocab, N extends string> = {
	[K in N & Name<S>]: { readonly state: K; readonly data: Value<S[K]> }
}[N & Name<S>]

/**
 * A state and the data it carries. Discriminated by `state`, which is what
 * makes narrowing the state narrow its data, with no nullable padding on the
 * states that guarantee a field.
 *
 * Never mutated: a value read from `current` stays valid.
 */
type Snapshot<S extends Vocab = Vocab> = At<S, Name<S>>

/**
 * What a pattern leaves open, resolved against what the vocabulary declares.
 * `*` is the wildcard in the state positions and the unlabelled arrow's empty
 * label is the wildcard in the input position — the same two rules the runtime
 * compares by, so a listener's type says exactly what its pattern can match.
 */
type Select<Coordinate extends string, All extends string> = [
	Coordinate,
] extends ['*' | '']
	? All
	: Coordinate & All

/**
 * What a listener is handed, narrowed by its own pattern: a union discriminated
 * by `on`, over the inputs and the two ends the pattern admits. `'* -> *'`
 * leaves all three open and is therefore the whole record.
 *
 * An unlabelled pattern also admits an immediate hop — `on: undefined`,
 * `input: undefined` — which is why that case is a separate union arm rather
 * than folded into the mapped type: the mapped type is indexed by input name,
 * and an immediate has none. A labelled pattern's `Label<P>` is never `''`, so
 * the arm drops out there, matching the runtime, where a labelled pattern
 * never matches an immediate.
 */
type Transition<
	I extends Vocab = Vocab,
	S extends Vocab = Vocab,
	P extends string = '* -> *',
> =
	| {
			[N in Select<Label<P>, Name<I>>]: {
				readonly on: N
				readonly input: Value<I[N]>
				readonly from: At<S, Select<From<P>, Name<S>>>
				readonly to: At<S, Select<To<P>, Name<S>>>
			}
	  }[Select<Label<P>, Name<I>>]
	| ([Label<P>] extends ['']
			? {
					readonly on: undefined
					readonly input: undefined
					readonly from: At<S, Select<From<P>, Name<S>>>
					readonly to: At<S, Select<To<P>, Name<S>>>
				}
			: never)

type Listener<
	I extends Vocab = Vocab,
	S extends Vocab = Vocab,
	P extends string = '* -> *',
> = (transition: Transition<I, S, P>) => void

/**
 * `send`'s arity follows the input's payload: a `void` input takes none and
 * rejects one, a payload-carrying input requires one. A union of tuples rather
 * than a generic rest parameter, so the name position stays readable as
 * `Parameters<…>[0]`.
 *
 * An undeclared vocabulary widens the payload to `unknown`, which no caller can
 * produce a value *for*, so it becomes optional there rather than required.
 */
type Dispatch<I extends Vocab> = {
	[N in Name<I>]: [I[N]] extends [void]
		? [name: N]
		: unknown extends I[N]
			? [name: N, payload?: I[N]]
			: [name: N, payload: I[N]]
}[Name<I>]

/** `start`'s arity follows the initial state's data, by the same rule. */
type Start<S extends Vocab, Init extends string> = [S[Init & Name<S>]] extends [
	void,
]
	? []
	: unknown extends S[Init & Name<S>]
		? [data?: S[Init & Name<S>]]
		: [data: S[Init & Name<S>]]

/** A running machine: the only mutable thing in the design. */
interface Host<I extends Vocab = Vocab, S extends Vocab = Vocab> {
	readonly current: Snapshot<S>
	readonly available: readonly Name<I>[]
	readonly send: (...args: Dispatch<I>) => void
	// Generic in the pattern, so the record the listener receives is narrowed by
	// the pattern that selected it rather than being the whole union every time.
	readonly on: <P extends Pattern<I, S>>(
		pattern: P,
		listener: Listener<I, S, P>,
	) => () => void
}

/**
 * Carries the vocabulary and the table's keys at the type level, and nothing at
 * all at runtime — the property is optional and never present. It is what the
 * derived types below read a machine back out of, and a function position is
 * what keeps the three parameters inferable together.
 */
declare const vocabulary: unique symbol
interface Vocabulary<I extends Vocab, S extends Vocab, K extends string> {
	readonly [vocabulary]?: (declared: readonly [I, S, K]) => void
}

/** A declared machine. Inert, shareable, and never mutated by running one. */
interface Machine<
	I extends Vocab = Vocab,
	S extends Vocab = Vocab,
	K extends string = string,
	Init extends string = string,
> extends Vocabulary<I, S, K> {
	readonly start: (...data: Start<S, Init>) => Host<I, S>
}

// ---------------------------------------------------------------------------
// Reading a machine type back out
// ---------------------------------------------------------------------------

/**
 * Everything a machine type carries, recovered in one match. The three are
 * inferred together and named rather than extracted one at a time: matching
 * `Machine` itself cannot work, because a partly-inferred `start` is not
 * assignable to a fully-inferred one and the check would simply fail.
 */
type Carried<M> =
	M extends Vocabulary<infer I, infer S, infer K>
		? { inputs: I; states: S; keys: K }
		: never

/** The input vocabulary a machine was declared with. */
export type InputsOf<M> = Carried<M>['inputs']

/** The state vocabulary a machine was declared with. */
export type StatesOf<M> = Carried<M>['states']

/**
 * The inputs state `S` has rows for — `available`, at the type level, and the
 * `'draft -'` text search made derivable. `Exclude<…, ''>` drops an immediate
 * row's empty label, the same way `available` never lists one at runtime.
 */
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

/**
 * The runtime's own view of the pieces it touches. Every checked surface —
 * per-state data, the key grammar, `start` and `send` arity — belongs to the
 * type layer above and has already been enforced by the time any of this runs,
 * so widening here costs nothing and keeps the implementation readable.
 */
type Data = any

/** A handler as the runtime calls it: data and payload in, data or the sentinel out. */
type Call = (args: {
	readonly data: Data
	readonly input: Data
	readonly skip: () => Skip
}) => Data | Skip

/** A candidate row, parsed: where it goes, and what it projects. */
type Row = readonly [to: string, handler: Call]

/**
 * A host as the runtime builds it: the same object the declared `Host` above
 * describes, with every coordinate widened to what the implementation actually
 * handles. The two are reconciled by the single cast in `machine`.
 */
interface RawHost {
	readonly current: Snapshot
	readonly available: readonly string[]
	readonly send: (name: string, payload?: unknown) => void
	readonly on: (pattern: string, listener: Listener) => () => void
}

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

/**
 * Source state to the unlabelled rows declared out of it, in declaration
 * order. Kept apart from `Index` rather than filtered out of it at read
 * time: `available` and `send` read `Index` directly, so a row stored here
 * is structurally unreachable from either rather than merely absent by
 * convention. Unused by anything yet — the next change wires it up — which
 * is the point: that change is an addition, not surgery on this one.
 */
type Immediates = Record<string, Row[] | undefined>

/**
 * Carries a vocabulary at the type level and nothing at all at runtime: it
 * **returns `undefined`**, which is what a caller observes. Nothing reads the
 * fields it fills in.
 *
 * The return type says so. `T` alone would need a cast through `unknown` to
 * hand back an `undefined`, which is the one place in the library where the
 * types would be describing something other than what runs; `T | undefined`
 * needs no cast at all, and `machine` subtracts the `undefined` back out on
 * the way in.
 *
 * The rationale recorded `null | T` as proposed and not taken; that entry no
 * longer decides anything, since it argued against legalising a bare
 * `inputs: null`, which is moot once the codebase carries no `null` at all.
 * What it protected still holds under `undefined`: extraction still reads
 * through `InputsOf` and `StatesOf` rather than through the marker's own
 * type, and a bare `inputs: undefined` no longer collapses `keyof S & string`
 * to `never`, because with nothing left to infer the constrained default
 * takes over and that half simply widens — the same surface omitting it
 * gives.
 */
export const types = <T>(): T | undefined => undefined

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
 *
 * `inputs` and `states` are the only inference sites for the vocabulary, and
 * both are optional: omitting one — or passing the marker's `undefined`
 * explicitly, which `Declared` treats the same — falls back to
 * `InputsFromKeys<K>` / `StatesFromKeys<K>`, so that half's *names* are still
 * exactly what `transitions` mentions rather than widening to `string` — only
 * the data each name carries widens, to `unknown`, since nothing declares it.
 * The fallback reads `K` — a *sibling* parameter, already inferred from
 * `transitions` — rather than reverse-inferring from a single field, which is
 * what `initial` must not do: a plain `NoInfer` position rather than a
 * conditional, because letting `initial` itself be a state-vocabulary
 * inference site makes the name it invented the only legal state, rejects
 * every real row, and moves the error off the row onto the whole table. The
 * intersection with `Init` recovers the initial state's *name* without
 * reopening that inference, which is what lets `start` follow that one
 * state's data.
 *
 * `RawI`/`RawS` are what `inputs`/`states` actually infer to, and `Declared`
 * resolves each to the default the moment it is `undefined`. Kept separate
 * from `I`/`S` — the resolved vocabularies used everywhere else in this
 * signature — because collapsing the two back into one parameter each,
 * constrained to bare `Vocab` with a default, is the version that fails: see
 * `Declared`.
 *
 * `K` is the table's keys, inferred from the mapped type in `transitions`
 * because a mapped type over a bare type parameter infers its own key set.
 * Rejected: a second `transitions: T` alongside it, which infers the same thing
 * and makes the contextual type of every row an intersection — enough call
 * signatures that the compiler stops elaborating into the handler, and a
 * wrong-shaped return is reported against the whole row instead of against the
 * expression that is wrong.
 */
export function machine<
	Init extends string,
	K extends string,
	RawI extends Vocab | undefined = undefined,
	RawS extends Vocab | undefined = undefined,
	I extends Vocab = Declared<RawI, InputsFromKeys<K>>,
	S extends Vocab = Declared<RawS, StatesFromKeys<K>>,
>(definition: {
	readonly initial: Init & Name<NoInfer<S>>
	// `| undefined` is what `types()` returns, and inference subtracts it: the
	// vocabulary lands as `RawI` rather than `RawI | undefined`, so nothing
	// downstream carries an undefined it would have to strip again. Spelled
	// out rather than left to `?:` alone because `exactOptionalPropertyTypes`
	// makes those two different: omitting the key is not the same as writing
	// `inputs: undefined`, and the marker's return type has to satisfy both.
	readonly inputs?: RawI | undefined
	readonly states?: RawS | undefined
	readonly transitions: Table<I, S, K>
}): Machine<I, S, K, Init> {
	const { initial, transitions } = definition as unknown as {
		readonly initial: string
		readonly transitions: Readonly<Record<string, Call>>
	}
	const index: Index = Object.create(null)
	const immediates: Immediates = Object.create(null)

	for (const key in transitions) {
		const [from, input, to] = parse(key)
		const row: Row = [to as string, transitions[key]!]
		// The label is the empty string only for an unlabelled arrow — `parse`
		// gives a key too malformed to carry a label an *absent* (`undefined`)
		// one instead, which keeps landing in `index`, under the literal name
		// `'undefined'`, exactly as it does without this branch: simply
		// unreachable, no row, no complaint. Splitting on falsy rather than on
		// exactly `''` would sweep it into `immediates` too.
		if (input === '') {
			;(immediates[from] ??= []).push(row)
		} else {
			const bySource = (index[from] ??= Object.create(null))
			;(bySource[input as string] ??= []).push(row)
		}
	}

	// Built against the widened surface and handed back as the declared one: the
	// two agree on every runtime detail and differ only in what the compiler
	// will let a caller pass, which is the whole point of the layer above.
	return {
		start: (data?: unknown): RawHost => {
			// Host state lives in closure variables read back through getters,
			// rather than on a plain object with assigned properties that `send`
			// reaches back into and mutates. Measured against the real toolchain:
			// assigned properties come out 6 B brotli larger (47 raw, 10 gzip) —
			// mutating two properties on a bound `host` object costs more than a
			// getter closing over a local, and the getter needs no extra identifier
			// for the object itself. `current` is a `state`/`data` pair rather than
			// two separate variables: a transition record needs both ends as
			// `{ state, data }`, so keeping the pair already boxed hands `from` and
			// `to` over as references instead of building two more objects per
			// commit.
			let current: Snapshot = { state: initial, data }

			// Copy-on-write at registration, plain iteration at dispatch. Rejected:
			// a mutable list mutated with `.push()`/`.splice()` at registration and
			// snapshotted with `.slice()` per dispatch — measured 20 B brotli larger
			// (29 raw, 14 gzip) against the real toolchain, and it allocates on the
			// path that runs most (every dispatch) rather than the one that runs
			// least (every subscribe/unsubscribe). A listener unsubscribed by an
			// earlier one still runs for the current transition under either
			// design; one registered during dispatch runs under neither.
			let listeners: Registration[] = []

			const queue: [name: string, payload: unknown][] = []
			let draining = false

			// One row-scanning path for both kinds of transition, rather than a
			// `commit` helper called from two near-identical loops: takes the rows
			// to try, commits the first that does not decline, and reports whether
			// the machine moved. Both callers below are then one line each.
			//
			// `on` and `input` are simply **left off** for an immediate hop, which
			// is why they are optional rather than explicitly-passed `undefined`:
			// nothing sent it, and the record an immediate carries says so.
			//
			// Defaulting `rows` to `[]` absorbs both misses — an input with no row,
			// and a state with no immediates — so neither caller needs `?? []`.
			//
			// Rejected: folding the input hop and the chain into a *single* loop,
			// by reassigning `rows` to the immediates after the first pass. It
			// reads worse — three mutable locals where the nested form has one —
			// and measured 13 B brotli *larger* against the real toolchain, so it
			// loses on both counts. Rejected earlier: a `commit` helper called
			// from two separate row-scanning loops, which duplicates the scan and
			// measured 49 B brotli larger than this.
			const step = (rows: Row[] = [], on?: string, input?: Data): boolean => {
				for (const [to, handler] of rows) {
					const data = handler({ data: current.data, input, skip })
					// Declining is an ordinary, silent outcome: fall through to the
					// next row declared for the same source and input.
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
					return true
				}
				return false
			}

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
							if (step(index[current.state]?.[on], on, input)) {
								// The target's immediates settle to exhaustion before this
								// queue entry is done — a chain is one input's worth of
								// work, however many hops it takes. Counted per chain, and
								// so reset with every input taken off the queue.
								let hops = 0
								while (step(immediates[current.state])) {
									if (hops++ >= 1e5) {
										throw new RangeError(
											`maximum transitions reached in '${current.state}'`,
										)
									}
								}
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
	} as unknown as Machine<I, S, K, Init>
}

/** A pattern parsed into its three coordinates, with the listener alongside. */
type Registration = readonly [
	from: string,
	input: string | undefined,
	to: string | undefined,
	listener: Listener,
]
