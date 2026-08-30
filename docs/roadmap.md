# Roadmap

> **None of this is promised.** These are directions the design record argues for,
> past what v1 ships. Whether any of them lands, and in what shape, stays open.

## `actions` — the record form, `restart`, and several per trigger

A bare-function `actions` block has landed: a state-name key means residency, an
edge key (drawn from the same pattern language `observe` uses) fires once per
matching transition, and both get `{ state, send }` or `{ transition, send }`.
See [the README](../README.md#actions-lifetime-scoped-work). What is left is the
record form the design chapter below argued for from the start:

```ts
actions: {
	loading: ({ state, send }) => fetchUser(state.id, send), // residency, bare function
	connected: {
		run: ({ state, send }) => subscribe(state.url, send),
		restart: false, // survives re-entry
	},
	'draft -cancel> *': () => track('cancelled'), // an edge, bare function
}
```

An action becomes a bare function, a record with `run` and an optional `restart`,
or an array of either. `restart` takes `boolean | ((from, to) => boolean)`,
consulted only on a self-transition: the default is to restart on every entry,
`restart: false` survives it, and a predicate over the resident data before and
after decides case by case. It is rejected at compile time on an edge trigger.
The array arm lets one trigger carry more than one action, set up in
declaration order and torn down in reverse. None of this changes what shipped:
an action's `send` still accepts only already-declared inputs, so `actions`
still adds nothing to the vocabulary.

`emit`, below, needed `actions` to exist first: a handler may `skip()`, and
declaration order is priority order, so a handler that emitted would announce a
transition that then loses. `emit` needs a post-commit home, and the action bag
is the only one.

_Argued in: [rationale §9](design-record.md#9-actions)._

## `emit` — a declared output channel

On top of `actions`, a machine could declare what it announces separately from what it
_is_:

```ts
outputs: type<{ type: 'opened'; center: Point } | { type: 'ended' }>(),

actions: {
	novice: {
		run: ({ state, emit }) => emit({ type: 'opened', center: state.origin }),
		restart: false,
	},
},
```

A named output vocabulary, reached from `actions` the way `send` reaches inputs.
Subscribers name an output rather than an internal state, so a topology refactor
stops breaking them. `observe` would still see every transition: nothing hidden, a
channel added. The spelling above is illustrative: no property name, shape, or
syntax is claimed ahead of the design that would justify it.

_Argued in: [rationale §10](design-record.md#revision-the-composition-boundary)._

## Residency on `observe` — the same record `actions` takes

Scoping setup and teardown to "while resident in a state" works two ways now:
the [caller-side recipe](../README.md#residency) over two `observe` patterns,
for a machine you did not declare it with, and a bare-key trigger in
[`actions`](../README.md#actions-lifetime-scoped-work), for one you did. What is
left is `observe` accepting the same record `actions` does —
`observe(pattern, { run, restart })` beside the unchanged
`observe(pattern, listener)` — including a bare state key meaning residency
there too, so a caller-side residency and a declared one share one policy
vocabulary instead of two.

Whether this lands is as open as everything else here, but it breaks nothing
that exists today either way: `actions` already settled the shape, this is only
`observe` learning to accept it.

_Argued in: [rationale §11](design-record.md#residency-is-derivable-not-a-host-feature)._

## Horizontal composition — the chosen direction

Two independent HCI toolkits, six years apart, converged on the same answer for
combining machines: several small peers running side by side, wired by subscriptions,
never hierarchy. That evidence is why peers is the direction, and declared outputs
(above) are what a peer would publish instead of its internal states.

**Peer orchestration is explicitly unsettled.** The wiring between peers still lives
outside any single definition, as imperative calls a caller has to remember to make —
declared outputs improve the convention's vocabulary without closing it. What shape
that orchestration takes, if any is ever built, is not decided.

_Argued in: [rationale §10](design-record.md#10-composition), the "Peers" design._

## Vertical composition — explicitly unlikely

A companion design mounted a child machine inside a state, reaching its outcome as a
derived state. It is recorded because it was seriously worked through, not because it
is likely: the motivating case was async work needing setup and teardown, and `actions`
reaches that case directly — a machine owning its own timer or subscription needs no
child machine to mount. What is left for mounting to justify is modularity, and that is
peers' job. Pursuing it would also cost a fourth vocabulary map and a second,
product-shaped way to compose. And a mount grows the input vocabulary, with names
like `loading.ok`, where `actions` leaves it exactly as declared.

_Argued in: [rationale §10](design-record.md#10-composition), the "Children" design and
"Where this points"._
