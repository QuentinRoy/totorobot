import { input, machine } from './lib.ts'

export const toggle = machine({
	initial: 'off',
	inputs: { toggle: input<void>() },
	states: {
		off: { on: { toggle: 'on' } },
		on: { on: { toggle: 'off' } },
	},
})
