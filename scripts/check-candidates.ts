// Type-checks every notation candidate under its own tsconfig.
//
// They are not covered by the root `pnpm typecheck`: each relaxes
// noUnusedLocals/noUnusedParameters (prototypes keep unused levers on purpose),
// and one of them is a negative result that must *not* compile.
//
// The negative results are the point. A candidate listed in MUST_FAIL that
// starts compiling is reported as a failure, because it means the limitation it
// records has been lifted and the rationale needs revisiting.

import { execFile } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = join(root, 'explorations', 'candidates')

/** Candidates kept as negative evidence. See each one's README. */
const MUST_FAIL = new Set(['c3-target-list'])

function projects(dir: string): string[] {
	const found: string[] = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue
		const child = join(dir, entry.name)
		if (existsSync(join(child, 'tsconfig.json'))) found.push(child)
		else found.push(...projects(child))
	}
	return found
}

const tsc = join(root, 'node_modules', '.bin', 'tsc')
let failed = 0

for (const project of projects(candidates).sort()) {
	const name = relative(candidates, project)
	const expectFailure = MUST_FAIL.has(name)

	let compiled = true
	try {
		await run(tsc, ['-p', project])
	} catch {
		compiled = false
	}

	if (compiled === !expectFailure) {
		console.log(
			`  ok    ${name}${expectFailure ? ' (fails, as recorded)' : ''}`,
		)
	} else if (expectFailure) {
		console.error(
			`  FAIL  ${name} — compiles, but is recorded as a negative result`,
		)
		failed++
	} else {
		console.error(`  FAIL  ${name} — does not compile`)
		failed++
	}
}

if (failed > 0) {
	console.error(`\n${failed} candidate(s) disagree with the record.`)
	process.exit(1)
}
console.log(`\nAll candidates agree with the record.`)
