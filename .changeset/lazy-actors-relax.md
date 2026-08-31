---
'totorobot': minor
---

Add an `actions` block, so work scoped to a state, or fired by a transition,
travels with the definition instead of being bookkeeping every caller writes:

```ts
actions: {
	connected: ({ to }) => {
		const socket = connect(to.url)
		return () => socket.close()
	},
}
```
