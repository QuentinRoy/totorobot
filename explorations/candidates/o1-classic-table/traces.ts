import { step } from './lib.ts'
import type { StateValue } from './lib.ts'
import type { Publication } from './neutral.ts'
import { publication } from './neutral.ts'

declare const console: { log: (...a: unknown[]) => void }
declare const process: { exitCode?: number }

let failed = 0
const log: string[] = []
const check = (l: string, ok: boolean) => {
	log.push(`${ok ? 'ok  ' : 'FAIL'} ${l}`)
	if (!ok) failed++
}

const empty = { state: 'empty', data: undefined } as StateValue<Publication>
const opened = step(publication, empty, 'open', { text: 'hi' })
check(
	'open: empty -> draft',
	opened.kind === 'moved' &&
		JSON.stringify(opened.next.data) === '{"text":"hi","revision":0}',
)
const draft = (opened as { next: StateValue<Publication> }).next

check(
	'revise with same text declines (skip)',
	step(publication, draft, 'revise', { text: 'hi' }).kind === 'none',
)
const r = step(publication, draft, 'submit', {
	route: 'review',
	reviewer: 'Ada',
})
check(
	'submit{review} -> review',
	r.kind === 'moved' && r.next.state === 'review',
)
const p = step(publication, draft, 'submit', { route: 'publish' })
check(
	'submit{publish} -> published — same event, other row',
	p.kind === 'moved' && p.next.state === 'published',
)
const c = step(publication, draft, 'cancel')
check(
	'plain edge with no `with` still moves',
	c.kind === 'moved' && c.next.state === 'empty',
)
const pub = (p as { next: StateValue<Publication> }).next
const stuck = step(publication, pub, 'revise', { text: 'x' })
check(
	'published is terminal',
	stuck.kind === 'none' && stuck.reason === 'unavailable',
)

console.log(log.join('\n'))
console.log(
	failed === 0 ? '\no1 traces: ALL PASSED' : `\no1 traces: ${failed} FAILED`,
)
if (failed > 0) process.exitCode = 1
