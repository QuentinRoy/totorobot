// Same stress test as n1: 20 states x 10 inputs -> a 4 000-member key union.
// The point of comparison is the type COST of declaring vs inferring.

import { machine, types } from './lib.ts'
import type { Key } from './lib.ts'

export type Ring = {
	inputs: {
		i0: { v: number }
		i1: void
		i2: void
		i3: void
		i4: void
		i5: void
		i6: void
		i7: void
		i8: void
		i9: void
	}
	states: {
		s00: { n: number }
		s01: void
		s02: void
		s03: void
		s04: void
		s05: void
		s06: void
		s07: void
		s08: void
		s09: void
		s10: void
		s11: void
		s12: void
		s13: void
		s14: void
		s15: void
		s16: void
		s17: void
		s18: void
		s19: void
	}
}

/** 10 x 20 x 20 = 4 000 members. */
export type RingKey = Key<Ring>

export const ring = machine({
	initial: 's00',
	types: types<Ring>(),
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
	},
})

// Force the union to materialise so the cost measured below is real.
export const oneKey: RingKey = 'i0: s00 -> s01'

// @ts-expect-error -- and prove the 4 000-member union still rejects
export const badKey: RingKey = 'i0: s00 -> s99'
