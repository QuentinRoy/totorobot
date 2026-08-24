/**
 * Totorobot — finite state machines declared as a transition table.
 *
 *     const publication = machine({
 *       initial: 'empty',
 *       inputs: type<Inputs>(),
 *       states: type<States>(),
 *       transitions: {
 *         'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
 *         'draft -cancel> empty': () => {},
 *       },
 *     })
 *
 *     const doc = publication.start()
 *     doc.observe('* -> published', (e) => notify(e.to))
 *     doc.send({ type: 'open', text: 'hello' })
 *
 * The API is specified in `README.md` and argued in `docs/api-rationale.md`.
 * This module is the whole library: one definition builder, one host, and no
 * dependencies.
 *
 * ## On what is exported
 *
 * An exported type is a promise, so the list is the one `README.md` publishes
 * and nothing more: `machine`, `type`, the derived `InputsOf`, `StatesOf`,
 * `Handled` and `Sources`, and `Skip`, which is unavoidably public because it
 * is in every handler's return type.
 *
 * Everything else — `Machine`, `Host`, `Transition`, `Listener`,
 * `Pattern` and the machinery under them — is module-local **on purpose**. The
 * emitted declarations still carry them, so every public signature resolves and
 * hover text reads normally; they simply cannot be imported, which is what
 * leaves them free to change. A caller who needs to name one names it through
 * what it came from — `typeof publication`,
 * `ReturnType<typeof publication.start>` — rather than through a type whose
 * parameter list would then be frozen. Adding an `export` here widens the API;
 * do it deliberately, and say so in `README.md`.
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
 * No validation of *data*, anywhere. A malformed input is still a silent no-op
 * rather than a checked argument: an input name outside the table finds no
 * row, and a pattern naming a state that does not exist parses fine and never
 * matches.
 *
 * Two throws, for the two things that cannot be silent. A chain of immediate
 * transitions that never settles — `'a -> b'` declared alongside `'b -> a'` —
 * throws a `RangeError` after 1e5 consecutive hops, naming the state it could
 * not settle in: a hang is worse than a loud failure. And a transition key or
 * `observe()` pattern that is not well formed — anything but exactly one
 * arrow with a non-empty source and target — throws a `SyntaxError` naming
 * the string, the same wording the type layer uses for the same mistake: a
 * mis-typed key is a spelling error in a declaration, not user data, so it is
 * caught rather than silently building a dead or wrong row. Everything else
 * keeps the no-validation rule.
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
 * wildcard in the label position for free. Anything else — no separator, one
 * separator without the other, a second arrow, an empty source or target —
 * throws: a key or pattern this malformed is not a coordinate that merely
 * fails to match, it is not a transition at all, so it is caught here rather
 * than registered as one. Both `machine()`'s key loop and `observe()`'s
 * pattern registration call this one function, so they cannot drift apart on
 * what they accept.
 */
const parse = (key: string): [from: string, input: string, to: string] => {
	const parts = key.split(/ -|> /)
	const [from, input, to] = parts
	if (parts.length !== 3 || !from || !to) {
		throw new SyntaxError(`not a transition: '${key}'`)
	}
	return [from, input as string, to]
}

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

/**
 * The constraint the input vocabulary carries: a **tagged union**, one member
 * per input, discriminated by `type`. `send`, and the `input` field of a
 * transition record, are values of this union directly.
 */
type InputVocab = { readonly type: string }

/**
 * The constraint the state vocabulary carries: a **tagged union**, one member
 * per state, discriminated by `name`. `current`, and both ends of a transition
 * record, are values of this union directly; there is no wrapper pairing a
 * name with a separate data bag.
 */
type StateVocab = { readonly name: string }

/**
 * Resolves one of `machine`'s raw vocabulary parameters to the default once
 * it is `undefined` — which a raw parameter is both when its property is
 * omitted and when it is passed the marker's `undefined` explicitly, since a
 * constraint of `T | undefined` (rather than `T` with a default) takes
 * `undefined` itself as a legal, non-widening inference target instead of a
 * constraint violation. Constraining to bare `T` was tried first and
 * rejected: a candidate of `undefined` against that narrower constraint is
 * invalid, and TypeScript's fallback for an invalid candidate is the
 * constraint itself — `T`, not the default — so an explicit `inputs:
 * undefined` widened every name to `string` where an omitted property
 * correctly inferred `InputsFromKeys<K>`. Two call sites that were meant to
 * be indistinguishable were not; this is what makes them the same again.
 *
 * Generic over `T` rather than fixed to one shape, so the one utility serves
 * both `I` (`InputVocab`-shaped) and `S` (`StateVocab`-shaped).
 */
type Declared<Raw, Default> = Raw extends undefined ? Default : Raw

/** The input types an `InputVocab` declares, read off the union's own tag. */
type InputType<I extends InputVocab> = I['type']

/** The state names a `StateVocab` declares, read off the union's own tag. */
type StateName<S extends StateVocab> = S['name']

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
type Key<I extends InputVocab, S extends StateVocab> =
	| `${StateName<S>} -${InputType<I>}> ${StateName<S>}`
	| `${StateName<S>} -> ${StateName<S>}`

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
 * A name a key can round-trip, kept as itself; anything else, dropped to
 * `never` so the mapped types below drop the property entirely.
 *
 * `*` is excluded because it is the wildcard, not a name: every `Pattern`
 * already reads a state coordinate of `*` as "any state," so a key that
 * *means* the literal state `*` could never be addressed by one — `'b -back>
 * *'` would commit into a state no pattern can single out again. A name
 * padded by a leading or trailing space is excluded because the space is the
 * grammar's own delimiter (` -` and `> `): `'a -x>  b'` does not fail to
 * parse, it quietly moves the extra space into the target, minting a state
 * that only that one spelling can ever name again. A tab or newline is left
 * alone — it collides with nothing in the grammar, so rejecting it would be
 * this library having opinions about naming rather than protecting its own
 * syntax.
 */
type RoundTrips<N extends string> = N extends '*' | ` ${string}` | `${string} `
	? never
	: N

/**
 * The default input vocabulary, used when `machine` is called with `inputs`
 * omitted: every name mentioned anywhere in `transitions`, each a union
 * member carrying its `type` and nothing else known — so, unlike a declared
 * input, an inferred one's extra fields read as `unknown` and accept
 * anything passed in, rather than being assumed absent.
 *
 * `K` is inferred from `transitions` before either default is applied — `K`
 * precedes `I` and `S` in `machine`'s own parameter list, and a later default
 * may reference an earlier parameter — so this reads back the *raw* table
 * keys rather than reverse-inferring from a single field the way `initial`
 * once did. A malformed key drops out silently: `From`/`Label`/`To` only
 * match the well-formed template, so a key that fails it contributes no name,
 * and its row is still rejected on its own by `Table` below.
 *
 * The `as RoundTrips<N>` remap drops `*` and any leading/trailing-space name
 * out of the *inferred* vocabulary before the mapped type is built, so a key
 * that mints one fails `Key` and is rejected on its own row, the same as any
 * other unknown name — see `RoundTrips`. A vocabulary declared through
 * `type<T>()` is untouched: only what gets inferred from a key is filtered,
 * never `InputType` itself.
 */
type InputsFromKeys<K extends string> = {
	[N in RoundTrips<Exclude<Label<K>, ''>>]: { readonly type: N } & Record<
		string,
		unknown
	>
}[RoundTrips<Exclude<Label<K>, ''>>]

/**
 * The default state vocabulary, used when `machine` is called with `states`
 * omitted: every name mentioned anywhere in `transitions`, each a union
 * member carrying its `name` and nothing else known — so, unlike a declared
 * state, an inferred one's extra fields read as `unknown` and accept
 * anything written back, rather than being assumed absent. Built the same way
 * `At` below builds a union from a mapped type: map, then immediately index.
 *
 * Same reasoning as `InputsFromKeys` for reading `K` rather than reverse-
 * inferring from `initial`, and the same `RoundTrips` filter for the same
 * reason.
 */
type StatesFromKeys<K extends string> = {
	[N in RoundTrips<From<K> | To<K>>]: { readonly name: N } & Record<
		string,
		unknown
	>
}[RoundTrips<From<K> | To<K>>]

/**
 * Every legal `observe()` pattern: the key grammar with the state coordinates
 * left open. `*` is a state name that no vocabulary can shadow, and the
 * unlabelled arrow is the broad form — so there is no `-*>`, and a bare key,
 * which names a state, is not a pattern.
 */
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
 * The tagged empty-object type: an optional property keyed by a module-private
 * `unique symbol`, never populated. Used only as a handler's return type for a
 * target that carries no payload, alongside `void` — see `Table` below.
 *
 * Chosen over an index-signature form (`Record<string, never>` and kin) on two
 * measured grounds, both against TS 7.0.2 and both pinned in
 * `explorations/empty-state-payload.ts`, and argued in
 * `docs/api-rationale.md#17-the-shape-of-a-named-thing`:
 *
 * - **Error quality.** This form reports the value is not assignable to
 *   `EmptyObject`. The index-signature form reports a property incompatible
 *   with the index signature and a string literal not assignable to `never` —
 *   machinery the caller never wrote, on what is the most common row in a
 *   table.
 * - **Read safety.** Reading a foreign property off a `Record`-shaped member
 *   of a union infers `never` rather than erroring; this form errors. Not
 *   reachable through this library's own types today, but the tagged form
 *   does not depend on that continuing to hold.
 *
 * Both encodings are equally strict otherwise: both reject a fresh literal
 * carrying extra properties, a variable of a wider object type, an
 * interface-typed value, and a spread of a wider state; both accept `{}` and
 * `undefined`. Costs nothing at runtime either way.
 */
declare const emptyObjectTag: unique symbol
type EmptyObject = { readonly [emptyObjectTag]?: never }

/**
 * The transitions table, checked row by row.
 *
 * A malformed key **poisons its own value type**: the row is typed as a string
 * literal no function can satisfy, so the error reads
 * `not a transition: '…'` and lands on the offending row. Rejected: reporting
 * through an intersected missing property, which is an object-level error and
 * would land on the whole table instead — failing the one promise the notation
 * makes about its own diagnostics.
 *
 * Each row's handler is typed **inline** here rather than through a separate
 * `Handler<I, S, K>` alias parameterized over `S`: a wrong-shaped return
 * behind such an alias reports against the whole state union
 * (`… required in type 'Data<{ name: "empty" } | …, "review">'`); resolving
 * the same computation inline reports against the one state the row actually
 * targets. See `docs/api-rationale.md#17-the-shape-of-a-named-thing`.
 *
 * The **source** state arrives whole, tag included, under `state` — a handler
 * shared across several rows can branch on `state.name` to tell which one it
 * is transitioning from. The **input** arrives under `input`: whole with its
 * `type` tag on an input-driven row, and `undefined` on an immediate row.
 * The **target**'s payload is what the handler returns, with its tag left
 * off: the library adds it back by spreading last (see `machine`'s `step`),
 * so a handler that spreads `state` into its return cannot leave the
 * source's tag on the committed state. A target with no payload accepts
 * nothing or `{}` (`EmptyObject | void`, above) and rejects everything else,
 * including a spread of a wider state. A target whose data is unknown — the
 * row's target was never declared, only inferred from the table — accepts
 * anything object-shaped, nothing included, matching how `StatesFromKeys`
 * widens it.
 *
 * `Skip` rides alongside the target's payload rather than replacing it, so
 * declining costs no type safety — a wrong-shaped return is still rejected on
 * a row that could also `skip()`.
 *
 * `state` and `input` are wrapped in `NoInfer` because handler parameters are
 * inference sites: a context-sensitive handler — one that destructures its
 * argument — otherwise infers `S` or `I` contravariantly from the table,
 * competing with the `states`/`inputs` properties that are meant to be their
 * only sources. `S` or `I` lands on garbage and `Key<I, S>` collapses, so
 * **every** row, well formed or not, is rejected as `not a transition: '…'`
 * — the diagnostic below, fired on rows that are fine.
 *
 * One limitation, and it is TypeScript's rather than this notation's: a handler
 * that destructures nothing — `() => ({ … })` — is not context-sensitive, so
 * the compiler types it in the same pass that infers `states:` from the sibling
 * property, before `S` is known. Its return expression therefore has no
 * contextual type and its literals widen, which a target state pinning a
 * literal field then rejects. Reading `state` or `input` defers the handler to
 * the pass after the vocabulary is known and needs no annotation; an
 * argument-free handler returning a pinned literal needs `as const` or a return
 * type. Nothing the library can express moves this: the vocabulary and the
 * table are properties of one object literal, and one is inferred from the
 * other.
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

/**
 * The members of `S` named `N`, narrowed by `Extract` on the tag `S` is
 * already discriminated by. `current`, and each end of a transition record,
 * are values of this — there is no wrapper pairing a name with a separate
 * data bag, and nothing to keep in sync: narrowing the tag narrows the whole
 * object, fields included, with no nullable padding on a field every member
 * of `N` guarantees.
 *
 * Never mutated: a value read from `current` stays valid.
 */
type At<S extends StateVocab, N extends string> = Extract<S, { name: N }>

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
 * by `input.type`, over the inputs and the two ends the pattern admits.
 * `'* -> *'` leaves all three open and is therefore the whole record.
 *
 * An unlabelled pattern also admits an immediate hop — `input: undefined` —
 * which is why that case is a separate union arm rather than folded into the
 * mapped type: the mapped type is indexed by input type, and an immediate has
 * none. A labelled pattern's `Label<P>` is never `''`, so the arm drops out
 * there, matching the runtime, where a labelled pattern never matches an
 * immediate.
 */
type Transition<
	I extends InputVocab = InputVocab,
	S extends StateVocab = StateVocab,
	P extends string = '* -> *',
> =
	| {
			[N in Select<Label<P>, InputType<I>>]: {
				readonly input: Extract<I, { type: N }>
				readonly from: At<S, Select<From<P>, StateName<S>>>
				readonly to: At<S, Select<To<P>, StateName<S>>>
			}
	  }[Select<Label<P>, InputType<I>>]
	| ([Label<P>] extends ['']
			? {
					readonly input: undefined
					readonly from: At<S, Select<From<P>, StateName<S>>>
					readonly to: At<S, Select<To<P>, StateName<S>>>
				}
			: never)

type Listener<
	I extends InputVocab = InputVocab,
	S extends StateVocab = StateVocab,
	P extends string = '* -> *',
> = (transition: Transition<I, S, P>) => void

/**
 * `start`'s arity follows the initial state's payload, minus its tag, by the
 * same three-way rule as a handler's return in `Table`: no payload takes no
 * argument, an inferred (`StatesFromKeys`) payload takes an optional one, a
 * declared payload requires one. The initial state named in the definition is
 * the only place that data can come from, so `start` cannot disagree with it.
 */
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
	readonly send: (input: I) => void
	// Generic in the pattern, so the record the listener receives is narrowed by
	// the pattern that selected it rather than being the whole union every time.
	readonly observe: <P extends Pattern<I, S>>(
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
 * The inputs state `S` has rows for, derived from the `'draft -'` text search
 * over the table's keys. `Exclude<…, ''>` drops an immediate row's empty
 * label.
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

/** A handler as the runtime calls it: source state and input payload in, target payload or the sentinel out. */
type Call = (args: {
	readonly state: Data
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
	readonly current: Data
	readonly send: (input: Data) => void
	readonly observe: (pattern: string, listener: Listener) => () => void
}

/**
 * Source state to input name to the rows declared for that pair, in
 * declaration order.
 *
 * Null-prototype at both levels so an untyped `send({ type: 'toString' })`
 * finds nothing rather than finding `Object.prototype`'s method and calling it
 * as a handler. A name outside the table has to change nothing rather than
 * throw, and +10 B brotli over plain object literals is the whole cost of
 * honouring it.
 */
type Index = Record<string, Record<string, Row[] | undefined> | undefined>

/**
 * Source state to the unlabelled rows declared out of it, in declaration
 * order. Kept apart from `Index` rather than filtered out of it at read
 * time: `send` reads `Index` directly, so a row stored here is structurally
 * unreachable from it rather than merely absent by convention.
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
export const type = <T>(): T | undefined => undefined

/**
 * One queue and one draining flag for every host, not one per host. Two
 * machines wired to each other are how peer composition works today, before
 * any composition feature exists, and commit ordering's rule 4 — `README.md`
 * — has to hold across that wiring the same way it holds within one host —
 * see `docs/api-rationale.md`, "Module scope, not per host".
 *
 * A queued entry is a thunk rather than a `[name, payload]` tuple: draining
 * now has to run rows against *whichever* host queued the entry, and a thunk
 * closes over that host's own `step`/`settle`/`index`/`current` for free,
 * where a tuple would need the host carried alongside it and matched back up
 * at drain time.
 */
let queue: (() => void)[] = []
let draining = false

/**
 * Run `work`, and everything it queues, as one dispatch — the window rule 4 is
 * stated in terms of, and the thing `draining` records being inside of. Takes
 * the drain if nobody holds it, drains to exhaustion and releases it; or, if
 * somebody already holds it, runs `work` and leaves the queue to them.
 *
 * Named for that window rather than for the flag it sets, because the window is
 * what both callers are asking for, and neither can be expressed as the other:
 * `send` has already queued its work and passes nothing, while `start` must run
 * its chain *inline* — it cannot defer it and still hand back a settled host —
 * but must do so from inside the window, so a send issued from one of those
 * hops queues like any other. Not the `dispatch` of the reducer libraries: that
 * verb is `send`, and this takes a thunk or nothing.
 *
 * The queue is empty whenever `draining` is false, because every exit path
 * clears it below, so taking the drain can never inherit abandoned work.
 *
 * `work?.()` rather than two call sites: the optional call is one byte-cheap
 * token where a required parameter would push `send` into allocating a closure
 * per call just to hand its `queue.push` over.
 */
const dispatch = (work?: () => void): void => {
	// Already inside a dispatch, somewhere — on this host or any other. The
	// outermost call, on whichever host started the chain, owns the drain.
	if (draining) return work?.()
	draining = true
	try {
		work?.()
		for (let run; (run = queue.shift());) run()
	} finally {
		// In a `finally` so a throwing listener leaves every host usable and the
		// flag correct. The queue is abandoned rather than drained: each
		// transition already committed stays committed, but nothing still queued
		// runs — on this host or any other.
		draining = false
		queue.length = 0
	}
}

/**
 * Declare a machine. The result is inert data — it holds the index in a
 * closure, never touches or annotates the configuration object it was given,
 * and exposes `start` only, because observation is a property of a running
 * machine and an imported definition stays inert.
 *
 * Every key is parsed **once**, here. Rejected: storing nothing and
 * prefix-scanning the raw keys on every dispatch, which came within 1.6% in the
 * pre-implementation prototypes — not a basis for choosing. The index wins on
 * behaviour: dispatch is a lookup rather than a scan, and a malformed key
 * arriving from untyped code cannot accidentally prefix-match.
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
 * `RawI` is what `inputs` actually infers to, and `Declared` resolves it to
 * the default the moment it is `undefined`. `I` stays a parameter of its own
 * — the resolved input vocabulary used everywhere else in this signature —
 * because collapsing it with `RawI` into one parameter, constrained to bare
 * `InputVocab` with a default, is the version that fails: see `Declared`.
 *
 * `S` gets the same `RawS`/`Declared` pair `I` gets, for the same reason and
 * with the same spelling — the two halves are symmetric here.
 *
 * That symmetry depends on `states` and `inputs` being the **only** inference
 * sites for `S` and `I`, which is not free: `Table` also puts `S` and `I` in
 * handler parameters, and parameters are inference sites too. A context-
 * sensitive handler otherwise infers `S` or `I` contravariantly from the table
 * and competes with `states`/`inputs` for them; `S`/`I` lands on garbage,
 * `Key<I, S>` collapses, and every row — well formed or not — is rejected as
 * `not a transition: '…'`. The `NoInfer` on `state` and `input` in `Table`
 * closes those sites, and closing them is what lets `S` and `I` carry
 * `Declared` defaults at all.
 *
 * Rejected: splitting this into overloads, which also avoids that failure
 * but costs the diagnostics the notation exists to give, exactly as §5 of the
 * rationale already recorded for overloads generally. Overload resolution
 * reports `No overload matches this call` against the whole call expression
 * and then elaborates only the *last* overload, so a malformed row lands on
 * `machine({` rather than on the row, a bad `initial` is reported as a
 * missing `states` property, and a table carrying two malformed rows names
 * only one of them. This signature reports each on its own row, and both of
 * two malformed rows separately.
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
	RawI extends InputVocab | undefined = undefined,
	RawS extends StateVocab | undefined = undefined,
	I extends InputVocab = Declared<RawI, InputsFromKeys<K>>,
	S extends StateVocab = Declared<RawS, StatesFromKeys<K>>,
>(definition: {
	readonly initial: Init & StateName<NoInfer<S>>
	// `| undefined` is what `type()` returns, and inference subtracts it: the
	// vocabulary lands as `RawI` rather than `RawI | undefined`, so nothing
	// downstream carries an undefined it would have to strip again. Spelled
	// out rather than left to `?:` alone because `exactOptionalPropertyTypes`
	// makes those two different: omitting the key is not the same as writing
	// `inputs: undefined`, and the marker's return type has to satisfy both.
	readonly inputs?: RawI | undefined
	readonly states?: RawS | undefined
	readonly transitions: Table<I, S, K>
}): Machine<I, S, K, Init>
// The implementation signature, never seen by a caller — only the signature
// above is. `any` rather than a structural type: a row's value in
// `Table<I, S, K>` can itself be the poison string literal
// `not a transition: '…'`, which is not a `Call`, so no non-`any` parameter
// type implements it. Narrowed back immediately below, the same way the rest
// of this function already treats its own inputs as `Data`.
export function machine(definition: any): any {
	const { initial, transitions } = definition as unknown as {
		readonly initial: string
		readonly transitions: Readonly<Record<string, Call>>
	}
	const index: Index = Object.create(null)
	const immediates: Immediates = Object.create(null)

	for (const key in transitions) {
		const [from, input, to] = parse(key)
		const row: Row = [to, transitions[key]!]
		// `parse` has already rejected anything that is not `from`, a label, and
		// `to` — so the label is the empty string exactly for an unlabelled
		// arrow, and nothing else reaches this branch. Splitting on falsy rather
		// than on exactly `''` would sweep a labelled row into `immediates` too.
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
		start: (data?: Data): RawHost => {
			// Host state lives in a closure variable read back through a getter,
			// rather than on a plain object with an assigned property that `send`
			// reaches back into and mutates. Measured against the real toolchain:
			// an assigned property comes out larger — mutating a bound `host`
			// object costs more than a getter closing over a local, and the getter
			// needs no extra identifier for the object itself. `current` is
			// already the whole tagged state object — the library adds the tag by
			// spreading it last, so a spread of the source state into a handler's
			// return cannot leave the wrong tag on the new one — which is what
			// hands `from` and `to` over as references instead of building two
			// more objects per commit.
			let current: Data = { ...data, name: initial }

			// Copy-on-write at registration, plain iteration at dispatch. Rejected:
			// a mutable list mutated with `.push()`/`.splice()` at registration and
			// snapshotted with `.slice()` per dispatch — measured 20 B brotli larger
			// (29 raw, 14 gzip) against the real toolchain, and it allocates on the
			// path that runs most (every dispatch) rather than the one that runs
			// least (every subscribe/unsubscribe). A listener unsubscribed by an
			// earlier one still runs for the current transition under either
			// design; one registered during dispatch runs under neither.
			let listeners: Registration[] = []

			// One row-scanning path for both kinds of transition, rather than a
			// `commit` helper called from two near-identical loops: takes the rows
			// to try, commits the first that does not decline, and reports whether
			// the machine moved. Both callers below are then one line each.
			//
			// `input` is simply **left off** for an immediate hop, which is why it
			// is optional rather than explicitly-passed `undefined`: nothing sent
			// it, and the record an immediate carries says so.
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
			const step = (rows: Row[] = [], input?: Data): boolean => {
				for (const [to, handler] of rows) {
					const payload = handler({ state: current, input, skip })
					// Declining is an ordinary, silent outcome: fall through to the
					// next row declared for the same source and input.
					if (payload === SKIP) continue

					// Commit, then notify — so every listener sees a machine that
					// agrees with the record it was handed. The tag is spread last,
					// so a handler that spread the source state into its return
					// cannot leave the source's tag on the committed state.
					const from = current
					current = { ...payload, name: to }
					const record: Transition = { input, from, to: current }
					for (const [f, l, t, listener] of listeners) {
						if (
							(f === '*' || f === from.name) &&
							(l === '' || l === input?.type) &&
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

			// The immediates of whatever state was just entered, settled to
			// exhaustion before the caller sees it — a chain is one arrival's
			// worth of work, however many hops it takes. Shared by `start`, which
			// settles the declared initial state before the host is handed back,
			// and `send`, which settles the target of a committed input. Counted
			// per call, so a budget spent settling the initial state does not
			// carry over into the first `send`.
			const settle = (): void => {
				let hops = 0
				while (step(immediates[current.name])) {
					if (hops++ >= 1e5) {
						throw new RangeError(
							`maximum transitions reached in '${current.name}'`,
						)
					}
				}
			}
			// Under the same drain ownership `send` takes, rather than bare: the
			// initial chain is a dispatch, so a send issued from one of its hops —
			// a handler reaching into another host today, an action on the initial
			// state once `actions` lands — queues and drains after the chain
			// settles, instead of nesting whenever `start` happened to be called
			// with nothing else in flight. See `docs/api-rationale.md`, "`start`
			// settles under the drain".
			dispatch(settle)

			return {
				get current(): Data {
					return current
				},

				observe: (pattern: string, listener: Listener): (() => void) => {
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

				send: (input: Data): void => {
					// Queued rather than run: `draining` is module scope, so this holds
					// whether the call came from this host's own listener, a listener on
					// a completely different host, or a hop `start` is settling — see
					// the queue's own comment.
					queue.push(() => {
						// Evaluated against the state at drain time, so a queued send may
						// correctly find no row and do nothing.
						if (step(index[current.name]?.[input?.type], input)) settle()
					})
					dispatch()
				},
			}
		},
	} as unknown
}

/** A pattern parsed into its three coordinates, with the listener alongside. */
type Registration = readonly [
	from: string,
	input: string,
	to: string,
	listener: Listener,
]
