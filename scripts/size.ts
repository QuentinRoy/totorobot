/**
 * Prints what the built bundle costs: raw, gzip and brotli.
 *
 * The measurement itself lives in `scripts/bundle-size.ts`, shared with the
 * script that writes these numbers into the changelog at release time, so the
 * two can never drift apart.
 *
 * Run via `pnpm size`, which builds first.
 */

import { bundleName, measure, readBuiltBundle } from './bundle-size.ts'

const source = readBuiltBundle()
if (source === null) {
	console.error(`No bundle at ${bundleName} — run \`pnpm build\` first.`)
	process.exit(1)
}

const format = (bytes: number) =>
	`${bytes.toLocaleString('en-US').padStart(7)} B  ${(bytes / 1024)
		.toFixed(2)
		.padStart(6)} kB`

const sizes = measure(source)

console.log(bundleName)
console.log(`  raw     ${format(sizes.raw)}`)
console.log(`  gzip    ${format(sizes.gzip)}`)
console.log(`  brotli  ${format(sizes.brotli)}`)
