// O1 -- the classic transition table: an array of records.
//
//     { event: 'submit', from: 'draft', to: 'review', guard, map }
//
// Every coordinate is a NAMED FIELD. No key syntax, no parsing, no spacing
// question. This is what a transition table looks like in a textbook, in
// javascript-state-machine, in finity, and in a database row.
//
// Round 1 measured that a cross-product of discriminants at value positions
// kills contextual typing. This encoding avoids the union entirely: the array
// is inferred as a tuple `T`, and a HOMOMORPHIC MAPPED TYPE over its indices
// types each element from its own literals -- the same mechanism that already
// works elsewhere in this project.

declare const typesBrand: unique symbol
declare const skipBrand: unique symbol

export interface Spec {
	readonly inputs: Record<string, unknown>
	readonly states: Record<string, unknown>
}
export interface Types<Sp extends Spec> {
	readonly [typesBrand]?: (s: Sp) => Sp
}
export function types<Sp extends Spec>(): Types<Sp> {
	return {}
}

export type StatesOf<Sp extends Spec> = Sp['states']
export type InputsOf<Sp extends Spec> = Sp['inputs']
export type StateName<Sp extends Spec> = keyof StatesOf<Sp> & string
export type InputName<Sp extends Spec> = keyof InputsOf<Sp> & string

type DataAt<Sp extends Spec, N> = StatesOf<Sp>[N & StateName<Sp>]
type PayloadAt<Sp extends Spec, E> = InputsOf<Sp>[E & InputName<Sp>]

/** The "not this transition" sentinel. */
export interface Skip {
	readonly [skipBrand]: true
}

/** What `with` receives: the SOURCE state's data and the input's payload. */
export interface Ctx<Sp extends Spec, From, Event> {
	readonly data: DataAt<Sp, From>
	readonly input: PayloadAt<Sp, Event>
	/** Decline this row; the next matching one is tried. */
	readonly skip: () => Skip
}

/** The loose shape — this is what gives `event`/`from`/`to` completions. */
export interface Shape<Sp extends Spec> {
	readonly event: InputName<Sp>
	readonly from: StateName<Sp>
	readonly to: StateName<Sp>
}

/**
 * Every legal row, as a union. Referencing `T[I]` inside a mapped template
 * forces `T` to resolve, which defeats the deferred inference path -- so the
 * per-row precision has to come from a union instead, and TypeScript has to
 * pick the right constituent from THREE discriminants (`event`, `from`, `to`).
 *
 * `with` is ONE function: it both decides and projects, so a narrowing made in
 * it is available to the value it returns. It is required when the target
 * carries data, and optional when it does not -- so a plain edge stays
 * `{ event, from, to }`.
 */
export type AnyRow<Sp extends Spec> = {
	[E in InputName<Sp>]: {
		[F in StateName<Sp>]: {
			[To in StateName<Sp>]: {
				readonly event: E
				readonly from: F
				readonly to: To
			} & ([DataAt<Sp, To>] extends [void]
				? { readonly with?: (ctx: Ctx<Sp, F, E>) => void | Skip }
				: { readonly with: (ctx: Ctx<Sp, F, E>) => DataAt<Sp, To> | Skip })
		}[StateName<Sp>]
	}[StateName<Sp>]
}[InputName<Sp>]

export type Table<Sp extends Spec> = readonly AnyRow<Sp>[]

// --- reading the topology back out -------------------------------------------

type Rows<T> = T extends readonly (infer R)[] ? R : never

/** Inputs available in state `F`. */
export type Handled<T, F> =
	Extract<Rows<T>, { from: F }> extends {
		event: infer E
	}
		? E
		: never
/** States reachable from `F` on `E`. */
export type Targets<T, F, E> =
	Extract<Rows<T>, { from: F; event: E }> extends {
		to: infer To
	}
		? To
		: never
/** States that can reach `To`. */
export type Sources<T, To> =
	Extract<Rows<T>, { to: To }> extends {
		from: infer F
	}
		? F
		: never

export type StateValue<Sp extends Spec> = {
	[K in StateName<Sp>]: { readonly state: K; readonly data: StatesOf<Sp>[K] }
}[StateName<Sp>]

export type Step<Sp extends Spec> =
	| { readonly kind: 'none'; readonly reason: 'declined' | 'unavailable' }
	| { readonly kind: 'moved'; readonly next: StateValue<Sp> }

export interface Machine<Sp extends Spec, T> {
	readonly initial: StateName<Sp>
	readonly transitions: T
}

export function machine<Sp extends Spec, const T extends readonly unknown[]>(
	def: { readonly transitions: T } & {
		readonly types: Types<Sp>
		readonly initial: StateName<Sp>
		readonly transitions: Table<Sp>
	},
): Machine<Sp, T> {
	return def as unknown as Machine<Sp, T>
}

// --- runtime -----------------------------------------------------------------

type RtRow = {
	event: string
	from: string
	to: string
	with?: (c: unknown) => unknown
}

const SKIP = { skipped: true }

/** Rows are tried in array order; the first that does not `skip()` wins. */
export function step<Sp extends Spec, T>(
	m: Machine<Sp, T>,
	current: StateValue<Sp>,
	inputName: string,
	payload?: unknown,
): Step<Sp> {
	const rows = m.transitions as unknown as readonly RtRow[]
	let sawCandidate = false

	for (const row of rows) {
		if (row.event !== inputName || row.from !== current.state) continue
		sawCandidate = true
		const ctx = { data: current.data, input: payload, skip: () => SKIP }
		const result = row.with ? row.with(ctx) : undefined
		if (result === SKIP) continue
		return {
			kind: 'moved',
			next: { state: row.to, data: result } as StateValue<Sp>,
		}
	}
	return { kind: 'none', reason: sawCandidate ? 'declined' : 'unavailable' }
}
