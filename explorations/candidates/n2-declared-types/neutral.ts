import { machine, types } from './lib.ts'

export type Submit =
	| { readonly route: 'review'; readonly reviewer: string }
	| { readonly route: 'publish' }

export type Decide =
	| { readonly verdict: 'approve' }
	| { readonly verdict: 'reject'; readonly text: string }

/** The whole vocabulary, as an ordinary type — nameable and exportable. */
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
	transitions: {
		'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),

		'revise: draft -> draft': ({ data, input, skip }) =>
			input.text === data.text
				? skip()
				: { text: input.text, revision: data.revision + 1 },

		'submit: draft -> review': ({ data, input, skip }) =>
			input.route === 'review'
				? { text: data.text, revision: data.revision, reviewer: input.reviewer }
				: skip(),

		'submit: draft -> published': ({ data, input, skip }) =>
			input.route === 'publish'
				? { text: data.text, revision: data.revision }
				: skip(),

		'cancel: draft -> empty': () => {},

		'revise: review -> draft': ({ data, input }) => ({
			text: input.text,
			revision: data.revision + 1,
		}),

		'decide: review -> published': ({ data, input, skip }) =>
			input.verdict === 'approve'
				? { text: data.text, revision: data.revision }
				: skip(),

		'decide: review -> empty': ({ data, input, skip }) =>
			input.verdict === 'reject' ? undefined : skip(),

		'cancel: review -> empty': () => {},

		'decide: published -> published': ({ data, input, skip }) =>
			input.verdict === 'approve' ? data : skip(),

		'cancel:empty -> review': ({ skip }) => skip(),
		'decide: empty->review': ({ skip }) => skip(),
	},
})
