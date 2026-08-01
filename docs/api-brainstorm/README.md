# API brainstorm artifacts

This directory is the durable record of the breadth-first API brainstorm. The
[session brief](../api-brainstorm-brief.md) defines the generative process.

Agent messages and the final task response are delivery mechanisms, not the
source of truth. An idea is captured only when it exists in this directory.

## Artifact index

- [`raw/`](raw/) contains separate source files from ideation agents and
  curators. Parallel agents never edit the same file; accepted or abandoned
  files are immutable evidence.
- [`raw-seeds.md`](raw-seeds.md) is the complete append-only index of stable seed
  IDs and links to those originals.
- [`idea-atlas.md`](idea-atlas.md) is the human-browsable map created after the
  generative waves.
- [`breakthrough-deck.md`](breakthrough-deck.md) is the varied selection
  prepared for human reaction.

Later expanded API families may receive their own files or directory, but they
must link back to the raw seed identifiers from which they grew.

## Capture rules

1. The coordinator assigns every agent an exact output path and unique seed-ID
   prefix before launch.
2. Every agent writes its own raw wave file before completing its task.
3. Parallel agents do not edit a shared output file.
4. Every seed receives its stable identifier in the original raw file; the
   coordinator never renames it later.
5. Accepted or abandoned raw files are immutable evidence. The index is
   append-only during generation. Corrections are annotated;
   earlier ideas are not silently erased.
6. The atlas may collapse cosmetic duplicates, but it links to every affected
   raw seed.
7. The breakthrough deck optimizes for surprise and diversity, not an implied
   ranking of “best” APIs.
8. A wave does not close until file existence, seed counts, unique IDs, parent
   references, and one-to-one coverage of every well-formed seed have been
   checked.
9. Missing or malformed output is retried without human intervention. Any
   unavoidable reconstruction is marked as recovered evidence.
10. Human feedback is recorded in the deck or a later disk artifact, even when
    it was originally given in conversation.

## Human delivery

The task handoff should provide a short orientation followed by links to:

1. the breakthrough deck for the first pass;
2. the idea atlas for browsing the explored landscape; and
3. the raw index for completeness and archaeological digging.

The human should not need to read the raw ledger linearly to understand the
session, but no filtering layer may make it inaccessible.
