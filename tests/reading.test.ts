import { describe, expect, test } from 'vitest'

import { editor } from './fixtures.ts'
import { cloneDeep } from './helpers.ts'

describe('reading', () => {
	test('current is { state, data }, with data undefined for a void state', () => {
		const host = editor.start()
		expect(host.current).toEqual({ state: 'idle', data: undefined })

		host.send('open', { text: 'hello' })
		expect(host.current).toEqual({
			state: 'draft',
			data: { text: 'hello', revision: 0 },
		})
	})

	test('a value read from current before a transition is unchanged after it', () => {
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
})
