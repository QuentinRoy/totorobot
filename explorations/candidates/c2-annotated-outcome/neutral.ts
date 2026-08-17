// The neutral document-publication machine in notation B.
// The specified input vocabulary is preserved: `submit` and `decide` are single
// inputs carrying a discriminated payload, exactly as the behaviour table says.

import { type Keep, type None, type To, data, input, machine } from './lib.ts'

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
				open: ({ input, at }): To<'draft'> =>
					at.draft({ text: input.text, revision: 0 }),
			},
		},

		draft: {
			data: data<{ readonly text: string; readonly revision: number }>(),
			on: {
				revise: ({ data, input, keep, none }): Keep | None =>
					input.text === data.text
						? none()
						: keep({ text: input.text, revision: data.revision + 1 }),

				submit: ({ data, input, at }): To<'review' | 'published'> =>
					input.route === 'review'
						? at.review({
								text: data.text,
								revision: data.revision,
								reviewer: input.reviewer,
							})
						: at.published([data.text, data.revision]),

				cancel: ({ at }): To<'empty'> => at.empty(),
			},
		},

		review: {
			data: data<{
				readonly text: string
				readonly revision: number
				readonly reviewer: string
			}>(),
			on: {
				revise: ({ data, input, at }): To<'draft'> =>
					at.draft({ text: input.text, revision: data.revision + 1 }),

				decide: ({ data, input, at }): To<'draft' | 'published'> =>
					input.verdict === 'approve'
						? at.published([data.text, data.revision])
						: at.draft({ text: input.text, revision: data.revision + 1 }),

				cancel: ({ at }): To<'empty'> => at.empty(),
			},
		},

		published: { data: data<readonly [text: string, revision: number]>() },
	},
})
