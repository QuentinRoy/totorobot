// N2 -- the transition table, with the state/input vocabulary DECLARED as a
// type rather than inferred from marker values.
//
//     types: types<{
//         inputs: { press: { key: string }; release: void }
//         states: { idle: void; ready: { n: number } }
//     }>(),
//
// Everything downstream is unchanged: the keys are still
// `${input}: ${from} -> ${to}`.
//
// What this buys over inferring from `state()` / `input()` markers:
//
//   * A marker call's type parameter is inferred from a contextual position, so
//     `state()` silently produced `State<any>` and every data-free state
//     accepted anything (see n1 finding 6). A type literal has NOTHING to
//     infer, so that entire class of bug cannot occur.
//   * The state-name inference cliff disappears -- names are declared, never
//     recovered from an object literal.
//   * `void` is the real type, not a stand-in. No `state()` placeholder.
//   * The vocabulary is an ordinary type: nameable, exportable, importable,
//     composable, generic.

declare const typesBrand: unique symbol
declare const skipBrand: unique symbol

export interface Spec {
	readonly inputs: Record<string, unknown>
	readonly states: Record<string, unknown>
}

export interface Types<Sp extends Spec> {
	readonly [typesBrand]?: (s: Sp) => Sp
}
/** Declare the machine's vocabulary. Erased at runtime. */
export function types<Sp extends Spec>(): Types<Sp> {
	return {}
}

/** The "not this transition" sentinel. */
export interface Skip {
	readonly [skipBrand]: true
}

export type StatesOf<Sp extends Spec> = Sp['states']
export type InputsOf<Sp extends Spec> = Sp['inputs']
export type StateName<Sp extends Spec> = keyof StatesOf<Sp> & string
export type InputName<Sp extends Spec> = keyof InputsOf<Sp> & string

// --- the key language --------------------------------------------------------

/** `input: from -> to` */
export type Key<Sp extends Spec> =
	`${InputName<Sp>}: ${StateName<Sp>} -> ${StateName<Sp>}`

/**
 * Spacing is NOT load-bearing: `load:idle->booting`, `load: idle -> booting`
 * and `load : idle ->  booting` all normalise to the canonical form before
 * anything else looks at them.
 */
export type Trim<S> = S extends ` ${infer R}`
	? Trim<R>
	: S extends `${infer R} `
		? Trim<R>
		: S

export type Norm<K> = K extends `${infer E}:${infer Rest}`
	? Rest extends `${infer F}->${infer T}`
		? `${Trim<E>}: ${Trim<F>} -> ${Trim<T>}`
		: never
	: never

export type OnOf<K> = K extends `${infer E}: ${string}` ? E : never
export type FromOf<K> = K extends `${string}: ${infer F} -> ${string}`
	? F
	: never
export type ToOf<K> = K extends `${string} -> ${infer T}` ? T : never

// --- handlers ----------------------------------------------------------------

export interface Ctx<Sp extends Spec, K> {
	/** The SOURCE state's data. `void` when it carries none. */
	readonly data: StatesOf<Sp>[FromOf<K> & StateName<Sp>]
	readonly input: InputsOf<Sp>[OnOf<K> & InputName<Sp>]
	/** Decline; the next transition declared for this (from, input) is tried. */
	readonly skip: () => Skip
}

/** Returns the TARGET state's data. */
export type Handler<Sp extends Spec, K> = (
	ctx: Ctx<Sp, K>,
) => StatesOf<Sp>[ToOf<K> & StateName<Sp>] | Skip

export type Transitions<Sp extends Spec> = {
	readonly [K in Key<Sp>]?: Handler<Sp, K>
}

/**
 * The author's OWN keys, whatever spacing they used, each handler typed from
 * the normalised key. Intersected with `Transitions` so the canonical union is
 * still what the editor offers as completions.
 */
export type Written<Sp extends Spec, T> = {
	readonly [K in keyof T]: Handler<Sp, Norm<K>>
}

// --- reading the topology back out -------------------------------------------

// These read the author's keys as TEXT, so they must normalise first --
// otherwise a compact `'go:a->b'` is invisible to them. This is the type-level
// half of the cost of tolerating spacing; the human half (grep) has no such fix.

/** Inputs available in state `F`. */
export type Handled<T, F extends string> = OnOf<
	Extract<Norm<keyof T>, `${string}: ${F} -> ${string}`>
>
/** States reachable from `F` on input `E`. */
export type Targets<T, F extends string, E extends string> = ToOf<
	Extract<Norm<keyof T>, `${E}: ${F} -> ${string}`>
>
/** States that can reach `To`. */
export type Sources<T, To extends string> = FromOf<
	Extract<Norm<keyof T>, `${string} -> ${To}`>
>

export type StateValue<Sp extends Spec> = {
	[K in StateName<Sp>]: { readonly state: K; readonly data: StatesOf<Sp>[K] }
}[StateName<Sp>]

export type Step<Sp extends Spec> =
	| { readonly kind: 'none'; readonly reason: 'declined' | 'unavailable' }
	| { readonly kind: 'moved'; readonly next: StateValue<Sp> }

// --- listener patterns -------------------------------------------------------

/** `input: from -> to`, with `*` allowed anywhere, or a bare input name. */
export type Pattern<Sp extends Spec> =
	| InputName<Sp>
	| `${InputName<Sp> | '*'}: ${StateName<Sp> | '*'} -> ${StateName<Sp> | '*'}`
	| `${StateName<Sp> | '*'} -> ${StateName<Sp> | '*'}`

/** Patterns tolerate spacing too, or the two halves of the API disagree. */
export type NormPat<P> = P extends `${infer E}:${infer R}`
	? R extends `${infer F}->${infer T}`
		? `${Trim<E>}: ${Trim<F>} -> ${Trim<T>}`
		: never
	: P extends `${infer F}->${infer T}`
		? `${Trim<F>} -> ${Trim<T>}`
		: Trim<P>

type PatOn<P> = P extends `${infer E}: ${string} -> ${string}`
	? E
	: P extends `${string} -> ${string}`
		? '*'
		: P
type PatFrom<P> = P extends `${string}: ${infer F} -> ${string}`
	? F
	: P extends `${infer F} -> ${string}`
		? F
		: '*'
type PatTo<P> = P extends `${string} -> ${infer T}` ? T : '*'

type Widen<Sel, All> = [Sel] extends ['*'] ? All : Sel & All
type At<Sp extends Spec, N> = Extract<StateValue<Sp>, { state: N }>

/** A union discriminated by `on`, so `e.on === 'submit'` narrows `e.input`. */
export type Event<Sp extends Spec, P = string> =
	Widen<PatOn<P>, InputName<Sp>> extends infer E
		? E extends InputName<Sp>
			? {
					readonly on: E
					readonly input: InputsOf<Sp>[E]
					readonly from: At<Sp, Widen<PatFrom<P>, StateName<Sp>>>
					readonly to: At<Sp, Widen<PatTo<P>, StateName<Sp>>>
				}
			: never
		: never

export interface Machine<Sp extends Spec, T> {
	readonly initial: StateName<Sp>
	readonly transitions: T
	on<P extends string>(
		pattern: NormPat<P> extends Pattern<Sp> ? P : Pattern<Sp>,
		fn: (e: Event<Sp, NormPat<P>>) => void,
	): Machine<Sp, T>
}

// --- the builder -------------------------------------------------------------

export type BadKeys<Sp extends Spec, T> = Exclude<Norm<keyof T>, Key<Sp>> &
	string

export type Validate<Sp extends Spec, T> = [BadKeys<Sp, T>] extends [never]
	? unknown
	: { readonly [K in BadKeys<Sp, T> as `not a transition: '${K}'`]: never }

export function machine<Sp extends Spec, T = unknown>(
	def: { readonly transitions: T } & {
		readonly types: Types<Sp>
		readonly initial: StateName<Sp>
		readonly transitions: Transitions<Sp> & Written<Sp, T>
	} & Validate<Sp, T>,
): Machine<Sp, T> {
	const listeners: [string, (e: never) => void][] = []
	const m: Machine<Sp, T> = {
		...(def as unknown as Omit<Machine<Sp, T>, 'on'>),
		on(pattern: string, fn: (e: never) => void) {
			listeners.push([pattern, fn])
			return m
		},
	} as Machine<Sp, T>
	;(m as unknown as Record<symbol, unknown>)[LISTENERS] = listeners
	return m
}

const LISTENERS: unique symbol = Symbol('listeners')

const parse = (
	k: string,
): [on: string, from: string, to: string] | undefined => {
	const colon = k.indexOf(':')
	if (colon < 0) return undefined
	const rest = k.slice(colon + 1)
	const arrow = rest.indexOf('->')
	if (arrow < 0) return undefined
	return [
		k.slice(0, colon).trim(),
		rest.slice(0, arrow).trim(),
		rest.slice(arrow + 2).trim(),
	]
}

const matches = (
	pattern: string,
	on: string,
	from: string,
	to: string,
): boolean => {
	if (!pattern.includes('->'))
		return pattern.trim() === on || pattern.trim() === '*'
	const arrow = pattern.indexOf('->')
	const head = pattern.slice(0, arrow)
	const pTo = pattern.slice(arrow + 2).trim()
	const colon = head.indexOf(':')
	const pOn = colon < 0 ? '*' : head.slice(0, colon).trim()
	const pFrom = (colon < 0 ? head : head.slice(colon + 1)).trim()
	const ok = (p: string, v: string) => p === '*' || p === v
	return ok(pOn, on) && ok(pFrom, from) && ok(pTo, to)
}

const SKIP = { skipped: true }

export function step<Sp extends Spec, T>(
	m: Machine<Sp, T>,
	current: StateValue<Sp>,
	inputName: string,
	payload?: unknown,
): Step<Sp> {
	const table = m.transitions as Record<string, (ctx: unknown) => unknown>
	let sawCandidate = false

	for (const key of Object.keys(table)) {
		const parsed = parse(key)
		if (!parsed) continue
		const [on, from, to] = parsed
		if (on !== inputName || from !== current.state) continue
		sawCandidate = true

		const result = table[key]?.({
			data: current.data,
			input: payload,
			skip: () => SKIP,
		})
		if (result === SKIP) continue

		const next = { state: to, data: result } as StateValue<Sp>
		const listeners =
			((m as unknown as Record<symbol, unknown>)[LISTENERS] as [
				string,
				(e: unknown) => void,
			][]) ?? []
		for (const [pattern, fn] of listeners) {
			if (matches(pattern, on, from, to))
				fn({ on, input: payload, from: current, to: next })
		}
		return { kind: 'moved', next }
	}

	return { kind: 'none', reason: sawCandidate ? 'declined' : 'unavailable' }
}
