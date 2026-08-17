import { step } from './lib.ts'
import type { StateValue } from './lib.ts'
import type { Publication } from './neutral.ts'
import { publication } from './neutral.ts'

declare const console: { log: (...a: unknown[]) => void }
declare const process: { exitCode?: number }

const log: string[] = []
let failed = 0
const check = (label: string, ok: boolean) => {
	log.push(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
	if (!ok) failed++
}

publication.on('* -> published', (e) =>
	log.push(`     entered published via ${e.on}`),
)

const empty = { state: 'empty', data: undefined } as StateValue<Publication>
const opened = step(publication, empty, 'open', { text: 'hello' })
check(
	'open: empty -> draft carries data',
	opened.kind === 'moved' &&
		JSON.stringify(opened.next.data) === '{"text":"hello","revision":0}',
)
const draft = (opened as { next: StateValue<Publication> }).next

check(
	'revise with same text declines',
	step(publication, draft, 'revise', { text: 'hello' }).kind === 'none',
)
const toReview = step(publication, draft, 'submit', {
	route: 'review',
	reviewer: 'Ada',
})
check(
	'submit{review} -> review',
	toReview.kind === 'moved' && toReview.next.state === 'review',
)
const toPub = step(publication, draft, 'submit', { route: 'publish' })
check(
	'submit{publish} -> published (same input, other target)',
	toPub.kind === 'moved' && toPub.next.state === 'published',
)
const published = (toPub as { next: StateValue<Publication> }).next
const stuck = step(publication, published, 'revise', { text: 'x' })
check(
	'published is terminal',
	stuck.kind === 'none' && stuck.reason === 'unavailable',
)
check(
	'listener fired',
	log.some((l) => l.includes('entered published')),
)

console.log(log.join('\n'))
console.log(
	failed === 0 ? '\nn2 traces: ALL PASSED' : `\nn2 traces: ${failed} FAILED`,
)
if (failed > 0) process.exitCode = 1
