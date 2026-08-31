import { expectTypeOf, test } from 'vitest'
import { machine, type, type InputsOf } from 'totorobot'

test('input maps preserve payload types and require their data when sending', () => {
	interface Inputs {
		set: number
		reset: undefined
		maybe: number | undefined
		clear: null
	}
	const definition = machine({
		initial: 'idle',
		inputs: type<Inputs>(),
		transitions: {
			'idle -set> idle': ({ input, inputData }) => {
				expectTypeOf(input).toEqualTypeOf<'set'>()
				expectTypeOf(inputData).not.toBeAny()
				expectTypeOf(inputData).toEqualTypeOf<number>()
			},
		},
	})
	expectTypeOf<InputsOf<typeof definition>>().toEqualTypeOf<Inputs>()
	const host = definition.start()
	host.send('set', 42)
	host.send('reset')
	host.send('maybe')
	host.send('maybe', 1)
	host.send('clear', null)
	// @ts-expect-error null is explicit data
	host.send('clear')
	// @ts-expect-error set requires a number
	host.send('set')
	// @ts-expect-error wrong payload
	host.send('set', '42')
	// @ts-expect-error unknown name
	host.send('missing')
	// @ts-expect-error tagged-object sending was removed
	host.send({ type: 'reset' })
})

test('possibly mismatched union-valued names and data are rejected', () => {
	const host = machine({
		initial: 'idle',
		inputs: type<{ text: string; count: number }>(),
		transitions: {
			'idle -text> idle': () => {},
			'idle -count> idle': () => {},
		},
	}).start()
	const input = 'text' as 'text' | 'count'
	const inputData = '' as string | number
	// @ts-expect-error the separate unions may not be correlated
	host.send(input, inputData)
	if (input === 'text') host.send(input, '')
	host.observe('* -> *', (event) => {
		if (event.input === 'text') event.send(event.input, event.inputData)
	})
})
