// The whole point of `&`: both self-transitions, side by side, and the
// difference between them is visible without opening either body.

import { command, data, input, machine } from './lib.ts'

type Cmd = { readonly kind: 'startTimer' } | { readonly kind: 'cancelTimer' }

export const dwell = machine({
	initial: 'idle',
	inputs: { move: input<{ readonly x: number }>(), settle: input<void>() },
	commands: command<Cmd>(),
	states: {
		idle: { on: { move: { tracking: ({ input }) => ({ x: input.x, n: 0 }) } } },

		tracking: {
			data: data<{ readonly x: number; readonly n: number }>(),
			enter: (): readonly Cmd[] => [{ kind: 'startTimer' }],
			exit: (): readonly Cmd[] => [{ kind: 'cancelTimer' }],
			on: {
				// `&` -- absorb the move. The dwell timer keeps running.
				move: { '&': ({ data, input }) => ({ x: input.x, n: data.n + 1 }) },
				// naming the state -- ENTER it again, so the dwell timer restarts.
				// Ordinary transition; the target just happens to be where we are.
				settle: { tracking: ({ data }) => ({ x: data.x, n: 0 }) },
			},
		},
	},
})

// And the bare form: handled, nothing changes at all.
export const clutch = machine({
	initial: 'armed',
	inputs: { noop: input<void>(), fire: input<void>() },
	states: {
		armed: { on: { noop: '&', fire: 'spent' } },
		spent: {},
	},
})
