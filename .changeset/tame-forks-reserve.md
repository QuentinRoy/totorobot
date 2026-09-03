---
'totorobot': major
---

A declared name in `inputs`, `states`, or `outputs` can no longer be `*` or contain a space. Both were already unreachable: `*` collides with the pattern wildcard, and the grammar's own delimiters (` -`, `> `) silently swallow a padded name. Declaring either now fails at compile time, naming the offending key:

```
reserved state name: '*' is the pattern wildcard
reserved input name: ' padded' contains a space
```

A name that merely contains `*`, like `a*b`, still works. A vocabulary inferred from `transitions` is unaffected; it already excluded both shapes.

This clears the way for `*` to mean something as a transitions row's own source, landing separately.
