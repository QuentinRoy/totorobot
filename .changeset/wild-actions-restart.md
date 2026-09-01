---
'totorobot': minor
---

`actions` values widen to a record with `run` and `restart`, or an array of
either, alongside the existing bare function:

```ts
actions: {
	connected: { run: ({ toData }) => subscribe(toData.url), restart: false },
}
```

`restart` (a boolean, or a predicate over the transition facts) is consulted
only on a
self-transition and restarts by default; it's a compile error on an edge.
A predicate runs once per self-transition, and that one decision governs
both the teardown and the setup that follows it. Arrays set up in order and
tear down in reverse. Existing actions need no change.
