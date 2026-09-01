/**
 * Shared bundle measurement: what the built bundle costs, and what the same
 * file costs in a version already published to npm.
 *
 * Brotli is the headline metric. It is measured with node's own zlib at
 * default settings, which is exactly what `preactjs/compressed-size-action`
 * uses, so the numbers here and the ones CI comments on a pull request are the
 * same numbers.
 *
 * Used by `scripts/size.ts`, which prints them, and by
 * `scripts/size-changelog.ts`, which writes them into CHANGELOG.md during
 * `changeset version`.
 */

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzipSync, brotliCompressSync } from 'node:zlib'

const run = promisify(execFile)

/** Path of the bundle inside the repo and inside a published tarball alike. */
export const bundleName = 'dist/totorobot.js'

const bundlePath = fileURLToPath(new URL(`../${bundleName}`, import.meta.url))

export type Sizes = { raw: number; gzip: number; brotli: number }

export function measure(source: Buffer): Sizes {
	return {
		raw: source.byteLength,
		gzip: gzipSync(source).byteLength,
		brotli: brotliCompressSync(source).byteLength,
	}
}

/** The bundle as `pnpm build` last left it, or null if there is none. */
export function readBuiltBundle(): Buffer | null {
	try {
		return readFileSync(bundlePath)
	} catch {
		return null
	}
}

/**
 * The same file out of a published tarball, so a release can be compared with
 * what actually shipped rather than with a rebuild of an old commit.
 *
 * Returns null whenever that version cannot be fetched: a first release with
 * nothing published before it, a run with no network, a version that was
 * unpublished. A missing baseline costs a delta, not a release.
 */
export async function readPublishedBundle(
	pkg: string,
	version: string,
): Promise<Buffer | null> {
	try {
		const { stdout } = await run('npm', [
			'view',
			`${pkg}@${version}`,
			'dist.tarball',
		])
		const url = stdout.trim()
		if (!url) return null

		const response = await fetch(url)
		if (!response.ok) return null
		const tarball = Buffer.from(await response.arrayBuffer())

		return await extract(tarball, `package/${bundleName}`)
	} catch {
		// The registry lookup, the download and the read of its body all fail
		// the same way here. None of them is worth stopping a release for.
		return null
	}
}

/**
 * One member of a gzipped tarball, read from tar's stdout.
 *
 * Buffer encoding throughout: a text pipe would mangle the minified bundle and
 * skew every number measured from it.
 */
function extract(tarball: Buffer, member: string): Promise<Buffer | null> {
	return new Promise((resolve) => {
		const child = execFile(
			'tar',
			['-xzO', '-f', '-', member],
			{ encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
			(error, stdout) => {
				const file = stdout as unknown as Buffer
				resolve(error || file.byteLength === 0 ? null : file)
			},
		)
		child.stdin?.end(tarball)
	})
}
