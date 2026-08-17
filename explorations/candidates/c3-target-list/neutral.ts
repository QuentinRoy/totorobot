// The neutral document-publication machine in notation C.
// Specified input vocabulary preserved: `submit` and `decide` are single inputs.

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
			data: data<void>(),
			on: {
				open: {
					to: 'draft',
					with: ({ input, at }) => at.draft({ text: input.text, revision: 0 }),
				},
			},
		},

		draft: {
			data: data<{ readonly text: string; readonly revision: number }>(),
			on: {
				revise: {
					here: ({ data, input, keep, none }) =>
						input.text === data.text
							? none()
							: keep({ text: input.text, revision: data.revision + 1 }),
				},
				submit: {
					to: 'review',
					or: 'published',
					with: ({ data, input, at }) =>
						input.route === 'review'
							? at.review({
									text: data.text,
									revision: data.revision,
									reviewer: input.reviewer,
								})
							: at.published([data.text, data.revision]),
				},
				cancel: { to: 'empty', with: ({ at }) => at.empty() },
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
					with: ({ data, input, at }) =>
						at.draft({ text: input.text, revision: data.revision + 1 }),
				},
				decide: {
					to: 'published',
					or: 'draft',
					with: ({ data, input, at }) =>
						input.verdict === 'approve'
							? at.published([data.text, data.revision])
							: at.draft({ text: input.text, revision: data.revision + 1 }),
				},
				cancel: { to: 'empty', with: ({ at }) => at.empty() },
			},
		},

		published: { data: data<readonly [text: string, revision: number]>() },
	},
})
