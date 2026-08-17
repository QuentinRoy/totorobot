import { machine, types } from './lib.ts'

export type Submit =
	| { readonly route: 'review'; readonly reviewer: string }
	| { readonly route: 'publish' }
export type Decide =
	| { readonly verdict: 'approve' }
	| { readonly verdict: 'reject'; readonly text: string }

export type Publication = {
	inputs: {
		open: { readonly text: string }
		revise: { readonly text: string }
		submit: Submit
		decide: Decide
		cancel: void
	}
	states: {
		empty: void
		draft: { readonly text: string; readonly revision: number }
		review: {
			readonly text: string
			readonly revision: number
			readonly reviewer: string
		}
		published: { readonly text: string; readonly revision: number }
	}
}

export const publication = machine({
	initial: 'empty',
	types: types<Publication>(),
	transitions: [
		{
			event: 'open',
			from: 'empty',
			to: 'draft',
			with: ({ input }) => ({ text: input.text, revision: 0 }),
		},
		{
			event: 'revise',
			from: 'draft',
			to: 'draft',
			with: ({ data, input, skip }) =>
				input.text === data.text
					? skip()
					: { text: input.text, revision: data.revision + 1 },
		},
		{
			event: 'submit',
			from: 'draft',
			to: 'review',
			with: ({ data, input, skip }) =>
				input.route === 'review'
					? {
							text: data.text,
							revision: data.revision,
							reviewer: input.reviewer,
						}
					: skip(),
		},
		{
			event: 'submit',
			from: 'draft',
			to: 'published',
			with: ({ data, input, skip }) =>
				input.route === 'publish'
					? { text: data.text, revision: data.revision }
					: skip(),
		},
		{ event: 'cancel', from: 'draft', to: 'empty' },
		{
			event: 'revise',
			from: 'review',
			to: 'draft',
			with: ({ data, input }) => ({
				text: input.text,
				revision: data.revision + 1,
			}),
		},
		{
			event: 'decide',
			from: 'review',
			to: 'published',
			with: ({ data, input, skip }) =>
				input.verdict === 'approve'
					? { text: data.text, revision: data.revision }
					: skip(),
		},
		{ event: 'cancel', from: 'review', to: 'empty' },
	],
})
