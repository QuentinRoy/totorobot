---
'totorobot': minor
---

A transitions row's source may now be `*`, meaning "this input, from wherever
the machine is, lands here":

```ts
transitions: {
	'* -up> idle': ({ from, fromData, skip }) =>
		from === 'idle' ? skip() : { deps: fromData.deps },
},
```

One row now covers every declared state, including its own target — a state
that should not move opts out with `skip()`, the same way any row declines a
source it does not want. `from` and `fromData` correlate the way
`current.name` and `current.data` do, so checking `from` narrows `fromData`
to that state's own payload rather than widening it to `unknown`.

A wildcard row is an ordinary row: declaration order and `skip()` still decide
between it and a concrete row for the same input, and a pattern naming one of
the states it covers matches it in `observe`, `Handled`, and `Sources` alike.
`observe` and `actions` already accepted `*` in this position; only
`transitions` refused it, and now the three agree.

Grepping a table for a state's own name (`'draft -'`) will not find a
wildcard row that reaches it along with every other state — `Handled` and
`Sources` still answer correctly, since they read a row's actual reach rather
than its spelling.
