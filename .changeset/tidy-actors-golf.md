---
'totorobot': major
---

A pattern or trigger that matches no declared row is now a type error instead
of an observer typed with `never`.

This is a breaking type change. Add the missing row, or remove the
registration. It checks table membership, not reachability, so a row that is
unreachable from `initial`, or a guard that always declines it, still counts
as declared. A bare `observe` call is exempt: it can always find its state
already occupied by the time it registers. A residency action on a noninitial
state needs an incoming row to ever run, and is rejected without one.
