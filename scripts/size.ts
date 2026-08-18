/**
 * Prints what the built bundle costs: raw, gzip and brotli.
 *
 * Brotli is the headline metric. It is measured with node's own zlib at
 * default settings, which is exactly what `preactjs/compressed-size-action`
 * uses, so the number printed here and the number CI comments on a pull
 * request are the same number.
 *
 * Run via `pnpm size`, which builds first.
 */

import { gzipSync, brotliCompressSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bundle = fileURLToPath(new URL('../dist/totorobot.js', import.meta.url))

let source: Buffer
try {
	source = readFileSync(bundle)
} catch {
	console.error(`No bundle at ${bundle} — run \`pnpm build\` first.`)
	process.exit(1)
}

const format = (bytes: number) =>
	`${bytes.toLocaleString('en-US').padStart(7)} B  ${(bytes / 1024)
		.toFixed(2)
		.padStart(6)} kB`

console.log(`dist/totorobot.js`)
console.log(`  raw     ${format(source.byteLength)}`)
console.log(`  gzip    ${format(gzipSync(source).byteLength)}`)
console.log(`  brotli  ${format(brotliCompressSync(source).byteLength)}`)
