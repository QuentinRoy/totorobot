// The neutral document-publication machine, with no `data` on data-free states.

import { data, input, machine } from './lib.ts'

type Submit =
	| { readonly route: 'review'; readonly reviewer: string }
	| { readonly route: 'publish' }

type Decide =
	| { readonly verdict: 'approve' }
	| { readonly verdict: 'reject'; readonly text: string }

export const publication = machine({
	initial: 'empty',
	inputs: {
		open: input<{ readonly text: string }>(),
		revise: input<{ readonly text: string }>(),
		submit: input<Submit>(),
		decide: input<Decide>(),
		cancel: input<void>(),
	},
	states: {
		empty: {
			on: {
				open: { draft: ({ input }) => ({ text: input.text, revision: 0 }) },
			},
		},

		draft: {
			data: data<{ readonly text: string; readonly revision: number }>(),
			on: {
				revise: {
					keep: ({ data, input, skip }) =>
						input.text === data.text
							? skip()
							: { text: input.text, revision: data.revision + 1 },
				},
				submit: {
					review: ({ data, input, skip }) =>
						input.route === 'review'
							? {
									text: data.text,
									revision: data.revision,
									reviewer: input.reviewer,
								}
							: skip(),
					published: ({ data, input, skip }) =>
						input.route === 'publish'
							? ([data.text, data.revision] as const)
							: skip(),
				},
				cancel: 'empty',
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
					draft: ({ data, input }) => ({
						text: input.text,
						revision: data.revision + 1,
					}),
				},
				decide: {
					published: ({ data, input, skip }) =>
						input.verdict === 'approve'
							? ([data.text, data.revision] as const)
							: skip(),
					draft: ({ data, input, skip }) =>
						input.verdict === 'reject'
							? { text: input.text, revision: data.revision + 1 }
							: skip(),
				},
				cancel: 'empty',
			},
		},

		published: { data: data<readonly [text: string, revision: number]>() },
	},
})
