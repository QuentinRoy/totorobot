// Send-site capability checking, verified. Messages are verbatim tsc output.
import { publication } from './neutral.ts'
import { capabilities, visit } from './consume.ts'

declare const draftValue: {
	readonly state: 'draft'
	readonly data: { readonly text: string; readonly revision: number }
}
declare const publishedValue: {
	readonly state: 'published'
	readonly data: readonly [text: string, revision: number]
}

const onDraft = capabilities(publication, draftValue)

// Legal from `draft`.
onDraft.submit({ route: 'review', reviewer: 'Ada' })
onDraft.revise({ text: 'next' })
onDraft.cancel()

// ILLEGAL from `draft` -- `decide` is only available in `review`.
//   error TS2339: Property 'decide' does not exist on type
//   'Capabilities<..., "draft">'.
// @ts-expect-error
onDraft.decide({ verdict: 'approve' })

// `published` is terminal: it declared no `on`, so it has NO capabilities.
const onPublished = capabilities(publication, publishedValue)
//   error TS2339: Property 'revise' does not exist on type
//   'Capabilities<..., "published">'.
// @ts-expect-error
onPublished.revise({ text: 'nope' })

// Exhaustive consumption. Omitting a state is a compile error.
declare const anyValue: Parameters<typeof visit<any, string>>[0]
export const rendered = visit(anyValue, {
	empty: () => 'empty',
	draft: (d: any) => `draft ${d.revision}`,
	review: (d: any) => `review by ${d.reviewer}`,
	published: (d: any) => `published ${d[0]}`,
})
