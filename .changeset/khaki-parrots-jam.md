---
'totorobot': minor
---

`observe` now also accepts a bare state key, meaning residency, using the
same `{ run, restart }` record `actions` takes:

```ts
doc.observe('loading', {
	run: ({ toData }) => subscribe(toData.url),
	restart: false,
})
```

If the state is already resident when you call `observe`, the run callback
fires immediately. Unsubscribing tears down a run in flight. There's no
array form, no third-argument options object, and no subscription
`AbortSignal`. Existing `observe(pattern, listener)` calls need no change.
