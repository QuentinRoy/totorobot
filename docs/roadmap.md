# Roadmap

> None of this is promised. These are the directions [the design record](api-rationale.md)
> argues for, past what v1 ships — sketches, not commitments. Whether any of it lands, and
> in what shape, is open.

## `actions` — effects owned by the definition

v1's answer to effects is "the caller writes a function". `actions` would be
trigger-keyed and declared inside `machine({…})`, so behaviour travels with the
definition when it is imported, rather than living beside it as a convention a caller
has to remember. It comes first because `emit` has nowhere to live without it: a
handler may `skip()`, and declaration order is priority order, so a handler that
emitted would announce a transition that then loses — `emit` needs a post-commit
home, and the action bag is the only one.

_Argued in: [rationale §9](api-rationale.md#9-actions)._

## `emit` — a declared output channel

On top of `actions`, a machine could declare what it announces separately from what
it _is_: a named output vocabulary, reached from `actions` the way `send` reaches
inputs, subscribed to by name rather than by internal state. `observe` would still
see every transition — nothing hidden, a channel added rather than one replaced.

_Argued in: [rationale §16](api-rationale.md#16-the-composition-boundary)._

## Horizontal composition — the chosen direction

Two independent HCI toolkits, six years apart, converged on the same answer to
combining machines: several small peers running side by side, wired by
subscriptions, never hierarchy. That evidence is why peers is the direction, and
declared outputs (above) are what a peer would publish instead of its internal
states, so a topology refactor stops breaking whoever is subscribed to it.

**Peer orchestration is explicitly unsettled.** The wiring between peers still lives
outside any single definition, as imperative calls a caller has to remember to
make — declared outputs improve the convention's vocabulary without closing it. What
shape that orchestration takes, if any is ever built, is not decided.

_Argued in: [rationale §10](api-rationale.md#10-composition), the "Peers" design._

## Vertical composition — explicitly unlikely

A companion design mounted a child machine inside a state, reaching its outcome as a
derived state. It is recorded because it was seriously worked through, not because
it is likely: the motivating case was async work needing setup and teardown, and
`actions` reaches that case directly — a machine owning its own timer or subscription
needs no child machine to mount. What is left for mounting to justify is modularity,
and that is peers' job, not a hierarchy's. Pursuing it would also cost a fourth
vocabulary map and a second, product-shaped way to compose, against a mechanism that
already inflected the vocabulary the way `actions` did not.

_Argued in: [rationale §10](api-rationale.md#10-composition), the "Children" design and
"Where this points"._
