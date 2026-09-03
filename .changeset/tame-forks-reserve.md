---
'totorobot': major
---

`inputs`, `states`, and `outputs` no longer accept a declared name of `*` or a name containing a space. Both were already unreachable: `*` collides with the pattern wildcard, and the grammar's own delimiters (` -`, `> `) silently swallow a padded name.

This is a breaking type change. Rename the offending state, input, or output; the error names the offending key and which vocabulary it is in, for example `reserved state name: '*' is the pattern wildcard`. A name that merely contains `*`, like `a*b`, is unaffected, and a vocabulary inferred from `transitions` already excluded both shapes.

This also clears the way for `*` to mean something as a transitions row's own source, landing separately.
