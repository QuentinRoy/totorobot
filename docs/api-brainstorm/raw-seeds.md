# Raw API seed index

> **Status:** Generation complete; 110 seeds indexed (2 pre-session, 52 Wave 1,
> 32 Wave 2, 24 Wave 3).

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
| [`W1-A-001`](raw/wave-1-near-field.md#w1-a-001) | Constructor typestates | Wave 1 | W1-A | None | |
| [`W1-A-002`](raw/wave-1-near-field.md#w1-a-002) | Epoch capabilities | Wave 1 | W1-A | None | |
| [`W1-A-003`](raw/wave-1-near-field.md#w1-a-003) | Knowledge in the visit | Wave 1 | W1-A | None | |
| [`W1-A-004`](raw/wave-1-near-field.md#w1-a-004) | Graph before behavior | Wave 1 | W1-A | None | |
| [`W1-A-005`](raw/wave-1-near-field.md#w1-a-005) | Returns are the graph | Wave 1 | W1-A | None | |
| [`W1-A-006`](raw/wave-1-near-field.md#w1-a-006) | Caller-executed obligations | Wave 1 | W1-A | None | |
| [`W1-A-007`](raw/wave-1-near-field.md#w1-a-007) | Coroutine topology | Wave 1 | W1-A | None | |
| [`W1-A-008`](raw/wave-1-near-field.md#w1-a-008) | Transaction policy | Wave 1 | W1-A | None | |
| [`W1-A-009`](raw/wave-1-near-field.md#w1-a-009) | State as classification | Wave 1 | W1-A | None | |
| [`W1-A-010`](raw/wave-1-near-field.md#w1-a-010) | Ordered rewrite program | Wave 1 | W1-A | None | |
| [`W1-A-011`](raw/wave-1-near-field.md#w1-a-011) | Residency reactions | Wave 1 | W1-A | None | |
| [`W1-A-012`](raw/wave-1-near-field.md#w1-a-012) | Resumable effect requests | Wave 1 | W1-A | None | |
| [`W1-A-013`](raw/wave-1-near-field.md#w1-a-013) | Goal-seeking machine | Wave 1 | W1-A | None | |
| [`W1-B-001`](raw/wave-1-alien-mechanisms.md#w1-b-001) | Executory State | Wave 1 | W1-B | None | |
| [`W1-B-002`](raw/wave-1-alien-mechanisms.md#w1-b-002) | Rendezvous Choreography | Wave 1 | W1-B | None | |
| [`W1-B-003`](raw/wave-1-alien-mechanisms.md#w1-b-003) | Linear Game Pieces | Wave 1 | W1-B | None | |
| [`W1-B-004`](raw/wave-1-alien-mechanisms.md#w1-b-004) | Live Permissive Circuit | Wave 1 | W1-B | None | |
| [`W1-B-005`](raw/wave-1-alien-mechanisms.md#w1-b-005) | Actuated Phase Clock | Wave 1 | W1-B | None | |
| [`W1-B-006`](raw/wave-1-alien-mechanisms.md#w1-b-006) | Motif and Coda | Wave 1 | W1-B | None | |
| [`W1-B-007`](raw/wave-1-alien-mechanisms.md#w1-b-007) | Certified Traveler | Wave 1 | W1-B | None | |
| [`W1-B-008`](raw/wave-1-alien-mechanisms.md#w1-b-008) | Petition, Order, Appeal | Wave 1 | W1-B | None | |
| [`W1-B-009`](raw/wave-1-alien-mechanisms.md#w1-b-009) | Receptor Field | Wave 1 | W1-B | None | |
| [`W1-B-010`](raw/wave-1-alien-mechanisms.md#w1-b-010) | Situated Atlas | Wave 1 | W1-B | None | |
| [`W1-B-011`](raw/wave-1-alien-mechanisms.md#w1-b-011) | Stigmergic Surface | Wave 1 | W1-B | None | |
| [`W1-B-012`](raw/wave-1-alien-mechanisms.md#w1-b-012) | Certified Quorum | Wave 1 | W1-B | None | |
| [`W1-B-013`](raw/wave-1-alien-mechanisms.md#w1-b-013) | Referee Projections | Wave 1 | W1-B | None | |
| [`W1-C-001`](raw/wave-1-anti-machine.md#w1-c-001) | Values, Then Conversions | Wave 1 | W1-C | None | |
| [`W1-C-002`](raw/wave-1-anti-machine.md#w1-c-002) | Revocable Replacement Handles | Wave 1 | W1-C | None | |
| [`W1-C-003`](raw/wave-1-anti-machine.md#w1-c-003) | Moves Born in Branches | Wave 1 | W1-C | None | |
| [`W1-C-004`](raw/wave-1-anti-machine.md#w1-c-004) | Authority in a Token | Wave 1 | W1-C | None | |
| [`W1-C-005`](raw/wave-1-anti-machine.md#w1-c-005) | Transition by Property | Wave 1 | W1-C | None | |
| [`W1-C-006`](raw/wave-1-anti-machine.md#w1-c-006) | Session-Typed Async Iterator | Wave 1 | W1-C | None | |
| [`W1-C-007`](raw/wave-1-anti-machine.md#w1-c-007) | Continuations Are States | Wave 1 | W1-C | None | |
| [`W1-C-008`](raw/wave-1-anti-machine.md#w1-c-008) | Transition Transactions | Wave 1 | W1-C | None | |
| [`W1-C-009`](raw/wave-1-anti-machine.md#w1-c-009) | Revisioned Store Lenses | Wave 1 | W1-C | None | |
| [`W1-C-010`](raw/wave-1-anti-machine.md#w1-c-010) | Plans Return Commands | Wave 1 | W1-C | None | |
| [`W1-C-011`](raw/wave-1-anti-machine.md#w1-c-011) | Lexical Resource States | Wave 1 | W1-C | None | |
| [`W1-C-012`](raw/wave-1-anti-machine.md#w1-c-012) | Topology From Use Sites | Wave 1 | W1-C | None | |
| [`W1-C-013`](raw/wave-1-anti-machine.md#w1-c-013) | Gestures as Parsers | Wave 1 | W1-C | None | |
| [`W1-D-001`](raw/wave-1-impossible-language.md#w1-d-001) | Rebinding metamorphosis | Wave 1 | W1-D | None | |
| [`W1-D-002`](raw/wave-1-impossible-language.md#w1-d-002) | Affine state leases | Wave 1 | W1-D | None | |
| [`W1-D-003`](raw/wave-1-impossible-language.md#w1-d-003) | Transition effects | Wave 1 | W1-D | None | |
| [`W1-D-004`](raw/wave-1-impossible-language.md#w1-d-004) | Codomain topology | Wave 1 | W1-D | None | |
| [`W1-D-005`](raw/wave-1-impossible-language.md#w1-d-005) | Graph-behavior lens | Wave 1 | W1-D | None | |
| [`W1-D-006`](raw/wave-1-impossible-language.md#w1-d-006) | Predicate states | Wave 1 | W1-D | None | |
| [`W1-D-007`](raw/wave-1-impossible-language.md#w1-d-007) | Clock-indexed typestates | Wave 1 | W1-D | None | |
| [`W1-D-008`](raw/wave-1-impossible-language.md#w1-d-008) | States as scoped modules | Wave 1 | W1-D | None | |
| [`W1-D-009`](raw/wave-1-impossible-language.md#w1-d-009) | Continuation machine | Wave 1 | W1-D | None | |
| [`W1-D-010`](raw/wave-1-impossible-language.md#w1-d-010) | Event grammar | Wave 1 | W1-D | None | |
| [`W1-D-011`](raw/wave-1-impossible-language.md#w1-d-011) | Reactive interaction score | Wave 1 | W1-D | None | |
| [`W1-D-012`](raw/wave-1-impossible-language.md#w1-d-012) | Consumer-mined protocol | Wave 1 | W1-D | None | |
| [`W1-D-013`](raw/wave-1-impossible-language.md#w1-d-013) | Goal-property routing | Wave 1 | W1-D | None | |
| [`W2-A-001`](raw/wave-2-mutations-a.md#w2-a-001) | Spend the Snapshot | Wave 2 | W2-A | W1-C-004 | |
| [`W2-A-002`](raw/wave-2-mutations-a.md#w2-a-002) | Target-Owned Entrances | Wave 2 | W2-A | H-001 | |
| [`W2-A-003`](raw/wave-2-mutations-a.md#w2-a-003) | Covenanted Residency | Wave 2 | W2-A | W1-B-001, W1-A-011 | |
| [`W2-A-004`](raw/wave-2-mutations-a.md#w2-a-004) | Goal-Composed Coda | Wave 2 | W2-A | W1-A-013, W1-B-006 | |
| [`W2-A-005`](raw/wave-2-mutations-a.md#w2-a-005) | Live Continuation Topology | Wave 2 | W2-A | W1-D-004 | |
| [`W2-A-006`](raw/wave-2-mutations-a.md#w2-a-006) | Residency-Interpolated Script | Wave 2 | W2-A | H-002, W1-A-011 | |
| [`W2-A-007`](raw/wave-2-mutations-a.md#w2-a-007) | Tendered Route Capability | Wave 2 | W2-A | W1-C-004, W1-A-013 | |
| [`W2-A-008`](raw/wave-2-mutations-a.md#w2-a-008) | Ledger Edge Lens | Wave 2 | W2-A | W1-B-001, H-001 | |
| [`W2-B-001`](raw/wave-2-mutations-b.md#w2-b-001) | Crossing Monitor | Wave 2 | W2-B | H-002, W1-A-009 | |
| [`W2-B-002`](raw/wave-2-mutations-b.md#w2-b-002) | Destination-Owned Entry | Wave 2 | W2-B | W1-C-005 | |
| [`W2-B-003`](raw/wave-2-mutations-b.md#w2-b-003) | Ruling Stream | Wave 2 | W2-B | W1-C-006, W1-B-008 | |
| [`W2-B-004`](raw/wave-2-mutations-b.md#w2-b-004) | Concurrent Classifications | Wave 2 | W2-B | W1-A-009 | |
| [`W2-B-005`](raw/wave-2-mutations-b.md#w2-b-005) | Certified Edge Transaction | Wave 2 | W2-B | H-001, W1-B-012 | |
| [`W2-B-006`](raw/wave-2-mutations-b.md#w2-b-006) | Operative Order Fold | Wave 2 | W2-B | W1-B-008 | |
| [`W2-B-007`](raw/wave-2-mutations-b.md#w2-b-007) | Counterfactual Properties | Wave 2 | W2-B | W1-C-005, W1-A-009 | |
| [`W2-B-008`](raw/wave-2-mutations-b.md#w2-b-008) | Compiled Continuation Graph | Wave 2 | W2-B | H-002, W1-C-006 | |
| [`W2-C-001`](raw/wave-2-mutations-c.md#w2-c-001) | Ephemeral Verdicts | Wave 2 | W2-C | W1-B-008, W1-D-006, W1-A-002 | |
| [`W2-C-002`](raw/wave-2-mutations-c.md#w2-c-002) | Commit Tickets | Wave 2 | W2-C | W1-A-008, W1-C-002 | |
| [`W2-C-003`](raw/wave-2-mutations-c.md#w2-c-003) | Desired-State Planner | Wave 2 | W2-C | W1-D-006 | |
| [`W2-C-004`](raw/wave-2-mutations-c.md#w2-c-004) | Provisional Sovereignty | Wave 2 | W2-C | W1-B-008 | |
| [`W2-C-005`](raw/wave-2-mutations-c.md#w2-c-005) | Continuation Topology | Wave 2 | W2-C | W1-A-005 | |
| [`W2-C-006`](raw/wave-2-mutations-c.md#w2-c-006) | Custody Auction | Wave 2 | W2-C | W1-B-007, W1-B-008, W1-A-002 | |
| [`W2-C-007`](raw/wave-2-mutations-c.md#w2-c-007) | Evidence-Only Topology | Wave 2 | W2-C | W1-D-004 | |
| [`W2-C-008`](raw/wave-2-mutations-c.md#w2-c-008) | Lease-Bundle State | Wave 2 | W2-C | W1-A-008, W1-C-002 | |
| [`W2-D-001`](raw/wave-2-mutations-d.md#w2-d-001) | Consumable Residency | Wave 2 | W2-D | None | |
| [`W2-D-002`](raw/wave-2-mutations-d.md#w2-d-002) | Constraint DOM | Wave 2 | W2-D | None | |
| [`W2-D-003`](raw/wave-2-mutations-d.md#w2-d-003) | Fact Projection | Wave 2 | W2-D | None | |
| [`W2-D-004`](raw/wave-2-mutations-d.md#w2-d-004) | Command Generator | Wave 2 | W2-D | None | |
| [`W2-D-005`](raw/wave-2-mutations-d.md#w2-d-005) | Contrapuntal Score | Wave 2 | W2-D | None | |
| [`W2-D-006`](raw/wave-2-mutations-d.md#w2-d-006) | Notarized Move | Wave 2 | W2-D | None | |
| [`W2-D-007`](raw/wave-2-mutations-d.md#w2-d-007) | Convergent Service View | Wave 2 | W2-D | None | |
| [`W2-D-008`](raw/wave-2-mutations-d.md#w2-d-008) | Legal Move Palette | Wave 2 | W2-D | None | |
| [`W3-A-001`](raw/wave-3-gaps-a.md#w3-a-001) | Possibility-frontier machine | Wave 3 | W3-A | None | |
| [`W3-A-002`](raw/wave-3-gaps-a.md#w3-a-002) | Earned-state seals | Wave 3 | W3-A | None | |
| [`W3-A-003`](raw/wave-3-gaps-a.md#w3-a-003) | Paraconsistent witness board | Wave 3 | W3-A | None | |
| [`W3-A-004`](raw/wave-3-gaps-a.md#w3-a-004) | Partitioning probes | Wave 3 | W3-A | None | |
| [`W3-A-005`](raw/wave-3-gaps-a.md#w3-a-005) | Principal-indexed knowledge | Wave 3 | W3-A | None | |
| [`W3-A-006`](raw/wave-3-gaps-a.md#w3-a-006) | Postcondition strategy request | Wave 3 | W3-A | None | |
| [`W3-B-001`](raw/wave-3-gaps-b.md#w3-b-001) | Frontier machine | Wave 3 | W3-B | None | |
| [`W3-B-002`](raw/wave-3-gaps-b.md#w3-b-002) | Causal permits | Wave 3 | W3-B | None | |
| [`W3-B-003`](raw/wave-3-gaps-b.md#w3-b-003) | Merge-shaped phases | Wave 3 | W3-B | None | |
| [`W3-B-004`](raw/wave-3-gaps-b.md#w3-b-004) | Traveling authority | Wave 3 | W3-B | None | |
| [`W3-B-005`](raw/wave-3-gaps-b.md#w3-b-005) | Epistemic typestate | Wave 3 | W3-B | None | |
| [`W3-B-006`](raw/wave-3-gaps-b.md#w3-b-006) | Escrowed effects | Wave 3 | W3-B | None | |
| [`W3-C-001`](raw/wave-3-gaps-c.md#w3-c-001) | Phase-space atlas | Wave 3 | W3-C | None | |
| [`W3-C-002`](raw/wave-3-gaps-c.md#w3-c-002) | Control-law relay | Wave 3 | W3-C | None | |
| [`W3-C-003`](raw/wave-3-gaps-c.md#w3-c-003) | Path-scoped effects | Wave 3 | W3-C | None | |
| [`W3-C-004`](raw/wave-3-gaps-c.md#w3-c-004) | Certified crossing sampler | Wave 3 | W3-C | None | |
| [`W3-C-005`](raw/wave-3-gaps-c.md#w3-c-005) | Constraint-manifold widget | Wave 3 | W3-C | None | |
| [`W3-C-006`](raw/wave-3-gaps-c.md#w3-c-006) | Reachable-target handoff | Wave 3 | W3-C | None | |
| [`W3-D-001`](raw/wave-3-gaps-d.md#w3-d-001) | Optic-pulled machine | Wave 3 | W3-D | None | |
| [`W3-D-002`](raw/wave-3-gaps-d.md#w3-d-002) | Certified patch history | Wave 3 | W3-D | None | |
| [`W3-D-003`](raw/wave-3-gaps-d.md#w3-d-003) | Capability cursors | Wave 3 | W3-D | None | |
| [`W3-D-004`](raw/wave-3-gaps-d.md#w3-d-004) | Operational counterfactuals | Wave 3 | W3-D | None | |
| [`W3-D-005`](raw/wave-3-gaps-d.md#w3-d-005) | Retractable interpretation | Wave 3 | W3-D | None | |
| [`W3-D-006`](raw/wave-3-gaps-d.md#w3-d-006) | Invertibility topology | Wave 3 | W3-D | None | |
