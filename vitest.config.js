import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// `explorations/` is prototype evidence rather than library coverage,
		// but it is included for the same reason it is type-checked: a finding
		// that stops holding should fail the build.
		include: ['tests/**/*.test.{js,ts}', 'explorations/**/*.test.ts'],
	},
})
