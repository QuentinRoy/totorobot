// MEASURED BLOCKER for encoding (d). Reproduce with:
//   pnpm exec tsc -p explorations/candidates/c1-edge-records/tsconfig.json
//
// Encoding (d) puts the target at a fixed position after the input key. Note 06
// F17 measured it as the best of the four encodings. What F17 did not test is
// (d) carrying a COMPLETE outcome algebra and a MULTI-TARGET transition.
// Both are required by the neutral machine (draft.submit, review.decide) and by
// Case 1 (startup.move). Measured here on typescript@7.0.2: (d) has two
// independent blockers, and they are not the same problem.

import { type Change, type Data, type Input, data, input } from './lib.ts'

// --- BLOCKER 1: a guarded-clause LIST destroys contextual typing -------------
// (d) must express a conditional/multi-target edge as an ordered clause list --
// F17's own "several entries or a nested union". Allowing a list at the edge
// position means the edge type is `Outcome | readonly Outcome[]`. Measured: a
// union of an object type with an ARRAY of that object type makes every BARE
// object edge in the whole machine lose its handler parameter types.
//
// Isolated bisection, S and I supplied explicitly so the declaration site is
// not a variable:
//   Edge = Change                        -> 0 errors
//   Edge = Change | NoTransition         -> 0 errors
//   Edge = Change | Same                 -> 0 errors
//   Edge = Change | readonly Change[]    -> 3x TS7031 "Binding element 'input'
//                                           implicitly has an 'any' type"
// The array branch is the cause. This is NOT the declaration-site question:
// supplying S and I as explicit type arguments changes nothing.

type S = {
	a: Data<void>
	b: Data<{ readonly n: number }>
}
type I = { go: Input<{ readonly v: number }> }

declare function withList(
	e: Change<S, I, 'a', 'go'> | readonly Change<S, I, 'a', 'go'>[],
): void
declare function withoutList(e: Change<S, I, 'a', 'go'>): void

// @ts-expect-error TS7031: Binding element 'input' implicitly has an 'any' type.
withList({ to: 'b', with: ({ input }) => ({ n: input.v }) })

// Identical edge, no list in the union: contextually typed, compiles clean.
withoutList({ to: 'b', with: ({ input }) => ({ n: input.v }) })

// --- BLOCKER 2: a guard does not narrow its own clause's handler ------------
// Even if blocker 1 were fixed, `when` and `with` are separate callbacks, so a
// refinement established in the guard does not flow into the data projection.
// Measured against the real neutral machine (draft.submit):
//   neutral.ts(49,24): error TS2339: Property 'reviewer' does not exist on
//     type 'Submit'. Property 'reviewer' does not exist on type
//     '{ readonly route: "publish"; }'.
// This is exactly the weakness Proposition 2 admitted for "rules as data", and
// it is the reason that document had to invent a `match` primitive. It is not
// avoidable inside (d): the guard and the projection cannot be one function
// without putting the decision back into a body, which is what (d) exists to
// prevent.

export const blockers = {
	one: 'clause list kills contextual typing',
	two: 'guard does not narrow projection',
} as const
export type { S, I }
export const _keepImportsUsed = { data: data<void>(), input: input<void>() }
