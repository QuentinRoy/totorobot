/**
 * Writes the bundle size of the release being cut into its CHANGELOG entry.
 *
 * Runs as part of `pnpm version`, straight after `changeset version` has
 * bumped package.json and opened a new `## <version>` section, and inserts a
 * `### Size` block under that heading. The delta is measured against the
 * previous version's published tarball rather than against a rebuild of an old
 * commit, so it compares against what actually shipped.
 *
 * That single edit covers the GitHub release too: `changesets/action` builds
 * the release body by slicing this file's `## <version>` section out, and the
 * size heading nests one level deeper, so it travels with the slice.
 *
 * Safe to run again: an existing `### Size` block for the same version is
 * replaced, which is what happens whenever the version pull request is
 * refreshed.
 */

import { execFile } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
	bundleName,
	measure,
	readBuiltBundle,
	readPublishedBundle,
	type Sizes,
} from './bundle-size.ts'

const run = promisify(execFile)

const root = new URL('..', import.meta.url)
const changelogPath = fileURLToPath(new URL('CHANGELOG.md', root))
const manifestPath = fileURLToPath(new URL('package.json', root))

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
	name: string
	version: string
}

await run('pnpm', ['build'], { cwd: fileURLToPath(root) })

const built = readBuiltBundle()
if (built === null) {
	console.error(`No bundle at ${bundleName} after \`pnpm build\`.`)
	process.exit(1)
}
const sizes = measure(built)

const changelog = readFileSync(changelogPath, 'utf8')

// Every release heading, newest first — that is the order `changeset version`
// writes them in, so the entry after the one being released is the baseline.
const headings = [...changelog.matchAll(/^## (\S+)$/gm)]
const current = headings.find((heading) => heading[1] === manifest.version)
if (current === undefined) {
	console.error(
		`No \`## ${manifest.version}\` section in CHANGELOG.md — nothing to annotate.`,
	)
	process.exit(1)
}
const previous = headings[headings.indexOf(current) + 1]?.[1]

const baseline =
	previous === undefined
		? null
		: await readPublishedBundle(manifest.name, previous)
if (previous !== undefined && baseline === null) {
	console.warn(
		`Could not read ${manifest.name}@${previous} from npm — writing sizes without a delta.`,
	)
}

const bytes = (value: number) => `${value.toLocaleString('en-US')} B`

function delta(now: Sizes, before: Sizes, from: string) {
	const difference = now.brotli - before.brotli
	if (difference === 0) return ` (no change vs ${from})`
	const sign = difference > 0 ? '+' : '−'
	const percent = ((Math.abs(difference) / before.brotli) * 100).toFixed(1)
	return ` (${sign}${bytes(Math.abs(difference))}, ${sign}${percent}% vs ${from})`
}

const comparison =
	baseline === null || previous === undefined
		? ''
		: delta(sizes, measure(baseline), previous)

const block = `### Size

\`${bundleName}\` — brotli ${bytes(sizes.brotli)}${comparison}, gzip ${bytes(
	sizes.gzip,
)}, raw ${bytes(sizes.raw)}`

// Everything from the heading to the end of the section, so a `### Size` block
// left by an earlier run is replaced rather than stacked.
const start = current.index + current[0].length
const nextHeading = changelog.indexOf('\n## ', start)
const end = nextHeading === -1 ? changelog.length : nextHeading
const section = changelog
	.slice(start, end)
	.replace(/^\n+### Size\n[\s\S]*?(?=\n### |\n*$)/, '')

writeFileSync(
	changelogPath,
	`${changelog.slice(0, start)}\n\n${block}\n${section.replace(/^\n+/, '\n')}${changelog.slice(end)}`,
)

console.log(`CHANGELOG.md: annotated ${manifest.version} with`)
console.log(block.split('\n').slice(-1)[0])
