// N -- the transition table with string keys.
//
//     'submit: draft -> review': ({ data, input, skip }) => …
//
// The key is a template literal type `${input}: ${from} -> ${to}`, so the whole
// union is materialised and the editor can complete it segment by segment. The
// open question this prototype exists to answer is whether that union's SIZE
// (inputs x states x states) is a problem in practice -- see measurements.ts.

declare const stateBrand: unique symbol
declare const inputBrand: unique symbol
declare const skipBrand: unique symbol

export interface State<T> {
	readonly [stateBrand]?: (t: T) => T
}
export interface Input<T> {
	readonly [inputBrand]?: (t: T) => T
}
/** The "not this transition" sentinel. */
export interface Skip {
	readonly [skipBrand]: true
}

// The no-argument form is a SEPARATE overload with no type parameter, not a
// default. With `state<T = void>()` the call sits in a position contextually
// typed by the still-unresolved `S`, so `T` infers as `any` and every data-free
// state silently accepts anything. A parameterless overload has nothing to
// infer, so `void` is guaranteed.

/** Declare a state that carries no data. */
export function state(): State<void>
/** Declare a state and its data. */
export function state<T>(): State<T>
export function state<T = void>(): State<T> {
	return {}
}

/** Declare an input that carries no payload. */
export function input(): Input<void>
/** Declare an input and its payload. */
export function input<T>(): Input<T>
export function input<T = void>(): Input<T> {
	return {}
}

export type DataOf<X> = X extends State<infer T> ? T : void
export type PayloadOf<X> = X extends Input<infer T> ? T : never

export type AnyStates = Record<string, State<any>>
export type AnyInputs = Record<string, Input<any>>

// --- the key language --------------------------------------------------------

/** `input: from -> to` */
export type Key<S, I> =
	`${keyof I & string}: ${keyof S & string} -> ${keyof S & string}`

export type OnOf<K> = K extends `${infer E}: ${string}` ? E : never
export type FromOf<K> = K extends `${string}: ${infer F} -> ${string}`
	? F
	: never
export type ToOf<K> = K extends `${string} -> ${infer T}` ? T : never

// --- handlers ----------------------------------------------------------------

export interface Ctx<S extends AnyStates, I extends AnyInputs, K> {
	/** The SOURCE state's data. */
	readonly data: DataOf<S[FromOf<K> & keyof S]>
	readonly input: PayloadOf<I[OnOf<K> & keyof I]>
	/** Decline; the next transition declared for this (from, input) is tried. */
	readonly skip: () => Skip
}

/** Returns the TARGET state's data. */
export type Handler<S extends AnyStates, I extends AnyInputs, K> = (
	ctx: Ctx<S, I, K>,
) => DataOf<S[ToOf<K> & keyof S]> | Skip

export type Transitions<S extends AnyStates, I extends AnyInputs> = {
	readonly [K in Key<S, I>]?: Handler<S, I, K>
}

// --- reading the topology back out -------------------------------------------

/** Inputs available in state `F` -- the basis of send-site checking. */
export type Handled<T, F extends string> = OnOf<
	Extract<keyof T, `${string}: ${F} -> ${string}`>
>
/** States reachable from `F` on input `E` -- question D, as a type. */
export type Targets<T, F extends string, E extends string> = ToOf<
	Extract<keyof T, `${E}: ${F} -> ${string}`>
>
/** States that can reach `To` -- question D in reverse, for free. */
export type Sources<T, To extends string> = FromOf<
	Extract<keyof T, `${string} -> ${To}`>
>

export type StateValue<S extends AnyStates> = {
	[K in keyof S & string]: { readonly state: K; readonly data: DataOf<S[K]> }
}[keyof S & string]

export type Step<S extends AnyStates> =
	| { readonly kind: 'none'; readonly reason: 'declined' | 'unavailable' }
	| { readonly kind: 'moved'; readonly next: StateValue<S> }

export interface Machine<S extends AnyStates, I extends AnyInputs, T> {
	readonly initial: keyof S & string
	readonly states: S
	readonly inputs: I
	readonly transitions: T
	/**
	 * Attach a listener. Patterns accept `*` in any position, and the pattern
	 * NARROWS the event: `'press: ready -> *'` gives `input` typed as `press`'s
	 * payload and `from` narrowed to `ready`.
	 */
	on<P extends Pattern<S, I>>(
		pattern: P,
		fn: (e: Event<S, I, P>) => void,
	): Machine<S, I, T>
}

/** `input: from -> to`, with `*` allowed anywhere, or a bare input name. */
export type Pattern<S, I> =
	| (keyof I & string)
	| `${(keyof I & string) | '*'}: ${(keyof S & string) | '*'} -> ${(keyof S & string) | '*'}`
	| `${(keyof S & string) | '*'} -> ${(keyof S & string) | '*'}`

// --- the pattern, parsed back out --------------------------------------------
// Three forms: `input`, `input: from -> to`, and `from -> to`.

export type PatOn<P> = P extends `${infer E}: ${string} -> ${string}`
	? E
	: P extends `${string} -> ${string}`
		? '*'
		: P
export type PatFrom<P> = P extends `${string}: ${infer F} -> ${string}`
	? F
	: P extends `${infer F} -> ${string}`
		? F
		: '*'
export type PatTo<P> = P extends `${string} -> ${infer T}` ? T : '*'

/** `*` means "any of them", so widen to the whole set. */
export type Widen<Sel, All> = [Sel] extends ['*'] ? All : Sel & All

export type OnIn<S, I, P> = Widen<PatOn<P>, keyof I & string>
type At<S extends AnyStates, N> = Extract<StateValue<S>, { state: N }>

/**
 * Distributed over the inputs the pattern can match, so the result is a union
 * DISCRIMINATED BY `on`. A pattern naming one input gives a single member;
 * `'* -> published'` gives one member per input, and `e.on === 'submit'`
 * narrows `e.input` to that input's payload.
 */
export type Event<S extends AnyStates, I extends AnyInputs, P = string> =
	OnIn<S, I, P> extends infer E
		? E extends keyof I & string
			? {
					/** The input that fired. */
					readonly on: E
					/** That input's payload. */
					readonly input: PayloadOf<I[E]>
					readonly from: At<S, Widen<PatFrom<P>, keyof S & string>>
					readonly to: At<S, Widen<PatTo<P>, keyof S & string>>
				}
			: never
		: never

// --- the builder -------------------------------------------------------------

/**
 * Capturing the literal as `T` defeats excess-property checking on the mapped
 * member -- a key is "known" if ANY intersection member has it, and `T` has all
 * of them. So bad keys are caught explicitly instead, which also means the error
 * names the offending key rather than printing the whole union.
 */
export type BadKeys<S, I, T> = Exclude<keyof T, Key<S, I>> & string

export type Validate<S, I, T> = [BadKeys<S, I, T>] extends [never]
	? unknown
	: {
			readonly [K in BadKeys<S, I, T> as `not a transition: '${K}'`]: never
		}

export function machine<S extends AnyStates, I extends AnyInputs, T = unknown>(
	def: { readonly transitions: T } & {
		readonly initial: keyof S & string
		readonly inputs: I
		readonly states: S
		readonly transitions: Transitions<S, I>
	} & Validate<S, I, T>,
): Machine<S, I, T> {
	const listeners: [string, (e: never) => void][] = []
	const m: Machine<S, I, T> = {
		...(def as unknown as Omit<Machine<S, I, T>, 'on'>),
		on(pattern: string, fn: (e: never) => void) {
			listeners.push([pattern, fn])
			return m
		},
	} as Machine<S, I, T>
	;(m as { readonly [LISTENERS]?: unknown } as Record<symbol, unknown>)[
		LISTENERS
	] = listeners
	return m
}

const LISTENERS: unique symbol = Symbol('listeners')

/** `input: from -> to`, split back out. */
const parse = (
	k: string,
): [on: string, from: string, to: string] | undefined => {
	const colon = k.indexOf(': ')
	const arrow = k.indexOf(' -> ')
	if (colon < 0 || arrow < colon) return undefined
	return [k.slice(0, colon), k.slice(colon + 2, arrow), k.slice(arrow + 4)]
}

const matches = (
	pattern: string,
	on: string,
	from: string,
	to: string,
): boolean => {
	if (!pattern.includes('->')) return pattern === on || pattern === '*'
	const arrow = pattern.indexOf(' -> ')
	const head = pattern.slice(0, arrow)
	const pTo = pattern.slice(arrow + 4)
	const colon = head.indexOf(': ')
	const pOn = colon < 0 ? '*' : head.slice(0, colon)
	const pFrom = colon < 0 ? head : head.slice(colon + 2)
	const ok = (p: string, v: string) => p === '*' || p === v
	return ok(pOn, on) && ok(pFrom, from) && ok(pTo, to)
}

const SKIP = { skipped: true }

/**
 * Try every transition declared for (current state, input), in declaration
 * order; the first that does not `skip()` wins.
 */
export function step<S extends AnyStates, I extends AnyInputs, T>(
	m: Machine<S, I, T>,
	current: StateValue<S>,
	inputName: string,
	payload?: unknown,
): Step<S> {
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

		const next = { state: to, data: result } as StateValue<S>
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
