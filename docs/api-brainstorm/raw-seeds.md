# Raw API seed index

> **Status:** Two pre-session seeds captured; generative session not started.

The immutable seed bodies live in source files under [`raw/`](raw/). This is the
complete append-only index and reading order. It must point to every raw seed
exactly once without paraphrasing or replacing the original body.

## Index rules

- Seeds receive stable, namespaced identifiers in their source files.
- Link each identifier directly to its stable heading in the source file.
- Preserve name, wave, source, and parent identifiers.
- Annotate likely cosmetic duplicates without deleting either seed.
- Do not rank, score, cluster away, or reject seeds during generation.
- Add corrections as notes instead of silently rewriting history.
- After each wave, verify that the indexed IDs exactly match the well-formed,
  uniquely identified seeds in accepted and abandoned raw files.

## Seeds

| Seed                                | Name                           | Wave        | Source | Parents | Annotation                                              |
| ----------------------------------- | ------------------------------ | ----------- | ------ | ------- | ------------------------------------------------------- |
| [`H-001`](raw/human-seeds.md#h-001) | Transition-keyed edge table    | Pre-session | Human  | None    | Withheld from Wave 1; ordinary seed from Wave 2 onward. |
| [`H-002`](raw/human-seeds.md#h-002) | Interpolated transition script | Pre-session | Human  | None    | Withheld from Wave 1; ordinary seed from Wave 2 onward. |
