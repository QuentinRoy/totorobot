# Roadmap

> **None of this is promised.** These are directions the design record argues for,
> past what the library ships today. Whether any of them lands, and in what shape, stays open.

## Horizontal composition — the chosen direction

Two independent HCI toolkits, six years apart, converged on the same answer for
combining machines: several small peers running side by side, wired by subscriptions,
never hierarchy. That evidence is why peers is the direction, and
[declared outputs](../README.md#outputs-what-a-machine-announces) — shipped — are what
a peer publishes instead of its internal states.

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
peers' job. Pursuing it would also cost another vocabulary map and a second,
product-shaped way to compose. And a mount grows the input vocabulary, with names
like `loading.ok`, where `actions` leaves it exactly as declared.

_Argued in: [rationale §10](design-record.md#10-composition), the "Children" design and
"Where this points"._
