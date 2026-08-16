// The live-runtime traces from docs/acceptance-cases.md.
//   pnpm exec node explorations/candidates/c2-annotated-outcome/live-traces.ts

import { request } from './case3.ts'
import { createExecution } from './live.ts'
import { toggle } from './toggle.ts'

declare const console: { log: (...a: unknown[]) => void }
const check = (label: string, ok: boolean) => {
	if (!ok) throw new Error(`FAILED: ${label}`)
}

// --- Live trace 1 -----------------------------------------------------------
// An observer of the two-state case submits a second `toggle` while observing
// off -> on. The first commit and observation cycle must FINISH before the
// queued input is applied to `on`, producing on -> off. The outermost `toggle`
// call returns only after that queue drains.

const log: string[] = []
let reentered = false
let exec: any

exec = createExecution(
	toggle as any,
	{ state: 'off', data: undefined } as any,
	{
		observe: (o: any) => {
			log.push(`observed ${o.next.state}`)
			if (!reentered) {
				reentered = true
				const d = exec.submit('toggle')
				log.push(`reentrant submit -> ${d.kind}`)
				// The machine must NOT have moved yet: we are still inside the first
				// observation, so the queued input has not been applied.
				log.push(`current during observation = ${exec.current.state}`)
			}
		},
	},
)

const outer = exec.submit('toggle')

check(
	'reentrant submission was queued, not nested',
	log[1] === 'reentrant submit -> queued',
)
check(
	'state unchanged during the first observation',
	log[2] === 'current during observation = on',
)
check('first observation saw on', log[0] === 'observed on')
check('queued input then applied to on -> off', log[3] === 'observed off')
check(
	'queue drained before the outermost call returned',
	exec.current.state === 'off',
)
check('outermost submission reports processed', outer.kind === 'processed')
check(
	'exactly two commits observed',
	log.filter((l) => l.startsWith('observed')).length === 2,
)

// --- Live trace 2 -----------------------------------------------------------
// Disposing the asynchronous case while `loading` makes its work unable to
// affect later evolution, and later submissions receive the documented
// disposed outcome.

const ran: string[] = []
const r = createExecution(
	request as any,
	{ state: 'idle', data: { nextRequestId: 0 } } as any,
	{ run: (c: any) => ran.push(c.do) },
)

r.submit('start')
check('loading', r.current.state === 'loading')
check('work begun', ran[0] === 'beginWork')

r.dispose()
check('disposed flag set', r.isDisposed)

const afterDispose = r.submit('succeed', { requestId: 0, result: 'late' })
check(
	'post-disposal submission is rejected as disposed',
	afterDispose.kind === 'disposed',
)
check('state did not change after disposal', r.current.state === 'loading')
check('no further commands ran', ran.length === 1)

console.log('live-traces.ts: ALL LIVE-RUNTIME TRACES PASSED')
console.log('  ordering observed:', JSON.stringify(log))
