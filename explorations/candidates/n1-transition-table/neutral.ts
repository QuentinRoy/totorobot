import { input, machine, state } from './lib.ts'

export type Submit =
	| { readonly route: 'review'; readonly reviewer: string }
	| { readonly route: 'publish' }

export type Decide =
	| { readonly verdict: 'approve' }
	| { readonly verdict: 'reject'; readonly text: string }

export const publication = machine({
	initial: 'empty',
	inputs: {
		open: input<{ readonly text: string }>(),
		revise: input<{ readonly text: string }>(),
		submit: input<Submit>(),
		decide: input<Decide>(),
		cancel: input(),
	},
	states: {
		empty: state(),
		draft: state<{ readonly text: string; readonly revision: number }>(),
		review: state<{
			readonly text: string
			readonly revision: number
			readonly reviewer: string
		}>(),
		published: state<{ readonly text: string; readonly revision: number }>(),
	},
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

		'decide: review -> draft': ({ data, input, skip }) =>
			input.verdict === 'reject'
				? { text: input.text, revision: data.revision + 1 }
				: skip(),

		'cancel: review -> empty': () => {},
	},
})
