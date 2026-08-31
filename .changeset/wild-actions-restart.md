---
'totorobot': minor
---

`actions` values widen to a record with `run` and `restart`, or an array of
either, alongside the existing bare function:

```ts
actions: {
	connected: { run: ({ to }) => subscribe(to.url), restart: false },
}
```

`restart` (`boolean | ((from, to) => boolean)`) is consulted only on a
self-transition and restarts by default; it's a compile error on an edge.
A predicate runs once per self-transition, and that one decision governs
both the teardown and the setup that follows it. Arrays set up in order and
tear down in reverse. Existing actions need no change.
