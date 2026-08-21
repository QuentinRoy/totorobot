import { describe, expect, test } from 'vitest'

import { editor } from './fixtures.ts'
import { cloneDeep } from './helpers.ts'

describe('reading', () => {
	test('current is the state itself, tag included', () => {
		const host = editor.start()
		expect(host.current).toEqual({ name: 'idle' })

		host.send({ type: 'open', text: 'hello' })
		expect(host.current).toEqual({
			name: 'draft',
			text: 'hello',
			revision: 0,
		})
	})

	test('a value read from current before a transition is unchanged after it', () => {
		const host = editor.start()
		host.send({ type: 'open', text: 'hello' })

		const before = host.current
		const beforeClone = cloneDeep(before)
		const beforeRef = before

		host.send({ type: 'revise', text: 'goodbye' })

		// Deep equality catches a value that changed; object identity catches an
		// implementation that mutated the old state in place even where, by
		// coincidence, the mutated value would still equal the clone.
		expect(before).toEqual(beforeClone)
		expect(before).toBe(beforeRef)
		expect(host.current).not.toBe(beforeRef)
	})
})
