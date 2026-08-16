// Proof the key language is actually parsed and enforced, not just accepted.

import { input, machine, state } from './lib.ts'
import type { Handled, PatOn, Sources, Targets, Widen } from './lib.ts'
import { publication } from './neutral.ts'
import type { Decide, Submit } from './neutral.ts'

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

type T = typeof publication.transitions

// The three search questions, answered from the keys alone.
type _b = Assert<Eq<Handled<T, 'draft'>, 'revise' | 'submit' | 'cancel'>>
type _d = Assert<Eq<Targets<T, 'draft', 'submit'>, 'review' | 'published'>>
type _s = Assert<Eq<Sources<T, 'published'>, 'draft' | 'review'>>
type _t = Assert<Eq<Handled<T, 'published'>, never>>

// --- what IS caught on the offending line -----------------------------------

export const perLine = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>() },
	states: {
		a: state<{ readonly n: number }>(),
		b: state<{ readonly q: number }>(),
	},
	transitions: {
		// WRONG TARGET DATA -- `a` needs { n: number }
		// @ts-expect-error
		'go: b -> a': () => ({ n: 'not a number' }),
		// READING A FIELD THE SOURCE DOES NOT HAVE
		// @ts-expect-error
		'go: a -> b': ({ data }) => ({ q: data.nope }),
	},
})

// --- what is caught only at the CALL ----------------------------------------
// Bad KEYS cannot be flagged per line: capturing the literal to read the
// topology back out defeats excess-property checking. The validator names them
// instead -- e.g. `not a transition: 'go:a->b'`.

// @ts-expect-error -- unknown state in target position
export const unknownTarget = machine({
	initial: 'a',
	inputs: { go: input() },
	states: { a: state(), b: state() },
	transitions: { 'go: a -> nowhere': () => {} },
})

// @ts-expect-error -- unknown input
export const unknownInput = machine({
	initial: 'a',
	inputs: { go: input() },
	states: { a: state(), b: state() },
	transitions: { 'nosuch: a -> b': () => {} },
})

// @ts-expect-error -- missing the arrow
export const noArrow = machine({
	initial: 'a',
	inputs: { go: input() },
	states: { a: state(), b: state() },
	transitions: { 'go: a b': () => {} },
})

// @ts-expect-error -- missing the input
export const noInput = machine({
	initial: 'a',
	inputs: { go: input() },
	states: { a: state(), b: state() },
	transitions: { 'a -> b': () => {} },
})

// @ts-expect-error -- spacing is load-bearing
export const spacing = machine({
	initial: 'a',
	inputs: { go: input() },
	states: { a: state(), b: state() },
	transitions: { 'go:a->b': () => {} },
})

export const typo = machine({
	// @ts-expect-error -- typo'd `initial`, caught on its own line
	initial: 'aa',
	inputs: { go: input() },
	states: { a: state(), b: state() },
	transitions: { 'go: a -> b': () => {} },
})

export type { _b, _d, _s, _t }

// --- listener events are narrowed BY THE PATTERN ----------------------------
// NB: these are written as assignments to a WRONG type on purpose would be
// vacuous if the event resolved to `never`. They assign to the RIGHT type, so a
// collapse to `never` still passes -- the negative cases below are what prove
// it did not.

publication
	// pattern names the input -> `on` is a literal, `input` is its payload,
	// `from` and `to` are narrowed to single states
	.on('submit: draft -> review', (e) => {
		const on: 'submit' = e.on
		const route: Submit['route'] = e.input.route
		const from: 'draft' = e.from.state
		const to: 'review' = e.to.state
		const text: string = e.from.data.text
		const reviewer: string = e.to.data.reviewer
		void [on, route, from, to, text, reviewer]
	})
	// bare input name -> payload known, states are not
	.on('open', (e) => {
		const text: string = e.input.text
		const from: 'empty' | 'draft' | 'review' | 'published' = e.from.state
		void [text, from]
	})
	// `*` in the input slot -> a union DISCRIMINATED BY `on`
	.on('* -> published', (e) => {
		const to: 'published' = e.to.state
		if (e.on === 'submit') {
			const route: Submit['route'] = e.input.route
			void route
		}
		if (e.on === 'decide') {
			const verdict: Decide['verdict'] = e.input.verdict
			void verdict
		}
		void to
	})

// --- and the negative cases, which prove none of the above is vacuous -------

publication.on('submit: draft -> review', (e) => {
	// @ts-expect-error -- `on` is the literal 'submit', not any input name
	const on: 'decide' = e.on
	// @ts-expect-error -- `revise`'s payload has no `route`
	const bad: string = e.input.nope
	// @ts-expect-error -- `from` is narrowed to `draft`
	const from: 'review' = e.from.state
	void [on, bad, from]
})

publication.on('* -> published', (e) => {
	// @ts-expect-error -- not narrowed yet: `.route` is not on every payload
	e.input.route
})

// @ts-expect-error -- `nosuch` is not an input
publication.on('nosuch: draft -> review', () => {})

// @ts-expect-error -- `draft -> published` exists, but `nowhere` is not a state
publication.on('* -> nowhere', () => {})
