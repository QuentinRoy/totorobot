---
'totorobot': major
---

Transition record types now include only combinations declared in `transitions`.
They no longer include sources, inputs, or destinations that the machine cannot
use at runtime.

This is a breaking type change. Remove checks for impossible combinations, or
add the corresponding transition when it is valid. Remove a `restart` predicate
from a state without a self-transition, or add that self-transition. An action
registered for a noninitial state no longer receives `from: undefined`; an
`observe` handler registered with a bare state key can still receive it when it
starts observing a state that is already occupied.
