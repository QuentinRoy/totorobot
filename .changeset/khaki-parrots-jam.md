---
'totorobot': minor
---

`observe` accepts a bare state key too, meaning residency, with the same
`{ run, restart }` record `actions` takes:

```ts
doc.observe('loading', { run: ({ to }) => subscribe(to.url), restart: false })
```

Already resident when observed, it runs immediately. Unsubscribing tears down
one currently in flight. No array, no third-argument options form, no
subscription `AbortSignal`. Existing `observe(pattern, listener)` calls need
no change.
