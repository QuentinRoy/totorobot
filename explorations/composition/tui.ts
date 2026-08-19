/**
 * PROTOTYPE — throwaway. See ./README.md.  Run: `pnpm proto:composition`
 *
 * A shell over the six scenarios. It knows nothing about either model — it
 * renders `peek()`, dispatches `keys`, and draws the trace with its nesting,
 * which is where the scheduler question becomes visible.
 */

import { build as ex1a } from './ex1-marking-menu/a.ts'
import { build as ex1b } from './ex1-marking-menu/b.ts'
import { build as ex2a } from './ex2-gesture-stack/a.ts'
import { build as ex2b } from './ex2-gesture-stack/b.ts'
import { build as ex3a } from './ex3-accordion/a.ts'
import { build as ex3b } from './ex3-accordion/b.ts'
import { nested, shared, type Scheduler } from './scheduler.ts'
import { tracer, type Tracer } from './trace.ts'
import type { Build, Scenario } from './scenario.ts'

const B = '\u001b[1m'
const D = '\u001b[2m'
const R = '\u001b[0m'

const examples: readonly (readonly [Build, Build])[] = [
	[ex1a, ex1b],
	[ex2a, ex2b],
	[ex3a, ex3b],
]

let which = 0
let model = 0 // 0 = A, 1 = B
let flat = true

let log: Tracer = tracer()
let sched: Scheduler = shared()
let scenario: Scenario = examples[0]![0]!(sched, log)

function rebuild(): void {
	log = tracer()
	sched = flat ? shared() : nested
	scenario = examples[which]![model]!(sched, log)
}

function show(data: unknown): string {
	if (data === undefined) return `${D}(void)${R}`
	const text = JSON.stringify(data)
	return text.length > 84 ? `${text.slice(0, 81)}...` : text
}

function render(): void {
	const lines: string[] = []
	lines.push(`${B}Composition prototype — issue #24${R}`)
	lines.push(`${B}${scenario.title}${R}`)
	lines.push(`${D}${scenario.note}${R}`)
	lines.push(
		`${D}scheduler:${R} ` +
			(flat
				? `${B}shared${R} (one queue — cross-machine sends drain flat)`
				: `${B}per-host${R} (today — cross-machine sends nest)`),
	)
	lines.push('')

	lines.push(`${B}MACHINES${R}`)
	for (const peek of scenario.peek()) {
		lines.push(
			`  ${peek.name.padEnd(12)} ${B}${peek.state.padEnd(10)}${R} ${D}${show(peek.data)}${R}`,
		)
	}
	lines.push('')

	lines.push(
		`${B}TRACE${R} ${D}(indent = ran inside the previous line's dispatch)${R}`,
	)
	const entries = log.entries.slice(-16)
	if (entries.length === 0) lines.push(`  ${D}(nothing yet)${R}`)
	for (const entry of entries) {
		lines.push(`  ${'  '.repeat(entry.depth)}${entry.text}`)
	}
	lines.push('')

	lines.push(`${B}KEYS${R}`)
	lines.push(
		'  ' +
			scenario.keys
				.map((k) => `${B}[${k.key}]${R} ${D}${k.label}${R}`)
				.join('  '),
	)
	lines.push(
		`  ${B}[[ ]]${R} ${D}example${R}  ${B}[\\]${R} ${D}model A/B${R}  ${B}[=]${R} ${D}scheduler${R}  ${B}[0]${R} ${D}clear trace${R}  ${B}[q]${R} ${D}quit${R}`,
	)

	console.clear()
	console.log(lines.join('\n'))
}

const stdin = process.stdin
stdin.setRawMode?.(true)
stdin.resume()
stdin.setEncoding('utf8')

stdin.on('data', (chunk: string | Buffer) => {
	const key = String(chunk)
	if (key === 'q' || key === '') {
		stdin.setRawMode?.(false)
		process.exit(0)
	}
	if (key === '[') {
		which = (which + examples.length - 1) % examples.length
		rebuild()
	} else if (key === ']') {
		which = (which + 1) % examples.length
		rebuild()
	} else if (key === '\\') {
		model = model === 0 ? 1 : 0
		rebuild()
	} else if (key === '=') {
		flat = !flat
		rebuild()
	} else if (key === '0') {
		log.clear()
	} else {
		const found = scenario.keys.find((k) => k.key === key)
		if (found) found.run()
	}
	render()
})

render()
