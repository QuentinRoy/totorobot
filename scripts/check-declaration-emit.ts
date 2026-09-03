// Regression check for #136: exporting a machine from a consuming module must
// survive `tsc --declaration`. A plain type-check would not catch this —
// TS4023 only fires during declaration emission — so this runs `tsc` against
// `tests/declaration-emit`, mapped to the built `dist/totorobot.d.ts`, the
// same way `pnpm test:dist`'s type pass does.

import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const project = join(root, 'tests', 'declaration-emit')
const tsc = join(root, 'node_modules', '.bin', 'tsc')

const outDir = await mkdtemp(join(tmpdir(), 'totorobot-declaration-emit-'))
try {
	await run(tsc, ['-p', project, '--outDir', outDir])
	console.log('  ok    declaration-emit')
} catch (error) {
	console.error('  FAIL  declaration-emit')
	console.error(error instanceof Error ? error.message : error)
	process.exitCode = 1
} finally {
	await rm(outDir, { recursive: true, force: true })
}
