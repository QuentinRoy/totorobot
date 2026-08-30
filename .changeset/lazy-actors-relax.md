---
'totorobot': minor
---

Add an `actions` block, so work scoped to a state travels with the definition
instead of being bookkeeping every caller writes:

```ts
actions: {
	loading: ({ to, send }) => openSocket(to.url, send), // on entry; returns a teardown
	'draft -submit> review': () => track('submitted'), // per matching transition
}
```

A bare key names a state; a key with `->` is an edge, in the same patterns
`observe` uses. Actions get the record a listener gets, and run in declaration
order before listeners.
