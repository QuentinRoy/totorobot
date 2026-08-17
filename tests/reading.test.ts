import { describe, expect, test } from 'vitest'

import { editor } from './fixtures.ts'

/** Clones plain objects and arrays; leaves functions and other values by reference. */
function cloneDeep<T>(value: T): T {
	if (Array.isArray(value)) return value.map(cloneDeep) as T
	if (
		value !== null &&
		typeof value === 'object' &&
		value.constructor === Object
	) {
		return Object.fromEntries(
			Object.entries(value).map(([key, v]) => [key, cloneDeep(v)]),
		) as T
	}
	return value
}

describe('reading', () => {
	test('[4] current is { state, data }, with data undefined for a void state', () => {
		const host = editor.start()
		expect(host.current).toEqual({ state: 'idle', data: undefined })

		host.send('open', { text: 'hello' })
		expect(host.current).toEqual({
			state: 'draft',
			data: { text: 'hello', revision: 0 },
		})
	})

	test('[5] a value read from current before a transition is unchanged after it', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		const before = host.current
		const beforeDataClone = cloneDeep(before.data)
		const beforeDataRef = before.data

		host.send('revise', { text: 'goodbye' })

		// Deep equality catches a value that changed; object identity catches an
		// implementation that mutated the old data in place even where, by
		// coincidence, the mutated value would still equal the clone.
		expect(before.data).toEqual(beforeDataClone)
		expect(before.data).toBe(beforeDataRef)
		expect(host.current.data).not.toBe(beforeDataRef)
	})

	test('[6] available lists the current state inputs in table declaration order', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		expect(host.available).toEqual([
			'revise',
			'touch',
			'submit',
			'poke',
			'lock',
		])
	})

	test('[6] available lists an input carried by two rows only once', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		expect(host.available.filter((name) => name === 'submit')).toHaveLength(1)
	})

	test('[6] available lists an input whose every candidate row would decline', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })

		// 'draft -poke> draft' always calls skip(), yet it is still advertised —
		// available is derived from the table, not from running the handler.
		expect(host.available).toContain('poke')
	})

	test('[7] available is empty for a state with no outgoing rows', () => {
		const host = editor.start()
		host.send('open', { text: 'hello' })
		host.send('lock')

		expect(host.current.state).toBe('locked')
		expect(host.available).toEqual([])
	})
})
