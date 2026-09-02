---
'totorobot': minor
---

`observe`'s pattern completions now list only patterns a declared row can
fire (the row keys and their wildcard generalizations), instead of every
name-valid combination. A dead pattern still fails to compile with the same
`no row matches '...'` message as before.

Add `Patterns` and `Listener`, next to the existing `Handled` and `Sources`.
Each takes the machine's own type: `typeof publication` for a machine declared
as `publication`. Together they let a helper that wraps `observe` type both of
the arguments it forwards:

```ts
const watch = (
	pattern: Patterns<typeof publication>,
	listener: Listener<typeof publication>,
) => doc.observe(pattern, listener)
```

Neither argument could be typed before. The pattern type, the host type and the
listener type are all internal, and `observe` is overloaded, so
`Parameters<typeof doc.observe>` resolves to its bare state key form rather than
its pattern one. `Listener` takes a pattern as a second argument and narrows the
record to that row; written without one, as above, it covers every row the table
can fire. Existing calls need no change.
