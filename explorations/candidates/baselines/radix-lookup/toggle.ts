// Case 2: the two-state ceremony floor, in the Radix lookup-table style.

import { createStateMachine } from './machine.ts'

const toggle = { off: { toggle: 'on' }, on: { toggle: 'off' } } as const
const [getState, send] = createStateMachine('off', toggle)

// --- demonstration -----------------------------------------------------------
declare const console: { log: (...args: unknown[]) => void }

const eq = (actual: unknown, expected: unknown, what: string) => {
	if (actual !== expected) {
		throw new Error(
			`${what}: expected ${String(expected)}, got ${String(actual)}`,
		)
	}
}

eq(getState(), 'off', 'initial')
eq(send('toggle'), 'on', 'off -> toggle')
eq(send('toggle'), 'off', 'on -> toggle')
eq(getState(), 'off', 'final')

console.log('toggle.ts: all assertions passed')
