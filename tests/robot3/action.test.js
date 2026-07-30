import { defineMachine, interpret } from 'totorobot'
import { describe, expect, test } from 'vitest'

describe('Action', () => {
	test('Can be used to do side-effects', () => {
		let count = 0
		let orig = {}
		let machine = defineMachine().create(
			'one',
			({ action, state, transition }) => ({
				one: state(
					transition(
						'ping',
						'two',
						action(() => count++),
					),
				),
				two: state(),
			}),
		)
		let service = interpret(machine, orig)
		service.send({ type: 'ping' })

		// Preserve QUnit assert.equal's loose equality semantics.
		expect
			.soft(service.snapshot.context == orig, 'context stays the same')
			.toBe(true)
		// Preserve QUnit assert.equal's loose equality semantics.
		expect.soft(count == 1, 'side-effect performed').toBe(true)
	})
})
