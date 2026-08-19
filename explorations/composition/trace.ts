/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * A trace with nesting depth, so the order in which peer machines settle is
 * visible instead of inferred. Depth is what makes the cross-host question
 * legible: a send that runs *inside* another machine's notify loop is drawn
 * indented, a send that waits its turn is drawn flat.
 */

export type Entry = { readonly depth: number; readonly text: string }

export type Tracer = {
	readonly entries: readonly Entry[]
	log(text: string): void
	nest<T>(text: string, fn: () => T): T
	clear(): void
}

export function tracer(): Tracer {
	const entries: Entry[] = []
	let depth = 0
	return {
		entries,
		log(text) {
			entries.push({ depth, text })
		},
		nest(text, fn) {
			entries.push({ depth, text })
			depth += 1
			try {
				return fn()
			} finally {
				depth -= 1
			}
		},
		clear() {
			entries.length = 0
		},
	}
}
