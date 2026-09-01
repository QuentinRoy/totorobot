---
'totorobot': minor
---

Add an `actions` block, so work scoped to a state, or fired by a transition,
travels with the definition instead of being bookkeeping every caller writes:

```ts
actions: {
	connected: ({ toData }) => {
		const socket = connect(toData.url)
		return () => socket.close()
	},
}
```
