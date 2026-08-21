/**
 * PROTOTYPE — throwaway. Example 3 — the ceremony floor — OPTION A.
 *
 * The smallest machine anyone writes: two states, three rows. Shipped by a
 * component library, used three times as an accordion, and rendered — which is
 * what most consumers of most machines actually do.
 *
 * The whole file below the machine is the app. Note that the machine knows
 * nothing about accordions, and that it did not have to.
 */

import { machine, type } from '../model-a.ts'
import type { Build } from '../scenario.ts'
import { bind, body, labels } from './domain.ts'

/* ============================================================= the widget */

type DisclosureInputs = { toggle: void; close: void }
type Disclosure = { closed: void; open: void }

const disclosure = machine({
	initial: 'closed',
	inputs: type<DisclosureInputs>(),
	states: type<Disclosure>(),

	transitions: {
		'closed -toggle> open': () => {},
		'open -toggle> closed': () => {},
		'open -close> closed': () => {},
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

		panel.on('* -> *', (e) =>
			log.log(`${label}: ${e.from.state} -${e.on ?? ''}> ${e.to.state}`),
		)

		// Effect and seam are one residency listener: mount the body while open,
		// and close the siblings on the way in.
		panel.on('open', () => {
			const unmount = body(label)
			step(`close others (${label} opened)`, () => {
				panels.forEach((other, j) => {
					if (i !== j) other.send('close')
				})
			})
			return unmount
		})
	})

	return {
		title: 'Ex3 · Accordion (ceremony floor) · A (open host)',
		note: 'Machine: 2 states, 3 rows, no outward vocabulary. Render: `current`, public.',
		keys: labels.map((label, i) => ({
			key: String(i + 1),
			label: `toggle ${label}`,
			run: () => step(`${label} <- toggle`, () => panels[i]!.send('toggle')),
		})),
		peek: () =>
			panels.map((panel, i) => ({
				name: labels[i]!,
				state: panel.current.state,
				data: panel.current.data,
			})),
	}
}
