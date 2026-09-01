// Measures `observe()` completion behaviour against the twenty-state,
// forty-four-row acceptance machine (docs/acceptance-cases.md, case 4; the
// same rows as tests/scale.test-d.ts), imported through the real library
// rather than a candidate prototype. `scripts/measure-completions.mjs`
// probes this file the same way it probes the transition-table playground:
// insert a partial pattern after the anchor and ask for completions.
//
// Unlike a transition key, a pattern only needs to name declared states and
// inputs to have compiled pre-#116; the interesting number is how many of
// that name-valid cross-product survive the row filter this ticket adds.

import { machine, type } from 'totorobot'

type Inputs = { next: { delta: number }; reset: undefined; skip: undefined }
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
	inputs: type<Inputs>(),
	states: type<States>(),
	transitions: {
		's00 -next> s01': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's01',
		}),
		's01 -next> s02': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's02',
		}),
		's02 -next> s03': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's03',
		}),
		's03 -next> s04': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's04',
		}),
		's04 -next> s05': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's05',
		}),
		's05 -next> s06': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's06',
		}),
		's06 -next> s07': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's07',
		}),
		's07 -next> s08': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's08',
		}),
		's08 -next> s09': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's09',
		}),
		's09 -next> s10': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's10',
		}),
		's10 -next> s11': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's11',
		}),
		's11 -next> s12': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's12',
		}),
		's12 -next> s13': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's13',
		}),
		's13 -next> s14': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's14',
		}),
		's14 -next> s15': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's15',
		}),
		's15 -next> s16': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's16',
		}),
		's16 -next> s17': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's17',
		}),
		's17 -next> s18': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's18',
		}),
		's18 -next> s19': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's19',
		}),
		's19 -next> s00': ({ fromData, inputData }) => ({
			visits: fromData.visits + inputData.delta,
			owner: 's00',
		}),
		's00 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's01 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's02 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's03 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's04 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's05 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's06 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's07 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's08 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's09 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's10 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's11 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's12 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's13 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's14 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's15 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's16 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's17 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's18 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's19 -reset> s00': () => ({ visits: 0, owner: 's00' as const }),
		's00 -skip> s05': ({ fromData }) => ({
			visits: fromData.visits + 1,
			owner: 's05',
		}),
		's05 -skip> s10': ({ fromData }) => ({
			visits: fromData.visits + 1,
			owner: 's10',
		}),
		's10 -skip> s15': ({ fromData }) => ({
			visits: fromData.visits + 1,
			owner: 's15',
		}),
		's15 -skip> s00': ({ fromData }) => ({
			visits: fromData.visits + 1,
			owner: 's00',
		}),
	},
})

const host = stress.start({ visits: 0, owner: 's00' })

// <- anchor: the script inserts a new `host.observe('…` call here
