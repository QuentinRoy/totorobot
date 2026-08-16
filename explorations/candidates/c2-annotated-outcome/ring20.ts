// Case 4, the twenty-state ring, in notation B. Generated shape, hand-checked.
// 20 states, 44 transitions, no effects.

import { type Keep, type To, data, input, machine } from './lib.ts'

export const ring = machine({
	initial: 's00',
	inputs: {
		next: input<{ readonly delta: number }>(),
		reset: input<void>(),
		skip: input<void>(),
	},
	states: {
		s00: {
			data: data<{ readonly visits: number; readonly owner: 's00' }>(),
			on: {
				next: ({ data, input, at }): To<'s01'> =>
					at.s01({ visits: data.visits + input.delta, owner: 's01' }),
				reset: ({ keep }): Keep => keep({ visits: 0, owner: 's00' }),
				skip: ({ data, at }): To<'s05'> =>
					at.s05({ visits: data.visits + 1, owner: 's05' }),
			},
		},
		s01: {
			data: data<{ readonly visits: number; readonly owner: 's01' }>(),
			on: {
				next: ({ data, input, at }): To<'s02'> =>
					at.s02({ visits: data.visits + input.delta, owner: 's02' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s02: {
			data: data<{ readonly visits: number; readonly owner: 's02' }>(),
			on: {
				next: ({ data, input, at }): To<'s03'> =>
					at.s03({ visits: data.visits + input.delta, owner: 's03' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s03: {
			data: data<{ readonly visits: number; readonly owner: 's03' }>(),
			on: {
				next: ({ data, input, at }): To<'s04'> =>
					at.s04({ visits: data.visits + input.delta, owner: 's04' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s04: {
			data: data<{ readonly visits: number; readonly owner: 's04' }>(),
			on: {
				next: ({ data, input, at }): To<'s05'> =>
					at.s05({ visits: data.visits + input.delta, owner: 's05' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s05: {
			data: data<{ readonly visits: number; readonly owner: 's05' }>(),
			on: {
				next: ({ data, input, at }): To<'s06'> =>
					at.s06({ visits: data.visits + input.delta, owner: 's06' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
				skip: ({ data, at }): To<'s10'> =>
					at.s10({ visits: data.visits + 1, owner: 's10' }),
			},
		},
		s06: {
			data: data<{ readonly visits: number; readonly owner: 's06' }>(),
			on: {
				next: ({ data, input, at }): To<'s07'> =>
					at.s07({ visits: data.visits + input.delta, owner: 's07' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s07: {
			data: data<{ readonly visits: number; readonly owner: 's07' }>(),
			on: {
				next: ({ data, input, at }): To<'s08'> =>
					at.s08({ visits: data.visits + input.delta, owner: 's08' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s08: {
			data: data<{ readonly visits: number; readonly owner: 's08' }>(),
			on: {
				next: ({ data, input, at }): To<'s09'> =>
					at.s09({ visits: data.visits + input.delta, owner: 's09' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s09: {
			data: data<{ readonly visits: number; readonly owner: 's09' }>(),
			on: {
				next: ({ data, input, at }): To<'s10'> =>
					at.s10({ visits: data.visits + input.delta, owner: 's10' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s10: {
			data: data<{ readonly visits: number; readonly owner: 's10' }>(),
			on: {
				next: ({ data, input, at }): To<'s11'> =>
					at.s11({ visits: data.visits + input.delta, owner: 's11' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
				skip: ({ data, at }): To<'s15'> =>
					at.s15({ visits: data.visits + 1, owner: 's15' }),
			},
		},
		s11: {
			data: data<{ readonly visits: number; readonly owner: 's11' }>(),
			on: {
				next: ({ data, input, at }): To<'s12'> =>
					at.s12({ visits: data.visits + input.delta, owner: 's12' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s12: {
			data: data<{ readonly visits: number; readonly owner: 's12' }>(),
			on: {
				next: ({ data, input, at }): To<'s13'> =>
					at.s13({ visits: data.visits + input.delta, owner: 's13' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s13: {
			data: data<{ readonly visits: number; readonly owner: 's13' }>(),
			on: {
				next: ({ data, input, at }): To<'s14'> =>
					at.s14({ visits: data.visits + input.delta, owner: 's14' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s14: {
			data: data<{ readonly visits: number; readonly owner: 's14' }>(),
			on: {
				next: ({ data, input, at }): To<'s15'> =>
					at.s15({ visits: data.visits + input.delta, owner: 's15' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s15: {
			data: data<{ readonly visits: number; readonly owner: 's15' }>(),
			on: {
				next: ({ data, input, at }): To<'s16'> =>
					at.s16({ visits: data.visits + input.delta, owner: 's16' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
				skip: ({ data, at }): To<'s00'> =>
					at.s00({ visits: data.visits + 1, owner: 's00' }),
			},
		},
		s16: {
			data: data<{ readonly visits: number; readonly owner: 's16' }>(),
			on: {
				next: ({ data, input, at }): To<'s17'> =>
					at.s17({ visits: data.visits + input.delta, owner: 's17' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s17: {
			data: data<{ readonly visits: number; readonly owner: 's17' }>(),
			on: {
				next: ({ data, input, at }): To<'s18'> =>
					at.s18({ visits: data.visits + input.delta, owner: 's18' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s18: {
			data: data<{ readonly visits: number; readonly owner: 's18' }>(),
			on: {
				next: ({ data, input, at }): To<'s19'> =>
					at.s19({ visits: data.visits + input.delta, owner: 's19' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
		s19: {
			data: data<{ readonly visits: number; readonly owner: 's19' }>(),
			on: {
				next: ({ data, input, at }): To<'s00'> =>
					at.s00({ visits: data.visits + input.delta, owner: 's00' }),
				reset: ({ at }): To<'s00'> => at.s00({ visits: 0, owner: 's00' }),
			},
		},
	},
})
