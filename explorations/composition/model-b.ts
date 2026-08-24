/**
 * PROTOTYPE — throwaway. OPTION B — the encapsulated machine.
 *
 * The same `machine({…})` call, with two additions and one subtraction.
 *
 *   + `outputs: type<Outputs>()` — a third declared vocabulary, beside
 *     `inputs` and `states`.
 *   + `actions` (docs/api-rationale.md §9: trigger-keyed, a bare state name is
 *     residency and returns its teardown, an arrow key is an edge) whose
 *     argument bag carries `emit` alongside `send`.
 *   − the host publishes declared outputs only. `.on('opened', …)` names an
 *     output, never a state or a transition. No `current`, no `available`, no
 *     patterns. `inspect()` is issue #24's debugging caveat, and nothing else.
 *
 * `emit` is the whole difference at the seam: a machine says what happened in
 * its own words, and no consumer names an internal state.
 */

import { machine as core } from '../../src/totorobot.ts'
import {
	isEdge,
	isPersistent,
	type Names,
	type Post,
	type Rec,
	type StartArgs,
	type Table,
	type Vocab,
} from './dsl.ts'

export { type } from '../../src/totorobot.ts'
export { persistent } from './dsl.ts'

/**
 * Trigger-keyed, per §9. A bare state name is residency — it runs on arrival,
 * restarts on re-entry, and its return value is the teardown. An arrow key is
 * an edge, and gets the transition record.
 */
export type Actions<
	I extends Vocab,
	S extends Vocab,
	O extends Vocab,
	A extends string,
> = {
	// Optional, and keyed by a union computed from `states` and `transitions`
	// rather than inferred from this block. Inferring the key set here would
	// make the block context-sensitive to a type parameter it is itself
	// producing, and every action's argument bag collapses to `never` — the
	// same inference trap note 06, F2 records. Cost: a trigger must be an exact
	// transition key or a state name; a wildcard pattern like
	// `'draft -cancel> *'` is not expressible in this prototype.
	[T in A]?: T extends Names<S>
		? (arg: {
				readonly data: S[T]
				readonly send: Post<I>
				readonly emit: Post<O>
			}) => (() => void) | void
		: (
				arg: Rec<I, S, T> & { readonly send: Post<I>; readonly emit: Post<O> },
			) => void
}

export type Host<I extends Vocab, O extends Vocab> = {
	readonly send: Post<I>
	/** Declared outputs. There is nothing else to subscribe to. */
	readonly on: <N extends Names<O>>(
		output: N,
		listener: (payload: O[N]) => void,
	) => () => void
	/** Debug channel. Not the seam — that is the point of Option B. */
	readonly inspect: () => { readonly state: string; readonly data: unknown }
}

type Raw = {
	readonly current: { readonly state: string; readonly data: unknown }
	readonly send: (...args: any[]) => void
	readonly observe: (pattern: string, listener: (e: any) => void) => () => void
}

export function machine<
	S extends Vocab,
	I extends Vocab,
	O extends Vocab,
	Init extends Names<S>,
	K extends string,
>(definition: {
	readonly initial: Init
	readonly inputs?: I | undefined
	readonly states?: S | undefined
	readonly outputs?: O | undefined
	readonly transitions: Table<I, S, K>
	readonly actions?: Actions<I, S, O, Names<NoInfer<S>> | NoInfer<K>>
}): { readonly start: (...args: StartArgs<S, Init>) => Host<I, O> } {
	const built = core({
		initial: definition.initial as never,
		transitions: definition.transitions as never,
	}) as unknown as { start: (...args: unknown[]) => Raw }

	const actions = (definition.actions ?? {}) as Readonly<
		Record<string, (arg: never) => unknown>
	>

	return {
		start: (...args: StartArgs<S, Init>) => {
			const host = built.start(...(args as unknown[]))
			const listeners: Record<
				string,
				((payload: unknown) => void)[] | undefined
			> = Object.create(null)

			const emit = (name: string, payload?: unknown) => {
				for (const fn of listeners[name] ?? []) fn(payload)
			}
			const bag = { send: host.send, emit }

			for (const trigger in actions) {
				const action = actions[trigger] as (arg: unknown) => unknown

				if (isEdge(trigger)) {
					host.observe(trigger, (e: object) => {
						action({ ...e, ...bag })
					})
					continue
				}

				const stays = isPersistent(action)
				let teardown: unknown
				host.observe(`${trigger} -> *`, (e: { to: { state: string } }) => {
					if (stays && e.to.state === trigger) return
					if (typeof teardown === 'function') teardown()
					teardown = undefined
				})
				host.observe(
					`* -> ${trigger}`,
					(e: { from: { state: string }; to: { data: unknown } }) => {
						if (stays && e.from.state === trigger) return
						teardown = action({ data: e.to.data, ...bag })
					},
				)
				if (host.current.state === trigger) {
					teardown = action({ data: host.current.data, ...bag })
				}
			}

			return {
				send: host.send as Post<I>,
				on: ((output: string, listener: (payload: unknown) => void) => {
					const list = (listeners[output] ??= [])
					list.push(listener)
					return () => {
						const at = list.indexOf(listener)
						if (at >= 0) list.splice(at, 1)
					}
				}) as Host<I, O>['on'],
				inspect: () => host.current,
			}
		},
	}
}
