import {
	createMachine,
	defineMachine,
	interpret,
	invoke,
	reduce,
	state,
	transition,
} from 'totorobot'
import { describe, expect, test } from 'vitest'

describe('States', () => {
	test('Basic state change', () => {
		expect.assertions(5)
		let machine = defineMachine().create('one', ({ state, transition }) => ({
			one: state(transition('ping', 'two')),
			two: state(transition('pong', 'one')),
		}))
		let service = interpret(machine, {}, (service) => {
			expect.soft(true, 'Callback called').toBeTruthy()
		})
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'one').toBe(true)
		service.send({ type: 'ping' })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'two').toBe(true)
		service.send({ type: 'pong' })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'one').toBe(true)
	})

	test('Data can be passed into the initial context', () => {
		let machine = defineMachine().create('one', ({ state }) => ({
			one: state(),
		}))

		let service = interpret(machine, {
			foo: 'bar',
		})

		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.context.foo == 'bar', 'works!').toBe(true)
	})

	test('First argument sets the initial state', () => {
		let machine = defineMachine().create('two', ({ state, transition }) => ({
			one: state(transition('next', 'two')),
			two: state(transition('next', 'three')),
			three: state(),
		}))

		let service = interpret(machine, {})
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.state == 'two', 'in the initial state')
			.toBe(true)

		machine = defineMachine().create('two', ({ state, transition }) => ({
			one: state(transition('next', 'two')),
			two: state(),
		}))
		service = interpret(machine, {})
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.state == 'two', 'in the initial state')
			.toBe(true)
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.machine.state.value.final == true, 'in the final state')
			.toBe(true)
	})

	test('Child machines receive the event used to invoke them', () => {
		let child = createMachine(
			{
				final: state(),
			},
			(ctx, ev) => ({ count: ev.count }),
		)
		let parent = createMachine({
			start: state(transition('next', 'next')),
			next: invoke(
				child,
				transition(
					'done',
					'end',
					reduce((ctx, ev) => ({
						...ctx,
						...ev.data,
					})),
				),
			),
			end: state(),
		})
		let service = interpret(parent, () => {})
		service.send({ type: 'next', count: 14 })
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.context.count == 14, 'event sent through').toBe(true)
	})
})
