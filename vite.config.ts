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
				// Repeated passes: each one exposes constants and dead
				// branches for the next.
				passes: 3,
				// The build targets modern Node and modern browsers, where
				// both of these rewrites are safe.
				unsafe_arrows: true,
				unsafe_methods: true,
			},
			mangle: {
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
