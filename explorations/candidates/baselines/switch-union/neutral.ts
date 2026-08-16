// Baseline 2: a plain `switch` over a discriminated union. No library.
//
// The neutral document-publication machine.
//
// Conventions used by this whole baseline, so that it is measured fairly:
//   - state values are a discriminated union on `state`, carrying per-state data
//   - inputs are a discriminated union on `input`
//   - one reduce-style function, `switch` on the state, `switch` on the input
//   - "no transition" is signalled by returning the *same* state object; a
//     same-state update returns a *new* object carrying the same tag
//   - exhaustiveness over states is enforced with an ordinary `never` check

export type PublicationState =
	| { readonly state: 'empty' }
	| {
			readonly state: 'draft'
			readonly text: string
			readonly revision: number
	  }
	| {
			readonly state: 'review'
			readonly text: string
			readonly revision: number
			readonly reviewer: string
	  }
	| {
			readonly state: 'published'
			readonly document: readonly [text: string, revision: number]
	  }

export type PublicationInput =
	| { readonly input: 'open'; readonly text: string }
	| { readonly input: 'revise'; readonly text: string }
	| {
			readonly input: 'submit'
			readonly route: 'review'
			readonly reviewer: string
	  }
	| { readonly input: 'submit'; readonly route: 'publish' }
	| { readonly input: 'decide'; readonly verdict: 'approve' }
	| {
			readonly input: 'decide'
			readonly verdict: 'reject'
			readonly text: string
	  }
	| { readonly input: 'cancel' }

export const initialState: PublicationState = { state: 'empty' }

export function reduce(
	state: PublicationState,
	input: PublicationInput,
): PublicationState {
	switch (state.state) {
		case 'empty':
			switch (input.input) {
				case 'open':
					return { state: 'draft', text: input.text, revision: 0 }
				default:
					return state
			}

		case 'draft':
			switch (input.input) {
				case 'revise':
					return input.text === state.text
						? state
						: { state: 'draft', text: input.text, revision: state.revision + 1 }
				case 'submit':
					return input.route === 'review'
						? {
								state: 'review',
								text: state.text,
								revision: state.revision,
								reviewer: input.reviewer,
							}
						: { state: 'published', document: [state.text, state.revision] }
				case 'cancel':
					return { state: 'empty' }
				default:
					return state
			}

		case 'review':
			switch (input.input) {
				case 'revise':
					return {
						state: 'draft',
						text: input.text,
						revision: state.revision + 1,
					}
				case 'decide':
					return input.verdict === 'approve'
						? { state: 'published', document: [state.text, state.revision] }
						: { state: 'draft', text: input.text, revision: state.revision + 1 }
				case 'cancel':
					return { state: 'empty' }
				default:
					return state
			}

		case 'published':
			return state

		default: {
			const unhandled: never = state
			return unhandled
		}
	}
}

// --- demonstration ---------------------------------------------------------
// Run: pnpm exec node explorations/candidates/baselines/switch-union/neutral.ts

declare const console: { log: (...args: unknown[]) => void }

const empty = initialState
if (empty.state !== 'empty') throw new Error(`initial is ${empty.state}`)

// empty --open--> draft
const opened = reduce(empty, { input: 'open', text: 'hello' })
if (opened.state !== 'draft') throw new Error(`open gave ${opened.state}`)
if (opened.revision !== 0)
	throw new Error(`open gave revision ${opened.revision}`)

// draft --revise (unchanged)--> no transition
const unchanged = reduce(opened, { input: 'revise', text: 'hello' })
if (unchanged !== opened)
	throw new Error('unchanged revise must not transition')

// draft --revise (changed)--> same-state update
const revised = reduce(opened, { input: 'revise', text: 'hello world' })
if (revised === opened)
	throw new Error('changed revise must produce a new value')
if (revised.state !== 'draft') throw new Error(`revise gave ${revised.state}`)
if (revised.revision !== 1)
	throw new Error(`revise gave rev ${revised.revision}`)

// draft --submit(review)--> review
const submitted = reduce(revised, {
	input: 'submit',
	route: 'review',
	reviewer: 'ada',
})
if (submitted.state !== 'review')
	throw new Error(`submit gave ${submitted.state}`)
if (submitted.reviewer !== 'ada') throw new Error('reviewer lost')

// review --decide(reject)--> draft, one source/input pair with two targets
const rejected = reduce(submitted, {
	input: 'decide',
	verdict: 'reject',
	text: 'try again',
})
if (rejected.state !== 'draft') throw new Error(`reject gave ${rejected.state}`)
if (rejected.revision !== 2)
	throw new Error(`reject gave rev ${rejected.revision}`)

// review --decide(approve)--> published, with the tuple payload
const approved = reduce(submitted, { input: 'decide', verdict: 'approve' })
if (approved.state !== 'published')
	throw new Error(`approve gave ${approved.state}`)
if (approved.document[0] !== 'hello world' || approved.document[1] !== 1)
	throw new Error(`published document is ${JSON.stringify(approved.document)}`)

// published is terminal: any broad input is unavailable, so no transition
const stillPublished = reduce(approved, { input: 'revise', text: 'nope' })
if (stillPublished !== approved) throw new Error('published must be terminal')

// draft --cancel--> empty
const cancelled = reduce(revised, { input: 'cancel' })
if (cancelled.state !== 'empty')
	throw new Error(`cancel gave ${cancelled.state}`)

// --- what this baseline does NOT give you ----------------------------------

// WEAKNESS 1 -- per-state capabilities are NOT enforced at the call site.
// `decide` is legal only from `review`, and `published` is terminal, yet both
// of these calls type-check. Nothing but the runtime `default: return state`
// stops them. There is no `@ts-expect-error` here on purpose: the point is
// that these lines compile.
const illegalFromEmpty = reduce(empty, { input: 'decide', verdict: 'approve' })
const illegalFromPublished = reduce(approved, { input: 'cancel' })
if (illegalFromEmpty !== empty || illegalFromPublished !== approved)
	throw new Error('unavailable inputs must produce no transition')

// WEAKNESS 2 -- the reducer's return type is the whole union, so the target of
// a statically known transition is NOT statically known. This next line only
// compiles because of the `@ts-expect-error`; if the baseline had typestate,
// the suppression itself would be an error.
// @ts-expect-error Property 'text' does not exist on type 'PublicationState'.
const leakedText: string = reduce(empty, { input: 'open', text: 'x' }).text
void leakedText

// WEAKNESS 3 -- "no transition" and "same-state update" are only distinguished
// by object identity, and there is no way at all to express Erlang's
// `repeat_state` (same state, DO re-run entry) versus `keep_state`.
console.log('neutral: all assertions passed')
