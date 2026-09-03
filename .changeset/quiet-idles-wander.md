---
'totorobot': minor
---

A transitions row's source can now be `*`, meaning "from wherever the machine is, lands here":

```ts
transitions: {
	'* -up> idle': ({ from, fromData, skip }) =>
		from === 'idle' ? skip() : { deps: fromData.deps },
},
```

One row now covers every declared state, including its own target. A state that should not move may opt out with `skip()`, albeit it should remain limited to a very few at the cost of readability.

A wildcard row is an ordinary row: declaration order and `skip()` still decide between it and a concrete row for the same input.
