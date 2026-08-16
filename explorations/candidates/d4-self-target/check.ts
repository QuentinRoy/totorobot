// Positive proof that inference did not silently collapse.
//
// The failure mode the old `nothing` placeholder existed to prevent is `S`
// widening to its constraint. If that happened, `keyof S` would be `string` and
// every assertion below would fail -- so this file, not errors.ts, is what
// proves omitting `data` is free.

import { command, input, machine } from './lib.ts'
import type { DataOf, StatesOf } from './lib.ts'
import { publication } from './neutral.ts'
import { toggle } from './toggle.ts'

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

// --- toggle: EVERY state is data-free. The hardest case for inference. -------

type ToggleStates = StatesOf<typeof toggle>
type _t1 = Assert<Eq<keyof ToggleStates, 'off' | 'on'>>
type _t2 = Assert<Eq<DataOf<ToggleStates['off']>, void>>
type _t3 = Assert<Eq<DataOf<ToggleStates['on']>, void>>
// and NOT widened:
type _t4 = Assert<Eq<string extends keyof ToggleStates ? true : false, false>>

// --- neutral: a mix of data-free and data-carrying states -------------------

type Pub = StatesOf<typeof publication>
type _p1 = Assert<Eq<keyof Pub, 'empty' | 'draft' | 'review' | 'published'>>
type _p2 = Assert<Eq<DataOf<Pub['empty']>, void>>
type _p3 = Assert<
	Eq<DataOf<Pub['draft']>, { readonly text: string; readonly revision: number }>
>
type _p4 = Assert<
	Eq<DataOf<Pub['published']>, readonly [text: string, revision: number]>
>

// --- the shape that defeats reverse-mapped inference -------------------------
//
// TWO conditions have to coincide, and neither alone is enough (measured):
//
//   (a) Nothing in the states object is inferable. In pass one TypeScript
//       types every un-annotated closure as an internal non-inferrable `any`,
//       and `createReverseMappedType` refuses a source made only of those.
//   (b) `S` occurs in a closure PARAMETER's type. Computing that contextual
//       type fixes `S` -- and with (a) there is nothing to fix it to, so it
//       locks to its constraint and never recovers on the second pass.
//
// (b) is unavoidable here: `ctx.data` is `DataOf<S[K]>` by construction. So the
// residual case is (a): every state data-free AND every branch a closure. It is
// a compile error, not a silent loss of checking.

// @ts-expect-error -- "Cannot infer the state names: ..."
export const allContextSensitive = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>() },
	states: {
		a: {
			on: {
				go: { b: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
			},
		},
		b: {
			on: {
				go: { a: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
			},
		},
	},
})

// Any one of these anchors repairs it, with no `nothing` anywhere:
export const anchoredByBareTarget = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>() },
	states: {
		a: {
			on: {
				go: { b: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
			},
		},
		b: { on: { go: 'a' } },
	},
})
type Anchored = StatesOf<typeof anchoredByBareTarget>
type _h1 = Assert<Eq<keyof Anchored, 'a' | 'b'>>
type _h2 = Assert<Eq<DataOf<Anchored['a']>, void>>

// A zero-argument branch is not context-sensitive, so it anchors too. Only one
// of the two branches needs it.
export const anchoredByArityZero = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>(), reset: input<void>() },
	states: {
		a: {
			on: {
				go: { b: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
			},
		},
		b: {
			on: {
				go: { a: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
				reset: { a: () => undefined },
			},
		},
	},
})
type A2 = StatesOf<typeof anchoredByArityZero>
type _h3 = Assert<Eq<keyof A2, 'a' | 'b'>>

// So does a residency hook, for the same reason.
export const anchoredByEnter = machine({
	initial: 'a',
	inputs: { go: input<{ readonly v: number }>() },
	commands: command<{ readonly kind: 'log' }>(),
	states: {
		a: {
			enter: () => [{ kind: 'log' }] as const,
			on: {
				go: { b: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
			},
		},
		b: {
			on: {
				go: { a: ({ input, skip }) => (input.v > 0 ? undefined : skip()) },
			},
		},
	},
})
type A3 = StatesOf<typeof anchoredByEnter>
type _h4 = Assert<Eq<keyof A3, 'a' | 'b'>>

export type { _t1, _t2, _t3, _t4, _p1, _p2, _p3, _p4, _h1, _h2, _h3, _h4 }
