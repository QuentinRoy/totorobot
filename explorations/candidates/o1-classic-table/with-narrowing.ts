// WHAT `with` RECOVERS.
//
// With a separate `guard` and `map`, two closures could not share a narrowing:
// `guard` proving `input.route === 'review'` told `map` nothing, so `map` had to
// re-test or cast — the neutral machine carried
// `reviewer: input.route === 'review' ? input.reviewer : ''`.
//
// One function that both decides and projects does not have that problem: the
// narrowing is simply in scope.

import { machine, types } from './lib.ts'
import type { Publication } from './neutral.ts'

export const m = machine({
	initial: 'empty',
	types: types<Publication>(),
	transitions: [
		{
			event: 'submit',
			from: 'draft',
			to: 'review',
			with: ({ data, input, skip }) =>
				input.route === 'review'
					? {
							text: data.text,
							revision: data.revision,
							// no re-test, no cast, no `?? ''`
							reviewer: input.reviewer,
						}
					: skip(),
		},
	],
})

// and the narrowing is real, not `any`: the OTHER branch has no `reviewer`
export const proof = machine({
	initial: 'empty',
	types: types<Publication>(),
	transitions: [
		{
			event: 'submit',
			from: 'draft',
			to: 'published',
			with: ({ data, input, skip }) =>
				input.route === 'publish'
					? // @ts-expect-error -- narrowed to the 'publish' variant here
						{ text: input.reviewer, revision: data.revision }
					: skip(),
		},
	],
})
