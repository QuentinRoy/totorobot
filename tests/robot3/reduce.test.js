import {
	createMachine,
	defineMachine,
	interpret,
	reduce,
	state,
	transition,
} from 'totorobot'
import { describe, expect, test } from 'vitest'

describe('Reduce', () => {
	test('Basic state change', () => {
		let machine = createMachine({
			one: state(
				transition(
					'ping',
					'two',
					reduce((ctx) => ({ ...ctx, one: 1 })),
					reduce((ctx) => ({ ...ctx, two: 2 })),
				),
			),
			two: state(),
		})
		let service = interpret(machine, () => {})
		service.send('ping')

		let { one, two } = service.context
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(one == 1, 'first reducer ran').toBe(true)
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(two == 2, 'second reducer ran').toBe(true)
	})

	test('If no reducers, the context remains', () => {
		let machine = defineMachine().create('one', ({ state, transition }) => ({
			one: state(transition('go', 'two')),
			two: state(),
		}))

		let service = interpret(machine, { one: 1, two: 2 })
		service.send({ type: 'go' })
		expect
			.soft(service.snapshot.context, 'context remains')
			.toEqual({ one: 1, two: 2 })
	})

	test('Event is the second argument', () => {
		expect.assertions(2)

		let machine = defineMachine().create(
			'one',
			({ reduce, state, transition }) => ({
				one: state(
					transition(
						'go',
						'two',
						reduce(function (ctx, ev) {
							expect.soft(ev).toEqual({ type: 'go' })
							return { ...ctx, worked: true }
						}),
					),
				),
				two: state(),
			}),
		)
		let service = interpret(machine, {})
		service.send({ type: 'go' })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.context.worked == true, 'changed the context')
			.toBe(true)
	})
})
