import { machine, types } from './lib.ts'
import type { Handled, Sources, Targets } from './lib.ts'
import { publication } from './neutral.ts'

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T
type T = typeof publication.transitions

type _b = Assert<Eq<Handled<T, 'draft'>, 'revise' | 'submit' | 'cancel'>>
type _d = Assert<Eq<Targets<T, 'draft', 'submit'>, 'review' | 'published'>>
type _s = Assert<Eq<Sources<T, 'published'>, 'draft' | 'review'>>

export const negative = machine({
	initial: 'a',
	types: types<{
		inputs: { go: { v: number } }
		states: { a: void; b: { n: number } }
	}>(),
	transitions: [
		// @ts-expect-error -- unknown target state
		{ event: 'go', from: 'a', to: 'nowhere' },
		// @ts-expect-error -- unknown event
		{ event: 'nosuch', from: 'a', to: 'b', with: () => ({ n: 1 }) },
		// @ts-expect-error -- `b` carries data, so `with` is REQUIRED
		{ event: 'go', from: 'a', to: 'b' },
		// @ts-expect-error -- `a` carries none, so `with` may not return data
		{ event: 'go', from: 'b', to: 'a', with: () => ({ anything: 1 }) },
		// @ts-expect-error -- wrong target data
		{ event: 'go', from: 'a', to: 'b', with: () => ({ n: 'no' }) },
		// @ts-expect-error -- source `a` has no data to read
		{ event: 'go', from: 'a', to: 'b', with: ({ data }) => ({ n: data.nope }) },
		// fine, and proves ctx really is typed
		{ event: 'go', from: 'a', to: 'b', with: ({ input }) => ({ n: input.v }) },
		// fine: a data-free target may still decline
		{ event: 'go', from: 'b', to: 'a', with: ({ skip }) => skip() },
		// fine: a plain edge needs no function at all
		{ event: 'go', from: 'b', to: 'a' },
	],
})
