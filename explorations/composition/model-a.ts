/**
 * PROTOTYPE — throwaway. OPTION A — the open transition host.
 *
 * `machine({ initial, inputs, states, transitions })` — v1 exactly, plus the
 * one designed-but-unbuilt piece Option A needs to be compared fairly:
 *
 *     host.on('loading', () => { start(); return () => stop() })
 *
 * A bare state name is residency. The listener runs on every arrival, its
 * returned teardown runs on every departure, and a self-transition tears down
 * before it sets up — the `docs/api.md:347` recipe, promoted into `.on`.
 * Arrow-bearing keys keep meaning transitions, unchanged.
 *
 * Everything a peer needs is here and nothing is declared for it: effects and
 * cross-machine wiring are both `.on`, attached by whoever instantiates.
 */

import { machine as core } from '../../src/totorobot.ts'
import {
	isEdge,
	isPersistent,
	type At,
	type Names,
	type Post,
	type Rec,
	type Snap,
	type StartArgs,
	type Table,
	type Vocab,
} from './dsl.ts'

export { type } from '../../src/totorobot.ts'
export { persistent } from './dsl.ts'

export type Host<I extends Vocab, S extends Vocab> = {
	readonly current: Snap<S>
	readonly available: readonly Names<I>[]
	readonly send: Post<I>
	readonly on: {
		/** Residency: a bare state name, with an optional teardown. */
		<N extends Names<S>>(
			state: N,
			resident: (snapshot: At<S, N>) => (() => void) | void,
		): () => void
		/** Transitions: the pattern language, narrowing the record. */
		<P extends string>(
			pattern: P,
			listener: (e: Rec<I, S, P>) => void,
		): () => void
	}
}

type Raw = {
	readonly current: { readonly state: string; readonly data: unknown }
	readonly available: readonly string[]
	readonly send: (...args: any[]) => void
	readonly observe: (pattern: string, listener: (e: any) => void) => () => void
}

export function machine<
	S extends Vocab,
	I extends Vocab,
	Init extends Names<S>,
	K extends string,
>(definition: {
	readonly initial: Init
	readonly inputs?: I | undefined
	readonly states?: S | undefined
	readonly transitions: Table<I, S, K>
}): { readonly start: (...args: StartArgs<S, Init>) => Host<I, S> } {
	const built = core({
		initial: definition.initial as never,
		transitions: definition.transitions as never,
	}) as unknown as { start: (...args: unknown[]) => Raw }

	return {
		start: (...args: StartArgs<S, Init>) => {
			const host = built.start(...(args as unknown[]))

			const on = (trigger: string, listener: (arg: any) => unknown) => {
				if (isEdge(trigger)) return host.observe(trigger, listener)

				// Residency. Exit is registered first, so a self-transition tears
				// down before it sets up — unless the resident is `persistent`,
				// which skips both halves of a self-transition.
				const stays = isPersistent(listener)
				let teardown: (() => void) | void
				const offExit = host.observe(
					`${trigger} -> *`,
					(e: { to: { state: string } }) => {
						if (stays && e.to.state === trigger) return
						if (teardown) teardown()
						teardown = undefined
					},
				)
				const offEnter = host.observe(
					`* -> ${trigger}`,
					(e: { from: { state: string }; to: unknown }) => {
						if (stays && e.from.state === trigger) return
						teardown = (listener as (s: unknown) => (() => void) | void)(e.to)
					},
				)
				// Nothing announces a state we are already in.
				if (host.current.state === trigger) {
					teardown = (listener as (s: unknown) => (() => void) | void)(
						host.current,
					)
				}
				return () => {
					offExit()
					offEnter()
					if (teardown) teardown()
				}
			}

			return {
				get current() {
					return host.current as Snap<S>
				},
				get available() {
					return host.available as readonly Names<I>[]
				},
				send: host.send as Post<I>,
				on: on as Host<I, S>['on'],
			}
		},
	}
}
