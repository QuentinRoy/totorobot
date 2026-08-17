// D3 -- TARGET-OWNED ENTRANCES ("the arrivals board").
//
// Every other notation in this project is organised by SOURCE: a state lists the
// inputs it accepts, and each handler has to say where it goes. That is where the
// multi-target problem lives, because one (source, input) pair may go to several
// places and TypeScript will not let a target SET sit at a value position
// (measured: tuples and cross-products both kill contextual typing).
//
// This notation transposes the map. A state declares who may ARRIVE:
//
//   <target>: { data, from: { <source>: { <input>: entrance } } }
//
// The multi-target problem then dissolves instead of being solved. `draft +
// submit` reaching `review` OR `published` is TWO entrances in TWO states, each
// with exactly ONE target -- and that target is the enclosing object key, a
// literal at a value position with completions. `submit` is never renamed.
//
// Because two entrances can now compete for the same (source, input), an
// entrance may decline with `pass()`. That is also how a conditional refusal is
// written, and it is where this notation's real cost lives -- see README.

declare const dataBrand: unique symbol
declare const inputBrand: unique symbol
declare const cmdBrand: unique symbol

export interface Data<T> {
	readonly [dataBrand]?: (t: T) => T
}
export interface Input<T> {
	readonly [inputBrand]?: (t: T) => T
}
export interface Commands<T> {
	readonly [cmdBrand]?: (t: T) => T
}

export function data<T>(): Data<T> {
	return {}
}
export function input<T>(): Input<T> {
	return {}
}
export function command<T>(): Commands<T> {
	return {}
}

/** A state that carries no data. Shipped once; no placeholder object. */
export const noData: Data<void> = {}

export type DataOf<X> = X extends Data<infer T> ? T : never
export type InputOf<X> = X extends Input<infer T> ? T : never
export type CommandOf<X> = X extends Commands<infer T> ? T : never

export type AnyStates = Record<string, Data<any>>
export type AnyInputs = Record<string, Input<any>>

// --- the four-member outcome algebra, spelled from the TARGET's side ---------
//
//   enter() in a state OTHER than the source -> next_state
//   enter() in the source state itself       -> keep_state   (residency kept)
//   again() in the source state itself       -> repeat_state (residency re-run)
//   every candidate entrance pass()es        -> no transition, reason 'declined'
//   no entrance exists for (source, input)   -> no transition, reason 'unavailable'
//
// Note what moved: THREE of the five outcomes are now readable from the two
// object keys alone (target key vs `from` key), with no body opened at all.

export interface Enter {
	readonly kind: 'enter'
	readonly data: unknown
	readonly commands: readonly unknown[]
}
export interface Again {
	readonly kind: 'again'
	readonly data: unknown
	readonly commands: readonly unknown[]
}
export interface Pass {
	readonly kind: 'pass'
}

/** A data-free target is admitted with no argument at all. */
export type Admit<D, C, R> = [D] extends [void]
	? (data?: void, commands?: readonly C[]) => R
	: (data: D, commands?: readonly C[]) => R

export interface Ectx<
	S extends AnyStates,
	I extends AnyInputs,
	F extends keyof S,
	K extends keyof S,
	E extends keyof I,
	C,
> {
	/** The SOURCE state's data -- `F`, not `K`. */
	readonly data: DataOf<S[F]>
	readonly input: InputOf<I[E]>
	/** Admit the arrival. The argument is THIS state's data. */
	readonly enter: Admit<DataOf<S[K]>, C, Enter>
	/** Self-entrances only: re-enter, re-running residency (repeat_state). */
	readonly again: [F] extends [K] ? Admit<DataOf<S[K]>, C, Again> : never
	/** Decline. Another entrance may claim it; if none does, no transition. */
	readonly pass: () => Pass
}

// ONE plain function type, not a union of shapes -- the measured requirement for
// handler parameters to keep their contextual types.
export type Entrance<
	S extends AnyStates,
	I extends AnyInputs,
	F extends keyof S,
	K extends keyof S,
	E extends keyof I,
	C,
> = (ctx: Ectx<S, I, F, K, E, C>) => Enter | Again | Pass

export type StateDef<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	C,
> = {
	readonly data: S[K]
	/** Moore side: commands run when this state is entered. */
	readonly entry?: (ctx: { readonly data: DataOf<S[K]> }) => readonly C[]
	/** Moore side: commands run when this state is left, or re-entered. */
	readonly exit?: (ctx: { readonly data: DataOf<S[K]> }) => readonly C[]
	/** Who may arrive here, and with what. Source key, then input key. */
	readonly from?: {
		readonly [F in keyof S]?: {
			readonly [E in keyof I]?: Entrance<S, I, F, K, E, C>
		}
	}
}

export interface Machine<
	S extends AnyStates,
	I extends AnyInputs,
	C,
	D = { readonly [K in keyof S]: StateDef<S, I, K, C> },
> {
	readonly initial: keyof S
	readonly states: D
}

export function machine<
	S extends AnyStates,
	I extends AnyInputs,
	Cm extends Commands<any> = Commands<any>,
	D = unknown,
>(
	def: { readonly states: D } & {
		readonly initial: keyof S
		readonly inputs: I
		readonly commands?: Cm
		readonly states: {
			readonly [K in keyof S]: StateDef<S, I, K, CommandOf<Cm>>
		}
	},
): Machine<S, I, CommandOf<Cm>, D & { readonly [K in keyof S]: unknown }> {
	return def as unknown as Machine<
		S,
		I,
		CommandOf<Cm>,
		D & { readonly [K in keyof S]: unknown }
	>
}

// --- reading the topology back out ------------------------------------------

/**
 * The inputs available in source state `K` -- gathered from EVERY state's `from`
 * block. This is the reverse index the notation gives up in the source text, and
 * it is the basis of send-site capability checking.
 */
export type Handled<I extends AnyInputs, D, K extends PropertyKey> = {
	[T in keyof D]: D[T] extends { readonly from: infer F }
		? K extends keyof F
			? keyof NonNullable<F[K]> & keyof I
			: never
		: never
}[keyof D]

/** The states reachable from source `K` on input `E` -- question D, as a type. */
export type Targets<D, K extends PropertyKey, E extends PropertyKey> = {
	[T in keyof D]: D[T] extends { readonly from: infer F }
		? K extends keyof F
			? E extends keyof NonNullable<F[K]>
				? T
				: never
			: never
		: never
}[keyof D]

export type StateValue<S extends AnyStates> = {
	[K in keyof S & string]: {
		readonly state: K
		readonly data: DataOf<S[K]>
	}
}[keyof S & string]

export type Step<S extends AnyStates, C> =
	| {
			readonly kind: 'none'
			readonly reason: 'declined' | 'unavailable'
			readonly commands: readonly C[]
	  }
	| {
			readonly kind: 'keep' | 'repeat' | 'to'
			readonly next: StateValue<S>
			readonly commands: readonly C[]
			readonly residencyRan?: boolean
	  }

// --- a real runtime ---------------------------------------------------------

type AnyEntrance = (ctx: {
	data: unknown
	input: unknown
	enter: (d?: unknown, c?: readonly unknown[]) => Enter
	again: (d?: unknown, c?: readonly unknown[]) => Again
	pass: () => Pass
}) => Enter | Again | Pass

type AnyStateDef = {
	from?: Record<string, Record<string, AnyEntrance> | undefined>
	entry?: (c: { data: unknown }) => readonly unknown[]
	exit?: (c: { data: unknown }) => readonly unknown[]
}

const enterCtor = (d?: unknown, c?: readonly unknown[]): Enter => ({
	kind: 'enter',
	data: d,
	commands: c ?? [],
})
const againCtor = (d?: unknown, c?: readonly unknown[]): Again => ({
	kind: 'again',
	data: d,
	commands: c ?? [],
})
const passCtor = (): Pass => ({ kind: 'pass' })

/**
 * Pure, synchronous evolution. Candidate entrances are tried in the declaration
 * order of `states`; the first that does not `pass()` wins.
 */
export function step<S extends AnyStates, I extends AnyInputs, C>(
	m: Machine<S, I, C>,
	current: StateValue<S>,
	inputName: string,
	payload?: unknown,
): Step<S, C> {
	const states = m.states as unknown as Record<string, AnyStateDef>
	const source: string = current.state
	let sawCandidate = false

	for (const target of Object.keys(states)) {
		const entrance = states[target]?.from?.[source]?.[inputName]
		if (typeof entrance !== 'function') continue
		sawCandidate = true

		const outcome = entrance({
			data: current.data,
			input: payload,
			enter: enterCtor,
			again: againCtor,
			pass: passCtor,
		})
		if (outcome.kind === 'pass') continue

		const next = { state: target, data: outcome.data } as StateValue<S>
		// `enter` at the source state preserves residency (keep_state); `again`
		// deliberately re-runs it (repeat_state); anything else moves.
		const movesResidency = target !== source || outcome.kind === 'again'
		const exiting = states[source]?.exit
		const entering = states[target]?.entry
		const exitCmds =
			movesResidency && exiting ? exiting({ data: current.data }) : []
		const enterCmds =
			movesResidency && entering ? entering({ data: outcome.data }) : []

		return {
			kind:
				target !== source ? 'to' : outcome.kind === 'again' ? 'repeat' : 'keep',
			next,
			commands: [
				...exitCmds,
				...outcome.commands,
				...enterCmds,
			] as readonly C[],
			residencyRan: exitCmds.length + enterCmds.length > 0,
		} as Step<S, C>
	}

	return {
		kind: 'none',
		reason: sawCandidate ? 'declined' : 'unavailable',
		commands: [],
	}
}

// --- the consumption view ---------------------------------------------------

/**
 * The capabilities of a value KNOWN to be in state `K`. Only inputs some state
 * declared an entrance for from `K` are present, so an illegal send does not
 * compile.
 */
export type Capabilities<
	S extends AnyStates,
	I extends AnyInputs,
	C,
	D,
	K extends keyof D & keyof S,
> = {
	[E in Handled<I, D, K>]: (payload: InputOf<I[E]>) => Step<S, C>
}

export function capabilities<
	S extends AnyStates,
	I extends AnyInputs,
	C,
	D,
	K extends keyof D & keyof S & string,
>(
	m: Machine<S, I, C, D>,
	value: { readonly state: K; readonly data: DataOf<S[K]> },
): Capabilities<S, I, C, D, K> {
	const states = m.states as unknown as Record<string, AnyStateDef>
	const out: Record<string, (payload?: unknown) => Step<S, C>> = {}
	for (const target of Object.keys(states)) {
		const incoming = states[target]?.from?.[value.state]
		if (!incoming) continue
		for (const inputName of Object.keys(incoming)) {
			out[inputName] ??= (payload?: unknown) =>
				step(m as Machine<S, I, C>, value as StateValue<S>, inputName, payload)
		}
	}
	return out as unknown as Capabilities<S, I, C, D, K>
}

/** Exhaustive consumption. Every state must be handled. */
export declare function visit<S extends AnyStates, R>(
	value: StateValue<S>,
	branches: {
		[K in keyof S & string]: (
			data: Extract<StateValue<S>, { state: K }>['data'],
		) => R
	},
): R
