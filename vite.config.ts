import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/**
 * Library build. One ESM file, declarations beside it, nothing else.
 *
 * `type: module` and `engines: node >= 26` are already declared, so a CommonJS,
 * UMD or IIFE output would serve nobody this package targets — the `formats`
 * list is deliberately a single entry.
 */
export default defineConfig({
	build: {
		target: 'esnext',
		lib: {
			entry: 'src/totorobot.ts',
			formats: ['es'],
			fileName: () => 'totorobot.js',
		},
		// The package is dependency-free; nothing should ever be marked
		// external, so an accidental import would show up as a size jump
		// rather than as a silent runtime dependency.
		rollupOptions: {
			external: [],
		},
		minify: 'terser',
		terserOptions: {
			// Terser's `unsafe_arrows` and `unsafe_methods` are only applied
			// when it knows it may emit ES2015+ output; its own default is
			// still ES5, which would silently disable both.
			ecma: 2020,
			compress: {
				ecma: 2020,
				// Measured against this module's actual shape (`pnpm size`,
				// brotli): passes 2 through 5 land on the exact same byte
				// count as pass 1, so there is no repeated-pass win to buy
				// here today. Kept at 1 rather than a larger assumed number;
				// re-measure if the source grows enough branches for a
				// second pass to start exposing new constants.
				passes: 1,
				// unsafe_methods measures a real 2 B brotli (4 gzip, 7 raw)
				// smaller. unsafe_arrows measures zero difference on the
				// current source — nothing here is written in a shape it
				// rewrites — but it costs nothing to leave on and remains
				// correct for the target environment, so it stays as a
				// no-cost safety net rather than because it currently earns
				// its keep.
				unsafe_arrows: true,
				unsafe_methods: true,
				// `draining` is the only boolean in the module and is never
				// compared with `===`, only read for truthiness, so
				// rewriting its literals as 0/1 is safe here. Measures 3 B
				// smaller, brotli and raw alike.
				booleans_as_integers: true,
			},
			mangle: {
				// Requesting this is really just documentation: terser
				// forces `mangle.toplevel` on whenever it also sees
				// `module: true`, which Vite always passes for `formats:
				// ['es']` (see terser's `format_mangler_options`) —
				// setting this to `false` here measurably changes nothing
				// through the real build, only through terser called
				// directly on unbundled code. There is no ESM build where
				// this is actually a choice.
				toplevel: true,
				// No property mangling. A closure-based host has almost no
				// internal property surface to gain from it, against a real
				// risk of renaming a public key.
				properties: false,
			},
			format: {
				ecma: 2020,
				comments: false,
			},
		},
		// The size script reads the bundle straight out of `dist`, so leave
		// the directory clean on every build.
		emptyOutDir: true,
		reportCompressedSize: false,
	},
	plugins: [
		dts({
			include: ['src'],
			rollupTypes: true,
		}),
	],
})
