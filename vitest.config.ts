import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// `explorations/` is prototype evidence rather than library coverage,
		// but it is included for the same reason it is type-checked: a finding
		// that stops holding should fail the build.
		//
		// `.test-d.ts` files are included here too, per Vitest's own
		// recommendation: running them as well as type-checking them means a
		// mistyped `@ts-expect-error` fails instead of silently passing.
		include: [
			'tests/**/*.test.{js,ts}',
			'tests/**/*.test-d.ts',
			'explorations/**/*.test.ts',
		],

		typecheck: {
			// The single switch for the type-test pass: every `vitest run`
			// — `pnpm test` and `pnpm test:coverage` alike — includes it, so
			// no script needs to pass `--typecheck` of its own.
			enabled: true,
			tsconfig: 'tests/tsconfig.json',
			ignoreSourceErrors: false,
			include: ['tests/**/*.test-d.ts'],
		},

		coverage: {
			provider: 'v8',
			include: ['src/**'],
			// The construction tracer fails on landing (the v1 entry point
			// doesn't exist yet), so the run fails before coverage would
			// otherwise report — keep the threshold check visible rather
			// than silently skipped.
			reportOnFailure: true,
			thresholds: {
				lines: 100,
				functions: 100,
				statements: 100,
				branches: 100,
			},
		},
	},
})
