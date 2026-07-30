import {
	createMachine,
	defineMachine,
	interpret,
	state,
	transition,
	reduce,
	d,
} from 'totorobot'
import { describe, expect, test } from 'vitest'

describe('robot/debug', () => {
	test("Errors for transitions to states that don't exist", () => {
		try {
			createMachine({
				one: state(transition('go', 'two')),
			})
		} catch (e) {
			expect
				.soft(
					/unknown state/.test(e.message),
					'Gets an error about unknown states',
				)
				.toBeTruthy()
		}
	})

	test('Does not error for transitions to states when state does exist', () => {
		try {
			defineMachine().create('one', ({ state, transition }) => ({
				one: state(transition('go', 'two')),
				two: state(),
			}))
			expect.soft(true, 'Created a valid machine!').toBeTruthy()
		} catch (e) {
			expect.soft(false, 'Should not have errored').toBeTruthy()
		}
	})

	test('Errors if an invalid initial state is provided', () => {
		try {
			defineMachine().create('oops', ({ state }) => ({
				one: state(),
			}))
			expect.soft(false, 'should have failed').toBeTruthy()
		} catch (e) {
			expect.soft(true, 'it is errored').toBeTruthy()
		}
	})

	test('Errors when no transitions for event from the current state', () => {
		try {
			const machine = createMachine('one', {
				one: state(),
			})
			const { send } = interpret(machine, () => {})
			send('go')
			expect.soft(false, 'should have failed').toBeTruthy()
		} catch (e) {
			expect.soft(true, 'it is errored').toBeTruthy()
		}
	})
})
