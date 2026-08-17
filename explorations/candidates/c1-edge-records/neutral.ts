// The neutral document-publication machine in encoding (d).
//
// READ blocker.ts FIRST. Encoding (d) cannot express a multi-target transition,
// so the two multi-target rows of the specified behaviour table --
// `draft + submit` (review | published) and `review + decide` (published |
// draft) -- are SPLIT into separate input names below.
//
// That is a capitulation, not a solution, and it is the same one the radix
// baseline was forced into. The specified vocabulary in
// docs/acceptance-cases.md has `submit(route, reviewer)` and
// `decide(verdict, text)` as single inputs carrying a discriminated payload.
// Splitting them moves the decision out of the machine into every caller, and
// the machine can no longer answer "what happens on submit?" -- there is no
// `submit`. Counted honestly, this candidate does not express the neutral
// machine.
//
// The conditional refusal on `revise` (unchanged -> no transition, changed ->
// same-state update) is ALSO not expressible, for the same reason: choosing
// between `none` and `keep` at runtime needs a clause list. It is written below
// as an unconditional `keep`, which is WRONG vs the spec, and marked.

import { data, input, machine } from './lib.ts'

export const publication = machine({
	initial: 'empty',
	inputs: {
		open: input<{ readonly text: string }>(),
		revise: input<{ readonly text: string }>(),
		submitToReview: input<{ readonly reviewer: string }>(),
		submitToPublish: input<void>(),
		approve: input<void>(),
		reject: input<{ readonly text: string }>(),
		cancel: input<void>(),
	},
	states: {
		empty: {
			data: data<void>(),
			on: {
				open: {
					to: 'draft',
					with: ({ input }) => ({ text: input.text, revision: 0 }),
				},
			},
		},

		draft: {
			data: data<{ readonly text: string; readonly revision: number }>(),
			on: {
				revise: {
					keep: ({ data, input }) => ({
						text: input.text,
						revision: data.revision + 1,
					}),
				},
				submitToReview: {
					to: 'review',
					with: ({ data, input }) => ({
						text: data.text,
						revision: data.revision,
						reviewer: input.reviewer,
					}),
				},
				submitToPublish: {
					to: 'published',
					with: ({ data }) => [data.text, data.revision] as const,
				},
				cancel: { to: 'empty' },
			},
		},

		review: {
			data: data<{
				readonly text: string
				readonly revision: number
				readonly reviewer: string
			}>(),
			on: {
				revise: {
					to: 'draft',
					with: ({ data, input }) => ({
						text: input.text,
						revision: data.revision + 1,
					}),
				},
				approve: {
					to: 'published',
					with: ({ data }) => [data.text, data.revision] as const,
				},
				reject: {
					to: 'draft',
					with: ({ data, input }) => ({
						text: input.text,
						revision: data.revision + 1,
					}),
				},
				cancel: { to: 'empty' },
			},
		},

		published: { data: data<readonly [text: string, revision: number]>() },
	},
})
