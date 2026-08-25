/**
 * The shipped `.d.ts` contains no `any` at all — not in the exports, not in the
 * module-local declarations the rollup carries along with them.
 *
 * `surface.test-d.ts` proves the stronger thing about the part a caller can
 * reach, and it proves it here too, since the type half of `pnpm test:dist`
 * resolves the package to this same file. What that walk cannot see is an `any`
 * sitting in a declaration nothing public refers to *yet*: a helper someone
 * types loosely today and wires into an exported signature tomorrow, at which
 * point the leak is already written and only the wiring is new. Reading the
 * emitted text is how that gets caught while it is still harmless.
 *
 * Dist-only, hence the filename: there is no artifact to read under `pnpm test`,
 * and a check that quietly skips when its subject is missing is worse than no
 * check. `vitest.dist.config.ts` includes `*.dist-test.ts`; the source config's
 * globs do not match it.
 */

import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const declarations = readFileSync(
	new URL('../dist/totorobot.d.ts', import.meta.url),
	'utf8',
)

/**
 * Comments are stripped first, because the prose legitimately discusses `any` —
 * this file's own subject is hard to write about otherwise. Naive enough to be
 * fooled by `//` inside a template-literal type, which the key grammar has no
 * way to produce today; if one ever appears, over-stripping shows up as a
 * missed leak rather than a false alarm, so re-read this then.
 */
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
	// A stripper bug, a moved artifact or an empty build would otherwise leave
	// the assertion above passing against nothing at all.
	expect(declarations).toContain('export declare function machine')
	expect(code).toContain('export declare function machine')
	expect(code).toContain('Machine<I, S, K, Init>')
})
