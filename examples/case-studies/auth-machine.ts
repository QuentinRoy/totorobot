import { defineMachine } from "../../src/totorobot.ts"

/**
 * Example 2: per-state context + a typed async `invoke`.
 *
 * `token` exists only on `authenticated`, `password` only while
 * `authenticating`, and `error` only on `idle` - so none of them can be read
 * from a state where they would be meaningless.
 */
export interface LoginEvent {
	type: "login"
	username: string
	password: string
}

interface Credentials {
	username: string
	password: string
}

interface LoginResult {
	token: string
}

async function fakeLogin(credentials: Credentials): Promise<LoginResult> {
	await new Promise((resolve) => setTimeout(resolve, 50))
	if (credentials.password !== "hunter2") {
		throw new Error("invalid credentials")
	}
	return { token: `token-for-${credentials.username}` }
}

type AuthSpec = {
	states: {
		idle: { error: string | null; attempts: number }
		authenticating: Credentials & { attempts: number }
		authenticated: { username: string; token: string }
	}
	events: {
		login: Omit<LoginEvent, "type">
	}
}

export const authMachine = defineMachine<AuthSpec>().create(
	"idle",
	({ state, final, transition, invoke, guard, reduce }) => ({
		idle: state(
			transition(
				"login",
				"authenticating",
				// A guard sees the same typed context + event as the reducer.
				guard((_context, event) => event.username.trim().length > 0),
				reduce((context, event) => ({
					username: event.username,
					password: event.password,
					attempts: context.attempts + 1,
				})),
			),
		),

		// `Credentials` comes from `fakeLogin`'s parameter, and `LoginResult` flows
		// into `done` as `result` - no hand-written settlement event wrapper.
		authenticating: invoke(
			(context) => fakeLogin(context),
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
					reduce((context, invokeError) => ({
						error:
							invokeError instanceof Error
								? invokeError.message
								: String(invokeError),
						attempts: context.attempts,
					})),
				),
			],
		),

		authenticated: final(),
	}),
)
