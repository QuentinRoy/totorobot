# Raw agent output

Every ideation agent writes to a separate file in this directory before it
finishes. The coordinator assigns the exact path; agents do not choose their
own filenames. Never make several parallel agents append to one shared file.

Use descriptive filenames such as:

- `wave-1-near-field.md`
- `wave-1-alien-mechanisms.md`
- `wave-1-anti-machine.md`
- `wave-1-impossible-language.md`
- `wave-2-mutations-a.md`
- `wave-3-gaps-a.md`

The coordinator also reserves a unique prefix for each file, such as `W1-A`,
`W1-B`, or `W2-C`. Every seed heading uses that prefix immediately:

```md
## W1-A-001

**Name:** Short name
```

These identifiers are canonical from birth. They are never remapped to a new
global sequence. Mutation-wave seeds list parent IDs in a `**Parents:**` field.

Use the loose seed shape from the
[session brief](../../api-brainstorm-brief.md#seed-format). A sketch may be
code, pseudocode, a type signature, a call-site fragment, a grammar, a diagram,
or precise prose.

Accepted or abandoned raw files are immutable evidence. Do not rewrite them to
normalize ideas or remove apparent duplicates. The coordinating agent adds
links and annotations in [`../raw-seeds.md`](../raw-seeds.md), not here.

If a worker cannot repair a partial file, declare it abandoned and give its
replacement a `-retry-N.md` path and `-R<N>` prefix. Index well-formed, uniquely
identified partial seeds as recovered, but do not count them toward the
replacement's minimum. Other fragments remain only as provenance.

Independent curator nominations also use separate files named
`curation-<lens>.md`. They are raw evidence but are not entries in the seed
index.
