// The neutral machine, organised by DESTINATION rather than by source.
// Read a state's `from` block to see every way of arriving there -- question D
// is the index rather than a search.

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
			from: {
				draft: { cancel: ({ enter }) => enter() },
				review: { cancel: ({ enter }) => enter() },
			},
		},

		draft: {
			data: data<{ readonly text: string; readonly revision: number }>(),
			from: {
				empty: {
					open: ({ input, enter }) => enter({ text: input.text, revision: 0 }),
				},
				// A self-entrance is keep_state: same control state, new data.
				draft: {
					revise: ({ data, input, enter, pass }) =>
						input.text === data.text
							? pass()
							: enter({ text: input.text, revision: data.revision + 1 }),
				},
				review: {
					revise: ({ data, input, enter }) =>
						enter({ text: input.text, revision: data.revision + 1 }),
					decide: ({ data, input, enter, pass }) =>
						input.verdict === 'reject'
							? enter({ text: input.text, revision: data.revision + 1 })
							: pass(),
				},
			},
		},

		review: {
			data: data<{
				readonly text: string
				readonly revision: number
				readonly reviewer: string
			}>(),
			from: {
				draft: {
					submit: ({ data, input, enter, pass }) =>
						input.route === 'review'
							? enter({
									text: data.text,
									revision: data.revision,
									reviewer: input.reviewer,
								})
							: pass(),
				},
			},
		},

		published: {
			data: data<readonly [text: string, revision: number]>(),
			from: {
				draft: {
					submit: ({ data, input, enter, pass }) =>
						input.route === 'publish'
							? enter([data.text, data.revision])
							: pass(),
				},
				review: {
					decide: ({ data, input, enter, pass }) =>
						input.verdict === 'approve'
							? enter([data.text, data.revision])
							: pass(),
				},
			},
		},
	},
})
