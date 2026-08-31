---
'totorobot': minor
---

Add an `actions` block, so work scoped to a state, or fired by a transition,
travels with the definition instead of being bookkeeping every caller writes.

Starting a host runs a declared residency action on the initial state, never
an edge action: entering the initial state is not a transition, so `* -> *`
does not fire there either. Real transitions afterwards, immediate chain
included, invoke their matching edge actions normally.
