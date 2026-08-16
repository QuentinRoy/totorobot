// Does declaring the vocabulary close the holes that inferring it left open?
//
// NB: the topology assertions use their OWN fixture, not `neutral.ts`, so that
// editing the neutral machine while experimenting does not fail the build.

import { machine, types } from './lib.ts'
import type { Handled, Norm, Sources, Targets } from './lib.ts'
import type { Decide, Submit } from './neutral.ts'
import { publication } from './neutral.ts'

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

// --- topology, on a fixed fixture -------------------------------------------

const fixture = machine({
	initial: 'empty',
	types: types<{
		inputs: { open: void; submit: void; cancel: void }
		states: { empty: void; draft: void; review: void; published: void }
	}>(),
	transitions: {
		'open: empty -> draft': () => {},
		'submit: draft -> review': () => {},
		'submit: draft -> published': () => {},
		'cancel: draft -> empty': () => {},
		'submit: review -> published': () => {},
	},
})
type F = typeof fixture.transitions

type _b = Assert<Eq<Handled<F, 'draft'>, 'submit' | 'cancel'>>
type _d = Assert<Eq<Targets<F, 'draft', 'submit'>, 'review' | 'published'>>
type _s = Assert<Eq<Sources<F, 'published'>, 'draft' | 'review'>>
type _t = Assert<Eq<Handled<F, 'published'>, never>>

// --- HOLE 1 in n1: `state()` / `input()` inferred `any` ----------------------
// Here `void` is written literally, so there is nothing to infer.

export const voidIsReallyVoid = machine({
	initial: 'a',
	types: types<{
		inputs: { go: void }
		states: { a: void; b: { n: number } }
	}>(),
	transitions: {
		// @ts-expect-error -- `a` carries no data
		'go: b -> a': () => ({ anything: 1 }),
		// @ts-expect-error -- `go` carries no payload
		'go: a -> b': ({ input }) => ({ n: input.whatever }),
	},
})

// --- HOLE 2 in d1: the state-name inference cliff ----------------------------
// Every state data-free AND every handler a closure. In d1 this collapsed
// `keyof S` to `string`; here the names are declared, so it cannot.

export const allClosures = machine({
	initial: 'a',
	types: types<{
		inputs: { go: { v: number } }
		states: { a: void; b: void }
	}>(),
	transitions: {
		'go: a -> b': ({ input, skip }) => (input.v > 0 ? undefined : skip()),
		'go: b -> a': ({ input, skip }) => (input.v > 0 ? undefined : skip()),
	},
})
type Cliff = typeof allClosures.transitions
type _c1 = Assert<Eq<Handled<Cliff, 'a'>, 'go'>>
type _c2 = Assert<Eq<Targets<Cliff, 'a', 'go'>, 'b'>>

// --- spacing is NOT load-bearing --------------------------------------------

type _n1 = Assert<Eq<Norm<'load:idle->booting'>, 'load: idle -> booting'>>
type _n2 = Assert<Eq<Norm<'load: idle -> booting'>, 'load: idle -> booting'>>
type _n3 = Assert<Eq<Norm<'load :idle ->  booting'>, 'load: idle -> booting'>>

export const anySpacing = machine({
	initial: 'idle',
	types: types<{
		inputs: { load: { url: string }; tick: void }
		states: { idle: void; booting: { url: string }; ready: { n: number } }
	}>(),
	transitions: {
		// compact
		'load:idle->booting': ({ input }) => ({ url: input.url }),
		// canonical
		'tick: booting -> ready': () => ({ n: 0 }),
		// ragged
		'tick :ready ->  idle': () => {},
	},
})
// and the handlers were really typed, not silently `any`:
type Sp = typeof anySpacing.transitions
type _sp = Assert<Eq<Targets<Sp, 'idle', 'load'>, 'booting'>>

export const spacingStillChecked = machine({
	initial: 'a',
	types: types<{ inputs: { go: void }; states: { a: void; b: void } }>(),
	transitions: {
		// @ts-expect-error -- compact spelling, still an unknown target
		'go:a->nowhere': () => {},
	},
})

// --- handler + listener typing survives -------------------------------------

publication
	.on('submit: draft -> review', (e) => {
		const on: 'submit' = e.on
		const route: Submit['route'] = e.input.route
		const from: 'draft' = e.from.state
		void [on, route, from]
	})
	.on('* -> published', (e) => {
		if (e.on === 'decide') {
			const v: Decide['verdict'] = e.input.verdict
			void v
		}
	})

publication.on('submit: draft -> review', (e) => {
	// @ts-expect-error -- narrowed to the literal
	const on: 'decide' = e.on
	void on
})

publication.on('* -> published', (e) => {
	// @ts-expect-error -- not narrowed yet
	e.input.route
})

export type { _b, _d, _s, _t, _c1, _c2, _n1, _n2, _n3, _sp }
