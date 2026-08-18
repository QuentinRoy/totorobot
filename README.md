# Totorobot

> [!WARNING]
> Totorobot is an experimental work in progress. It is not published to npm,
> its API may change without notice, and it should not be used in production.

Totorobot is a small TypeScript finite-state-machine library built around a
declared vocabulary and a flat, string-keyed transition table with the input
as an arrow label. Definitions are inert data; a host created by `.start()` is
the only mutable object, and listeners are attached by whoever runs the
machine.

The project asks a specific question: how much state-machine correctness can
TypeScript enforce while keeping a compact, Robot-inspired creation API?

## Example

```ts
import { machine, types } from 'totorobot'

type Inputs = {
	open: { text: string }
	revise: { text: string }
	submit: { route: 'review' | 'publish'; reviewer?: string }
	cancel: void
}
type States = {
	empty: void
	draft: { text: string; revision: number }
	review: { text: string; revision: number; reviewer: string }
	published: { text: string; revision: number }
}

export const publication = machine({
	initial: 'empty',
	inputs: types<Inputs>(),
	states: types<States>(),

	transitions: {
		'empty -open> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'draft -submit> review': ({ data, input, skip }) =>
			input.route === 'review'
				? { ...data, reviewer: input.reviewer! }
				: skip(),
		'draft -submit> published': ({ data, input, skip }) =>
			input.route === 'publish' ? { ...data } : skip(),
		'draft -cancel> empty': () => {},
	},
})

const doc = publication.start()
doc.on('* -> published', (e) => notify(e.to.data))
doc.send('open', { text: 'hello' })
```

| part          | answers                               |
| ------------- | ------------------------------------- |
| `initial`     | where a new host starts               |
| `inputs`      | what can happen                       |
| `states`      | what we can be                        |
| `transitions` | how we move, and what the new data is |
| `.on()`       | what the outside world does about it  |

Read [the API](docs/api.md) for the full design, and
[the design record](docs/api-rationale.md) for why it looks this way.

## What is checked

- **Per-state data.** Narrowing the state narrows its data, with no nullable
  padding in states that logically guarantee a field.
- Unknown state or input names anywhere in a transition key or a pattern.
- A handler returning the wrong shape for its target state.
- Reads of source data the source state does not have.
- Malformed keys — wrong spacing included — reported as
  `not a transition: '…'` on the offending line.

What is **not** checked: the send site. Per-state capabilities are advertised
at runtime (`available`) rather than enforced by the compiler.

## Status and limitations

This repository is a design prototype, not a released library. There is no
stability guarantee, compatibility promise, or npm release yet.

`actions`, immediate transitions, and composition of invoked children are
designed but not part of v1 — see
[Designed, not in v1](docs/api.md#designed-not-in-v1). The design is also
flat: no hierarchy, no parallel regions.

## Documentation

- [The API](docs/api.md) — the design: the blocks, the key language, what is
  checked, what is deliberately absent, and what is deferred past v1.
- [Design record](docs/api-rationale.md) — the decision ledger, what was
  considered and rejected and on what evidence, and the reusable TypeScript
  findings.
- [FSM library requirements](docs/requirements.md) prioritizes the target
  behavior, type guarantees, design latitude, and non-goals.
- [FSM API acceptance cases](docs/acceptance-cases.md) defines the pinned
  Marking Menu fixture and shared comparison tasks for coherent candidates.
- [Research notes](docs/research/) — ten prior-art notes on automata theory,
  execution semantics, HCI state machines, typestate, TypeScript type
  engineering, and the JS FSM landscape.
- [Explorations](explorations/README.md) holds the compilable prototypes behind
  the findings, including one built over Robot3 itself. They are type-checked
  and the Robot3 one is tested, so a rejected option that starts working again
  fails the build rather than going unnoticed.

## Repository layout

- `src/totorobot.ts` — the library implementation and public API.
- `examples/case-studies/` — traffic-light and asynchronous-auth examples.
- `examples/index.ts` — runs both case studies.
- `tests/` — the v1 test suite: runtime tests (`*.test.ts`), type tests
  (`*.test-d.ts`) and the plain-JavaScript untyped path (`untyped.test.js`).
- `docs/api.md` — the shipped design.
- `docs/api-rationale.md` — the evidence behind that design.
- `explorations/` — prototypes of alternative API shapes, kept compiling as
  evidence for that history. Not part of the library.
- `explorations/candidates/` — the notation candidates and the three rival
  baselines they were measured against.

## Development

Requires Node.js 26 or newer and pnpm. Node runs the TypeScript sources
directly for development; `pnpm build` produces the published ESM bundle and
type declarations in `dist/`.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm examples
```

`pnpm test` runs the runtime tests, type tests, and the plain-JavaScript
untyped path in `tests/` against the shipped API. `pnpm typecheck` covers
`src/`, `examples/` and `explorations/`.

## Relationship to Robot3

Totorobot was inspired by [Robot3](https://thisrobot.life/) and deliberately
keeps parts of its small functional vocabulary. It is an independent
experiment, not a fork, drop-in replacement, or compatibility layer.
