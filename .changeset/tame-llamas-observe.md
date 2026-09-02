---
'totorobot': minor
---

`observe`'s pattern completions now list only the patterns a declared row can
fire, rather than every combination the names allow. A dead pattern still fails
to compile with the same `no row matches '...'` message as before.

Add `Patterns` and `Observer`, beside the existing `Handled` and `Sources`. Both
take the machine's own type, so a helper that wraps `observe` can type both of
the arguments it forwards and keep the pattern generic:

```ts
const watch = <P extends Patterns<typeof publication>>(
	pattern: P,
	observer: Observer<typeof publication, P>,
) => doc.observe(pattern, observer)
```

`watch` behaves like `observe` at its own boundary: it rejects a dead pattern,
and narrows the record to the row the pattern matched.
Written without a pattern, `Observer` covers every row the table can fire.
Existing calls need no change.
