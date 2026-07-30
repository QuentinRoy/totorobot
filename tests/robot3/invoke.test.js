import {
	createMachine,
	defineMachine,
	immediate,
	interpret,
	invoke,
	reduce,
	state,
	state as final,
	transition,
} from 'totorobot'
import { describe, expect, test } from 'vitest'

describe('Invoke Promise', () => {
	test('Goes to the "done" event when complete', async () => {
		let machine = defineMachine().create(
			'one',
			({ invoke, reduce, state, transition }) => ({
				one: state(transition('click', 'two')),
				two: invoke(
					() => Promise.resolve(13),
					({ done }) => [
						done(
							'three',
							reduce((ctx, result) => ({ ...ctx, age: result })),
						),
					],
				),
				three: state(),
			}),
		)

		let service = interpret(machine, { age: 0 })
		service.send({ type: 'click' })
		await Promise.resolve()
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.context.age == 13, 'Invoked').toBe(true)
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.state == 'three', 'now in the next state')
			.toBe(true)
	})

	test('Goes to the "error" event when there is an error', async () => {
		let machine = defineMachine().create(
			'one',
			({ invoke, reduce, state, transition }) => ({
				one: state(transition('click', 'two')),
				two: invoke(
					() => Promise.reject(new Error('oh no')),
					({ error }) => [
						error(
							'three',
							reduce((ctx, thrown) => ({ ...ctx, error: thrown })),
						),
					],
				),
				three: state(),
			}),
		)

		let service = interpret(machine, { age: 0 })
		service.send({ type: 'click' })
		await Promise.resolve()
		await Promise.resolve()
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(
				service.snapshot.context.error.message == 'oh no',
				'Got the right error',
			)
			.toBe(true)
	})

	test('The initial state can be an invoke', async () => {
		let machine = defineMachine().create(
			'one',
			({ invoke, reduce, state }) => ({
				one: invoke(
					() => Promise.resolve(2),
					({ done }) => [
						done(
							'two',
							reduce((ctx, result) => ({ ...ctx, age: result })),
						),
					],
				),
				two: state(),
			}),
		)

		let service = interpret(machine, { age: 0 })
		await Promise.resolve()
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.context.age == 2, 'Invoked immediately')
			.toBe(true)
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.snapshot.state == 'two', 'in the new state').toBe(true)
	})

	test('Should not fire "done" event when state changes', async () => {
		const wait = (ms) => () => new Promise((resolve) => setTimeout(resolve, ms))

		let machine = createMachine({
			one: state(transition('click', 'two')),
			two: invoke(
				wait(10),
				transition('done', 'one'),
				transition('click', 'three'),
			),
			three: state(transition('done', 'error')),
			error: state(),
		})

		let service = interpret(machine, () => {})
		service.send('click')
		service.send('click')
		await wait(15)()
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.machine.current == 'three', 'now in the next state')
			.toBe(true)
	})

	test('Should fire "done" when context changes', async () => {
		const wait = (ms) => () => new Promise((resolve) => setTimeout(resolve, ms))

		let machine = createMachine(
			{
				one: state(transition('click', 'two')),
				two: invoke(
					wait(10),
					transition('done', 'three'),
					transition(
						'click',
						'two',
						reduce((ctx) => ({ value: ctx.value + 1 })),
					),
				),
				three: state(),
				error: state(),
			},
			() => ({ value: 0 }),
		)

		let service = interpret(machine, () => {})
		service.send('click')
		service.send('click')
		service.send('click')
		await wait(15)()
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(service.context.value == 2, 'value should be 2').toBe(true)
		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.machine.current == 'three', 'now in the correct state')
			.toBe(true)
	})
})

describe('Invoke Machine', () => {
	test('Can invoke a child machine', async () => {
		expect.assertions(4)
		let one = createMachine({
			nestedOne: state(transition('go', 'nestedTwo')),
			nestedTwo: final(),
		})
		let two = createMachine({
			one: state(transition('go', 'two')),
			two: invoke(one, transition('done', 'three')),
			three: final(),
		})
		let c = 0
		let service = interpret(two, (thisService) => {
			switch (c) {
				case 0:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.machine.current == 'two').toBe(true)
					break
				case 1:
					// Preserve QUnit assert.notEqual's loose inequality semantics.
					expect
						.soft(thisService != service, 'second time a different service')
						.toBe(true)
					break
				case 2:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.machine.current == 'three', 'now in three state')
						.toBe(true)
					break
			}
			c++
		})
		service.send('go')
		service.child.send('go')
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(c == 3, 'there were 3 transitions').toBe(true)
	})

	test('Can invoke a dynamic child machine', async () => {
		expect.assertions(10)
		let dynamicMachines = [
			createMachine({
				nestedOne: state(transition('go', 'nestedTwo')),
				nestedTwo: final(),
			}),
			createMachine({
				nestedThree: state(transition('go', 'nestedFour')),
				nestedFour: final(),
			}),
		]

		let root = createMachine({
			one: state(transition('go', 'two')),
			two: invoke(() => dynamicMachines[0], transition('done', 'three')),
			three: state(transition('go', 'four')),
			four: invoke(() => dynamicMachines[1], transition('done', 'five')),
			five: final(),
		})
		let c = 0
		let service = interpret(root, (thisService) => {
			switch (c) {
				case 0:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.machine.current == 'two').toBe(true)
					break
				case 1:
					// Preserve QUnit assert.notEqual's loose inequality semantics.
					expect
						.soft(thisService != service, 'second time a different service')
						.toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(thisService.machine.current == 'nestedTwo').toBe(true)
					break
				case 2:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(thisService == service, 'equal service').toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.machine.current == 'three', 'now in three state')
						.toBe(true)
					break
				case 3:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.machine.current == 'four').toBe(true)
					break
				case 4:
					// Preserve QUnit assert.notEqual's loose inequality semantics.
					expect
						.soft(thisService != service, 'third time a different service')
						.toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(thisService.machine.current == 'nestedFour').toBe(true)
					break
				case 5:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.machine.current == 'five', 'now in five state')
						.toBe(true)
					break
			}
			c++
		})
		service.send('go')
		service.child.send('go')
		service.send('go')
		service.child.send('go')
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(c == 6, 'there were 6 transitions').toBe(true)
	})

	test('Child machines receive events from their parents', async () => {
		const action = (fn) =>
			reduce((ctx, ev) => {
				fn(ctx, ev)
				return ctx
			})

		const wait = (ms) => () => new Promise((resolve) => setTimeout(resolve, ms))

		const child = createMachine(
			{
				init: state(
					immediate(
						'waiting',
						action((ctx) => {
							ctx.stuff.push(1)
						}),
					),
				),
				waiting: invoke(
					wait(50),
					transition(
						'done',
						'fin',
						action((ctx) => {
							ctx.stuff.push(2)
						}),
					),
				),
				fin: state(),
			},
			(ctx) => ctx,
		)

		const machine = createMachine(
			{
				idle: state(transition('next', 'child')),
				child: invoke(child, transition('done', 'end')),
				end: state(),
			},
			() => ({ stuff: [] }),
		)

		let service = interpret(machine, () => {})
		service.send('next')

		await wait(50)()

		expect.soft(service.context.stuff).toEqual([1, 2])
	})

	test('Service does not have a child when not in an invoked state', () => {
		const child = createMachine({
			nestedOne: state(transition('next', 'nestedTwo')),
			nestedTwo: state(),
		})
		const parent = createMachine({
			one: invoke(child, transition('done', 'two')),
			two: state(),
		})

		let service = interpret(parent, () => {})
		expect.soft(service.child, 'there is a child service').toBeTruthy()

		service.child.send('next')
		expect.soft(service.child, 'No longer a child').toBeFalsy()
	})

	test('Multi level nested machines resolve in correct order', async () => {
		expect.assertions(18)

		const four = createMachine({
			init: state(transition('START', 'start')),
			start: state(transition('DONE', 'done')),
			done: state(),
		})

		const three = createMachine({
			init: state(transition('START', 'start')),
			start: invoke(four, transition('done', 'done')),
			done: state(),
		})

		const two = createMachine({
			init: state(transition('START', 'start')),
			start: invoke(three, transition('done', 'done')),
			done: state(),
		})

		const one = createMachine({
			init: state(transition('START', 'start')),
			start: invoke(two, transition('done', 'done')),
			done: state(),
		})

		let c = 0
		let service = interpret(one, (thisService) => {
			switch (c) {
				case 0:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.machine.current == 'start', 'initial state')
						.toBe(true)
					break
				case 1:
					// Preserve QUnit assert.notEqual's loose inequality semantics.
					expect
						.soft(
							thisService.machine.states != service.machine.states,
							'second time a different service',
						)
						.toBe(true)
					expect.soft(service.child, 'has child').toBeTruthy()
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.child.machine.current == 'start').toBe(true)
					break
				case 2:
					expect.soft(service.child.child, 'has grand child').toBeTruthy()
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.child.machine.current == 'start').toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.child.child.machine.current == 'start').toBe(true)
					break
				case 3:
					expect
						.soft(service.child.child.child, 'has grand grand child')
						.toBeTruthy()
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.child.child.machine.current == 'start').toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.child.child.child.machine.current == 'start')
						.toBe(true)
					break
				case 4:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.child.child.child.machine.current == 'done')
						.toBe(true)
					break
				case 5:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.child.child.machine.current == 'done').toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(
							service.child.child.child == undefined,
							'child is removed when resolved',
						)
						.toBe(true)
					break
				case 6:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.child.machine.current == 'done').toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(
							service.child.child == undefined,
							'child is removed when resolved',
						)
						.toBe(true)
					break
				case 7:
					// Preserve QUnit assert.equal's loose equality semantics.
					expect.soft(service.machine.current == 'done').toBe(true)
					// Preserve QUnit assert.equal's loose equality semantics.
					expect
						.soft(service.child == undefined, 'child is removed when resolved')
						.toBe(true)
					break
			}
			c++
		})
		service.send('START') // machine one
		service.child.send('START') // machine two
		service.child.child.send('START') // machine tree
		service.child.child.child.send('START') // machine four
		service.child.child.child.send('DONE') // machine four
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(c == 8, 'there were 6 transitions').toBe(true)
	})

	test('Invoking a machine that immediately finishes', async () => {
		expect.assertions(3)
		const expectations = ['nestedTwo', 'three', 'three']

		const child = createMachine({
			nestedOne: state(immediate('nestedTwo')),
			nestedTwo: final(),
		})

		const parent = createMachine({
			one: state(transition('next', 'two')),
			two: invoke(child, transition('done', 'three')),
			three: final(),
		})

		let service = interpret(parent, (s) => {
			// Preserve QUnit assert.equal's loose equality semantics.
			expect.soft(s.machine.current == expectations.shift()).toBe(true)
		})

		service.send('next')
	})
})
