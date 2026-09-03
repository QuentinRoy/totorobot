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
 * initially leaves an unlabeled arrow's label empty. Normalizing that slot to
 * `undefined` lets transition dispatch distinguish an immediate row from
 * `send('')`; pattern matching still reads an absent label as its wildcard.
 * Shared by `machine()` and `observe()`, so the two cannot drift. The
 * exclusive-or check is zero only when the split has exactly three parts
 * (I42).
 */
type Coordinates = [from: string, input: string | undefined, to: string]

let parse = (
	key: string,
	parts: (string | undefined)[] = key.split(/ -|> /),
): Coordinates => {
	if (parts.length ^ 3 || !parts[0] || !parts[2]) {
		throw SyntaxError(`not a transition: '${key}'`)
	}
	return ((parts[1] ||= undefined), parts) as Coordinates
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
type VocabMap<SomeVocab extends Vocab> =
	true extends IsUnion<SomeVocab>
		? never
		: SomeVocab extends readonly unknown[] | Function
			? never
			: Exclude<keyof SomeVocab, string> extends never
				? unknown
				: never

/**
 * Lands an omitted property and an explicit `undefined` on the same type;
 * constraining the raw parameter to bare `T` widens the explicit case instead
 * (I19).
 */
type Declared<Raw, Default> = Raw extends undefined ? Default : Raw

type Name<SomeVocab extends Vocab> = keyof SomeVocab & string

/** The payload a name carries. `& keyof SomeVocab` is the constraint, never a filter. */
type Payload<
	SomeVocab extends Vocab,
	MemberName extends string,
> = SomeVocab[MemberName & keyof SomeVocab]

// ---------------------------------------------------------------------------
// The key grammar, at the type level
// ---------------------------------------------------------------------------

/**
 * A union, not a validating conditional, because a union is what an editor
 * offers as completions — |states|² × |inputs| of them, priced in §12 Sending
 * inputs.
 */
type Key<Inputs extends Vocab, States extends Vocab> =
	| `${Name<States>} -${Name<Inputs>}> ${Name<States>}`
	| `${Name<States>} -> ${Name<States>}`

/** A leading `infer` stops at the first separator, so these agree with `parse`. */
type From<KeyString> =
	KeyString extends `${infer FromPart} -${string}> ${string}` ? FromPart : never
type Label<KeyString> =
	KeyString extends `${string} -${infer LabelPart}> ${string}`
		? LabelPart
		: never
type To<KeyString> = KeyString extends `${string} -${string}> ${infer ToPart}`
	? ToPart
	: never

/**
 * `*` collides with the pattern wildcard, a padded name with the grammar's own
 * delimiters: a key minting either names a state nothing can address (§5 The
 * declared vocabulary).
 */
type RoundTrips<CandidateName extends string> = CandidateName extends
	'*' | ` ${string}` | `${string} `
	? never
	: CandidateName

/**
 * The vocabulary when `inputs` is omitted, read off the raw keys `Keys`, a
 * sibling parameter already inferred. Only inferred names are filtered, never
 * declared.
 */
type InputsFromKeys<Keys extends string> = {
	[InputName in RoundTrips<Exclude<Label<Keys>, ''>>]: unknown
}

/** The same for state names, read off both ends of every key. */
type StatesFromKeys<Keys extends string> = {
	[StateName in RoundTrips<From<Keys> | To<Keys>>]: unknown
}

/** No `-*>`: the unlabelled arrow is the broad form, and a bare key is not one. */
type Wildcard<States extends Vocab> = Name<States> | '*'
type Pattern<Inputs extends Vocab = AnyVocab, States extends Vocab = AnyVocab> =
	| `${Wildcard<States>} -${Name<Inputs>}> ${Wildcard<States>}`
	| `${Wildcard<States>} -> ${Wildcard<States>}`

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/**
 * Checked row by row: a malformed key poisons its own value type, so
 * `not a transition: '…'` lands on that row, not on the whole table. The return
 * is the destination's payload, resolved inline rather than behind an alias over
 * `States`, so a wrong-shaped return names the one state the row targets (I18);
 * the row stays the authority for the name, which no return can redirect (§5 The
 * declared vocabulary). The `void` arm accepts an empty body, and only where the
 * payload already admits `undefined`, so a destination that carries something
 * still rejects a handler that returns nothing (I27). `NoInfer` guards the
 * parameters (I14).
 */
type Table<Inputs extends Vocab, States extends Vocab, Keys extends string> = {
	readonly [RowKey in Keys]: RowKey extends Key<Inputs, States>
		? (args: {
				readonly input: NoInfer<
					[Label<RowKey>] extends [''] ? undefined : Label<RowKey>
				>
				readonly inputData: NoInfer<
					[Label<RowKey>] extends ['']
						? undefined
						: Payload<Inputs, Label<RowKey>>
				>
				readonly from: From<RowKey>
				readonly fromData: NoInfer<Payload<States, From<RowKey>>>
				readonly to: To<RowKey>
				readonly skip: () => Skip
			}) =>
				| (undefined extends States[To<RowKey> & keyof States]
						? States[To<RowKey> & keyof States] | void
						: States[To<RowKey> & keyof States])
				| Skip
		: `not a transition: '${RowKey}'`
}

// ---------------------------------------------------------------------------
// What a running machine is
// ---------------------------------------------------------------------------

/**
 * The name and the payload as one union member, so a name check narrows the data
 * beside it (§5 The declared vocabulary). A state carrying nothing keeps its
 * `data`, valued `undefined`, rather than dropping the property.
 */
type Current<States extends Vocab> = {
	[StateName in Name<States>]: {
		readonly name: StateName
		readonly data: States[StateName]
	}
}[Name<States>]

/**
 * `send` is the whole declared vocabulary from every state, never narrowed to
 * what `from` or `to` handles: a queued input is read at drain time, by which
 * point the machine has moved, so the normal reaction sends something the state
 * it was notified about does not handle (§12 Sending inputs). A tuple union
 * keeps each input name paired with its data when callers hold unions of both
 * fields (I29).
 */
type Send<Inputs extends Vocab> = (
	...args: {
		[InputName in Name<Inputs>]: undefined extends Inputs[InputName]
			? [input: InputName, inputData?: Inputs[InputName]]
			: [input: InputName, inputData: Inputs[InputName]]
	}[Name<Inputs>]
) => void

/**
 * What an action announces through, structurally `Send`'s twin today, optional
 * payload rule included. Declared apart rather than aliased: `send` names a
 * capability a state permits, which is the wrong story for an output, and two
 * declarations can drift without a rename (§10 Composition).
 */
type Emit<Outputs extends Vocab> = (
	...args: {
		[OutputName in Name<Outputs>]: undefined extends Outputs[OutputName]
			? [output: OutputName, data?: Outputs[OutputName]]
			: [output: OutputName, data: Outputs[OutputName]]
	}[Name<Outputs>]
) => void

/**
 * What every declared action carries beyond the facts: the host's `send`, which
 * an observer gets too, and `emit`, which only an action does. A handler may
 * `skip()`, so a handler that emitted would announce a hop that then loses; an
 * `observe` callback is outside the machine, and the channel is the machine
 * speaking for itself (§10 Composition).
 */
type Capabilities<Inputs extends Vocab, Outputs extends Vocab> = {
	readonly send: Send<Inputs>
	readonly emit: Emit<Outputs>
}

/**
 * What a listener is handed: the output's name, what it carried, and the
 * emitting host's own `send`, so a reaction drives the machine back without
 * closing over a host reference. One member per name, so a name check narrows
 * the payload beside it, the same construction `Current` uses (I31).
 */
type Announcement<
	Inputs extends Vocab,
	Outputs extends Vocab,
	OutputName extends string,
> = {
	[EachOutput in OutputName]: {
		readonly output: EachOutput
		readonly data: Payload<Outputs, EachOutput>
		readonly send: Send<Inputs>
	}
}[OutputName]

/**
 * A declared row matches a pattern when every coordinate agrees: `*` in a
 * pattern's state position admits any name; a pattern's label position has no
 * wildcard spelling (line 127) — the omitted, unlabelled form is the broad one
 * already, so it admits a row's label, named or absent alike (I31, I32).
 */
type Matches<RowKey extends string, PatternString extends string> = (
	From<PatternString> extends '*'
		? true
		: From<RowKey> extends From<PatternString>
			? true
			: false
) extends true
	? (
			Label<PatternString> extends ''
				? true
				: Label<RowKey> extends Label<PatternString>
					? true
					: false
		) extends true
		? To<PatternString> extends '*'
			? true
			: To<RowKey> extends To<PatternString>
				? true
				: false
		: false
	: false

/** The declared rows a pattern admits, one member of `Keys` per match. */
type MatchingRows<
	Keys extends string,
	PatternString extends string,
> = Keys extends unknown
	? Matches<Keys, PatternString> extends true
		? Keys
		: never
	: never

/**
 * A pattern with no declared row it could ever fire from — the same
 * `string extends Keys` gate `Transition`'s own fallback uses (I34), so a
 * genuinely widened `Keys` is left unchecked rather than falsely rejected.
 */
type NoMatch<
	Keys extends string,
	PatternString extends string,
> = string extends Keys
	? false
	: [MatchingRows<Keys, PatternString>] extends [never]
		? true
		: false

/**
 * The matchable subset of `Pattern<Inputs, States>`: every member with at
 * least one declared row, filtered against the table the same way `NoMatch`
 * rejects a dead one — but computed from `Inputs`, `States` and `Keys` alone,
 * with no call-site pattern in the formula. `observe`'s edge overload
 * intersects its parameter with this rather than gating on
 * `NoMatch<Keys, PatternString>` at the top: a pattern this checks *offers*,
 * `NoMatch` still decides what it *accepts* (I37).
 */
type MatchedPattern<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
> = string extends Keys
	? Pattern<Inputs, States>
	: {
			[PatternString in Pattern<Inputs, States>]: NoMatch<
				Keys,
				PatternString
			> extends true
				? never
				: PatternString
		}[Pattern<Inputs, States>]

/** The wildcard rules of the runtime's own comparison, at the type level. */
type Select<Coordinate extends string, All extends string> = [
	Coordinate,
] extends ['*' | '']
	? All
	: Coordinate & All

/**
 * The pattern-only construction `Transition` built before #99 (I31): the
 * fallback for a widened `Keys`, where the exact row keys are unavailable
 * (I34).
 */
type PatternFacts<
	Inputs extends Vocab,
	States extends Vocab,
	PatternString extends string,
	Extra extends object,
> = {
	[FromState in Select<From<PatternString>, Name<States>>]: {
		[ToState in Select<To<PatternString>, Name<States>>]:
			| {
					[InputName in Select<Label<PatternString>, Name<Inputs>>]: Extra & {
						readonly input: InputName
						readonly inputData: Inputs[InputName]
						readonly from: FromState
						readonly fromData: States[FromState]
						readonly to: ToState
						readonly toData: States[ToState]
					}
			  }[Select<Label<PatternString>, Name<Inputs>>]
			| ([Label<PatternString>] extends ['']
					? Extra & {
							readonly input: undefined
							readonly inputData: undefined
							readonly from: FromState
							readonly fromData: States[FromState]
							readonly to: ToState
							readonly toData: States[ToState]
						}
					: never)
	}[Select<To<PatternString>, Name<States>>]
}[Select<From<PatternString>, Name<States>>]

/**
 * Three names and their three payloads, narrowed by the observer's own
 * pattern. One member per declared row `Keys` the pattern admits, filtered
 * against the table rather than built from the pattern's own wildcards, so a
 * source, an input or a destination this table never pairs cannot appear
 * together in one record — a check on any one name narrows the payload
 * beside it, and also narrows the other two, to only what that name actually
 * reaches (I31, I32). `string extends Keys` falls back to `PatternFacts` for
 * a widened `Keys`, which would otherwise collapse every field to `never`
 * (I34). `Extra` is what the record carries beyond the facts — `send` for a
 * committed transition, nothing for a restart decision (§9 Actions).
 */
type Transition<
	Inputs extends Vocab = AnyVocab,
	States extends Vocab = AnyVocab,
	Keys extends string = string,
	PatternString extends string = '* -> *',
	Extra extends object = { readonly send: Send<Inputs> },
> = string extends Keys
	? PatternFacts<Inputs, States, PatternString, Extra>
	: {
			[RowKey in MatchingRows<Keys, PatternString>]: Extra & {
				readonly input: [Label<RowKey>] extends [''] ? undefined : Label<RowKey>
				readonly inputData: [Label<RowKey>] extends ['']
					? undefined
					: Payload<Inputs, Label<RowKey>>
				readonly from: From<RowKey>
				readonly fromData: Payload<States, From<RowKey>>
				readonly to: To<RowKey>
				readonly toData: Payload<States, To<RowKey>>
			}
		}[MatchingRows<Keys, PatternString>]

type EdgeObserver<
	Inputs extends Vocab = AnyVocab,
	States extends Vocab = AnyVocab,
	Keys extends string = string,
	PatternString extends string = '* -> *',
> = (transition: Transition<Inputs, States, Keys, PatternString>) => void

// ---------------------------------------------------------------------------
// Actions
//
// Every action takes the same one argument, whichever kind of trigger fired it:
// the transition record, `send` included, exactly what a matching observer
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
type Arrived<
	States extends Vocab,
	StateName extends string,
	Extra extends object,
> = Extra & {
	readonly input: undefined
	readonly inputData: undefined
	readonly from: undefined
	readonly fromData: undefined
	readonly to: NoInfer<StateName>
	readonly toData: NoInfer<Payload<States, StateName>>
}

/**
 * What a residency action and a residency observer for the same bare state
 * share: every declared row landing on `StateName`, correlated per row like
 * any other `Transition`, plus the arrival no transition caused (I31, I32).
 */
type Residency<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	StateName extends string,
	Extra extends object = { readonly send: Send<Inputs> },
> =
	| Transition<Inputs, States, Keys, `* -> ${StateName}`, Extra>
	| Arrived<States, StateName, Extra>

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
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	Outputs extends Vocab,
	InitialState extends string,
	StateName extends string,
> = [StateName] extends [InitialState]
	? Residency<Inputs, States, Keys, StateName, Capabilities<Inputs, Outputs>>
	: Transition<
			Inputs,
			States,
			Keys,
			`* -> ${StateName}`,
			Capabilities<Inputs, Outputs>
		>

/**
 * Fires on arrival at its state, by any route `* -> StateName` covers; the
 * teardown it returns runs on exit (§9 Actions). Generic in the argument
 * itself, rather than in `Inputs, States, Keys, StateName`, so `Actions` and
 * `ObserveAction` can each hand it a differently-scoped arrival
 * (`ActionArrival`, `Residency`) without a second signature. The trailing
 * `| void` is not the bivariance hole it looks like — that only opens when a
 * signature's return type *is* `void`, not when `void` is one arm of a union,
 * where an explicit wrong-shaped or `async` return is still rejected (I27).
 * It is what lets a setup with nothing to tear down end in a plain statement
 * rather than an explicit `return undefined`.
 */
type ResidencyAction<ArrivalRecord> = (
	arrival: NoInfer<ArrivalRecord>,
) => undefined | Teardown | void

/**
 * Not bare `void`: that alone lets a function return anything, `Teardown`
 * included, stranding it uncalled on every matching edge. Unioned with
 * `undefined` the hole closes — an explicit `Teardown` return is still
 * rejected (I27) — while still taking a plain block body with nothing to
 * return.
 */
type EdgeAction<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	Outputs extends Vocab,
	PatternString extends string,
> = (
	transition: NoInfer<
		Transition<
			Inputs,
			States,
			Keys,
			PatternString,
			Capabilities<Inputs, Outputs>
		>
	>,
) => undefined | void

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
 * restart. Without `NoInfer` the predicate reopens `States` and the table
 * collapses (I28).
 */
type Restart<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	StateName extends string,
> = {
	readonly restart?:
		| boolean
		| ((
				facts: NoInfer<
					Transition<Inputs, States, Keys, `${StateName} -> ${StateName}`, {}>
				>,
		  ) => boolean)
}

/**
 * A bare state name whose residency can actually run: `initial`, whose
 * synthetic arrival needs no incoming row (#100), or any other state with at
 * least one declared row landing on it
 * (`NoMatch<Keys, '* -> StateName'>` false). Named once rather than left
 * inline in `Actions`, the same question I35 already stated twice under
 * different names before it was unified — #117 built a second reader on top
 * of this one (completions for `actions`) and measured its cost too high to
 * ship (I38), but the question itself is asked here exactly once regardless.
 */
type Eligible<
	Keys extends string,
	InitialState extends string,
	StateName extends string,
> = [StateName] extends [InitialState]
	? true
	: NoMatch<Keys, `* -> ${StateName}`> extends true
		? false
		: true

/**
 * Checked row by row, like `Table`: decidable from the string alone (§9
 * Actions), an edge-shaped key (`from -input> to`, wildcards included) against
 * `Pattern`, else a bare key against the declared state names. Either miss
 * reports its own `not a trigger: '…'` rather than poisoning a well-formed
 * neighbour. `restart` has no meaning on an edge, so only the residency arm
 * widens with it.
 *
 * A name-valid key naming no declared row (or, for a noninitial bare state,
 * no incoming row at all — `Eligible` false) reports `no row matches '…'`
 * instead: an edge with no matching row can never run, and neither can a
 * noninitial residency with none, since `enter` hands the synthetic arrival
 * only to `initial`'s own action (#100). This is a second, independent check
 * alongside `ActionArrival`'s own `InitialState` comparison, not a
 * replacement for it: a noninitial action's argument still excludes the
 * arrival member it can never receive, precise as I33 left it, and
 * eligibility is checked on top of that, not by widening it.
 */
type Actions<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	Outputs extends Vocab,
	InitialState extends string,
	TriggerKeys extends string,
> = {
	readonly [
		TriggerKey in TriggerKeys
	]: TriggerKey extends `${string} -${string}> ${string}`
		? TriggerKey extends Pattern<Inputs, States>
			? NoMatch<Keys, TriggerKey> extends true
				? `no row matches '${TriggerKey}'`
				: Action<EdgeAction<Inputs, States, Keys, Outputs, TriggerKey>>
			: `not a trigger: '${TriggerKey}'`
		: TriggerKey extends Name<States>
			? Eligible<Keys, InitialState, TriggerKey> extends true
				? Action<
						ResidencyAction<
							ActionArrival<
								Inputs,
								States,
								Keys,
								Outputs,
								InitialState,
								TriggerKey
							>
						>,
						Restart<Inputs, States, Keys, TriggerKey>
					>
				: `no row matches '${TriggerKey}'`
			: `not a trigger: '${TriggerKey}'`
}

/**
 * What `observe` takes for a bare state key: a residency action alone or in a
 * `{ run, restart }` record, the same two shapes `Actions` allows for one —
 * everything but the array, which a caller gets by calling `observe` twice
 * (§11 The host). Always arrival-capable, whichever state: a late
 * registration can find any state already occupied, `initial` or not (I32).
 */
type ObserveAction<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	StateName extends string,
> =
	| ResidencyAction<Residency<Inputs, States, Keys, StateName>>
	| ({
			readonly run: ResidencyAction<Residency<Inputs, States, Keys, StateName>>
	  } & Restart<Inputs, States, Keys, StateName>)

/** The initial payload, omitted exactly when `send` would omit one (§5). */
type Start<States extends Vocab, InitialState extends string> =
	undefined extends Payload<States, InitialState>
		? [data?: Payload<States, InitialState>]
		: [data: Payload<States, InitialState>]

/** A running machine: the only mutable thing in the design. */
export interface Host<
	Inputs extends Vocab = AnyVocab,
	States extends Vocab = AnyVocab,
	Keys extends string = string,
	Outputs extends Vocab = AnyVocab,
> {
	readonly current: Current<States>
	readonly send: Send<Inputs>
	// Subscribe by output name, not by a place in the machine's topology. One
	// coordinate, so no pattern language and nothing to wildcard; returns an
	// idempotent unsubscribe, mirroring `observe` (§10 Composition). Generic in
	// the name, so the record's payload is narrowed by it.
	readonly on: <OutputName extends Name<Outputs>>(
		output: OutputName,
		listener: (
			announcement: NoInfer<Announcement<Inputs, Outputs, OutputName>>,
		) => void,
	) => () => void
	// Generic in the pattern, so an observer's record is narrowed by it. A
	// name-valid edge pattern with no declared row it could ever fire from is
	// rejected the same way `Table` rejects a malformed key — the pattern
	// parameter's own type, not the observer's (#100). A bare state key is
	// the second, overloaded form: always eligible, since a late registration
	// can find any declared state already occupied, and takes the same record
	// `actions` does for a residency, minus the array — call `observe` again
	// for a second one — and minus the third-argument options form,
	// deliberately not added (§11 The host).
	readonly observe: {
		// Accepts a matchable pattern without asking a conditional about it,
		// so an unresolved type parameter satisfies this signature: a caller's
		// own helper, generic in its pattern, can forward that pattern here
		// (I39). A dead pattern fails the constraint instead, and falls to the
		// signature below, which is what still rejects it by name.
		<PatternString extends MatchedPattern<Inputs, States, Keys>>(
			pattern: PatternString,
			observer: EdgeObserver<Inputs, States, Keys, PatternString>,
		): () => void
		<PatternString extends Pattern<Inputs, States>>(
			pattern: NoMatch<Keys, PatternString> extends true
				? `no row matches '${PatternString}'`
				: PatternString & MatchedPattern<Inputs, States, Keys>,
			observer: EdgeObserver<Inputs, States, Keys, PatternString>,
		): () => void
		<StateName extends Name<States>>(
			pattern: StateName,
			action: ObserveAction<Inputs, States, Keys, StateName>,
		): () => void
	}
}

/** Nothing at runtime; a function position keeps the four inferable together. */
declare const vocabulary: unique symbol
interface Vocabulary<
	Inputs extends Vocab,
	States extends Vocab,
	Keys extends string,
	Outputs extends Vocab,
> {
	readonly [vocabulary]?: (
		declared: readonly [Inputs, States, Keys, Outputs],
	) => void
}

/** A declared machine. Inert, shareable, and never mutated by running one. */
export interface Machine<
	Inputs extends Vocab = AnyVocab,
	States extends Vocab = AnyVocab,
	Keys extends string = string,
	InitialState extends string = string,
	Outputs extends Vocab = AnyVocab,
> extends Vocabulary<Inputs, States, Keys, Outputs> {
	readonly start: (
		...data: Start<States, InitialState>
	) => Host<Inputs, States, Keys, Outputs>
}

// ---------------------------------------------------------------------------
// Reading a machine type back out
// ---------------------------------------------------------------------------

/** All four at once, because matching `Machine` itself simply fails (I22). */
type Carried<MachineType> =
	MachineType extends Vocabulary<
		infer Inputs,
		infer States,
		infer Keys,
		infer Outputs
	>
		? { inputs: Inputs; states: States; keys: Keys; outputs: Outputs }
		: never

/** The input vocabulary a machine was declared with. */
export type InputsOf<MachineType> = Carried<MachineType>['inputs']

/** The state vocabulary a machine was declared with. */
export type StatesOf<MachineType> = Carried<MachineType>['states']

/** The output vocabulary a machine was declared with. */
export type OutputsOf<MachineType> = Carried<MachineType>['outputs']

/** The inputs `StateName` has rows for; `Exclude<…, ''>` drops immediate rows. */
export type Handled<MachineType, StateName extends string> = Exclude<
	Label<
		Extract<Carried<MachineType>['keys'], `${StateName} -${string}> ${string}`>
	>,
	''
>

/** The states that can reach `StateName`: the reverse index, from the same keys. */
export type Sources<MachineType, StateName extends string> = From<
	Extract<Carried<MachineType>['keys'], `${string} -${string}> ${StateName}`>
>

/**
 * The patterns `observe` accepts on `MachineType`: the public face of
 * `MatchedPattern`, for a caller wrapping `observe` who wants the same
 * constraint on their own pattern argument — `Pattern` itself is not
 * exported to name directly (I37).
 */
export type Patterns<MachineType> = MatchedPattern<
	Carried<MachineType>['inputs'],
	Carried<MachineType>['states'],
	Carried<MachineType>['keys']
>

/**
 * What `observe` takes beside one of those patterns, for the same caller: the
 * public face of `EdgeObserver`, which is module-local like the rest (I37).
 * Three of that alias's four parameters live in `MachineType`, so only the
 * pattern is left, and omitting it covers every row the table can fire. Named
 * for `observe` rather than called an observer, which `on`'s own `Listener`
 * has the better claim to: this one is handed a transition record, not an
 * event (I40).
 */
export type Observer<
	MachineType,
	PatternString extends Patterns<MachineType> = Patterns<MachineType>,
> = EdgeObserver<
	Carried<MachineType>['inputs'],
	Carried<MachineType>['states'],
	Carried<MachineType>['keys'],
	PatternString
>

/**
 * What `on` takes beside an output name: the reserved name spent at last, on
 * the one channel that earned it (I40). A subscriber here is told that
 * something happened and reads what it carried, which `observe`'s callback —
 * handed the record of a committed transition — is not. The name defaults to
 * every declared output, so `Listener<MachineType>` covers the whole
 * vocabulary.
 */
export type Listener<
	MachineType,
	OutputName extends Name<Carried<MachineType>['outputs']> = Name<
		Carried<MachineType>['outputs']
	>,
> = (
	announcement: Announcement<
		Carried<MachineType>['inputs'],
		Carried<MachineType>['outputs'],
		OutputName
	>,
) => void

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

/** A transition handler beside its once-parsed coordinates; see I42. */
type Row = readonly [handler: UncheckedHandler, coordinates: Coordinates]

/** The snapshot, unchecked: the name dispatch keys on, and what it carries. */
type Snapshot = { readonly name: string; readonly data: unknown }

type UncheckedEmit = (output: string, data?: unknown) => void

/** One row of the listener store: the name subscribed to, and what to run. */
type Subscription = readonly [
	output: string,
	run: (announcement: unknown) => void,
]

interface UncheckedHost {
	readonly current: Snapshot
	readonly send: UncheckedSend
	readonly observe: (
		pattern: string,
		action: EdgeObserver | ActionItem,
	) => () => void
	readonly on: (
		output: string,
		listener: (announcement: unknown) => void,
	) => () => void
}

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
		// In a `finally` so a throwing observer leaves every host usable; the queue is
		// abandoned, not drained, and what committed stays committed.
		queue = []
		draining = 0
	}
}

/**
 * One row from a key and an item, bare or arrow alike: shared by the `actions`
 * block and a bare-key `observe`, so a caller-side residency and a declared one
 * parse identically (§11 The host). `item.run ?? item` reads both item shapes
 * at once: a plain function has no `run`, and a value carrying one is a record
 * that happens to be callable, not the reverse. An arrow row stops at its
 * handler, `key` and `restart` meaning nothing on one. A residency leaves its
 * input slot empty: reading the hole yields `undefined` without making the
 * bundle spell that value (I42).
 */
let toRow = (key: string, item: UncheckedItem): Registration => {
	let run = item.run ?? item
	return / -|> /.test(key)
		? ([...parse(key), run] as Registration)
		: (['*', , key, run, key, item.restart] as unknown as Registration)
}

/**
 * Declare a machine. The result is inert data: a parsed row snapshot lives in a
 * closure, the configuration object is never touched, and only `start` is
 * exposed. Keys are parsed once and exact coordinates are scanned at dispatch;
 * this replaced the larger encoded index after the full architecture pass
 * (I42).
 *
 * `inputs` and `states` are the vocabulary's only inference sites, both optional
 * — omitting one keeps the names `transitions` mentions and widens only their
 * payloads to `unknown`. `initial` is a `NoInfer` position rather than a third
 * site (I21), intersected with `InitialState` to recover its name, which is
 * what lets `start` follow the initial state's payload. `RawInputs`/`RawStates`
 * are what the properties infer to and `Inputs`/`States` the resolved
 * vocabularies; collapsing each pair into one fails (I19), and the defaults
 * hold only because `Table`'s `NoInfer` closes the handler parameters — as
 * would overloads, at the cost of per-row diagnostics (I14). `Keys` comes from
 * the mapped type in `transitions`, with no second one beside it (I20).
 * `TriggerKeys` is the same idea again for `actions`: inferred from that
 * block's own keys, contributing nothing back to `Inputs`, `States` or `Keys`
 * (§9 Actions).
 *
 * `outputs` has no second inference site at all — nothing derives an output
 * name the way `transitions` keys derive input and state names — so an omitted
 * `outputs` widens only where widening is what the caller meant: to the
 * any-vocabulary default when no vocabulary was declared either, and to the
 * empty one, which leaves `emit` and `on` uncallable, when some was (I41).
 */
export let machine: <
	InitialState extends string,
	Keys extends string,
	RawInputs extends Vocab | undefined = undefined,
	RawStates extends Vocab | undefined = undefined,
	RawOutputs extends Vocab | undefined = undefined,
	Inputs extends Vocab = Declared<RawInputs, InputsFromKeys<Keys>>,
	States extends Vocab = Declared<RawStates, StatesFromKeys<Keys>>,
	Outputs extends Vocab = Declared<
		RawOutputs,
		[RawInputs, RawStates] extends [undefined, undefined] ? AnyVocab : {}
	>,
	TriggerKeys extends string = never,
>(definition: {
	readonly initial: InitialState & Name<NoInfer<States>>
	// `| undefined` is what `type()` returns, and inference subtracts it. Spelled
	// out because `exactOptionalPropertyTypes` makes `?:` a different thing.
	readonly inputs?:
		(RawInputs & VocabMap<Exclude<RawInputs, undefined>>) | undefined
	readonly states?:
		(RawStates & VocabMap<Exclude<RawStates, undefined>>) | undefined
	readonly outputs?:
		(RawOutputs & VocabMap<Exclude<RawOutputs, undefined>>) | undefined
	readonly transitions: Table<Inputs, States, Keys>
	readonly actions?:
		| Actions<Inputs, States, Keys, Outputs, InitialState, TriggerKeys>
		| undefined
}) => Machine<Inputs, States, Keys, InitialState, Outputs> =
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
		let rows: Row[] = []

		// Snapshot keys and handlers while rejecting malformed keys at construction.
		// Either order behaves the same; handler first compressed one byte smaller.
		for (let key in transitions) rows.push([transitions[key]!, parse(key)])

		// Residency on `State` is stored as the pattern `* -> State`, the teardown
		// key alone telling the two kinds apart, so one loop matches both and
		// observers besides (I16). A bare key naming nothing declared is a silent
		// no-op, as everywhere else; an arrow goes through `parse`, which throws on
		// a malformed one. An array is unwrapped to one row per element (§9 Actions).
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
				let observers: Registration[] = []

				// A fresh row per host: a teardown is written on the row itself, and
				// `actionRows` belongs to the definition (§9 Actions). `observers` needs no
				// copy; `observe` builds its rows host-local already.
				let hostActionRows = actionRows.map((row) => [...row] as Registration)

				// A teardown runs at most once: `void` blanks the slot in the same
				// assignment that calls it (I16).
				let clear = (row: Registration) => (row[6] = void row[6]?.())

				// The wildcard rules once, for actions, residencies and observers alike:
				// `*` and an absent label stand for any, and a missing `from` — an arrival no
				// transition caused — matches no edge row, so that case needs no branch
				// of its own (§9 Actions). Only a residency has a teardown key, stores
				// what it returns, and gates setup on a self-transition by `row[7]`, the
				// decision `step` already made below: one call to `restart` serves both
				// halves of the same residency's hop (§9 Actions).
				let fire = (
					list: Registration[],
					facts: UncheckedFacts,
					capabilities?: object,
				): void => {
					// The facts plus the capabilities the record carries: the same `send`
					// the host exposes, so a reaction drives the machine without closing
					// over the host it was registered on, and — for an action alone —
					// `emit`, passed in by the two sites that fire actions (§10
					// Composition). Once per call, so the allocation stays off the path
					// that runs most (I16).
					let arrival: Arrival = { ...facts, send, ...capabilities }
					for (let row of list) {
						let [from, input, to, run, key] = row
						if (
							(from === '*' || from === arrival.from) &&
							(!input || input === arrival.input) &&
							(to === '*' || to === arrival.to) &&
							(key ? arrival.to !== arrival.from || row[7] : arrival.from)
						) {
							let teardown = run(arrival)
							if (key) row[6] = teardown as Teardown | undefined
						}
					}
				}

				// The arrival no transition caused: source and input are simply absent
				// (§9 Actions). Shared by `start` and a bare-key `observe`, which goes
				// through `fire` for the `to === state` test its third clause already does.
				let enter = (list: Registration[], capabilities?: object): void =>
					fire(
						list,
						{
							to: current.name,
							toData: current.data,
						} as UncheckedFacts,
						capabilities,
					)

				// One scanning path for both kinds of transition: commit the first row
				// that does not decline, report whether the machine moved. Fusing it with
				// the chain below, or splitting a `commit` out of it, measured larger (I16).
				let step = (
					input?: UncheckedFacts['input'],
					inputData?: unknown,
				): boolean => {
					// The source, read once for the whole scan: only a commit moves the
					// machine, and a commit returns.
					let { name: from, data: fromData } = current
					for (let [handler, [source, label, to]] of rows) {
						if (source === from && label === input) {
							let toData = handler({
								input,
								inputData,
								from,
								fromData,
								to,
								skip,
							})
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
								// before observers, each in reverse declaration order, so several on
								// one trigger unwind like a stack. A throw here abandons the hop with
								// nothing committed and the later teardowns unrun (§9 Actions). `false`
								// survives, a predicate decides from the transition's own facts,
								// anything else restarts, an omitted `restart` included; `.call` is the
								// cheapest thing only a function has. `row[7]` banks that one decision
								// for `fire` to reuse below, on that same row's setup, so a predicate
								// the caller wrote once is asked once (§9 Actions).
								for (let list of [hostActionRows, observers]) {
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

								// Commit, then notify, so every observer sees a machine that agrees
								// with the record. The payload is stored exactly as returned (§5).
								current = { name: to, data: toData }

								// Actions in declaration order, then observers (§9 Actions).
								fire(hostActionRows, facts, actionCapabilities)
								fire(observers, facts)
								// One input yields at most one transition.
								return true
							}
						}
					}
					return false
				}

				// A chain is one arrival's worth of work, however many hops; the budget is
				// per call, so settling the initial state does not spend the first send's.
				let settle = (): void => {
					let hops = 1e5
					while (step()) {
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
						if (step(input, inputData)) settle()
					})
					dispatch()
				}

				// A flat list of `[name, listener]` rows scanned per emit, not a keyed
				// store: `pnpm size` measured the keyed variant larger on all three
				// figures, and this reuses the `observers` idiom verbatim. Listener
				// counts are realistically single-digit, so the scan is not a concern.
				// Copy-on-write for the
				// same reason `observers` is: a listener registered during an emit must
				// not join that pass, and one unsubscribed during it must still finish
				// it (§10 Composition).
				let listeners: Subscription[] = []

				// Delivery is inline — `dispatch` runs its work in both branches — because
				// `emit` is post-commit by construction, so a listener already sees a
				// committed machine, and queueing the call would deliver the announcement
				// after the machine had left the state that announced it. Under the drain
				// because an `emit` captured by a residency and called later runs with no
				// dispatch open, and a listener's `send` would then drain inside the
				// listener's own frame and re-enter it (§10 Composition). A throwing
				// listener propagates, like a throwing observer.
				let emit: UncheckedEmit = (output, data) => {
					dispatch(() => {
						let announcement = { output, data, send }
						for (let [subscribedOutput, run] of listeners)
							if (subscribedOutput === output) run(announcement)
					})
				}

				// The one capability an action carries and an observer does not, built
				// once rather than per hop (I16).
				let actionCapabilities = { emit }

				// Under the drain `send` takes, so a send from one of these hops runs after
				// the chain settles (§11 The host, "`start` settles under the drain").
				// Entering `initial` is not a transition, so no `from`. `fire`'s final
				// clause admits a row on that synthetic arrival only when it has the
				// teardown key unique to a residency; passing the whole list therefore
				// remains the residency-only startup slice without allocating a filter
				// result (I42; §9 Actions).
				dispatch(() => {
					enter(hostActionRows, actionCapabilities)
					settle()
				})

				return {
					get current(): Snapshot {
						return current
					},

					observe: (
						pattern: string,
						action: EdgeObserver | ActionItem,
					): (() => void) => {
						// `toRow` reads a bare `pattern` as residency on that state, the same
						// as a bare key in `actions`, so the two share one parser (§11 The
						// host).
						let registration = toRow(pattern, action as UncheckedItem)
						observers = [...observers, registration]
						// Already resident when observed: no arrival will announce it, so it runs
						// once here instead, registration order never deciding whether a
						// residency fires (§11 The host). The teardown key is the residency
						// guard; `fire` tests `to` against the current state itself.
						if (registration[4]) enter([registration])
						// Idempotent (§11 The host), and a residency in flight tears down on
						// the way out.
						return () => {
							observers = observers.filter((other) => other != registration)
							clear(registration)
						}
					},

					// One coordinate, so the row is the name and what to run — no
					// pattern to parse and nothing to wildcard. Idempotent unsubscribe,
					// like `observe`'s (§10 Composition).
					on: (
						output: string,
						listener: (announcement: unknown) => void,
					): (() => void) => {
						let subscription: Subscription = [output, listener]
						listeners = [...listeners, subscription]
						return () => {
							listeners = listeners.filter((other) => other != subscription)
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
 * that one, since a missing `from` matches no edge (§9 Actions). `emit` is
 * present only on a record built for an action: a handler may `skip()` and an
 * observer is outside the machine, so neither may announce (§10 Composition).
 */
type Arrival = UncheckedFacts & {
	readonly send: UncheckedSend
	readonly emit?: UncheckedEmit
}

/**
 * One row shape for an observer, an edge action and a residency action alike: a
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
	input: string | undefined,
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
