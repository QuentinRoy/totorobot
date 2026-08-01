/**
 * Runtime evidence for [`robot3-wrapper.ts`](robot3-wrapper.ts).
 *
 * The rest of `explorations/` only type-checks. This file actually runs the
 * machines, because the claim being tested - "totorobot could be mostly types
 * over Robot3" - is a runtime claim as much as a typing one.
 *
 * The final `describe` block pins the mismatches described in the wrapper's
 * header. It asserts Robot3's current behaviour, so if a future Robot3
 * release fixes one of them, the test fails and says so.
 */

import * as robot from 'robot3'
import { describe, expect, test, vi } from 'vitest'

import type { AuthSpec } from './config-object-kit.ts'
import {
	action,
	createMachine,
	defineMachine,
	guard,
	immediate,
	interpret,
	invoke,
	reduce,
	state,
	transition,
} from './robot3-wrapper.ts'

/** Flushes the microtask queue past Robot3's `.then`/`.catch` and this
 * wrapper's own promise wrapping, so an invoked settlement has landed. */
const flush = (): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Robot3's own generics derive `send`'s event union from the state map and
 * collapse it to `never` unless the whole machine was inferred end to end.
 * The three tests that reach past the wrapper only need the untyped shape.
 */
const raw = robot as unknown as {
	createMachine: (
		initial: string,
		states: Record<string, unknown>,
		context: (context: unknown) => unknown,
	) => object
	state: (...transitions: unknown[]) => unknown
	transition: (event: string, target: string) => unknown
	interpret: (
		machine: object,
		onChange: (() => void) | undefined,
		context: unknown,
	) => { machine: { current: string }; send: (event: unknown) => void }
}

const spec = defineMachine<AuthSpec>()({ initialState: 'idle' })

const authMachine = createMachine(spec, {
	idle: state(
		transition(
			'login',
			'authenticating',
			guard((_context, event) => event.username.length > 0),
			reduce((_context, event) => ({ username: event.username })),
		),
		// idle -> idle does not change the context shape, so no reducer is
		// required. That is `TransitionModifiers` doing its job on top of a
		// runtime with no idea the rule exists.
		transition('ping', 'idle'),
	),
	authenticating: state(
		transition(
			'success',
			'authenticated',
			reduce((_context, event) => ({ token: event.token })),
		),
	),
	authenticated: state(),
})

describe('the typed layer over Robot3', () => {
	test('runs a machine end to end', () => {
		const service = interpret(authMachine, { attempts: 0 })

		expect(service.current.state).toBe('idle')
		expect(service.current.context).toEqual({ attempts: 0 })

		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')
		idle.send({ name: 'login', username: 'quentin' })

		expect(service.current.state).toBe('authenticating')
		expect(service.current.context).toEqual({ username: 'quentin' })

		const authenticating = service.current
		if (authenticating.state !== 'authenticating') {
			throw new Error('expected authenticating')
		}
		authenticating.send({ name: 'success', token: 'tok' })

		expect(service.current.state).toBe('authenticated')
		expect(service.current.context).toEqual({ token: 'tok' })
	})

	test('narrows context and send to the current state', () => {
		const service = interpret(authMachine, { attempts: 0 })
		const current = service.current

		if (current.state !== 'idle') throw new Error('expected idle')

		// `context` is idle's, not a union over all three states.
		expect(current.context.attempts).toBe(0)

		current.send({ name: 'ping', count: 1 })
	})

	test('a failing guard leaves the state alone', () => {
		const service = interpret(authMachine, { attempts: 0 })
		const current = service.current

		if (current.state !== 'idle') throw new Error('expected idle')
		current.send({ name: 'login', username: '' })

		expect(service.current.state).toBe('idle')
		expect(service.current.context).toEqual({ attempts: 0 })
	})

	test('an event the current state does not handle is dropped', () => {
		const service = interpret(authMachine, { attempts: 0 })
		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')
		idle.send({ name: 'login', username: 'quentin' })

		// "ping" is declared, but authenticating does not handle it. The type
		// layer rejects this; the runtime silently drops it.
		const send = service.current.send as (event: unknown) => void
		send({ name: 'ping', count: 1 })

		expect(service.current.state).toBe('authenticating')
	})

	test('onChange fires once per accepted transition', () => {
		const onChange = vi.fn()
		const service = interpret(authMachine, { attempts: 0 }, onChange)

		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')

		idle.send({ name: 'login', username: '' })
		expect(onChange).not.toHaveBeenCalled()

		idle.send({ name: 'login', username: 'quentin' })
		expect(onChange).toHaveBeenCalledTimes(1)
	})

	test('an immediate transition fires without waiting for an event', () => {
		const immediateMachine = createMachine(spec, {
			idle: state(
				transition(
					'login',
					'authenticating',
					reduce((_context, event) => ({ username: event.username })),
				),
			),
			authenticating: state(
				immediate(
					'authenticated',
					reduce((context) => ({ token: `t-${context.username}` })),
				),
			),
			authenticated: state(),
		})

		const service = interpret(immediateMachine, { attempts: 0 })
		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')
		idle.send({ name: 'login', username: 'q' })

		// No second send: the immediate already fired on entry.
		expect(service.current.state).toBe('authenticated')
		expect(service.current.context).toEqual({ token: 't-q' })
	})

	test('invoke transitions on the promise resolving', async () => {
		const invokeMachine = createMachine(spec, {
			idle: state(
				transition(
					'login',
					'authenticating',
					reduce((_context, event) => ({ username: event.username })),
				),
			),
			authenticating: invoke(
				(context) => Promise.resolve({ token: `t-${context.username}` }),
				({ done }) => [
					done(
						'authenticated',
						reduce((_context, result) => ({ token: result.token })),
					),
				],
			),
			authenticated: state(),
		})

		const service = interpret(invokeMachine, { attempts: 0 })
		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')
		idle.send({ name: 'login', username: 'q' })

		expect(service.current.state).toBe('authenticating')
		await flush()

		expect(service.current.state).toBe('authenticated')
		expect(service.current.context).toEqual({ token: 't-q' })
	})

	test('invoke transitions on the promise rejecting', async () => {
		const invokeMachine = createMachine(spec, {
			idle: state(
				transition(
					'login',
					'authenticating',
					reduce((_context, event) => ({ username: event.username })),
				),
			),
			authenticating: invoke(
				() => Promise.reject(new Error('nope')),
				({ error }) => [
					error(
						'idle',
						reduce(() => ({ attempts: 1 })),
					),
				],
			),
			authenticated: state(),
		})

		const service = interpret(invokeMachine, { attempts: 0 })
		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')
		idle.send({ name: 'login', username: 'q' })

		await flush()

		expect(service.current.state).toBe('idle')
		expect(service.current.context).toEqual({ attempts: 1 })
	})

	test('invoke gives the source a real, if unused, AbortSignal', async () => {
		let observed: AbortSignal | undefined
		const invokeMachine = createMachine(spec, {
			idle: state(
				transition(
					'login',
					'authenticating',
					reduce((_context, event) => ({ username: event.username })),
				),
			),
			authenticating: invoke(
				(context, signal) => {
					observed = signal
					return Promise.resolve({ token: context.username })
				},
				({ done }) => [
					done(
						'authenticated',
						reduce((_context, result) => ({ token: result.token })),
					),
				],
			),
			authenticated: state(),
		})

		const service = interpret(invokeMachine, { attempts: 0 })
		const idle = service.current
		if (idle.state !== 'idle') throw new Error('expected idle')
		idle.send({ name: 'login', username: 'q' })
		await flush()

		expect(observed).toBeInstanceOf(AbortSignal)
		// Mismatch 5: nothing ever aborts it, even though the state was left.
		expect(observed?.aborted).toBe(false)
	})
})

/**
 * The rejections, kept out of any `test` body on purpose: `@ts-expect-error`
 * suppresses the type error but the statement still runs, and a `send` the
 * type layer was supposed to reject is exactly the kind of call that throws.
 * This function is never invoked - `pnpm typecheck` is what reads it.
 */
export function compileTimeRejections(): void {
	const current = interpret(authMachine, { attempts: 0 }).current

	if (current.state === 'idle') {
		// @ts-expect-error - idle does not handle "success"
		current.send({ name: 'success', token: 'tok' })
		// @ts-expect-error - "login" carries a username
		current.send({ name: 'login' })
	}

	if (current.state === 'authenticated') {
		// @ts-expect-error - a terminal state handles nothing at all
		current.send({ name: 'ping', count: 1 })
	}
}

describe('Robot3 mismatches the wrapper has to absorb', () => {
	function twoStateMachine(event: string): object {
		return raw.createMachine(
			'idle',
			{
				idle: raw.state(raw.transition(event, 'done')),
				done: raw.state(),
			},
			(context) => context,
		)
	}

	test('an event keyed on `name` is silently dropped, not rejected', () => {
		// Robot3 computes the key as `event.type || event`, so an untranslated
		// `{ name }` object becomes the key itself and matches nothing. No
		// throw, no warning - the send just does nothing. This is why the
		// wrapper translates, and the argument for keying the spec on `type`.
		const service = raw.interpret(twoStateMachine('login'), () => {}, {})

		service.send({ name: 'login' })
		expect(service.machine.current).toBe('idle')

		service.send({ type: 'login' })
		expect(service.machine.current).toBe('done')
	})

	test('omitting onChange throws on the first transition', () => {
		// Robot3's `.d.ts` marks `onChange` optional; `transitionTo` calls it
		// unconditionally. The wrapper therefore always passes a function.
		const service = raw.interpret(twoStateMachine('go'), undefined, {})

		expect(() => {
			service.send({ type: 'go' })
		}).toThrow()
	})

	test('an action returning -1 replaces the context with false', () => {
		// `action` is `reduce((ctx, ev) => !!~fn(ctx, ev) && ctx)`, and
		// `~(-1) === 0`. Typing the callback `=> void` does not prevent it:
		// TypeScript allows returning a value from a void-returning callback,
		// so this compiles with no cast.
		const machine = createMachine(spec, {
			idle: state(
				transition(
					'ping',
					'idle',
					action(() => -1),
				),
			),
			authenticating: state(),
			authenticated: state(),
		})

		const service = interpret(machine, { attempts: 0 })
		const current = service.current
		if (current.state !== 'idle') throw new Error('expected idle')
		current.send({ name: 'ping', count: 1 })

		expect(service.current.context).toBe(false)
	})
})
