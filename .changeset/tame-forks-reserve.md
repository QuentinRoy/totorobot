---
'totorobot': major
---

A declared name in `inputs`, `states`, or `outputs` may no longer be `*` or
contain a space. Both were already unaddressable: `*` collides with the
pattern wildcard, and the grammar's own delimiters (` -`, `> `) silently
absorb a padded name, so declaring either one produced a state or input
nothing could ever reach. `type<{ '*': undefined }>()` and
`type<{ ' padded': undefined }>()` are now compile errors naming the
offending key and which vocabulary it is in, for example:

```
reserved state name: '*' is the pattern wildcard
reserved input name: ' padded' contains a space
```

A name that merely contains `*`, such as `a*b`, is untouched. Nothing changes
for a vocabulary inferred from `transitions`, which already excluded both
shapes.

This clears the way for `*` to mean something in a transitions row's own
source position, landing separately.
