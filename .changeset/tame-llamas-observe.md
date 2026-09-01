---
'totorobot': minor
---

`observe`'s pattern completions now list only patterns a declared row can
fire (the row keys and their wildcard generalizations), instead of every
name-valid combination. A dead pattern still fails to compile with the same
`no row matches '...'` message as before.

Add `Patterns<M>`, alongside `Handled<M, S>` and `Sources<M, S>`, so a helper
that wraps `observe` can name that same matchable set for its own pattern
argument. Existing calls need no change.
