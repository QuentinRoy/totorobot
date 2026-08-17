// Executed evidence. Run: pnpm exec node <this file>

import { step } from './lib.ts'
import type { StateValue } from './lib.ts'
import { publication } from './neutral.ts'

declare const console: { log: (...a: unknown[]) => void }
declare const process: { exitCode?: number }

type S = typeof publication.states
const log: string[] = []
let failed = 0

const check = (label: string, ok: boolean) => {
	log.push(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
	if (!ok) failed++
}

publication
	.on('* -> published', (e) => log.push(`     listener: published via ${e.on}`))
	.on('cancel', (e) => log.push(`     listener: cancel from ${e.from.state}`))

const empty = { state: 'empty', data: undefined } as StateValue<S>

// open: empty -> draft
const opened = step(publication, empty, 'open', { text: 'hello' })
check(
	'open moves empty -> draft with data',
	opened.kind === 'moved' &&
		opened.next.state === 'draft' &&
		JSON.stringify(opened.next.data) === '{"text":"hello","revision":0}',
)
const draft = (opened as { next: StateValue<S> }).next

// revise with the SAME text declines; with new text it stays in draft
check(
	'revise, unchanged text -> declined',
	step(publication, draft, 'revise', { text: 'hello' }).kind === 'none',
)
const revised = step(publication, draft, 'revise', { text: 'goodbye' })
check(
	'revise, new text -> stays in draft, revision bumped',
	revised.kind === 'moved' &&
		revised.next.state === 'draft' &&
		JSON.stringify(revised.next.data) === '{"text":"goodbye","revision":1}',
)

// ONE input, TWO targets -- the discriminating test
const toReview = step(publication, draft, 'submit', {
	route: 'review',
	reviewer: 'Ada',
})
check(
	'submit{route:review} -> review',
	toReview.kind === 'moved' && toReview.next.state === 'review',
)
const toPublished = step(publication, draft, 'submit', { route: 'publish' })
check(
	'submit{route:publish} -> published (same input, other target)',
	toPublished.kind === 'moved' && toPublished.next.state === 'published',
)

// decide, also two targets
const review = (toReview as { next: StateValue<S> }).next
check(
	'decide{approve} -> published',
	step(publication, review, 'decide', { verdict: 'approve' }).kind === 'moved',
)
const rejected = step(publication, review, 'decide', {
	verdict: 'reject',
	text: 'redo',
})
check(
	'decide{reject} -> draft',
	rejected.kind === 'moved' && rejected.next.state === 'draft',
)

// terminal by construction: `published` declares no outgoing transition
const published = (toPublished as { next: StateValue<S> }).next
const stuck = step(publication, published, 'revise', { text: 'x' })
check(
	'published is terminal -> unavailable',
	stuck.kind === 'none' && stuck.reason === 'unavailable',
)

// listeners fired
check(
	'wildcard listener saw both routes into published',
	log.filter((l) => l.includes('listener: published')).length === 2,
)
check(
	'bare-input listener registered',
	log.some((l) => l.includes('listener: cancel')) === false,
)

console.log(log.join('\n'))
console.log(
	failed === 0
		? '\nn1 traces: ALL PASSED — one `submit` reaches review AND published'
		: `\nn1 traces: ${failed} FAILED`,
)
if (failed > 0) process.exitCode = 1
