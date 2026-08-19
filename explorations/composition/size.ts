/**
 * PROTOTYPE — throwaway. `pnpm proto:composition:size`
 *
 * Two byte questions, because they have different answers.
 *
 * 1. SHIPPED — what the library costs. Three bundles through the project's own
 *    vite/terser settings (`vite.config.ts`), measured with the same zlib call
 *    `scripts/size.ts` uses, so these numbers are comparable to `pnpm size`:
 *
 *      core   src/totorobot.ts as shipped today
 *      A      core + residency on `.on`
 *      B      core + `outputs` / `actions` / `emit`
 *
 *    Caveat, and it matters: `model-a.ts` and `model-b.ts` are LAYERS over the
 *    host, not forks of it. Each pays for a wrapper object and, for residency,
 *    two `.on` registrations where an integrated implementation would hook the
 *    commit directly. Both are inflated by roughly the same wrapper, so read
 *    the A-vs-B delta, not the absolute numbers.
 *
 * 2. AUTHORED — what a user writes. Comments and blank lines stripped, then
 *    the `machine({…})` definitions measured on their own, so the answer is
 *    about the notation rather than about how chatty this prototype is.
 */

import { brotliCompressSync, gzipSync } from 'node:zlib'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))
const root = fileURLToPath(new URL('../..', import.meta.url))

/* ------------------------------------------------------------- 1. shipped */

const entries = {
	core: `export { machine, types } from ${JSON.stringify(join(root, 'src/totorobot.ts'))}`,
	A: `export { machine, types } from ${JSON.stringify(join(here, 'model-a.ts'))}`,
	B: `export { machine, types } from ${JSON.stringify(join(here, 'model-b.ts'))}`,
}

const scratch = mkdtempSync(join(tmpdir(), 'totorobot-size-'))
const shipped: Record<string, { raw: number; gzip: number; brotli: number }> =
	{}

for (const [name, source] of Object.entries(entries)) {
	const entry = join(scratch, `${name}.ts`)
	writeFileSync(entry, source)

	await build({
		logLevel: 'silent',
		build: {
			target: 'esnext',
			minify: 'terser',
			// Copied from `vite.config.ts` rather than imported: importing it
			// drags the config into `pnpm typecheck`, which does not cover it.
			// Keep in step with that file if its terser options change.
			terserOptions: {
				ecma: 2020,
				compress: {
					ecma: 2020,
					passes: 1,
					unsafe_arrows: true,
					unsafe_methods: true,
					booleans_as_integers: true,
				},
				mangle: { toplevel: true, properties: false },
				format: { ecma: 2020, comments: false },
			},
			reportCompressedSize: false,
			rollupOptions: { external: [] },
			lib: { entry, formats: ['es'], fileName: () => `${name}.js` },
			outDir: join(scratch, 'out', name),
			emptyOutDir: true,
		},
		// No declaration emit; this measures runtime only.
		plugins: [],
	})

	const bytes = readFileSync(join(scratch, 'out', name, `${name}.js`))
	shipped[name] = {
		raw: bytes.byteLength,
		gzip: gzipSync(bytes).byteLength,
		brotli: brotliCompressSync(bytes).byteLength,
	}
}

const pad = (n: number, width = 7) => String(n).padStart(width)
const delta = (n: number) => (n >= 0 ? `+${n}` : String(n))

console.log('\nSHIPPED — through vite.config.ts, brotli is the headline\n')
console.log('  variant      raw     gzip   brotli   Δ brotli vs core')
for (const name of ['core', 'A', 'B'] as const) {
	const s = shipped[name]!
	const d =
		name === 'core' ? '' : `   ${delta(s.brotli - shipped['core']!.brotli)} B`
	console.log(
		`  ${name.padEnd(6)}${pad(s.raw)}  ${pad(s.gzip)}  ${pad(s.brotli)}${d}`,
	)
}
console.log(
	`\n  B costs ${delta(shipped['B']!.brotli - shipped['A']!.brotli)} B brotli over A ` +
		`(${delta(shipped['B']!.raw - shipped['A']!.raw)} raw, ` +
		`${delta(shipped['B']!.gzip - shipped['A']!.gzip)} gzip).`,
)

rmSync(scratch, { recursive: true, force: true })

/* ------------------------------------------------------------ 2. authored */

const strip = (source: string) =>
	source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^[ \t]*\/\/.*$/gm, '')
		.split('\n')
		.filter((line) => line.trim() !== '')
		.join('\n')

/** The `machine({ … })` spans, matched on parens. */
const definitions = (source: string) => {
	const spans: string[] = []
	let at = source.indexOf('machine(')
	while (at !== -1) {
		let depth = 0
		let i = at + 'machine'.length
		for (; i < source.length; i += 1) {
			if (source[i] === '(') depth += 1
			else if (source[i] === ')') {
				depth -= 1
				if (depth === 0) break
			}
		}
		spans.push(source.slice(at, i + 1))
		at = source.indexOf('machine(', i)
	}
	return spans.join('\n')
}

console.log('\nAUTHORED — comments and blank lines stripped\n')
console.log(
	'  example                 whole file A/B            machine({…}) only A/B',
)

for (const example of [
	'ex1-marking-menu',
	'ex2-gesture-stack',
	'ex3-accordion',
] as const) {
	const read = (model: string) =>
		strip(readFileSync(join(here, example, `${model}.ts`), 'utf8'))
	const a = read('a')
	const b = read('b')
	const da = definitions(a)
	const db = definitions(b)

	const whole = `${a.length}/${b.length} B ` + `(${delta(b.length - a.length)})`
	const defs =
		`${da.length}/${db.length} B ` +
		`(${delta(db.length - da.length)}, ` +
		`${Math.round((db.length / da.length - 1) * 100)}%)`

	console.log(`  ${example.padEnd(20)}  ${whole.padEnd(24)}  ${defs}`)
}

console.log()
