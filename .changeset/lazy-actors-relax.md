---
'totorobot': minor
---

Add an `actions` block to `machine({…})`, so lifetime-scoped work travels with a
definition instead of being bookkeeping every caller writes by hand:

```ts
actions: {
	loading: ({ state, send }) => {
		const controller = new AbortController()
		fetchUser(state.id, controller.signal).then(
			(user) => send({ type: 'loaded', user }),
			(reason) => send({ type: 'failed', reason }),
		)
		return () => controller.abort()
	},
	'draft -submit> review': () => track('submitted'),
}
```

A key with no `->` names a state and means residency: the function runs on entry,
and the function it returns runs on exit, including across a self-transition and
on every hop of an immediate chain. A key containing `->` is an edge, drawn from
the same pattern language `observe` uses, and fires once per matching transition,
receiving the transition record itself — identical to what a matching listener
gets. Actions run in block declaration order, ahead of every listener, and a
throwing action propagates the same way a throwing listener does.

Only bare functions are supported for now; a `restart` policy, the record form,
and several actions per trigger are tracked separately. `machine()` and its
definitions are otherwise unchanged.

    raw     1,091 B -> 1,464 B
    gzip      640 B ->   764 B
    brotli    577 B ->   700 B
