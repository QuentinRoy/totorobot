/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * What the TUI drives. Every example exports two factories with this shape —
 * one per model — so the shell knows nothing about either.
 */

import type { Scheduler } from './scheduler.ts'
import type { Tracer } from './trace.ts'

export type Key = {
	readonly key: string
	readonly label: string
	readonly run: () => void
}

export type Peek = {
	readonly name: string
	readonly state: string
	readonly data: unknown
}

export type Scenario = {
	readonly title: string
	readonly note: string
	readonly keys: readonly Key[]
	peek(): readonly Peek[]
}

export type Build = (sched: Scheduler, log: Tracer) => Scenario
