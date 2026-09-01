---
'totorobot': major
---

Transition record types now include only combinations declared in `transitions`.
They no longer include sources, inputs, or destinations that the machine cannot
use at runtime.

This is a breaking type change. Remove checks for impossible combinations, or
add the corresponding transition when it is valid. Remove a `restart` predicate
from a state without a self-transition, or add that self-transition. A
residency action's `from` still allows `undefined` in its type, the same as
`observe`'s, even on a noninitial state where only `observe` or the initial
state's own action can actually receive that value at runtime.
