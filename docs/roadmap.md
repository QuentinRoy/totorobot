# Roadmap

> None of this is promised: sketches the design record argues for, past what v1 ships.
> Whether any of it lands, and in what shape, stays open.

## `actions` — effects owned by the definition

v1's answer to effects is "the caller writes a function." `actions` would be
trigger-keyed and declared inside `machine({…})`, so behaviour travels with the
definition when it is imported, rather than living beside it as a convention a caller
has to remember:

```ts
actions: {
	loading:              ({ data, send }) => fetchUser(data.id, send),   // residency
	connected: persistent(({ data, send }) => subscribe(data.url, send)), // survives re-entry
	'draft -cancel> *':   () => track('cancelled'),                       // an edge
}
```

One action per trigger — a state name for entry, or a transition key for an edge. The
default is to restart on every entry; policy is a wrapper rather than syntax, the way
`persistent` is above. An action's `send` accepts only already-declared inputs, so
`actions` adds nothing to the vocabulary.

It comes first among the directions here because `emit`, below, has nowhere to live
without it: a handler may `skip()`, and declaration order is priority order, so a
handler that emitted would announce a transition that then loses. `emit` needs a
post-commit home, and the action bag is the only one.

_Argued in: [rationale §9](api-rationale.md#9-actions)._

## `emit` — a declared output channel

On top of `actions`, a machine could declare what it announces separately from what it
_is_:

```ts
outputs: type<{ type: 'opened'; center: Point } | { type: 'ended' }>(),

actions: {
	novice: persistent(({ data, emit }) => emit({ type: 'opened', center: data.origin })),
},
```

A named output vocabulary, reached from `actions` the way `send` reaches inputs,
subscribed to by name rather than by internal state, so a topology refactor stops
breaking whoever is subscribed to it. `observe` would still see every transition:
nothing hidden, a channel added. The `.on` spelling above is illustrative — no method
name, shape, or syntax is claimed ahead of the design that would justify it.

_Argued in: [rationale §16](api-rationale.md#16-the-composition-boundary)._

## Residency — a recipe today, maybe declared later

Scoping setup and teardown to "while resident in a state" already works as a
[caller-side recipe](api.md#residency-is-a-recipe-not-a-feature) over two `observe`
patterns; the bare key in the key language is reserved for it. If `actions` lands, the
same scoping could be declared directly instead of assembled by hand — the
`// residency` comment on `loading`, above, is what that would look like.

This entry makes no ordering claim against `actions` or `emit`. The host not owning
residency is a decision already made, not a gap waiting on the others, and adding it
later breaks nothing that exists today. Whether it ever does is as open as everything
else here.

_Argued in: [rationale §12](api-rationale.md#residency-is-derivable-not-a-host-feature)._

## Horizontal composition — the chosen direction

Two independent HCI toolkits, six years apart, converged on the same answer for
combining machines: several small peers running side by side, wired by subscriptions,
never hierarchy. That evidence is why peers is the direction, and declared outputs
(above) are what a peer would publish instead of its internal states, so a topology
refactor stops breaking whoever is subscribed to it.

**Peer orchestration is explicitly unsettled.** The wiring between peers still lives
outside any single definition, as imperative calls a caller has to remember to make —
declared outputs improve the convention's vocabulary without closing it. What shape
that orchestration takes, if any is ever built, is not decided.

_Argued in: [rationale §10](api-rationale.md#10-composition), the "Peers" design._

## Vertical composition — explicitly unlikely

A companion design mounted a child machine inside a state, reaching its outcome as a
derived state. It is recorded because it was seriously worked through, not because it
is likely: the motivating case was async work needing setup and teardown, and `actions`
reaches that case directly — a machine owning its own timer or subscription needs no
child machine to mount. What is left for mounting to justify is modularity, and that is
peers' job. Pursuing it would also cost a fourth vocabulary map and a second,
product-shaped way to compose, against a mechanism that already inflected the
vocabulary the way `actions` did not.

_Argued in: [rationale §10](api-rationale.md#10-composition), the "Children" design and
"Where this points"._
