# Research round: FSM theory and library quality

Outside evidence for the next API decision, gathered after the propositions in
`../api-brainstorm/propositions.md` failed to convince.

Read in this order:

1. [Evaluation brief](00-evaluation-brief.md) — the objective function
   (authoring ease, readability, DX) and the two dissatisfactions that started
   this round, including the **arrow test**.
2. [Synthesis](10-synthesis.md) — what the evidence changes, the verdict on the
   three propositions, and what to do next.

Notes, by topic:

| Note                                                                             | Status                                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [01 — Automata and statechart theory](01-automata-statechart-theory.md)          | written, citations verified bibliographically                                |
| [02 — Execution semantics and time](02-execution-semantics-and-time.md)          | written, library sources read directly (XState `createActor.ts`, Redux, DOM) |
| [03 — HCI: state machines for interaction](03-hci-interaction-state-machines.md) | written, two primary sources read in full                                    |
| [04 — HCI: critiques and alternatives](04-hci-critiques-and-alternatives.md)     | written, Proton++ and PMIW read in full                                      |
| [05 — Typestate and behavioural types](05-typestate-and-behavioural-types.md)    | written, fifteen primary sources read                                        |
| [06 — TypeScript type engineering](06-typescript-type-engineering.md)            | written, **prototypes built and measured** on TS 5.9.3 and 7.0.2             |
| [07 — JS/TS library landscape](07-js-fsm-library-landscape.md)                   | written, **library type definitions probed with tsc/node**; sizes measured   |
| [08 — Cross-language FSM design](08-cross-language-fsm-design.md)                | written, `gen_statem` read directly                                          |
| [09 — API usability and DX evidence](09-api-usability-and-dx-evidence.md)        | written, two primary sources read in full                                    |

Later notes have corrected earlier ones. Each correction is recorded inline in
the note that was wrong, as a blockquote pointing at the note that overturned
it — notes 01 (F5), 08 (F7) and 09 (F1) each carry one. The synthesis is
revised; the notes are not silently rewritten.

Note 06 is the only note whose central claims are **measured rather than
cited**, and it falsifies both an earlier project conclusion
(`design-explorations.md`, "Attempt 1") and two claims in the first draft of the
synthesis. Where it disagrees with another note, it wins.

## Provenance and caveats

A nine-topic parallel research sweep was launched and all nine agents were
killed by a session limit before writing anything. These notes are a reduced
inline pass covering the topics most relevant to the stated objective. They are
deep where a primary source was retrieved and read, and thin elsewhere.

Evidence tags are used throughout: **[READ]** means the full text or a
substantial part was retrieved and read; **[ABSTRACT]** means only an abstract,
documentation summary, or search snippet; **[SECONDARY]** means the source was
seen cited or summarized elsewhere, or is standard textbook material. Claims
labelled _inference_ in the synthesis are analysis, not findings.

The strongest single result of the round is the state-search taxonomy in note
09 (Sunshine, Herbsleb and Aldrich, ICPC 2015): developers on API-protocol
tasks spend 71% of their time answering four questions, and the propositions
answer the fourth one — "how do I get from state X to state Y?" — worst.
