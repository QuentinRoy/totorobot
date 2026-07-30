import { describe, expect, expectTypeOf, test, vi } from "vitest"

import { defineMachine, interpret } from "../src/totorobot.ts"

// ---------------------------------------------------------------------------
// Traffic light: per-state context, `blinking` exists only on `yellow`.
// ---------------------------------------------------------------------------

type TrafficSpec = {
	states: {
		red: { changes: number }
		green: { changes: number }
		yellow: { changes: number; blinking: boolean }
	}
	events: { next: Record<never, never> }
}

const trafficLight = defineMachine<TrafficSpec>().create(
	"red",
	({ state, transition, reduce }) => ({
		red: state(
			transition(
				"next",
				"green",
				reduce((context) => ({ changes: context.changes + 1 })),
			),
		),
		green: state(
			transition(
				"next",
				"yellow",
				reduce((context) => ({ changes: context.changes + 1, blinking: true })),
			),
		),
		yellow: state(
			transition(
				"next",
				"red",
				// `blinking` is readable here and nowhere else.
				reduce((context) => ({
					changes: context.changes + (context.blinking ? 1 : 0),
				})),
			),
		),
	}),
)

describe("per-state context", () => {
	test("cycles and carries state-specific fields", () => {
		const service = interpret(trafficLight, { changes: 0 })

		expect(service.snapshot).toEqual({ state: "red", context: { changes: 0 } })
		service.send({ type: "next" })
		expect(service.snapshot).toEqual({ state: "green", context: { changes: 1 } })
		service.send({ type: "next" })
		expect(service.snapshot).toEqual({
			state: "yellow",
			context: { changes: 2, blinking: true },
		})
		service.send({ type: "next" })
		expect(service.snapshot).toEqual({ state: "red", context: { changes: 3 } })
	})

	test("narrowing `state` narrows `context`", () => {
		const service = interpret(trafficLight, { changes: 0 })
		const snapshot = service.snapshot

		if (snapshot.state === "yellow") {
			expectTypeOf(snapshot.context).toEqualTypeOf<{
				changes: number
				blinking: boolean
			}>()
		}
		if (snapshot.state === "red") {
			expectTypeOf(snapshot.context).toEqualTypeOf<{ changes: number }>()
			// @ts-expect-error `blinking` exists only on `yellow`
			snapshot.context.blinking
		}
	})

	test("initial context is checked against the initial state", () => {
		// @ts-expect-error `red` does not declare `blinking`
		interpret(trafficLight, { changes: 0, blinking: true })
		// @ts-expect-error `red` requires `changes`
		interpret(trafficLight, {})
	})
})

// ---------------------------------------------------------------------------
// Explicit initial and final states.
// ---------------------------------------------------------------------------

describe("state roles", () => {
	type Spec = {
		states: {
			start: { count: number }
			finished: { count: number }
		}
		events: { finish: Record<never, never> }
	}

	test("the machine owns its initial state and final states cannot transition", () => {
		const machine = defineMachine<Spec>().create(
			"start",
			({ state, final, transition }) => ({
				start: state(transition("finish", "finished")),
				finished: final(),
			}),
		)

		expect(machine.initial).toBe("start")
		expect(machine.states.finished.final).toBe(true)

		const service = interpret(machine, { count: 0 })
		service.send({ type: "finish" })
		expect(service.snapshot).toEqual({
			state: "finished",
			context: { count: 0 },
		})

		service.send({ type: "finish" })
		expect(service.snapshot.state).toBe("finished")
	})

	test("the initial state must exist", () => {
		expect(() =>
			defineMachine<Spec>().create(
				// @ts-expect-error no state named `missing` exists
				"missing",
				({ state, final }) => ({
					start: state(),
					finished: final(),
				}),
			),
		).toThrow(/no state named "missing"/)
	})

	test("a final state rejects transitions", () => {
		const machine = defineMachine<Spec>().create(
			"start",
			({ state, final, transition }) => ({
				start: state(transition("finish", "finished")),
				// @ts-expect-error final states cannot declare transitions
				finished: final(transition("finish", "start")),
			}),
		)

		expect(machine.states.finished.transitions).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// Auth: invoke, guards, actions, symbol events.
// ---------------------------------------------------------------------------

const retry = Symbol("retry")

interface LoginResult {
	token: string
	issuedAt: number
}

type AuthSpec = {
	states: {
		idle: { error: string | null; attempts: number }
		authenticating: { username: string; password: string; attempts: number }
		authenticated: { username: string; token: string }
	}
	events: {
		login: { username: string; password: string }
		[retry]: Record<never, never>
	}
}

const login = async (
	username: string,
	password: string,
): Promise<LoginResult> => {
	if (password !== "hunter2") throw new Error("invalid credentials")
	return { token: `token-for-${username}`, issuedAt: 1 }
}

const authMachine = defineMachine<AuthSpec>().create(
	"idle",
	({ state, final, transition, invoke, guard, reduce }) => ({
		idle: state(
			transition(
				"login",
				"authenticating",
				guard((_data, event) => event.username.trim().length > 0),
				reduce((context, event) => ({
					username: event.username,
					password: event.password,
					attempts: context.attempts + 1,
				})),
			),
		),

		authenticating: invoke(
			(context) => login(context.username, context.password),
			({ done, error }) => [
				done(
					"authenticated",
					reduce((context, result) => ({
						username: context.username,
						token: result.token,
					})),
				),
				error(
					"idle",
					reduce((context, err) => ({
						error: err instanceof Error ? err.message : String(err),
						attempts: context.attempts,
					})),
				),
			],
		),

		authenticated: final(),
	}),
)

describe("invoke", () => {
	test("resolves into the done target with the promise's value", async () => {
		const service = interpret(authMachine, {
			error: null,
			attempts: 0,
		})

		service.send({ type: "login", username: "quentin", password: "hunter2" })
		expect(service.snapshot.state).toBe("authenticating")

		await vi.waitFor(() => expect(service.snapshot.state).toBe("authenticated"))

		const context = service.snapshot
		if (context.state !== "authenticated") throw new Error("unreachable")
		// No null check: `token` is guaranteed by this state.
		expectTypeOf(context.context.token).toEqualTypeOf<string>()
		expect(context.context.token).toBe("token-for-quentin")
	})

	test("rejects into the error target with `unknown`", async () => {
		const service = interpret(authMachine, {
			error: null,
			attempts: 0,
		})

		service.send({ type: "login", username: "quentin", password: "wrong" })
		await vi.waitFor(() => expect(service.snapshot.state).toBe("idle"))

		expect(service.snapshot.context).toEqual({
			error: "invalid credentials",
			attempts: 1,
		})
	})

	test("the resolved type flows into `done` without a hand-written wrapper", () => {
		defineMachine<AuthSpec>().create(
			"idle",
			({ state, final, transition, invoke, reduce }) => ({
				idle: state(
					transition(
						"login",
						"authenticating",
						reduce((context, event) => ({
							username: event.username,
							password: event.password,
							attempts: context.attempts,
						})),
					),
				),
				authenticating: invoke(
					(context) => login(context.username, context.password),
					({ done, error }) => [
						done(
							"authenticated",
							reduce((context, result) => {
								expectTypeOf(result).toEqualTypeOf<LoginResult>()
								expectTypeOf(context).toEqualTypeOf<{
									username: string
									password: string
									attempts: number
								}>()
								return { username: context.username, token: result.token }
							}),
						),
						error(
							"idle",
							reduce((context, err) => {
								expectTypeOf(err).toEqualTypeOf<unknown>()
								return { error: String(err), attempts: context.attempts }
							}),
						),
					],
				),
				authenticated: final(),
			}),
		)
	})

	test("a promise settling after we've left the state is ignored", async () => {
		let release: (value: { ok: boolean }) => void = () => {}
		const slow = new Promise<{ ok: boolean }>((resolve) => {
			release = resolve
		})

		type Spec = {
			states: { waiting: { n: number }; done: { n: number }; bailed: { n: number } }
			events: { bail: Record<never, never> }
		}

		const invoking = defineMachine<Spec>().create(
			"waiting",
			({ final, invoke, reduce }) => ({
				waiting: invoke(
					() => slow,
					({ done }) => [done("done", reduce((context) => context))],
				),
				done: final(),
				bailed: final(),
			}),
		)

		const service = interpret(invoking, { n: 1 })
		service.stop()
		release({ ok: true })
		await slow

		expect(service.snapshot.state).toBe("waiting")
	})
})

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

describe("modifiers", () => {
	type Spec = {
		states: { one: { attempts: number }; two: { attempts: number } }
		events: { ping: { allowed?: boolean } }
	}

	test("multiple guards: any returning false prevents the transition", () => {
		// The behaviour Robot3 has and the first prototype could not express.
		let canProceed = false
		const machine = defineMachine<Spec>().create(
			"one",
			({ state, final, transition, guard }) => ({
				one: state(
					transition(
						"ping",
						"two",
						guard(() => canProceed),
						guard((_data, event) => event.allowed === true),
					),
				),
				two: final(),
			}),
		)

		const service = interpret(machine, { attempts: 0 })

		service.send({ type: "ping", allowed: true })
		expect(service.snapshot.state).toBe("one")

		canProceed = true
		service.send({ type: "ping" })
		expect(service.snapshot.state).toBe("one")

		service.send({ type: "ping", allowed: true })
		expect(service.snapshot.state).toBe("two")
	})

	test("guards short-circuit in order", () => {
		const second = vi.fn(() => true)
		const machine = defineMachine<Spec>().create(
			"one",
			({ state, final, transition, guard }) => ({
				one: state(
					transition(
						"ping",
						"two",
						guard(() => false),
						guard(second),
					),
				),
				two: final(),
			}),
		)

		interpret(machine, { attempts: 0 }).send({ type: "ping" })
		expect(second).not.toHaveBeenCalled()
	})

	test("actions run in order with the source context, only once guards pass", () => {
		const calls: string[] = []
		const machine = defineMachine<Spec>().create(
			"one",
			({ state, final, transition, action, guard, reduce }) => ({
				one: state(
					transition(
						"ping",
						"two",
						action((context) => calls.push(`a:${context.attempts}`)),
						action(() => calls.push("b")),
						reduce((context) => ({ attempts: context.attempts + 1 })),
					),
					transition(
						"ping",
						"two",
						guard(() => false),
						action(() => calls.push("never")),
					),
				),
				two: final(),
			}),
		)

		const service = interpret(machine, { attempts: 7 })
		service.send({ type: "ping" })

		expect(calls).toEqual(["a:7", "b"])
		expect(service.snapshot.context).toEqual({ attempts: 8 })
	})

	test("a reusable combinator applies to any state whose context fits", () => {
		// Written with no knowledge of the machine; usable because the modifier's
		// type parameters sit in `apply`'s parameter positions.
		const machine = defineMachine<Spec>().create(
			"one",
			({ state, final, transition, guard }) => {
				const maxAttempts = (limit: number) =>
					guard<{ attempts: number }, unknown>(
						(context) => context.attempts < limit,
					)

				return {
					one: state(transition("ping", "two", maxAttempts(3))),
					two: final(),
				}
			},
		)

		const blocked = interpret(machine, { attempts: 5 })
		blocked.send({ type: "ping" })
		expect(blocked.snapshot.state).toBe("one")

		const allowed = interpret(machine, { attempts: 1 })
		allowed.send({ type: "ping" })
		expect(allowed.snapshot.state).toBe("two")
	})

	test("more than one reduce per transition is rejected", () => {
		// robot3 pipelines reducers; with per-state context that fold is not typeable,
		// so the signature admits exactly one and it must come last. The runtime
		// check backs the same rule up for callers who are not using TypeScript.
		expect(() =>
			defineMachine<Spec>().create(
				"one",
				({ state, final, transition, reduce }) => ({
					one: state(
						transition(
							"ping",
							"two",
							// @ts-expect-error only one reduce is allowed, and it must be last
							reduce((context) => context),
							reduce((context) => context),
						),
					),
					two: final(),
				}),
			),
		).toThrow(/at most one/)
	})

	test("reduce may be omitted when the source context already fits the target", () => {
		const machine = defineMachine<Spec>().create(
			"one",
			({ state, final, transition }) => ({
				one: state(transition("ping", "two")),
				two: final(),
			}),
		)

		const service = interpret(machine, { attempts: 4 })
		service.send({ type: "ping" })
		expect(service.snapshot).toEqual({ state: "two", context: { attempts: 4 } })
	})
})

// ---------------------------------------------------------------------------
// What the types catch
// ---------------------------------------------------------------------------

describe("type errors", () => {
	type Spec = {
		states: { idle: { attempts: number }; authed: { token: string } }
		events: { login: { username: string }; [retry]: Record<never, never> }
	}

	test("a reducer must return its target state's context", () => {
		defineMachine<Spec>().create(
			"idle",
			({ state, final, transition, reduce }) => ({
				idle: state(
					transition(
						"login",
						"authed",
						// @ts-expect-error returns idle's context, target `authed` declares { token }
						reduce(() => ({ attempts: 1 })),
					),
				),
				authed: final(),
			}),
		)
	})

	test("a reducer may only read its source state's context", () => {
		defineMachine<Spec>().create(
			"idle",
			({ state, final, transition, reduce }) => ({
				idle: state(
					transition(
						"login",
						"authed",
						// @ts-expect-error `token` is not on idle's context
						reduce((context) => ({ token: context.token })),
					),
				),
				authed: final(),
			}),
		)
	})

	test("reduce cannot be omitted when the shapes differ", () => {
		defineMachine<Spec>().create(
			"idle",
			({ state, final, transition }) => ({
				// @ts-expect-error idle's context is not assignable to authed's
				idle: state(transition("login", "authed")),
				authed: final(),
			}),
		)
	})

	test("target and event names must exist", () => {
		defineMachine<Spec>().create(
			"idle",
			({ state, final, transition }) => ({
				// @ts-expect-error no such state
				idle: state(transition("login", "nope")),
				authed: final(),
			}),
		)
		defineMachine<Spec>().create(
			"idle",
			({ state, final, transition }) => ({
				// @ts-expect-error no such event
				idle: state(transition("nope", "authed")),
				authed: final(),
			}),
		)
	})

	test("the state map must match the spec exactly", () => {
		// @ts-expect-error `authed` is missing
		defineMachine<Spec>().create("idle", ({ state }) => ({
			idle: state(),
		}))
		defineMachine<Spec>().create("idle", ({ state, final }) => ({
			idle: state(),
			authed: final(),
			// @ts-expect-error no such state in the spec
			bogus: final(),
		}))
	})

	test("send rejects undeclared events and wrong payloads", () => {
		const machine = defineMachine<Spec>().create(
			"idle",
			({ state, final, transition, reduce }) => ({
				idle: state(
					transition(
						"login",
						"authed",
						reduce((_data, event) => ({ token: event.username })),
					),
				),
				authed: final(),
			}),
		)
		const service = interpret(machine, { attempts: 0 })

		// @ts-expect-error `username` must be a string
		service.send({ type: "login", username: 42 })
		// @ts-expect-error the machine declares no `logout`
		service.send({ type: "logout" })
	})
})

// ---------------------------------------------------------------------------
// Narrowed send
// ---------------------------------------------------------------------------

describe("send narrowed to the current state", () => {
	type Spec = {
		states: { idle: { n: number }; busy: { n: number } }
		events: { start: Record<never, never>; cancel: Record<never, never> }
	}

	const machine = defineMachine<Spec>().create(
		"idle",
		({ state, transition }) => ({
			idle: state(transition("start", "busy")),
			busy: state(transition("cancel", "idle")),
		}),
	)

	test("`current.send` only accepts what the current state handles", () => {
		const service = interpret(machine, { n: 0 })
		const current = service.current

		if (current.state === "idle") {
			expectTypeOf(current.send).toBeCallableWith({ type: "start" })
			// @ts-expect-error `idle` does not handle `cancel`
			current.send({ type: "cancel" })
			current.send({ type: "start" })
		}
	})

	test("the unnarrowed `send` still accepts the whole union", () => {
		const service = interpret(machine, { n: 0 })
		service.send({ type: "cancel" }) // no-op at runtime, but allowed
		expect(service.snapshot.state).toBe("idle")
		service.send({ type: "start" })
		expect(service.snapshot.state).toBe("busy")
	})
})

// ---------------------------------------------------------------------------
// Symbol event names
// ---------------------------------------------------------------------------

describe("symbol events", () => {
	test("symbols work as event names and cannot collide", () => {
		type Spec = {
			states: { a: { n: number }; b: { n: number } }
			events: { [retry]: { attempt: number } }
		}

		const machine = defineMachine<Spec>().create(
			"a",
			({ state, final, transition, reduce }) => ({
				a: state(
					transition(
						retry,
						"b",
						reduce((_data, event) => ({ n: event.attempt })),
					),
				),
				b: final(),
			}),
		)

		const service = interpret(machine, { n: 0 })
		service.send({ type: retry, attempt: 3 })
		expect(service.snapshot).toEqual({ state: "b", context: { n: 3 } })
	})
})
