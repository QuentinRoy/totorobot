// Notation B -- the annotated outcome.
//
// Source and input stay object keys. Outcome kind and target move into the
// handler's RETURN ANNOTATION, which Prettier keeps at a stable position just
// before `=>`. The body is ordinary TypeScript, so ordinary narrowing works.

declare const dataBrand: unique symbol
declare const inputBrand: unique symbol

export interface Data<T> {
	readonly [dataBrand]?: (t: T) => T
}
export interface Input<T> {
	readonly [inputBrand]?: (t: T) => T
}
export function data<T>(): Data<T> {
	return {}
}
export function input<T>(): Input<T> {
	return {}
}
export type DataOf<X> = X extends Data<infer T> ? T : never
export type InputOf<X> = X extends Input<infer T> ? T : never

export type AnyStates = Record<string, Data<any>>
export type AnyInputs = Record<string, Input<any>>

declare const cmdBrand: unique symbol
export interface Commands<T> {
	readonly [cmdBrand]?: (t: T) => T
}
export function command<T>(): Commands<T> {
	return {}
}
export type CommandOf<X> = X extends Commands<infer T> ? T : never

// --- the outcome algebra, four members --------------------------------------

export interface To<N extends string> {
	readonly kind: 'to'
	readonly to: N
	readonly data: unknown
}
export interface Keep {
	readonly kind: 'keep'
	readonly data: unknown
}
export interface Repeat {
	readonly kind: 'repeat'
	readonly data: unknown
}
export interface None {
	readonly kind: 'none'
}

// Target-bound constructors. A data-free target takes no argument.
export type At<S extends AnyStates, C> = {
	[N in keyof S & string]: [DataOf<S[N]>] extends [void]
		? (commands?: readonly C[]) => To<N>
		: (data: DataOf<S[N]>, commands?: readonly C[]) => To<N>
}

export interface Ctx<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
	C,
> {
	readonly data: DataOf<S[K]>
	readonly input: InputOf<I[E]>
	readonly at: At<S, C>
	readonly keep: (data: DataOf<S[K]>, commands?: readonly C[]) => Keep
	readonly repeat: (data: DataOf<S[K]>, commands?: readonly C[]) => Repeat
	readonly none: () => None
}

// One plain function type -- NOT a union of shapes. This is why the handler
// parameters keep their contextual type where notation A's lose it.
export type Handler<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	E extends keyof I,
	C,
> = (ctx: Ctx<S, I, K, E, C>) => To<keyof S & string> | Keep | Repeat | None

export type StateDef<
	S extends AnyStates,
	I extends AnyInputs,
	K extends keyof S,
	C,
> = {
	readonly data: S[K]
	/** Moore side: commands run when this state is entered. */
	readonly enter?: (ctx: { readonly data: DataOf<S[K]> }) => readonly C[]
	/** Moore side: commands run when this state is left, or re-entered. */
	readonly exit?: (ctx: { readonly data: DataOf<S[K]> }) => readonly C[]
	/** Mealy side: one handler per input this state accepts. */
	readonly on?: { readonly [E in keyof I]?: Handler<S, I, K, E, C> }
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

/** The inputs state `K` actually declared -- the basis of send-site checking. */
export type Handled<I extends AnyInputs, D, K extends keyof D> = D[K] extends {
	readonly on: infer O
}
	? keyof O & keyof I
	: never

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
