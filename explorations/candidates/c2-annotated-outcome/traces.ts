// Executable acceptance traces. Run:
//   pnpm exec node explorations/candidates/c2-annotated-outcome/traces.ts

import { markingMenu } from './case1.ts'
import { request } from './case3.ts'
import { step } from './runtime.ts'
import { toggle } from './toggle.ts'

declare const console: { log: (...a: unknown[]) => void }

const check = (label: string, ok: boolean) => {
	if (!ok) throw new Error(`FAILED: ${label}`)
}
const kinds = (s: { kind: string }) => s.kind
const has = (s: any, doName: string) =>
	(s.commands ?? []).some((c: any) => c.do === doName)

/** Assert a step committed, and get at its target. */
const commit = (s: any, label: string) => {
	if (s.kind === 'none')
		throw new Error(`${label}: expected a commit, got none`)
	return s as { kind: string; next: any; commands: any[] }
}

// ---------------------------------------------------------------- Case 2
let t: any = { state: 'off', data: undefined }
t = commit(step(toggle as any, t, 'toggle'), 't')
check('off + toggle -> on', t.next.state === 'on')
t = commit(step(toggle as any, t.next, 'toggle'), 't')
check('on + toggle -> off', t.next.state === 'off')

// ---------------------------------------------------------------- Case 1
// Trace 1: down(p0) from idle(nextToken 0) enters startup(timerToken 0,
// nextToken 1), reports start, schedules token 0.
let m: any = { state: 'idle', data: { nextToken: 0 } }
const t1 = step(markingMenu as any, m, 'down', { point: [0, 0] })
check('T1 enters startup', commit(t1, 't1').next.state === 'startup')
check('T1 timerToken 0', commit(t1, 't1').next.data.timerToken === 0)
check('T1 nextToken 1', commit(t1, 't1').next.data.nextToken === 1)
check(
	'T1 reports start',
	commit(t1, 't1').commands[0].do === 'startInteraction',
)
check(
	'T1 schedules token 0',
	commit(t1, 't1').commands[1].do === 'scheduleDwell' &&
		commit(t1, 't1').commands[1].token === 0,
)

// Trace 2: nearby move commits a SAME-STATE stroke update; a matching
// dwellElapsed(0) then enters novice and reports open.
const t2a = step(markingMenu as any, commit(t1, 't1').next, 'move', {
	point: [1, 1],
})
check('T2 nearby move is a same-state update', kinds(t2a) === 'keep')
check(
	'T2 keep does NOT re-run residency',
	commit(t2a, 't2a').commands.length === 0,
)
check('T2 still startup', commit(t2a, 't2a').next.state === 'startup')
check('T2 stroke grew', commit(t2a, 't2a').next.data.stroke.length === 2)
const t2b = step(markingMenu as any, commit(t2a, 't2a').next, 'dwellElapsed', {
	token: 0,
})
check(
	'T2 matching dwell enters novice',
	commit(t2b, 't2b').next.state === 'novice',
)
check('T2 reports open', has(commit(t2b, 't2b'), 'openMenu'))
// leaving startup cancels its dwell, from `exit`, even on the dwell path
check(
	'T2 leaving startup cancels its dwell',
	has(commit(t2b, 't2b'), 'cancelDwell'),
)

// Trace 3: fresh execution -- a FAR move enters expert and cancels token 0;
// a later dwellElapsed(0) produces NO transition.
const f1 = step(
	markingMenu as any,
	{ state: 'idle', data: { nextToken: 0 } } as any,
	'down',
	{ point: [0, 0] },
)
const f2 = step(markingMenu as any, commit(f1, 'f1').next, 'move', {
	point: [100, 100],
})
check(
	'T3 far move CHANGES state to expert',
	kinds(f2) === 'to' && commit(f2, 'f2').next.state === 'expert',
)
check(
	'T3 cancels dwell token 0',
	commit(f2, 'f2').commands[0].do === 'cancelDwell' &&
		commit(f2, 'f2').commands[0].token === 0,
)
const f3 = step(markingMenu as any, commit(f2, 'f2').next, 'dwellElapsed', {
	token: 0,
})
check('T3 stale dwell in expert = NO transition', kinds(f3) === 'none')
check(
	'T3 stale dwell is unavailable, not a same-state update',
	(f3 as any).reason === 'unavailable',
)

// A stale dwell WITHIN startup is also no-transition (declined, not update).
const s1 = step(
	markingMenu as any,
	{ state: 'idle', data: { nextToken: 0 } } as any,
	'down',
	{ point: [0, 0] },
)
const s2 = step(markingMenu as any, commit(s1, 's1').next, 'dwellElapsed', {
	token: 99,
})
check('stale dwell in startup = no transition', kinds(s2) === 'none')
check('stale dwell in startup is declined', (s2 as any).reason === 'declined')

// Trace 4: cancel from startup returns to idle, cancels dwell, reports cancel.
const c1 = step(markingMenu as any, commit(s1, 's1').next, 'cancel', {
	point: [0, 0],
})
check('T4 returns to idle', commit(c1, 'c1').next.state === 'idle')
check('T4 cancels dwell via residency', has(commit(c1, 'c1'), 'cancelDwell'))
check(
	'T4 reports cancellation',
	commit(c1, 'c1').commands[1].do === 'cancelled',
)

// Trace 5: an input unavailable in the current state produces NO transition,
// not a same-state update.
const u1 = step(
	markingMenu as any,
	{ state: 'idle', data: { nextToken: 0 } } as any,
	'move',
	{ point: [1, 1] },
)
check('T5 move in idle = no transition', kinds(u1) === 'none')
check(
	'T5 unavailable, not a same-state update',
	(u1 as any).reason === 'unavailable',
)

// ---------------------------------------------------------------- Case 3
// 1 start req 0; 2 cancel req 0; 3 start req 1; 4 succeed(0) -> nothing;
// 5 succeed(1) -> success.
let r: any = { state: 'idle', data: { nextRequestId: 0 } }
const r1 = step(request as any, r, 'start')
check(
	'R1 loading req 0',
	commit(r1, 'r1').next.state === 'loading' &&
		commit(r1, 'r1').next.data.requestId === 0,
)
check('R1 initial progress 0', commit(r1, 'r1').next.data.progress === 0)
const r2 = step(request as any, commit(r1, 'r1').next, 'cancel')
check('R2 back to idle', commit(r2, 'r2').next.state === 'idle')
check(
	'R2 nextRequestId incremented',
	commit(r2, 'r2').next.data.nextRequestId === 1,
)
check(
	'R2 abandons work 0',
	commit(r2, 'r2').commands[0].do === 'abandonWork' &&
		commit(r2, 'r2').commands[0].requestId === 0,
)
const r3 = step(request as any, commit(r2, 'r2').next, 'start')
check('R3 loading req 1', commit(r3, 'r3').next.data.requestId === 1)
const r4 = step(request as any, commit(r3, 'r3').next, 'succeed', {
	requestId: 0,
	result: 'stale',
})
check('R4 stale success produces NO transition', kinds(r4) === 'none')
const r5 = step(request as any, commit(r3, 'r3').next, 'succeed', {
	requestId: 1,
	result: 'fresh',
})
check(
	'R5 matching success enters success',
	commit(r5, 'r5').next.state === 'success',
)
check('R5 carries the result', commit(r5, 'r5').next.data.result === 'fresh')
check(
	'R5 retains next identity',
	commit(r5, 'r5').next.data.nextRequestId === 2,
)

console.log('traces.ts: ALL ACCEPTANCE TRACES PASSED')
