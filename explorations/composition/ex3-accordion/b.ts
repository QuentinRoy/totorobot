/**
 * PROTOTYPE — throwaway. Example 3 — the ceremony floor — OPTION B.
 *
 * The same two states and three rows, published. Two things to weigh:
 *
 *   · `outputs` + `actions` add six lines to a five-line machine, and
 *     `opened` / `closed` say exactly what the state names `open` / `closed`
 *     already said. Compare Example 2, where the same feature earned its keep.
 *   · the app cannot read the state, so rendering goes through `inspect()` —
 *     the debug channel — on every frame. The alternative is a third output
 *     mirroring the state plus a shadow copy at the consumer.
 */

import { machine, types } from '../model-b.ts'
import type { Build } from '../scenario.ts'
import { bind, body, labels } from './domain.ts'

/* ============================================================= the widget */

type DisclosureInputs = { toggle: void; close: void }
type Disclosure = { closed: void; open: void }
type Published = { opened: void; closed: void }

const disclosure = machine({
	initial: 'closed',
	inputs: types<DisclosureInputs>(),
	states: types<Disclosure>(),
	outputs: types<Published>(),

	transitions: {
		'closed -toggle> open': () => {},
		'open -toggle> closed': () => {},
		'open -close> closed': () => {},
	},

	// The body is a view, so it stays in the app. What the definition owns is
	// the announcement — and the announcement is a pair, `opened` / `closed`,
	// which is what the app needs to bracket the body. Note that both names
	// restate a state name the app is not allowed to read.
	actions: {
		open: ({ emit }) => {
			emit('opened')
			return () => emit('closed')
		},
	},
})

/* ================================================================ the app */

export const build: Build = (sched, log) => {
	bind((text) => log.log(text))

	const panels = labels.map(() => disclosure.start())

	const step = (label: string, run: () => void) =>
		sched.run(() => log.nest(label, run))

	panels.forEach((panel, i) => {
		const label = labels[i]!
		let unmount: (() => void) | undefined

		panel.on('opened', () => {
			log.log(`${label} !> opened`)
			unmount = body(label)
			step(`close others (${label} opened)`, () => {
				panels.forEach((other, j) => {
					if (i !== j) other.send('close')
				})
			})
		})
		panel.on('closed', () => {
			log.log(`${label} !> closed`)
			unmount?.()
			unmount = undefined
		})
	})

	return {
		title: 'Ex3 · Accordion (ceremony floor) · B (encapsulated)',
		note: 'Machine: +outputs +actions on 3 rows. Render: `inspect()`, the debug channel.',
		keys: labels.map((label, i) => ({
			key: String(i + 1),
			label: `toggle ${label}`,
			run: () => step(`${label} <- toggle`, () => panels[i]!.send('toggle')),
		})),
		peek: () =>
			panels.map((panel, i) => ({ name: labels[i]!, ...panel.inspect() })),
	}
}
