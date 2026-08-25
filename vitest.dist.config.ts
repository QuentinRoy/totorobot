import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Re-runs the v1 suite against the built artifact rather than the source it
 * came from — the `unsafe_*` terser options can change runtime semantics, and
 * the declaration rollup can alter the public type surface with no runtime
 * symptom, neither of which a source-only run would notice. `pnpm test:dist`
 * builds first, then points this config at the result.
 *
 * No test is duplicated to get there: the suite imports the library by package
 * name, so both halves are redirected by remapping that one specifier — to the
 * minified bundle for the runtime tests here, and to the emitted declarations
 * for the type tests in `tests/tsconfig.dist.json`. The two need separate
 * mappings because the type pass resolves through the tests' own tsconfig
 * rather than through this bundler.
 *
 * Importing by name rather than by a relative path into `src/` is what makes
 * that possible. A relative specifier cannot be remapped for the type pass at
 * all: `paths` and `rootDirs` only engage once the file the specifier resolves
 * to is missing, and `src/totorobot.ts` always exists.
 */
export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^totorobot$/,
				replacement: path.resolve(import.meta.dirname, 'dist/totorobot.js'),
			},
		],
	},

	test: {
		include: ['tests/**/*.test.{js,ts}', 'tests/**/*.test-d.ts'],

		// No coverage block: the thresholds are scoped to `src/`, and this run
		// exercises the built artifact rather than an instrumentable source
		// tree, so carrying them here would fail for the wrong reason.

		typecheck: {
			enabled: true,
			tsconfig: 'tests/tsconfig.dist.json',
			ignoreSourceErrors: false,
			include: ['tests/**/*.test-d.ts'],
		},
	},
})
