import { type To, data, input, machine } from './lib.ts'

export const toggle = machine({
	initial: 'off',
	inputs: { toggle: input<void>() },
	states: {
		off: { data: data<void>(), on: { toggle: ({ at }): To<'on'> => at.on() } },
		on: { data: data<void>(), on: { toggle: ({ at }): To<'off'> => at.off() } },
	},
})
