// Negative evidence: omitting `data` must not weaken anything.
// Every `@ts-expect-error` here is load-bearing -- if the type system stopped
// checking, tsc reports the directive as UNUSED and this file fails.

import { data, input, machine } from './lib.ts'

export const m = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>(), stay: input<void>() },
	states: {
		a: {
			data: data<{ readonly n: number }>(),
			on: {
				// 1. UNKNOWN TARGET NAME.
				// @ts-expect-error
				go: { nowhere: () => undefined },
				// 2. WRONG TARGET DATA -- `b` needs { q: number }.
				// @ts-expect-error
				stay: { b: () => ({ q: 'not a number' }) },
			},
		},
		b: {
			data: data<{ readonly q: number }>(),
			on: {
				// 3. INVALID SOURCE-DATA READ.
				// @ts-expect-error
				go: { keep: ({ data }) => ({ q: data.nope }) },
				// 4. UNKNOWN INPUT NAME.
				// @ts-expect-error
				nosuch: { a: () => ({ n: 1 }) },
			},
		},
	},
})

// --- what is new: states that declare no `data` at all ----------------------

export const bare = machine({
	initial: 'idle',
	inputs: { go: input<{ readonly v: number }>() },
	states: {
		idle: {
			on: {
				go: {
					// 5. A DATA-FREE TARGET ACCEPTS NO DATA.
					// @ts-expect-error
					busy: () => ({ anything: 1 }),
				},
			},
		},
		busy: {
			on: {
				go: {
					// 6. A DATA-FREE SOURCE HAS NO DATA TO READ.
					// @ts-expect-error
					idle: ({ data }) => void data.anything,
				},
			},
		},
	},
})

// 7. TYPO'D `initial` -- proof that `keyof S` is still the real key set and
//    has not widened to `string`.
export const typo = machine({
	// @ts-expect-error
	initial: 'idl',
	inputs: { go: input<void>() },
	states: {
		idle: { on: { go: 'busy' } },
		busy: { on: { go: 'idle' } },
	},
})

// 8. TYPO'D BARE TARGET, in a machine where NO state declares data.
export const typoTarget = machine({
	initial: 'idle',
	inputs: { go: input<void>() },
	states: {
		// @ts-expect-error
		idle: { on: { go: 'busyy' } },
		busy: { on: { go: 'idle' } },
	},
})

// 9. THE BARE SHORTHAND IS ONLY LEGAL FOR DATA-FREE TARGETS.
export const shorthand = machine({
	initial: 'idle',
	inputs: { go: input<void>() },
	states: {
		// @ts-expect-error -- `loaded` carries data, so it cannot be a bare name
		idle: { on: { go: 'loaded' } },
		loaded: { data: data<{ readonly n: number }>() },
	},
})
