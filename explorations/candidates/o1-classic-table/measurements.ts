// 20 states x 10 inputs -> the row union is 10 x 20 x 20 = 4 000 OBJECT types,
// where n1/n2's key union was 4 000 string literals. Object types are far
// heavier; this is the number that decides whether the shape scales.

import { machine, types } from './lib.ts'

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

export const ring = machine({
	initial: 's00',
	types: types<Ring>(),
	transitions: [
		{ event: 'i0', from: 's00', to: 's01' },
		{ event: 'i1', from: 's01', to: 's02' },
		{ event: 'i2', from: 's02', to: 's03' },
		{ event: 'i3', from: 's03', to: 's04' },
		{ event: 'i4', from: 's04', to: 's05' },
		{ event: 'i5', from: 's05', to: 's06' },
		{ event: 'i6', from: 's06', to: 's07' },
		{ event: 'i7', from: 's07', to: 's08' },
		{ event: 'i8', from: 's08', to: 's09' },
		{ event: 'i9', from: 's09', to: 's10' },
		{ event: 'i0', from: 's10', to: 's11' },
		{ event: 'i1', from: 's11', to: 's12' },
		{ event: 'i2', from: 's12', to: 's13' },
		{ event: 'i3', from: 's13', to: 's14' },
		{ event: 'i4', from: 's14', to: 's15' },
		{ event: 'i5', from: 's15', to: 's16' },
		{ event: 'i6', from: 's16', to: 's17' },
		{ event: 'i7', from: 's17', to: 's18' },
		{ event: 'i8', from: 's18', to: 's19' },
		{ event: 'i9', from: 's19', to: 's00', with: () => ({ n: 0 }) },
	],
})
