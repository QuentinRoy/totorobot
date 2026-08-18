import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Re-runs the v1 suite against the built artifact rather than the source it
 * came from — `unsafe_*` terser options can change runtime semantics, and the
 * declaration rollup can alter the public type surface, neither of which a
 * source-only run would notice. `pnpm test:dist` builds first, then points
 * this config at the result. No test is duplicated to get there: both the
 * runtime and type files are the real ones in `tests/`, reached through
 * `.dist-typecheck/`, not copies.
 *
 * The two halves need different redirects. The runtime half runs through
 * Vite, so a `resolve.alias` on the import specifier is enough — Vite resolves
 * it before touching the filesystem. The type half runs through `tsc`
 * directly on `tests/tsconfig.json` (see the ticket: "the type pass resolves
 * through the tests' own tsconfig rather than a bundler alias"), and `tsc`
 * has no alias mechanism for a relative specifier — `compilerOptions.paths`
 * and `rootDirs` both only redirect a specifier once the file they would
 * otherwise resolve to is missing, and `../src/totorobot.ts` always exists.
 * So the type half is redirected by giving `tsc` a different file to find:
 * `.dist-typecheck/tests` is a symlink to the real `tests/`, and
 * `.dist-typecheck/src/totorobot.d.ts` is the only file at the path its
 * relative imports now resolve to, re-exporting the built declarations.
 */
export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^(\.\.\/)+src\/totorobot\.ts$/,
				replacement: path.resolve(import.meta.dirname, 'dist/totorobot.js'),
			},
		],
	},
	test: {
		include: [
			'.dist-typecheck/tests/**/*.test.{js,ts}',
			'.dist-typecheck/tests/**/*.test-d.ts',
		],

		// No coverage block: thresholds are scoped to `src/` for the source
		// run, and would fail here for the wrong reason — this run exercises
		// the built artifact, not an instrumentable source tree.

		typecheck: {
			enabled: true,
			tsconfig: '.dist-typecheck/tsconfig.json',
			ignoreSourceErrors: false,
			include: ['.dist-typecheck/tests/**/*.test-d.ts'],
		},
	},
})
