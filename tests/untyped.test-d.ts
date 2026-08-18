import { expectTypeOf, test } from 'vitest'

import { machine, types } from '../src/totorobot.ts'

test('a well-formed table compiles with no vocabulary declared', () => {
	const untyped = machine({
		initial: 'anything',
		transitions: {
			'off -toggle> on': ({ data, input }) => {
				expectTypeOf(data).toEqualTypeOf<unknown>()
				expectTypeOf(input).toEqualTypeOf<unknown>()
			},
		},
	})

	const host = untyped.start()
	expectTypeOf(host.current.state).toEqualTypeOf<string>()
	expectTypeOf(host.current.data).toEqualTypeOf<unknown>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<string>()
})

test('a malformed key is rejected with no vocabulary declared', () => {
	machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - no space before '-'
			'on-toggle> off': () => {},
		},
	})
})

test('a bare key naming a state is rejected with no vocabulary declared', () => {
	machine({
		initial: 'off',
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - a bare key names a state, not an edge
			on: () => {},
		},
	})
})

test('declaring inputs and omitting states checks inputs and widens states', () => {
	type Inputs = { toggle: void }

	const half = machine({
		initial: 'anything',
		inputs: types<Inputs>(),
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - 'bogus' is not a declared input
			'off -bogus> on': () => {},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<string>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<'toggle'>()
})

test('declaring states and omitting inputs checks states and widens inputs', () => {
	type States = { off: void; on: void }

	const half = machine({
		initial: 'off',
		states: types<States>(),
		transitions: {
			'off -toggle> on': () => {},
			// @ts-expect-error - 'bogus' is not a declared state
			'bogus -toggle> on': () => {},
		},
	})

	const host = half.start()
	expectTypeOf(host.current.state).toEqualTypeOf<'off' | 'on'>()
	expectTypeOf(host.send).parameter(0).toEqualTypeOf<string>()
})
