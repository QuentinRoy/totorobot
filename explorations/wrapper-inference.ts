/**
 * Where a wrapper call can stand in a definition, and where it cannot.
 *
 * The proposal was `transitions: { 'draft -submit> review': transition(fn) }`,
 * and `action(fn, { restart: false })` beside it, on the grounds that a named
 * call reads better than a record. In `transitions` it does not survive, for two
 * independent reasons either of which is enough on its own. **In `actions` it
 * does**, in section 6, and the line between them is whether the block is an
 * inference site, not whether the value is a call. `observe` is clear of it
 * entirely, since a started host's vocabulary is already concrete.
 *
 * **A wrapper needs the vocabulary before the table is contextually typed, and
 * the shipped signature does not have it yet.** `machine` resolves the
 * vocabulary in two tiers: `RawI`/`RawS` infer from the `inputs`/`states`
 * properties, and `I`/`S` are *defaulted* type parameters computed off them
 * through `Declared`. A default is resolved after inference, so when a row's
 * generic call is checked `I` and `S` are not there yet, the call's own `P`
 * falls back to its constraint, and every row is rejected as
 * `not a transition: '…'`, well formed or not. Section 3 isolates this to the tier alone: the
 * same alias and the same call pass on one tier and fail on two. Collapsing the
 * pair is not available, per [I19](../docs/implementation-record.md#i19).
 *
 * **And `P` is recovered by alias identity, not structurally.** Even on one
 * tier, the wrapper works only while the table's row type and the wrapper's
 * signature name the *same* alias. Write the identical expression out twice and
 * `P` falls back to `string` (section 4). Factoring the row behind an alias to
 * satisfy that is what [I18](../docs/implementation-record.md#i18) warns against,
 * since it costs the per-row diagnostics the notation exists to give.
 *
 * A wrapper that infers the vocabulary from its own context, rather than being
 * handed it, is unsound as well as inconvenient. It reopens the table as an
 * inference site for `S`, one level outside the `NoInfer` that
 * [I14](../docs/implementation-record.md#i14) put on the handler's parameters, so
 * an undeclared state name in a key stops being an error (section 5).
 *
 * A **record**, `{ run: fn, … }`, has none of this, because it is not a call:
 * contextual typing reaches `run` from the table directly and nothing new
 * becomes an inference site. Measured against a patched copy of
 * `src/totorobot.ts` whose row value was widened to
 * `((args) => …) | { readonly run: (args) => … }`, it passed the whole battery
 * below. That patch is not carried here: the shipped `Table` has no such arm,
 * and adding one for a block that does not exist yet is not this repository's
 * call to make ahead of the design.
 *
 * TS 7.0.2.
 */

import { machine, type, type Skip } from '../src/totorobot.ts'
import { assertType, type Equal } from './config-object-kit.ts'

type InputVocab = Record<string, unknown>
type StateVocab = { readonly name: string }
type From<K> = K extends `${infer F} -${string}> ${string}` ? F : never
type Label<K> = K extends `${string} -${infer L}> ${string}` ? L : never
type To<K> = K extends `${string} -${string}> ${infer T}` ? T : never

/**
 * Every state carries a payload, so the empty-payload arm of the real `Table`
 * ([I17](../docs/implementation-record.md#i17)) never comes up and a row type can
 * be written out below without reaching for its tag.
 */
type In = { open: { text: string }; submit: { reviewer: string } }
type St =
	| { name: 'draft'; text: string }
	| { name: 'review'; text: string; reviewer: string }

const inputs = type<In>()
const states = type<St>()

// ---------------------------------------------------------------------------
// 1. The baseline this is arguing against giving up.
// ---------------------------------------------------------------------------

machine({
	inputs,
	states,
	initial: 'draft',
	transitions: {
		'draft -submit> review': ({ state, inputData }) => {
			assertType<Equal<typeof state, { name: 'draft'; text: string }>>()
			return { text: state.text, reviewer: inputData.reviewer }
		},
	},
})

// ---------------------------------------------------------------------------
// 2. Both wrapper shapes, against the real `machine()`.
// ---------------------------------------------------------------------------

/** Nothing in `<F>(fn: F) => F` can see which row it is on. */
declare function identity<F>(fn: F): F

machine({
	inputs,
	states,
	initial: 'draft',
	transitions: {
		// @ts-expect-error - `F` infers from the arrow, so the row's own type is
		// never the contextual type and the parameters go implicitly `any`
		'draft -submit> review': identity(({ inputData }) => ({
			text: '',
			reviewer: inputData.reviewer,
		})),
	},
})

/**
 * The kit hands the wrapper a vocabulary up front, which is the only way it can
 * name a row's handler type at all. It still fails here, for the tier reason.
 */
declare function kit<I extends InputVocab, S extends StateVocab>(): {
	transition: <P extends string>(
		fn: (args: {
			readonly state: NoInfer<Extract<S, { name: From<P> }>>
			readonly input: NoInfer<Label<P> & string>
			readonly inputData: NoInfer<I[Label<P> & keyof I]>
			readonly skip: () => Skip
		}) => Omit<Extract<S, { name: To<P> }>, 'name'> | Skip,
	) => (args: {
		readonly state: NoInfer<Extract<S, { name: From<P> }>>
		readonly input: NoInfer<Label<P> & string>
		readonly inputData: NoInfer<I[Label<P> & keyof I]>
		readonly skip: () => Skip
	}) => Omit<Extract<S, { name: To<P> }>, 'name'> | Skip
}

const { transition } = kit<In, St>()

machine({
	inputs,
	states,
	// @ts-expect-error - the collapse does not stay on the row: with `S` gone,
	// `StateName<NoInfer<S>>` is `never` and the initial state stops resolving too
	initial: 'draft',
	transitions: {
		// @ts-expect-error - `I` and `S` are defaults, unresolved when this call is
		// checked, so `P` falls back to `string` and the row reads as malformed
		'draft -submit> review': transition(() => ({ text: '', reviewer: '' })),
	},
})

// ---------------------------------------------------------------------------
// 3. The tier, isolated. One miniature table, one alias, one wrapper, two
//    signatures around them: the vocabulary inferred directly, and the
//    vocabulary defaulted off a `Raw` pair the way `machine` does it.
// ---------------------------------------------------------------------------

type MiniHandler<I extends InputVocab, S extends StateVocab, P> = (args: {
	readonly state: NoInfer<Extract<S, { name: From<P> }>>
	readonly input: NoInfer<Label<P> & string>
	readonly inputData: NoInfer<I[Label<P> & keyof I]>
}) => Omit<Extract<S, { name: To<P> }>, 'name'> | void

type MiniKey<
	I extends InputVocab,
	S extends StateVocab,
> = `${S['name']} -${keyof I & string}> ${S['name']}`

type MiniTable<I extends InputVocab, S extends StateVocab, K extends string> = {
	readonly [P in K]: P extends MiniKey<I, S>
		? MiniHandler<I, S, P>
		: `not a transition: '${P}'`
}

type Declared<Raw, Default> = Raw extends undefined ? Default : Raw
type StatesFromKeys<K extends string> = {
	[N in From<K> | To<K>]: { readonly name: N }
}[From<K> | To<K>]
type InputsFromKeys<K extends string> = {
	[N in Label<K>]: unknown
}

declare function oneTier<
	I extends InputVocab,
	S extends StateVocab,
	K extends string,
>(d: {
	inputs: I | undefined
	states: S | undefined
	transitions: MiniTable<I, S, K>
}): void

/**
 * An action's trigger is a name in the declared vocabulary, so this block is only
 * ever *checked*: unlike `transitions` it contributes nothing to inference. That
 * is the difference section 6 turns on.
 */
type MiniAct<S extends StateVocab, N> = (args: {
	readonly data: NoInfer<Extract<S, { name: N }>>
}) => void

type MiniActions<S extends StateVocab> = {
	readonly [N in S['name']]?: MiniAct<S, N>
}

declare function twoTier<
	K extends string,
	RawI extends InputVocab | undefined = undefined,
	RawS extends StateVocab | undefined = undefined,
	I extends InputVocab = Declared<RawI, InputsFromKeys<K>>,
	S extends StateVocab = Declared<RawS, StatesFromKeys<K>>,
>(d: {
	readonly inputs?: RawI | undefined
	readonly states?: RawS | undefined
	readonly transitions: MiniTable<I, S, K>
	readonly actions?: MiniActions<S> | undefined
}): void

declare function miniKit<I extends InputVocab, S extends StateVocab>(): {
	transition: <P extends string>(
		fn: MiniHandler<I, S, P>,
	) => MiniHandler<I, S, P>
}

const mini = miniKit<In, St>().transition

/**
 * One tier, and the wrapper is fine: both parameters narrow, and a malformed
 * neighbour reports on its own line instead of poisoning the row above it.
 * Sections 3 and 4 are why none of that survives the shipped signature.
 */
oneTier({
	inputs,
	states,
	transitions: {
		'draft -submit> review': mini(({ state, inputData }) => {
			assertType<Equal<typeof state, { name: 'draft'; text: string }>>()
			assertType<Equal<typeof inputData, { reviewer: string }>>()
			return { text: state.text, reviewer: inputData.reviewer }
		}),
		// @ts-expect-error - no space after '>', so this is not a transition
		'draft -submit>review': mini(() => ({ text: '', reviewer: '' })),
	},
})

/** The same alias and the same call, with `I`/`S` moved behind a `Raw` pair. */
twoTier({
	inputs,
	states,
	transitions: {
		// @ts-expect-error - the tier is the whole difference from the row above
		'draft -submit> review': mini(() => ({ text: '', reviewer: '' })),
	},
})

// ---------------------------------------------------------------------------
// 4. Alias identity, isolated. The same row type written out again rather than
//    named loses `P`, on one tier, with nothing else changed.
// ---------------------------------------------------------------------------

declare function longhandKit<I extends InputVocab, S extends StateVocab>(): {
	transition: <P extends string>(
		fn: (args: {
			readonly state: NoInfer<Extract<S, { name: From<P> }>>
			readonly input: NoInfer<Label<P> & string>
			readonly inputData: NoInfer<I[Label<P> & keyof I]>
		}) => Omit<Extract<S, { name: To<P> }>, 'name'> | void,
	) => (args: {
		readonly state: NoInfer<Extract<S, { name: From<P> }>>
		readonly input: NoInfer<Label<P> & string>
		readonly inputData: NoInfer<I[Label<P> & keyof I]>
	}) => Omit<Extract<S, { name: To<P> }>, 'name'> | void
}

const longhand = longhandKit<In, St>().transition

oneTier({
	inputs,
	states,
	transitions: {
		// @ts-expect-error - structurally identical to `MiniHandler`, and `P` still
		// falls back to `string`: the recovery is by alias, not by shape
		'draft -submit> review': longhand(() => ({ text: '', reviewer: '' })),
	},
})

// ---------------------------------------------------------------------------
// 5. The soundness hole. Drop the kit and let the wrapper infer the vocabulary
//    from its own context: it compiles, and it should not.
// ---------------------------------------------------------------------------

declare function free<
	I extends InputVocab,
	S extends StateVocab,
	P extends string,
>(fn: MiniHandler<I, S, P>): MiniHandler<I, S, P>

/** Handed the vocabulary, the wrapper rejects an undeclared target. */
oneTier({
	inputs,
	states,
	transitions: {
		// @ts-expect-error - 'nope' is not a declared state
		'draft -submit> nope': mini(() => {}),
	},
})

/**
 * Inferring it instead, the same row compiles. `free`'s **return** type names `S`
 * outside the `NoInfer` that `MiniTable` puts on the handler's parameters, so the
 * table is an inference site for the vocabulary again, which is I14's bug one
 * level out, and `MiniKey<I, S>` widens to admit whatever the row says. No `@ts-expect-error`
 * can pin a negative like this: if a future TypeScript starts rejecting the row,
 * this file keeps compiling and the improvement goes unannounced.
 */
oneTier({
	inputs,
	states,
	transitions: {
		'draft -submit> nope': free(() => {}),
	},
})

// ---------------------------------------------------------------------------
// 6. The scope of section 3's failure. Same signature, same tier, same kind of
//    wrapper, but in a block that supplies nothing to inference, and it works.
// ---------------------------------------------------------------------------

declare function actionKit<S extends StateVocab>(): {
	persistent: <N extends string>(fn: MiniAct<S, N>) => MiniAct<S, N>
}

const { persistent } = actionKit<St>()

/**
 * `transitions` is an inference site, since `K` comes from it, so it is
 * checked while `I` and `S` are still defaults, which is I24. `actions` is keyed
 * off `S['name']`, contributes nothing, and is therefore checked after `S`
 * resolves. The wrapper that cannot work one property up works here.
 */
twoTier({
	inputs,
	states,
	transitions: {
		'draft -submit> review': ({ state, inputData }) => ({
			text: state.text,
			reviewer: inputData.reviewer,
		}),
	},
	actions: {
		draft: persistent(({ data }) => {
			const text: string = data.text
			void text
		}),
		review: persistent(({ data }) => {
			const reviewer: string = data.reviewer
			void reviewer
		}),
	},
})

/** The diagnostics survive it: a field the trigger does not carry is still caught. */
twoTier({
	inputs,
	states,
	transitions: {
		'draft -submit> review': ({ state, inputData }) => ({
			text: state.text,
			reviewer: inputData.reviewer,
		}),
	},
	actions: {
		draft: persistent(({ data }) => {
			// @ts-expect-error - `draft` carries no `reviewer`
			void data.reviewer
		}),
	},
})

/**
 * The kit is still doing the work, though. Without a vocabulary handed in, the
 * wrapper's own parameters fall back and `data` is `never`. The trigger key is
 * still constrained by the mapped type, so a probe that only checks whether bad
 * keys are rejected will report success here.
 */
declare function persistentFree<S extends StateVocab, N extends string>(
	fn: MiniAct<S, N>,
): MiniAct<S, N>

twoTier({
	inputs,
	states,
	transitions: {
		'draft -submit> review': ({ state, inputData }) => ({
			text: state.text,
			reviewer: inputData.reviewer,
		}),
	},
	actions: {
		draft: persistentFree(({ data }) => {
			// @ts-expect-error - `data` is `never`: nothing handed this one the
			// vocabulary, so its own parameters fell back
			void data.text
		}),
	},
})
