// The consumption view: what a CALLER writes once a machine exists.
//
// The brief's stated gap (section 4, closing): "no surveyed library enforces
// per-state capabilities at the send site". This is the file that closes it.

import type {
	AnyInputs,
	AnyStates,
	DataOf,
	Handled,
	InputOf,
	Machine,
	StateValue,
	Step,
} from './lib.ts'
import { step } from './runtime.ts'

/**
 * The capabilities of a value KNOWN to be in state `K`. Only the inputs that
 * state actually declared are present, so an illegal send does not compile.
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

export declare function capabilities<
	S extends AnyStates,
	I extends AnyInputs,
	C,
	D,
	K extends keyof D & keyof S & string,
>(
	m: Machine<S, I, C, D>,
	value: { readonly state: K; readonly data: DataOf<S[K]> },
): Capabilities<S, I, C, D, K>

/** Exhaustive consumption. Every state must be handled. */
export declare function visit<S extends AnyStates, R>(
	value: StateValue<S>,
	branches: {
		[K in keyof S & string]: (
			data: Extract<StateValue<S>, { state: K }>['data'],
		) => R
	},
): R

export { step }
