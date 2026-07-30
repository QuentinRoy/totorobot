import { defineMachine, immediate, interpret } from 'totorobot'
import { describe, expect, test } from 'vitest'

describe('Immediate', () => {
	test('Will immediately transition', () => {
		let machine = defineMachine().create('one', ({ state, transition }) => ({
			one: state(transition('ping', 'two')),
			two: state(immediate('three')),
			three: state(),
		}))
		let service = interpret(machine, {})
		service.send({ type: 'ping' })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'three').toBe(true)
	})

	test('Will not reject state when a guard fails', () => {
		let machine = defineMachine().create(
			'one',
			({ guard, state, transition }) => ({
				one: state(transition('ping', 'two')),
				two: state(
					immediate(
						'three',
						guard(() => false),
					),
					transition('next', 'three'),
				),
				three: state(),
			}),
		)
		let service = interpret(machine, {})
		service.send({ type: 'ping' })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'two').toBe(true)
		service.send({ type: 'next' })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'three').toBe(true)
	})

	test('Can immediately transitions past 2 states', () => {
		let machine = defineMachine().create('one', ({ state }) => ({
			one: state(immediate('two')),
			two: state(immediate('three')),
			three: state(),
		}))

		let service = interpret(machine, {})
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.state == 'three', 'transitioned to 3')
			.toBe(true)
		expect
			.soft(service.machine.state.value.final, 'in the final state')
			.toBeTruthy()
	})
})
