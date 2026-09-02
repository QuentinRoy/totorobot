// Measures editor completion behaviour for three surfaces: the string-key
// transition table, `observe()`'s pattern argument (#116), and `actions`'s own
// key (#117).
//
// This exists because acceptance-cases.md lists "language-server completion and
// diagnostic latency" among the 20-state measurements. The transition-table
// layout is one whose key type is a cross-product — |inputs| x |states|^2 — and
// so, before #116, was `observe()`'s pattern argument: the same cross-product,
// filtered against the declared table only at the point of rejecting an
// unreachable one, never at the point of offering completions. `actions` never
// had that problem — `A` defaults to `never`, so its contextual type has no
// known members and completion offers nothing either way (#117).
//
//   node scripts/measure-completions.mjs [projectDir]
//
// With no argument, measures all three surfaces: the transition table against
// explorations/candidates/n1-transition-table (an 80-member and a
// 4 000-member machine in playground.ts), `observe()` against
// scripts/completion-fixtures/observe-machine, and `actions` against
// scripts/completion-fixtures/actions-machine (both the 20-state, 44-row
// acceptance machine, imported through the real library). Passing a
// directory measures the transition-table surface against it alone, the
// original single-project form.
//
// Two notes for anyone extending this:
//
//   * TypeScript 7 ships a Go binary and no JS compiler API, so there is no
//     LanguageService to call. The only route is the protocol an editor speaks.
//   * The server issues requests of its own (client/registerCapability) and
//     blocks on the reply. A client that ignores them hangs on the first
//     completion request with no error - which is what made an earlier attempt
//     conclude that `--lsp` "did not answer textDocument/completion".

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * TypeScript 7 is a Go binary shipped in a per-platform package. `typescript`
 * itself exports only `lib/version.cjs`, so the executable has to be located the
 * way `typescript/lib/getExePath.js` does it internally.
 */
function getExePath() {
	// Resolved relative to `typescript` itself: under pnpm the platform package is
	// its dependency, not the repository's, so it is not resolvable from here.
	const fromHere = createRequire(import.meta.url)
	const fromTypeScript = createRequire(
		fromHere.resolve('typescript/package.json'),
	)
	const manifest = fromTypeScript.resolve(
		`@typescript/typescript-${process.platform}-${process.arch}/package.json`,
	)
	const exe = join(dirname(manifest), 'lib', 'tsc')
	return process.platform === 'win32' ? `${exe}.exe` : exe
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where to insert a new key: the last transition of each machine. */
const TABLE_ANCHORS = {
	small: `\t\t'submit: empty -> published': ({ input, skip }) =>\n\t\t\tinput.route === 'publish' ? { text: '' } : skip(),\n`,
	big: `\t\t'release: dragging -> dropped': () => {},\n`,
}

/** Cases: which machine, what has been typed so far, and a label. */
const TABLE_CASES = [
	['small', '', '64 members, nothing typed'],
	['small', 'sub', '64, `sub`'],
	['small', 'submit: dr', '64, `submit: dr`'],
	['small', 'submit: draft -> re', '64, `submit: draft -> re`'],
	['big', '', '4 000 members, nothing typed'],
	['big', 'sav', '4 000, `sav`'],
	['big', 'save: edit', '4 000, `save: edit`'],
	['big', 'save: editing -> sa', '4 000, `save: editing -> sa`'],
]

/**
 * Where to insert a new `observe()` call: right after `start()`, on its own
 * line. The 20-state acceptance machine has one anchor, not one per size —
 * unlike the transition table there is no small/big split to measure here.
 */
const OBSERVE_ANCHORS = {
	observe: `const host = stress.start({ visits: 0, owner: 's00' })\n`,
}

const OBSERVE_CASES = [
	['observe', '', "20 states, 44 rows, observe(''), nothing typed"],
	['observe', 's0', '20/44, `s0`'],
	['observe', 's00 -', '20/44, `s00 -`'],
]

/**
 * Where to insert a new `actions` key: right inside the empty `actions: {}`
 * object — Prettier collapses an empty literal onto one line, so the anchor
 * stops short of the closing brace rather than expecting a line of its own —
 * in the same 20-state acceptance machine (#117).
 */
const ACTIONS_ANCHORS = {
	actions: `\tactions: {`,
}

const ACTIONS_CASES = [
	['actions', '', "20 states, 44 rows, actions: {''}, nothing typed"],
	['actions', 's0', '20/44, `s0`'],
	['actions', 's00 -', '20/44, `s00 -`'],
]

/**
 * Runs one measurement pass: spawns its own `tsc --lsp` (a language server
 * keeps per-project state, so two projects cannot share a process), builds
 * each case by inserting `typed` after `anchor` in `playground.ts`, and
 * prints a table of what `textDocument/completion` returns.
 */
async function measure(projectDir, anchors, cases, insert) {
	const probePath = join(projectDir, '_completion-probe.ts')
	const probeUri = pathToFileURL(probePath).href
	const playground = readFileSync(join(projectDir, 'playground.ts'), 'utf8')

	function build(which, typed) {
		const anchor = anchors[which]
		const anchorAt = playground.indexOf(anchor)
		if (anchorAt < 0)
			throw new Error(`anchor not found for ${which} in ${projectDir}`)
		const insertAt = anchorAt + anchor.length
		const inserted = insert(typed)
		const text =
			playground.slice(0, insertAt) + inserted + playground.slice(insertAt)
		const lines = text.slice(0, insertAt + inserted.length).split('\n')
		return {
			text,
			line: lines.length - 1,
			character: lines[lines.length - 1].length,
		}
	}

	const proc = spawn(getExePath(), ['--lsp', '--stdio'], {
		stdio: ['pipe', 'pipe', 'pipe'],
	})
	const stderr = []
	proc.stderr.on('data', (chunk) => stderr.push(chunk.toString()))

	let buf = Buffer.alloc(0)
	const pending = new Map()
	let nextId = 1

	function send(msg) {
		const body = JSON.stringify(msg)
		proc.stdin.write(
			`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`,
		)
	}

	proc.stdout.on('data', (chunk) => {
		buf = Buffer.concat([buf, chunk])
		for (;;) {
			const headerEnd = buf.indexOf('\r\n\r\n')
			if (headerEnd < 0) return
			const match = /Content-Length: (\d+)/i.exec(
				buf.subarray(0, headerEnd).toString('utf8'),
			)
			if (!match) return
			const length = Number(match[1])
			const start = headerEnd + 4
			if (buf.length < start + length) return
			const msg = JSON.parse(
				buf.subarray(start, start + length).toString('utf8'),
			)
			buf = buf.subarray(start + length)

			if (msg.id !== undefined && msg.method) {
				send({ jsonrpc: '2.0', id: msg.id, result: null }) // see the header note
			} else if (msg.id !== undefined && pending.has(msg.id)) {
				const settle = pending.get(msg.id)
				pending.delete(msg.id)
				settle(msg)
			}
		}
	})

	function request(method, params, timeoutMs = 60_000) {
		const id = nextId++
		return new Promise((res, rej) => {
			pending.set(id, res)
			send({ jsonrpc: '2.0', id, method, params })
			setTimeout(() => {
				if (pending.delete(id)) rej(new Error(`timeout: ${method}`))
			}, timeoutMs)
		})
	}

	try {
		const init = await request('initialize', {
			processId: process.pid,
			rootUri: pathToFileURL(projectDir).href,
			capabilities: {
				workspace: {
					configuration: true,
					didChangeConfiguration: { dynamicRegistration: true },
				},
				textDocument: { completion: { contextSupport: true } },
			},
		})
		if (init.error) throw new Error(`initialize: ${JSON.stringify(init.error)}`)
		send({ jsonrpc: '2.0', method: 'initialized', params: {} })

		console.log(`${projectDir.replace(repoRoot + '/', '')}\n`)
		console.log(
			'| case | entries | response | isIncomplete | cold ms | warm ms |',
		)
		console.log('| --- | --- | --- | --- | --- | --- |')

		let version = 0
		for (const [which, typed, label] of cases) {
			const { text, line, character } = build(which, typed)
			writeFileSync(probePath, text)

			const doc = { uri: probeUri, version: ++version }
			if (version === 1) {
				send({
					jsonrpc: '2.0',
					method: 'textDocument/didOpen',
					params: { textDocument: { ...doc, languageId: 'typescript', text } },
				})
			} else {
				send({
					jsonrpc: '2.0',
					method: 'textDocument/didChange',
					params: { textDocument: doc, contentChanges: [{ text }] },
				})
			}

			const ask = () =>
				request('textDocument/completion', {
					textDocument: { uri: probeUri },
					position: { line, character },
				})

			const coldStart = performance.now()
			const first = await ask()
			const cold = performance.now() - coldStart
			if (first.error)
				throw new Error(`completion: ${JSON.stringify(first.error)}`)

			const warm = []
			for (let i = 0; i < 5; i++) {
				const warmStart = performance.now()
				await ask()
				warm.push(performance.now() - warmStart)
			}
			warm.sort((a, b) => a - b)

			const list = first.result
			const items = Array.isArray(list) ? list : (list?.items ?? [])
			const incomplete = Array.isArray(list)
				? 'n/a'
				: String(list?.isIncomplete)
			const kb = Buffer.byteLength(JSON.stringify(list), 'utf8') / 1024

			console.log(
				`| ${label} | ${items.length} | ${kb.toFixed(0)} KB | ${incomplete} | ` +
					`${cold.toFixed(0)} | ${warm[2].toFixed(0)} |`,
			)
		}
		console.log()
	} finally {
		try {
			rmSync(probePath)
		} catch {}
		proc.kill()
	}
}

/** A new transition row, inserted into the object literal right after the anchor. */
const insertTableRow = (typed) => `\t\t'${typed}`

/** A new `observe()` call, inserted as its own statement after `start()`. */
const insertObserveCall = (typed) => `\nhost.observe('${typed}`

/** A new `actions` key, inserted right after the block's opening brace. */
const insertActionsKey = (typed) => `\t\t'${typed}`

const explicitDir = process.argv[2]
const targets = explicitDir
	? [
			{
				dir: resolve(explicitDir),
				anchors: TABLE_ANCHORS,
				cases: TABLE_CASES,
				insert: insertTableRow,
			},
		]
	: [
			{
				dir: join(repoRoot, 'explorations/candidates/n1-transition-table'),
				anchors: TABLE_ANCHORS,
				cases: TABLE_CASES,
				insert: insertTableRow,
			},
			{
				dir: join(repoRoot, 'scripts/completion-fixtures/observe-machine'),
				anchors: OBSERVE_ANCHORS,
				cases: OBSERVE_CASES,
				insert: insertObserveCall,
			},
			{
				dir: join(repoRoot, 'scripts/completion-fixtures/actions-machine'),
				anchors: ACTIONS_ANCHORS,
				cases: ACTIONS_CASES,
				insert: insertActionsKey,
			},
		]

try {
	for (const { dir, anchors, cases, insert } of targets) {
		await measure(dir, anchors, cases, insert)
	}
} catch (error) {
	console.error(`FAILED: ${error.message}`)
	process.exitCode = 1
}
