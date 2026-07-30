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
import { defineMachine, interpret } from "totorobot"

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
  "idle",
  ({ state, final, transition, reduce }) => ({
    idle: state(
      transition(
        "finish",
        "finished",
        reduce((context) => ({ result: context.count })),
      ),
    ),
    finished: final(),
  }),
)

const service = interpret(counter, { count: 42 })
service.send({ type: "finish" })

if (service.current.state === "finished") {
  service.current.context.result // number
}
```

The machine spec is declared first, then `create` checks the state map against
it. Builders such as `state`, `final`, `transition`, `invoke`, `guard`,
`reduce`, and `action` are scoped to the creation callback so their context and
event types can be inferred.

## What is checked

Totorobot currently catches:

- transitions to unknown states;
- undeclared events and incorrectly shaped payloads;
- reducers that return the wrong target-state context;
- reads of context fields that do not exist in the current state;
- missing or extra state definitions;
- an initial context that does not match the declared initial state;
- transitions declared on a final state;
- events sent through `service.current.send` that the narrowed state does not
  handle;
- multiple reducers on one transition.

Runtime support currently includes guarded transitions, actions, context
reducers, promise invocation with typed success/error branches, cancellation,
and final states.

## Status and limitations

This repository is a design prototype, not a released library. There is no
stability guarantee, package build, compatibility promise, or npm release yet.
Known rough edges and the reasoning behind the API are recorded in
[the design explorations](docs/design-explorations.md).

Notable missing features include immediate transitions and entry/exit hooks.
Some inference also depends on keeping transition declarations inline in the
state map.

## Repository layout

- `src/totorobot.ts` — the library implementation and public API.
- `examples/case-studies/` — traffic-light and asynchronous-auth examples.
- `examples/index.ts` — runs both case studies.
- `tests/totorobot.test.ts` — runtime and compile-time coverage.
- `docs/design-explorations.md` — the experiments and trade-offs that led to
  the current design.

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
