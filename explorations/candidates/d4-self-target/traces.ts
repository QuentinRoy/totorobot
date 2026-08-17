// Executable evidence for notation D.
//   pnpm exec node explorations/candidates/d1-target-keys/traces.ts

import { publication } from './neutral.ts'
import { step } from './runtime.ts'
import { toggle } from './toggle.ts'

declare const console: { log: (...a: unknown[]) => void }
const check = (label: string, ok: boolean) => {
	if (!ok) throw new Error(`FAILED: ${label}`)
}
const commit = (s: any, label: string) => {
	if (s.kind === 'none')
		throw new Error(`${label}: expected a commit, got none`)
	return s
}

// --- toggle -----------------------------------------------------------------
let t: any = commit(
	step(toggle as any, { state: 'off', data: undefined } as any, 'toggle'),
	't',
)
check('off -> on', t.next.state === 'on')
t = commit(step(toggle as any, t.next, 'toggle'), 't')
check('on -> off', t.next.state === 'off')

// --- the neutral machine, full specified behaviour --------------------------
const empty: any = { state: 'empty', data: undefined }

const opened = commit(
	step(publication as any, empty, 'open', { text: 'a' }),
	'open',
)
check('empty + open -> draft', opened.next.state === 'draft')
check('revision starts at 0', opened.next.data.revision === 0)

// revise with UNCHANGED text -> NO TRANSITION (not a same-state update)
const unchanged = step(publication as any, opened.next, 'revise', { text: 'a' })
check('unchanged revise = no transition', unchanged.kind === 'none')
check(
	'and it is a handled refusal, not unavailable',
	(unchanged as any).reason === 'declined',
)

// revise with CHANGED text -> SAME-STATE UPDATE
const changed = commit(
	step(publication as any, opened.next, 'revise', { text: 'b' }),
	'revise',
)
check('changed revise = same-state update', changed.kind === 'keep')
check('still draft', changed.next.state === 'draft')
check('revision incremented', changed.next.data.revision === 1)

// THE CRITICAL ONE: a single input `submit` reaching two different states.
const toReview = commit(
	step(publication as any, opened.next, 'submit', {
		route: 'review',
		reviewer: 'Ada',
	}),
	'submit->review',
)
check('submit(review) -> review', toReview.next.state === 'review')
check('carries the reviewer', toReview.next.data.reviewer === 'Ada')

const toPublished = commit(
	step(publication as any, opened.next, 'submit', { route: 'publish' }),
	'submit->published',
)
check(
	'SAME input submit(publish) -> published',
	toPublished.next.state === 'published',
)
check('published data is the tuple', toPublished.next.data[0] === 'a')

// and `decide`, the other multi-target input
const approved = commit(
	step(publication as any, toReview.next, 'decide', { verdict: 'approve' }),
	'approve',
)
check('decide(approve) -> published', approved.next.state === 'published')
const rejected = commit(
	step(publication as any, toReview.next, 'decide', {
		verdict: 'reject',
		text: 'fix',
	}),
	'reject',
)
check('SAME input decide(reject) -> draft', rejected.next.state === 'draft')
check('reject carries the new text', rejected.next.data.text === 'fix')

// shared input with state-specific availability
const cancelled = commit(
	step(publication as any, toReview.next, 'cancel'),
	'cancel',
)
check('review + cancel -> empty', cancelled.next.state === 'empty')

// terminal state: published declared no `on` at all
const terminal = step(publication as any, toPublished.next, 'revise', {
	text: 'x',
})
check('published refuses every input', terminal.kind === 'none')
check(
	'and reports it as unavailable',
	(terminal as any).reason === 'unavailable',
)

console.log('d1 traces: ALL PASSED — one `submit` reaches review AND published')
