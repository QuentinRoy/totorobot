// Case 2, the two-state ceremony floor, written as un-inverted sequential code.
//
// There is no sequence here. `off -> on -> off` has no beginning, middle or
// end, so awaiting the next input buys nothing at all; the loop body is a
// negation. Everything the async form adds is overhead.

import { check, createChannel, log, settle } from './harness.ts'
import type { Channel } from './harness.ts'

export type Toggle = 'toggle'

// >>> MACHINE START
export async function runToggle(
	input: Channel<Toggle>,
	emit: (state: 'off' | 'on') => void,
): Promise<never> {
	let on = false
	emit('off')
	for (;;) {
		await input.next()
		on = !on
		emit(on ? 'on' : 'off')
	}
}
// <<< MACHINE END

// ------------------------------------------------------------------ DEMO --

const input = createChannel<Toggle>()
const seen: string[] = []

void runToggle(input, (state) => {
	seen.push(state)
})
await settle()
check(seen, ['off'], 'initial state')

input.push('toggle')
await settle()
check(seen, ['off', 'on'], 'first toggle')

input.push('toggle')
input.push('toggle')
await settle()
check(seen, ['off', 'on', 'off', 'on'], 'two queued toggles')

log('toggle.ts: all checks passed -> ' + seen.join(' '))
