import { data, input, machine } from './lib.ts'

export const toggle = machine({
	initial: 'off',
	inputs: { toggle: input<void>() },
	states: {
		off: { data: data<void>(), on: { toggle: { to: 'on' } } },
		on: { data: data<void>(), on: { toggle: { to: 'off' } } },
	},
})
