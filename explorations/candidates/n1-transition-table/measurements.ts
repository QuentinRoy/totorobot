// The open question: `Key<S, I>` is inputs x states x states. Does that size
// actually hurt? This file is the stress test -- 20 states and 10 inputs, which
// is 20 x 20 x 10 = 4 000 union members, the size of acceptance Case 4's ring.

import { input, machine, state } from './lib.ts'
import type { Key } from './lib.ts'

const inputs = {
	i0: input<{ readonly v: number }>(),
	i1: input(),
	i2: input(),
	i3: input(),
	i4: input(),
	i5: input(),
	i6: input(),
	i7: input(),
	i8: input(),
	i9: input(),
}

const states = {
	s00: state<{ readonly n: number }>(),
	s01: state(),
	s02: state(),
	s03: state(),
	s04: state(),
	s05: state(),
	s06: state(),
	s07: state(),
	s08: state(),
	s09: state(),
	s10: state(),
	s11: state(),
	s12: state(),
	s13: state(),
	s14: state(),
	s15: state(),
	s16: state(),
	s17: state(),
	s18: state(),
	s19: state(),
}

/** 10 x 20 x 20 = 4 000 members. */
export type RingKey = Key<typeof states, typeof inputs>

export const ring = machine({
	initial: 's00',
	inputs,
	states,
	transitions: {
		'i0: s00 -> s01': ({ input }) => void input.v,
		'i1: s01 -> s02': () => {},
		'i2: s02 -> s03': () => {},
		'i3: s03 -> s04': () => {},
		'i4: s04 -> s05': () => {},
		'i5: s05 -> s06': () => {},
		'i6: s06 -> s07': () => {},
		'i7: s07 -> s08': () => {},
		'i8: s08 -> s09': () => {},
		'i9: s09 -> s10': () => {},
		'i0: s10 -> s11': ({ input }) => void input.v,
		'i1: s11 -> s12': () => {},
		'i2: s12 -> s13': () => {},
		'i3: s13 -> s14': () => {},
		'i4: s14 -> s15': () => {},
		'i5: s15 -> s16': () => {},
		'i6: s16 -> s17': () => {},
		'i7: s17 -> s18': () => {},
		'i8: s18 -> s19': () => {},
		'i9: s19 -> s00': () => ({ n: 0 }),
		// and the reverse direction, so it is 40 transitions not 20
		'i9: s01 -> s00': () => ({ n: 0 }),
		'i0: s02 -> s01': ({ input }) => void input.v,
		'i1: s03 -> s02': () => {},
		'i2: s04 -> s03': () => {},
		'i3: s05 -> s04': () => {},
		'i4: s06 -> s05': () => {},
		'i5: s07 -> s06': () => {},
		'i6: s08 -> s07': () => {},
		'i7: s09 -> s08': () => {},
		'i8: s10 -> s09': () => {},
		'i9: s11 -> s10': () => {},
		'i0: s12 -> s11': ({ input }) => void input.v,
		'i1: s13 -> s12': () => {},
		'i2: s14 -> s13': () => {},
		'i3: s15 -> s14': () => {},
		'i4: s16 -> s15': () => {},
		'i5: s17 -> s16': () => {},
		'i6: s18 -> s17': () => {},
		'i7: s19 -> s18': () => {},
		'i8: s00 -> s19': () => {},
	},
})

// Force the union to be fully materialised, so the cost below is real and not
// TypeScript being lazy about a mapped type it never had to expand.
export const oneKey: RingKey = 'i0: s00 -> s01'

// @ts-expect-error -- and prove the 4 000-member union actually rejects
export const badKey: RingKey = 'i0: s00 -> s99'
