// Measures editor completion behaviour for the string-key layout: how many
// entries the language server offers for a partially-typed transition key, how
// large the response is, and how long it takes.
//
// This exists because acceptance-cases.md lists "language-server completion and
// diagnostic latency" among the 20-state measurements, and the string-key layout
// is the one whose key type is a cross-product — |inputs| x |states|^2.
//
//   node scripts/measure-completions.mjs [projectDir]
//
// Defaults to explorations/candidates/n1-transition-table, which holds both an
// 80-member and a 4 000-member machine in playground.ts.
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
const projectDir = resolve(
	process.argv[2] ??
		join(repoRoot, 'explorations/candidates/n1-transition-table'),
)
const probePath = join(projectDir, '_completion-probe.ts')
const probeUri = pathToFileURL(probePath).href
const playground = readFileSync(join(projectDir, 'playground.ts'), 'utf8')

/** Where to insert a new key: the last transition of each machine. */
const ANCHORS = {
	small: `\t\t'submit: empty -> published': ({ input, skip }) =>\n\t\t\tinput.route === 'publish' ? { text: '' } : skip(),\n`,
	big: `\t\t'release: dragging -> dropped': () => {},\n`,
}

/** Cases: which machine, what has been typed so far, and a label. */
const CASES = [
	['small', '', '64 members, nothing typed'],
	['small', 'sub', '64, `sub`'],
	['small', 'submit: dr', '64, `submit: dr`'],
	['small', 'submit: draft -> re', '64, `submit: draft -> re`'],
	['big', '', '4 000 members, nothing typed'],
	['big', 'sav', '4 000, `sav`'],
	['big', 'save: edit', '4 000, `save: edit`'],
	['big', 'save: editing -> sa', '4 000, `save: editing -> sa`'],
]

function build(which, typed) {
	const anchor = ANCHORS[which]
	const at = playground.indexOf(anchor)
	if (at < 0) throw new Error(`anchor not found for ${which} machine`)
	const insertAt = at + anchor.length
	const inserted = `\t\t'${typed}`
	const text =
		playground.slice(0, insertAt) + inserted + playground.slice(insertAt)
	const lines = text.slice(0, insertAt + inserted.length).split('\n')
	return {
		text,
		line: lines.length - 1,
		character: lines[lines.length - 1].length,
	}
}

// --- a minimal LSP client -----------------------------------------------------

const proc = spawn(getExePath(), ['--lsp', '--stdio'], {
	stdio: ['pipe', 'pipe', 'pipe'],
})
const stderr = []
proc.stderr.on('data', (d) => stderr.push(d.toString()))

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
		const msg = JSON.parse(buf.subarray(start, start + length).toString('utf8'))
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

// --- run ----------------------------------------------------------------------

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
	for (const [which, typed, label] of CASES) {
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

		const t0 = performance.now()
		const first = await ask()
		const cold = performance.now() - t0
		if (first.error)
			throw new Error(`completion: ${JSON.stringify(first.error)}`)

		const warm = []
		for (let i = 0; i < 5; i++) {
			const t = performance.now()
			await ask()
			warm.push(performance.now() - t)
		}
		warm.sort((a, b) => a - b)

		const list = first.result
		const items = Array.isArray(list) ? list : (list?.items ?? [])
		const incomplete = Array.isArray(list) ? 'n/a' : String(list?.isIncomplete)
		const kb = Buffer.byteLength(JSON.stringify(list), 'utf8') / 1024

		console.log(
			`| ${label} | ${items.length} | ${kb.toFixed(0)} KB | ${incomplete} | ` +
				`${cold.toFixed(0)} | ${warm[2].toFixed(0)} |`,
		)
	}
} catch (error) {
	console.error(`FAILED: ${error.message}`)
	if (stderr.length) console.error(stderr.join('').slice(0, 1000))
	process.exitCode = 1
} finally {
	try {
		rmSync(probePath)
	} catch {}
	proc.kill()
}
