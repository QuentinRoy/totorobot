---
'totorobot': minor
---

Add an `actions` block, so work scoped to a state travels with the definition
instead of being bookkeeping every caller writes:

```ts
actions: {
	loading: ({ to, send }) => {
		const ctrl = new AbortController()
		fetchUser(to.id, ctrl.signal).then((user) => send({ type: 'loaded', user }))
		return () => ctrl.abort()
	},
	'draft -submit> review': () => track('submitted'),
}
```

A key with no `->` names a state: it runs on entry, and what it returns runs on
exit. A key with `->` is an edge, firing once per matching transition, with the
same patterns `observe` uses.

Every action receives the transition record a listener gets. On the initial
state, which no transition caused, `from` and `input` are `undefined`. Actions
run in declaration order, before listeners.
