---
'totorobot': minor
---

`observe`'s pattern completions now list only the patterns a declared row can
fire, rather than every combination the names allow. A dead pattern still fails
to compile with the same `no row matches '...'` message as before.

Add `Patterns` and `Observer`, beside the existing `Handled` and `Sources`. Both
take the machine's own type. You can use them, for example, to name an observer
before you register it, and it narrows the record just as an inline one does:

```ts
const notify: Observer<typeof publication, '* -> published'> = ({ toData }) =>
	announce(toData.text)
```

Written without a pattern, `Observer` covers every row the table can fire. The
two types also compose: a helper that wraps `observe` can hold one generic `P`
across its pattern and its observer, and still reject a dead pattern at its own
boundary. Existing calls need no change.
