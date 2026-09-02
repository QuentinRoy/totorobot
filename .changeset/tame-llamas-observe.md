---
'totorobot': minor
---

`observe`'s pattern completions now list only patterns a declared row can
fire (the row keys and their wildcard generalizations), instead of every
name-valid combination. A dead pattern still fails to compile with the same
`no row matches '...'` message as before.

Add `Patterns` and `Observer`, next to the existing `Handled` and `Sources`.
Each takes the machine's own type: `typeof publication` for a machine declared
as `publication`. Together they let a helper that wraps `observe` type both of
the arguments it forwards, and stay generic in the pattern:

```ts
const watch = <P extends Patterns<typeof publication>>(
	pattern: P,
	observer: Observer<typeof publication, P>,
) => doc.observe(pattern, observer)
```

Neither argument could be typed before. The pattern type, the host type and the
callback type are all internal, and `observe` is overloaded, so
`Parameters<typeof doc.observe>` resolves to its bare state key form rather than
its pattern one. Callers of a helper like `watch` keep what a direct `observe`
gives them: a dead pattern is rejected at the helper's own boundary, and the
record is narrowed to the row the pattern matched. `Observer` written without a
pattern covers every row the table can fire.

The documentation now calls `observe`'s callback an observer rather than a
listener, since it is handed the record of a transition that committed rather
than an event that happened. Nothing about the callback changed, and `Listener`
is deliberately not exported: it is kept for a declared output channel, which
would have the better claim to it.

`observe` takes one more overload to make the generic helper work, which accepts
a matchable pattern directly rather than through a conditional on it.
Completions are unchanged, and so is every existing call.
