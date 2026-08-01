# Raw agent output

Every ideation agent writes to a separate file in this directory before it
finishes. Never make several parallel agents append to one shared file.

Use descriptive filenames such as:

- `wave-1-topology-language.md`
- `wave-1-typestate-interaction.md`
- `wave-1-functions-algebras.md`
- `wave-1-ownership-lifetime.md`
- `wave-2-mutations-a.md`
- `wave-3-gaps-b.md`

Agent-local seed identifiers may use a short file-specific prefix. The
coordinating agent assigns canonical stable identifiers when copying seeds into
[`../raw-seeds.md`](../raw-seeds.md).

Use the loose seed shape from the
[session brief](../../api-brainstorm-brief.md#seed-format). A sketch may be
code, pseudocode, a type signature, a call-site fragment, a grammar, a diagram,
or precise prose.

Raw files are evidence. Do not rewrite another agent's file to normalize its
ideas or remove apparent duplicates.
