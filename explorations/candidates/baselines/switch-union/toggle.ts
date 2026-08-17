// Baseline 2: a plain `switch` over a discriminated union. No library.
//
// Case 2, the two-state ceremony floor. This is the number every candidate has
// to beat.
//
// With no per-state data the discriminated union degenerates to a union of
// string literals, which is exactly the point Case 2 makes: a state without
// data needs no placeholder object. The `input` is still named in the body so
// that the arrow test is scored on the same information a candidate would
// show.

export type ToggleState = 'off' | 'on'
export type ToggleInput = 'toggle'

export const initialState: ToggleState = 'off'

export function reduce(state: ToggleState, input: ToggleInput): ToggleState {
	switch (state) {
		case 'off':
			return input === 'toggle' ? 'on' : state
		case 'on':
			return input === 'toggle' ? 'off' : state
		default: {
			const unhandled: never = state
			return unhandled
		}
	}
}

// --- demonstration ---------------------------------------------------------
// Run: pnpm exec node explorations/candidates/baselines/switch-union/toggle.ts

declare const console: { log: (...args: unknown[]) => void }

const s0 = initialState
if (s0 !== 'off') throw new Error(`initial is ${s0}`)

const s1 = reduce(s0, 'toggle')
if (s1 !== 'on') throw new Error(`off + toggle gave ${s1}`)

const s2 = reduce(s1, 'toggle')
if (s2 !== 'off') throw new Error(`on + toggle gave ${s2}`)

console.log('toggle: all assertions passed')
