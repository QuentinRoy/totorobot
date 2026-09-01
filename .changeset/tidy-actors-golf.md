---
'totorobot': major
---

A pattern or trigger built from declared names, but matching no declared row,
is now a compile-time registration error, not a listener typed with `never`:

```ts
doc.observe('draft -publish> published', () => {}) // no such row: compile error
```

This checks table membership, not reachability: a row unreachable from
`initial`, or one a guard always declines, still counts. A bare-state
`observe` stays valid with no incoming row, since a late registration can find
the state already occupied; a declared residency `action` on a noninitial
state needs an incoming row to ever run, and is rejected without one.
