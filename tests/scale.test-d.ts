/**
 * Inference at scale: the twenty-state / forty-four-row acceptance case
 * (docs/acceptance-cases.md, case 4) used purely as a type fixture. Only its
 * inference aspect is used here — declaration size, cold check duration and
 * editor latency belong to `scripts/measure-completions.mjs`, not to this
 * suite.
 */

import { expectTypeOf, test } from 'vitest'

import { machine, types, type Handled } from '../src/totorobot.ts'

type Inputs = {
	next: { delta: number }
	reset: void
	skip: void
}
type States = {
	s00: { visits: number; owner: 's00' }
	s01: { visits: number; owner: 's01' }
	s02: { visits: number; owner: 's02' }
	s03: { visits: number; owner: 's03' }
	s04: { visits: number; owner: 's04' }
	s05: { visits: number; owner: 's05' }
	s06: { visits: number; owner: 's06' }
	s07: { visits: number; owner: 's07' }
	s08: { visits: number; owner: 's08' }
	s09: { visits: number; owner: 's09' }
	s10: { visits: number; owner: 's10' }
	s11: { visits: number; owner: 's11' }
	s12: { visits: number; owner: 's12' }
	s13: { visits: number; owner: 's13' }
	s14: { visits: number; owner: 's14' }
	s15: { visits: number; owner: 's15' }
	s16: { visits: number; owner: 's16' }
	s17: { visits: number; owner: 's17' }
	s18: { visits: number; owner: 's18' }
	s19: { visits: number; owner: 's19' }
}

const stress = machine({
	initial: 's00',
	inputs: types<Inputs>(),
	states: types<States>(),
	transitions: {
		's00 -next> s01': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's01',
		}),
		's01 -next> s02': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's02',
		}),
		's02 -next> s03': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's03',
		}),
		's03 -next> s04': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's04',
		}),
		's04 -next> s05': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's05',
		}),
		's05 -next> s06': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's06',
		}),
		's06 -next> s07': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's07',
		}),
		's07 -next> s08': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's08',
		}),
		's08 -next> s09': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's09',
		}),
		's09 -next> s10': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's10',
		}),
		's10 -next> s11': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's11',
		}),
		's11 -next> s12': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's12',
		}),
		's12 -next> s13': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's13',
		}),
		's13 -next> s14': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's14',
		}),
		's14 -next> s15': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's15',
		}),
		's15 -next> s16': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's16',
		}),
		's16 -next> s17': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's17',
		}),
		's17 -next> s18': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's18',
		}),
		's18 -next> s19': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's19',
		}),
		's19 -next> s00': ({ data, input }) => ({
			visits: data.visits + input.delta,
			owner: 's00',
		}),
		's00 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's01 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's02 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's03 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's04 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's05 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's06 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's07 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's08 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's09 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's10 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's11 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's12 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's13 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's14 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's15 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's16 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's17 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's18 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's19 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		's00 -skip> s05': ({ data }) => ({
			visits: data.visits + 1,
			owner: 's05',
		}),
		's05 -skip> s10': ({ data }) => ({
			visits: data.visits + 1,
			owner: 's10',
		}),
		's10 -skip> s15': ({ data }) => ({
			visits: data.visits + 1,
			owner: 's15',
		}),
		's15 -skip> s00': ({ data }) => ({
			visits: data.visits + 1,
			owner: 's00',
		}),
	},
})

test('the full twenty-state, forty-four-row table type-checks, and start() requires the initial data', () => {
	stress.start({ visits: 0, owner: 's00' })
	// @ts-expect-error - s00's data is not void; start() requires it
	stress.start()

	expectTypeOf(stress.start().current.state).toEqualTypeOf<
		| 's00'
		| 's01'
		| 's02'
		| 's03'
		| 's04'
		| 's05'
		| 's06'
		| 's07'
		| 's08'
		| 's09'
		| 's10'
		| 's11'
		| 's12'
		| 's13'
		| 's14'
		| 's15'
		| 's16'
		| 's17'
		| 's18'
		| 's19'
	>()
})

test('skip is only available from s00, s05, s10 and s15', () => {
	type M = typeof stress

	// Pure type-level assertions: `toEqualTypeOf` accepts `any` against
	// anything, so the `toBeAny` guards keep this test from passing
	// vacuously against an unresolved import or an `any` implementation.
	expectTypeOf<Handled<M, 's00'>>().not.toBeAny()
	expectTypeOf<Handled<M, 's00'>>().toEqualTypeOf<'next' | 'reset' | 'skip'>()
	expectTypeOf<Handled<M, 's05'>>().not.toBeAny()
	expectTypeOf<Handled<M, 's05'>>().toEqualTypeOf<'next' | 'reset' | 'skip'>()
	expectTypeOf<Handled<M, 's01'>>().not.toBeAny()
	expectTypeOf<Handled<M, 's01'>>().toEqualTypeOf<'next' | 'reset'>()
	expectTypeOf<Handled<M, 's19'>>().not.toBeAny()
	expectTypeOf<Handled<M, 's19'>>().toEqualTypeOf<'next' | 'reset'>()
})

test('handler data and input are inferred with no annotations, at this scale', () => {
	machine({
		initial: 's00',
		inputs: types<Inputs>(),
		states: types<States>(),
		transitions: {
			's00 -next> s01': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<{ visits: number; owner: 's00' }>()
				expectTypeOf(input).toEqualTypeOf<{ delta: number }>()
				return { visits: data.visits + input.delta, owner: 's01' }
			},
			's19 -next> s00': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<{ visits: number; owner: 's19' }>()
				return { visits: data.visits + input.delta, owner: 's00' }
			},
			's00 -skip> s05': ({ data, skip }) =>
				data.visits < 0 ? skip() : { visits: data.visits + 1, owner: 's05' },
		},
	})
})

test('a wrong owner literal is still rejected at this scale', () => {
	machine({
		initial: 's00',
		inputs: types<Inputs>(),
		states: types<States>(),
		transitions: {
			// @ts-expect-error - s01's owner literal is "s01", not "s00"
			's00 -next> s01': ({ data, input }) => ({
				visits: data.visits + input.delta,
				owner: 's00',
			}),
			's00 -reset> s00': () => ({ visits: 0, owner: 's00' }),
		},
	})
})
