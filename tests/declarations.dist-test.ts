/**
 * The shipped `.d.ts` contains no `any`, including in the module-local
 * declarations the rollup carries along with the exports. `surface.test-d.ts`
 * proves the stronger thing about the reachable part; this catches an `any`
 * sitting in a declaration nothing public refers to yet (I24).
 *
 * Dist-only, hence the filename: there is nothing to read under `pnpm test`,
 * and a check that skips when its subject is missing is worse than none.
 */

import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const declarations = readFileSync(
	new URL('../dist/totorobot.d.ts', import.meta.url),
	'utf8',
)

// Comments go first, because the prose legitimately discusses `any`. Naive
// enough to be fooled by `//` inside a template-literal type, which the key
// grammar cannot produce today.
const code = declarations
	.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
	.replace(/\/\/[^\n]*/g, '')

test('the emitted declarations are free of `any`', () => {
	const offenders = code
		.split('\n')
		.map((line, i) => [i + 1, line] as const)
		.filter(([, line]) => /\bany\b/.test(line))
		.map(([number, line]) => `${number}: ${line.trim()}`)

	expect(offenders).toEqual([])
})

test('the check is reading the declarations it thinks it is', () => {
	// Otherwise a stripper bug or an empty build leaves the assertion above
	// passing against nothing.
	expect(declarations).toContain('export declare function machine')
	expect(code).toContain('export declare function machine')
	expect(code).toContain('Machine<I, S, K, Init>')
})
