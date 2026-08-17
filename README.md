# Totorobot

> [!WARNING]
> Totorobot is an experimental work in progress. It is not published to npm,
> its API may change without notice, and it should not be used in production.

Totorobot is a small TypeScript finite-state-machine experiment built around
**per-state context** (typestate). Declaring each state's context separately
lets TypeScript narrow both the context and the events that can be sent after
you narrow the current state.

The project asks a specific question: how much state-machine correctness can
TypeScript enforce while keeping a compact, Robot-inspired creation API?

## Example

```ts
import { defineMachine, interpret } from 'totorobot'

type CounterSpec = {
	states: {
		idle: { count: number }
		finished: { result: number }
	}
	events: {
		finish: Record<never, never>
	}
}

const counter = defineMachine<CounterSpec>().create(
	'idle',
	({ state, transition, reduce }) => ({
		idle: state(
			transition(
				'finish',
				'finished',
				reduce((context) => ({ result: context.count })),
			),
		),
		finished: state(),
	}),
)

const service = interpret(counter, { count: 42 })
service.send({ type: 'finish' })

if (service.current.state === 'finished') {
	service.current.context.result // number
}
```

The machine spec is declared first, then `create` checks the state map against
it. Builders such as `state`, `transition`, `invoke`, `guard`, `reduce`, and
`action` are scoped to the creation callback so their context and event types
can be inferred.

## What is checked

Totorobot currently catches:

- transitions to unknown states;
- undeclared events and incorrectly shaped payloads;
- reducers that return the wrong target-state context;
- reads of context fields that do not exist in the current state;
- missing or extra state definitions;
- an initial context that does not match the declared initial state;
- events sent through `service.current.send` that the narrowed state does not
  handle;
- multiple reducers on one transition.

Runtime support currently includes guarded transitions, actions, context
reducers, promise invocation with typed success/error branches, cancellation,
and terminal states represented by `state()` with no transitions.

## Status and limitations

This repository is a design prototype, not a released library. There is no
stability guarantee, package build, compatibility promise, or npm release yet.

Notable missing features include immediate transitions and entry/exit hooks.
Some inference also depends on keeping transition declarations inline in the
state map.

## The next API

The code above is the **first generation**. The design has since settled on a
different shape — a declared vocabulary, a flat string-keyed transition table, and
listeners attached by whoever runs the machine:

```ts
const publication = machine({
	initial: 'empty',
	types: types<Publication>(),
	transitions: {
		'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'submit: draft -> review': ({ data, input, skip }) => …,
	},
})

const doc = publication.start()
doc.on('* -> published', (e) => notify(e.to.data))
```

It is designed, not built. Read [the API](docs/api.md) for what it is, and
[the design record](docs/api-rationale.md) for why.

## Documentation

**The next API**

- [The API](docs/api.md) — the settled design: the blocks, the key language, what
  is checked, what is deliberately absent, and what is deferred past v1.
- [Design record](docs/api-rationale.md) — the decision ledger, what was
  considered and rejected and on what evidence, and the reusable TypeScript
  findings.

**Inputs that still govern**

- [FSM library requirements](docs/requirements.md) prioritizes the target
  behavior, type guarantees, design latitude, and non-goals.
- [FSM API acceptance cases](docs/acceptance-cases.md) defines the pinned
  Marking Menu fixture and shared comparison tasks for coherent candidates.
- [Research notes](docs/research/) — ten prior-art notes on automata theory,
  execution semantics, HCI state machines, typestate, TypeScript type
  engineering, and the JS FSM landscape.

**The current implementation**

- [Design notes](docs/design-notes.md) explains the shipped API, its type
  guarantees, runtime semantics, and known limitations.
- [Explorations](explorations/README.md) holds the compilable prototypes behind
  the findings, including one built over Robot3 itself. They are type-checked
  and the Robot3 one is tested, so a rejected option that starts working again
  fails the build rather than going unnoticed.

## Repository layout

- `src/totorobot.ts` — the library implementation and public API.
- `examples/case-studies/` — traffic-light and asynchronous-auth examples.
- `examples/index.ts` — runs both case studies.
- `tests/totorobot.test.ts` — runtime and compile-time coverage.
- `docs/api.md` — the design the project is moving to.
- `docs/api-rationale.md` — the evidence behind that design.
- `docs/design-notes.md` — reference for the current, shipped design.
- `explorations/` — prototypes of alternative API shapes, kept compiling as
  evidence for that history. Not part of the library.
- `explorations/candidates/` — the notation candidates and the three rival
  baselines they were measured against.

## Development

Requires Node.js 26 or newer and pnpm. Node runs the TypeScript sources directly,
so this experimental repository has no build step.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm examples
```

## Relationship to Robot3

Totorobot was inspired by [Robot3](https://thisrobot.life/) and deliberately
keeps parts of its small functional vocabulary. It is an independent
experiment, not a fork, drop-in replacement, or compatibility layer.
