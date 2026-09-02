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
the arguments it forwards, and stay generic in the pattern:

```ts
const watch = <P extends Patterns<typeof publication>>(
	pattern: P,
	listener: Listener<typeof publication, P>,
) => doc.observe(pattern, listener)
```

Neither argument could be typed before. The pattern type, the host type and the
listener type are all internal, and `observe` is overloaded, so
`Parameters<typeof doc.observe>` resolves to its bare state key form rather than
its pattern one. Callers of a helper like `watch` keep what a direct `observe`
gives them: a dead pattern is rejected at the helper's own boundary, and the
record is narrowed to the row the pattern matched. `Listener` written without a
pattern covers every row the table can fire.

`observe` takes one more overload to make that work, which accepts a matchable
pattern directly rather than through a conditional on it. Completions are
unchanged, and so is every existing call.
