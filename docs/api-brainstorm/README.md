# API brainstorm artifacts

This directory is the durable record of the breadth-first API brainstorm. The
[session brief](../api-brainstorm-brief.md) defines the generative process.

Agent messages and the final task response are delivery mechanisms, not the
source of truth. An idea is captured only when it exists in this directory.

## Artifact index

- [`raw/`](raw/) contains one source file per agent and wave. Parallel agents
  never edit the same file.
- [`raw-seeds.md`](raw-seeds.md) is the append-only canonical ledger assembled
  from those source files.
- [`idea-atlas.md`](idea-atlas.md) is the human-browsable map created after the
  generative waves.
- [`breakthrough-deck.md`](breakthrough-deck.md) is the varied selection
  prepared for human reaction.

Later expanded API families may receive their own files or directory, but they
must link back to the raw seed identifiers from which they grew.

## Capture rules

1. Every agent writes its own raw wave file before completing its task.
2. Parallel agents do not edit a shared output file.
3. Every raw seed receives a stable identifier when incorporated into the
   canonical ledger.
4. The ledger is append-only during generation. Corrections are annotated;
   earlier ideas are not silently erased.
5. The atlas may collapse cosmetic duplicates, but it links to every affected
   raw seed.
6. The breakthrough deck optimizes for surprise and diversity, not an implied
   ranking of “best” APIs.
7. Human feedback is recorded in the deck or a later disk artifact, even when
   it was originally given in conversation.

## Human delivery

The task handoff should provide a short orientation followed by links to:

1. the breakthrough deck for the first pass;
2. the idea atlas for browsing the explored landscape; and
3. the raw ledger for completeness and archaeological digging.

The human should not need to read the raw ledger linearly to understand the
session, but no filtering layer may make it inaccessible.
