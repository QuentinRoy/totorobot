import { machine, type } from '../../src/totorobot.ts'

/**
 * Example 3: the `actions` block — effects the definition owns.
 *
 * The other two examples keep every effect in the caller, which is what v1
 * offered. Here the debounce timer and the request live on the definition
 * instead, keyed by the state they belong to: a key with no arrow is a
 * residency, so it runs on entry and its returned function runs on exit.
 * Nothing else has to remember to cancel them.
 *
 * The dividing line is roughly whether the effect feeds back in. The debounce
 * exists only to send this machine its own `debounceElapsed`, so it belongs
 * here; reporting to a logger or driving another host belongs on `observe`,
 * where `index.ts` puts it.
 *
 * The request is the borderline case, and the two examples disagree on
 * purpose: auth-machine leaves the same effect to the caller, because there
 * the caller has to hold the credentials anyway. Here nothing outside cares
 * that a request is in flight, and its cancellation is exactly this state's
 * exit, so the residency owns it.
 */
type Inputs = {
	type: { text: string }
	debounceElapsed: undefined
	results: { items: readonly string[] }
}

type States =
	| { name: 'idle' }
	| { name: 'typing'; query: string }
	| { name: 'loading'; query: string }
	| { name: 'results'; query: string; items: readonly string[] }

const DEBOUNCE_MS = 40

const CORPUS = ['totoro', 'totorobot', 'robot3', 'xstate', 'robotics']

async function fakeSearch(query: string): Promise<readonly string[]> {
	await new Promise((resolve) => setTimeout(resolve, 30))
	return CORPUS.filter((entry) => entry.startsWith(query))
}

export const searchBox = machine({
	inputs: type<Inputs>(),
	states: type<States>(),
	initial: 'idle',

	transitions: {
		'idle -type> typing': ({ inputData }) => ({ query: inputData.text }),
		'typing -type> typing': ({ inputData }) => ({ query: inputData.text }),
		'results -type> typing': ({ inputData }) => ({ query: inputData.text }),
		// A keystroke during the request abandons it: the `loading` residency
		// tears down on the way out, so the reply that is already in flight is
		// dropped rather than racing the next one.
		'loading -type> typing': ({ inputData }) => ({ query: inputData.text }),

		'typing -debounceElapsed> loading': ({ state }) => ({
			query: state.query,
		}),
		'loading -results> results': ({ state, inputData }) => ({
			query: state.query,
			items: inputData.items,
		}),
	},

	actions: {
		// The debounce: a timer whose only purpose is to send this machine its
		// own input. A `send` from an action is queued like any other.
		typing: ({ send }) => {
			const timer = setTimeout(() => send('debounceElapsed'), DEBOUNCE_MS)
			return () => clearTimeout(timer)
		},

		loading: ({ to, send }) => {
			let live = true
			void fakeSearch(to.query).then((items) => {
				if (live) send('results', { items })
			})
			return () => {
				live = false
			}
		},
	},
})

/** Resolves the next time the host settles on `results`. */
export function nextResults(
	host: ReturnType<typeof searchBox.start>,
): Promise<readonly string[]> {
	return new Promise((resolve) => {
		const stop = host.observe('* -> results', (e) => {
			stop()
			resolve(e.to.items)
		})
	})
}
