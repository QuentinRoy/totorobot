import { machine, types } from '../../src/totorobot.ts'

/**
 * Example 2: per-state data, a declining row, and an asynchronous result.
 *
 * `token` exists only on `authenticated`, `username` only from
 * `authenticating` onwards, and `error` only on `idle` — so none of them can be
 * read from a state where they would be meaningless.
 *
 * There is no library-owned request lifecycle: a transition is pure, so the
 * request lives in the caller and its settlement arrives as an ordinary
 * `send`. That is also what makes a stale result free — a `succeed` arriving
 * after we have already left `authenticating` matches no row and does nothing.
 */
type Inputs =
	| { type: 'login'; username: string; password: string }
	| { type: 'succeed'; token: string }
	| { type: 'fail'; reason: string }

type States =
	| { name: 'idle'; error: string | null; attempts: number }
	| {
			name: 'authenticating'
			username: string
			password: string
			attempts: number
	  }
	| { name: 'authenticated'; username: string; token: string }

export const authMachine = machine({
	initial: 'idle',
	inputs: types<Inputs>(),
	states: types<States>(),

	transitions: {
		// A blank username is not an attempt: the row declines, so nothing
		// changes and no listener fires. Declining is an ordinary outcome.
		'idle -login> authenticating': ({ state, input, skip }) =>
			input.username.trim()
				? {
						username: input.username,
						password: input.password,
						attempts: state.attempts + 1,
					}
				: skip(),

		'authenticating -succeed> authenticated': ({ state, input }) => ({
			username: state.username,
			token: input.token,
		}),

		'authenticating -fail> idle': ({ state, input }) => ({
			error: input.reason,
			attempts: state.attempts,
		}),
	},
})

interface Credentials {
	username: string
	password: string
}

async function fakeLogin({
	username,
	password,
}: Credentials): Promise<{ token: string }> {
	await new Promise((resolve) => setTimeout(resolve, 50))
	if (password !== 'hunter2') throw new Error('invalid credentials')
	return { token: `token-for-${username}` }
}

/**
 * The effect, owned by the caller: submit the credentials, then report the
 * outcome back as an input. `current` is consulted rather than a `send`
 * return value, because `send` has none.
 */
export async function signIn(
	host: ReturnType<typeof authMachine.start>,
	credentials: Credentials,
): Promise<void> {
	host.send({ type: 'login', ...credentials })
	if (host.current.name !== 'authenticating') return
	try {
		host.send({ type: 'succeed', ...(await fakeLogin(credentials)) })
	} catch (error) {
		host.send({
			type: 'fail',
			reason: error instanceof Error ? error.message : String(error),
		})
	}
}
