# Quiet Foundations

Lens: Understated, structurally clean mechanisms whose deliberately open seam could accept one alien property without disturbing the core.

## [W1-A-003 - Knowledge in the visit](wave-1-near-field.md#w1-a-003)

The exhaustive visit is a compact foundation: it creates a hard boundary around state-specific knowledge while leaving ownership and representation opaque. Its open seam is branch-local lifetime; knowledge is protected during a callback, but work started there has no stated validity or revocation boundary afterward.

## [W1-C-001 - Values, Then Conversions](wave-1-anti-machine.md#w1-c-001)

Immutable values and free conversions form a nearly irreducible core with explicit evolution and no imposed runtime shell. Its open seam is effect and resource responsibility: the mechanism does not say how a conversion acquires external resources, survives waiting, or guarantees cleanup.

## [W2-D-008 - Legal Move Palette](wave-2-mutations-d.md#w2-d-008)

The pure split between deriving opaque legal moves and applying one to a caller-owned position creates a stable rules boundary while keeping UI and effect execution outside it. Its open seam is freshness and authority: a move retained after its source position changes has no stated validity contract; the existing effect list is a useful attachment point.
