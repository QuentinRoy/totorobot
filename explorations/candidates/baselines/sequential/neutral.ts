// The neutral document-publication machine, written as un-inverted sequential
// code (baseline 1 of docs/acceptance-cases.md section 4).
//
// Behaviour is the source/input/outcome table from
// docs/acceptance-cases.md, "Neutral test machine":
//
//   empty            open(text)               -> change to draft
//   draft            revise(text) unchanged   -> no transition
//   draft            revise(text) changed     -> update draft
//   draft            submit(review, reviewer) -> change to review
//   draft            submit(publish)          -> change to published
//   review           revise(text)             -> change back to draft
//   review           decide(approve)          -> change to published
//   review           decide(reject, text)     -> change to draft
//   draft | review   cancel                   -> change to empty
//   published        any broad input          -> no transition: unavailable
//
// The control states are not named anywhere in the control flow. They are
// lexical positions: `empty` is the loop head, `draft` is the outer switch,
// `review` is the switch nested inside `case 'submit'`, and `published` is a
// `return`. Per-state data is whatever is in scope at that depth, which is why
// `reviewer` is unreachable from `draft` and `text`/`revision` are unreachable
// from `empty` -- scoping does buy real per-state data, for free.
//
// This nesting only works because the graph is *reducible*: every back edge
// targets a lexical ancestor. Add one edge that is not (say
// `empty --restore--> review`) and no arrangement of loops expresses it; you
// are forced back to a top-level dispatch loop, i.e. the `switch` baseline.

import { check, createChannel, log, settle } from './harness.ts'
import type { Channel } from './harness.ts'

export type DocInput =
	| { readonly type: 'open'; readonly text: string }
	| { readonly type: 'revise'; readonly text: string }
	| {
			readonly type: 'submit'
			readonly to: 'review'
			readonly reviewer: string
	  }
	| { readonly type: 'submit'; readonly to: 'publish' }
	| { readonly type: 'decide'; readonly verdict: 'approve' }
	| {
			readonly type: 'decide'
			readonly verdict: 'reject'
			readonly text: string
	  }
	| { readonly type: 'cancel' }

// OBSERVATION COST. Sequential code has no observable current state: the
// abstract state is the program counter, which JavaScript cannot reify. To let
// a caller render a UI at all, the machine must announce each commit -- and
// this union is a hand-written state-to-data map that *nothing checks against
// the control flow*. Section 7 of the brief calls exactly this shape
// known-bad, and here it is unavoidable rather than chosen.
export type Commit =
	| { readonly phase: 'empty' }
	| {
			readonly phase: 'draft'
			readonly text: string
			readonly revision: number
	  }
	| {
			readonly phase: 'review'
			readonly text: string
			readonly revision: number
			readonly reviewer: string
	  }
	| { readonly phase: 'published'; readonly doc: readonly [string, number] }

// >>> MACHINE START
export async function runDocument(
	input: Channel<DocInput>,
	emit: (commit: Commit) => void,
): Promise<void> {
	empty: for (;;) {
		emit({ phase: 'empty' })
		let start = await input.next()
		// Unavailable inputs in `empty`: no transition, and no commit.
		while (start.type !== 'open') start = await input.next()

		let text = start.text
		let revision = 0
		emit({ phase: 'draft', text, revision })

		draft: for (;;) {
			const d = await input.next()
			switch (d.type) {
				case 'revise': {
					if (d.text === text) continue draft // declined: no transition
					text = d.text
					revision += 1
					emit({ phase: 'draft', text, revision }) // same-state update
					continue draft
				}
				case 'submit': {
					if (d.to === 'publish') {
						emit({ phase: 'published', doc: [text, revision] })
						return // terminal
					}
					const reviewer = d.reviewer
					emit({ phase: 'review', text, revision, reviewer })
					review: for (;;) {
						const r = await input.next()
						switch (r.type) {
							case 'revise': {
								text = r.text
								revision += 1
								emit({ phase: 'draft', text, revision })
								continue draft
							}
							case 'decide': {
								if (r.verdict === 'approve') {
									emit({ phase: 'published', doc: [text, revision] })
									return // terminal
								}
								text = r.text
								revision += 1
								emit({ phase: 'draft', text, revision })
								continue draft
							}
							case 'cancel':
								continue empty
							default:
								continue review // unavailable in review: no transition
						}
					}
				}
				case 'cancel':
					continue empty
				default:
					continue draft // unavailable in draft: no transition
			}
		}
	}
}
// <<< MACHINE END

// ------------------------------------------------------------------ DEMO --

const input = createChannel<DocInput>()
const seen: Commit[] = []

void runDocument(input, (commit) => {
	seen.push(commit)
})
await settle()
check(seen, [{ phase: 'empty' }], 'initial state is empty')

// `cancel` is unavailable in `empty`: no transition.
input.push({ type: 'cancel' })
await settle()
check(seen.length, 1, 'unavailable input in empty produces no commit')

input.push({ type: 'open', text: 'a' })
await settle()
check(seen[1], { phase: 'draft', text: 'a', revision: 0 }, 'open enters draft')

// Unchanged revise is declined, not a same-state commit.
input.push({ type: 'revise', text: 'a' })
await settle()
check(seen.length, 2, 'unchanged revise produces no commit')

input.push({ type: 'revise', text: 'b' })
await settle()
check(
	seen[2],
	{ phase: 'draft', text: 'b', revision: 1 },
	'revise updates draft',
)

input.push({ type: 'submit', to: 'review', reviewer: 'rae' })
await settle()
check(
	seen[3],
	{ phase: 'review', text: 'b', revision: 1, reviewer: 'rae' },
	'submit enters review',
)

// One source/input pair, two targets: decide(reject) goes back to draft.
input.push({ type: 'decide', verdict: 'reject', text: 'c' })
await settle()
check(
	seen[4],
	{ phase: 'draft', text: 'c', revision: 2 },
	'reject returns to draft',
)

// review + revise also returns to draft.
input.push({ type: 'submit', to: 'review', reviewer: 'sam' })
input.push({ type: 'revise', text: 'd' })
await settle()
check(
	seen[6],
	{ phase: 'draft', text: 'd', revision: 3 },
	'review revise -> draft',
)

input.push({ type: 'cancel' })
await settle()
check(seen[7], { phase: 'empty' }, 'cancel returns to empty')

input.push({ type: 'open', text: 'e' })
input.push({ type: 'submit', to: 'publish' })
await settle()
check(
	seen[9],
	{ phase: 'published', doc: ['e', 0] },
	'submit(publish) enters published',
)

// `published` is terminal. The FSM would report an unavailable input; here the
// machine has simply returned, so the input is queued forever and nobody can
// tell the difference from the outside.
input.push({ type: 'revise', text: 'f' })
await settle()
check(seen.length, 10, 'no commit after the terminal state')

log('neutral.ts: all checks passed -> ' + seen.map((c) => c.phase).join(' '))
