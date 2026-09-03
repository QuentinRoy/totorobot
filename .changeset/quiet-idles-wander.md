---
'totorobot': minor
---

A transitions row's source can now be `*`, meaning "this input, from wherever the machine is, lands here":

```ts
transitions: {
	'* -up> idle': ({ from, fromData, skip }) =>
		from === 'idle' ? skip() : { deps: fromData.deps },
},
```

One row now covers every declared state, including its own target. A state that should not move opts out with `skip()`, the same way any row declines a source it does not want. `from` and `fromData` correlate the way `current.name` and `current.data` do, so checking `from` narrows `fromData` instead of widening it to `unknown`.

A wildcard row is an ordinary row: declaration order and `skip()` still decide between it and a concrete row for the same input. `observe` and `actions` already accepted `*` here; now `transitions` does too.

Grepping a table for a state's own name (`'draft -'`) won't find a wildcard row that also reaches it. `Handled` and `Sources` still answer correctly, since they read a row's actual reach rather than its spelling.
