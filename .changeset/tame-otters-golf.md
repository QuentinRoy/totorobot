---
'totorobot': major
---

A transition record's three names now correlate with the declared table:
checking one narrows the other two to only the sources, destinations and
inputs a declared row actually pairs it with, not to every declared name.
`observe`, `actions`, and a residency's arrival all share this.

```ts
doc.observe('empty -> *', (e) => {
	// `e.to` narrows to "draft" alone — the only state "empty" reaches —
	// rather than to every declared state.
})
```

A residency's `from`, and a `restart` predicate's facts, narrow the same way.
A state with no row reaching it, or no self-transition row, now narrows to
`never` there instead of to the whole vocabulary: declare the missing row, or
read a narrower field.

A declared action shares its residency's arrival-capable type with `observe`
throughout: `from` stays `'…' | undefined` on every bare-state action, initial
or not, whether or not that particular declaration could ever actually see the
`undefined` case at runtime.
