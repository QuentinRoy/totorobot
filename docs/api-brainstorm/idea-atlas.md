# Raw Seed Idea Atlas

> **Status:** Generation complete. 110 seeds. This is a descriptive map, not an evaluation.

## Orientation

The territories below are overlapping browsing views, not candidate families. A seed can illuminate several design choices, and neighboring seeds can disagree about source of truth, ownership, topology, or effects. Primary placement is used only by the coverage ledger; it does not merge contradictory seeds into one API.

## Browse by Design Choice

| Design choice | Views present in the raw pool | Representative raw seeds |
| --- | --- | --- |
| Source of truth / what the machine is | Caller-held value, hidden service, external facts, obligations ledger, continuation, phase point, or history graph | [W1-C-001](raw/wave-1-anti-machine.md#w1-c-001), [W1-A-002](raw/wave-1-near-field.md#w1-a-002), [W1-A-009](raw/wave-1-near-field.md#w1-a-009), [W1-B-001](raw/wave-1-alien-mechanisms.md#w1-b-001), [W1-D-009](raw/wave-1-impossible-language.md#w1-d-009), [W3-C-001](raw/wave-3-gaps-c.md#w3-c-001), [W3-D-002](raw/wave-3-gaps-d.md#w3-d-002) |
| Evolving-state owner | Caller, application store, service, current continuation, cooperating actors, or causal replicas | [W1-A-001](raw/wave-1-near-field.md#w1-a-001), [W1-A-008](raw/wave-1-near-field.md#w1-a-008), [W2-D-007](raw/wave-2-mutations-d.md#w2-d-007), [W1-C-006](raw/wave-1-anti-machine.md#w1-c-006), [W1-B-002](raw/wave-1-alien-mechanisms.md#w1-b-002), [W3-B-001](raw/wave-3-gaps-b.md#w3-b-001) |
| Transition request | Named edge or event, conversion, property path, petition, proposal, desired postcondition, or boundary crossing | [H-001](raw/human-seeds.md#h-001), [W1-C-001](raw/wave-1-anti-machine.md#w1-c-001), [W1-C-005](raw/wave-1-anti-machine.md#w1-c-005), [W1-B-008](raw/wave-1-alien-mechanisms.md#w1-b-008), [W1-B-012](raw/wave-1-alien-mechanisms.md#w1-b-012), [W2-C-003](raw/wave-2-mutations-c.md#w2-c-003), [W3-C-001](raw/wave-3-gaps-c.md#w3-c-001) |
| State-specific knowledge | Exhaustive visit, branch capability, destination constructor, revision permit, role projection, or principal-indexed proof | [W1-A-003](raw/wave-1-near-field.md#w1-a-003), [W1-C-003](raw/wave-1-anti-machine.md#w1-c-003), [W2-A-002](raw/wave-2-mutations-a.md#w2-a-002), [W1-C-004](raw/wave-1-anti-machine.md#w1-c-004), [W1-B-013](raw/wave-1-alien-mechanisms.md#w1-b-013), [W3-A-005](raw/wave-3-gaps-a.md#w3-a-005) |
| Topology location | Explicit graph, handler codomains, current values, use sites, consumer programs, runtime evidence, or merged facts | [W1-A-004](raw/wave-1-near-field.md#w1-a-004), [W1-D-004](raw/wave-1-impossible-language.md#w1-d-004), [W2-A-005](raw/wave-2-mutations-a.md#w2-a-005), [W1-C-012](raw/wave-1-anti-machine.md#w1-c-012), [W1-D-012](raw/wave-1-impossible-language.md#w1-d-012), [W2-C-007](raw/wave-2-mutations-c.md#w2-c-007), [W3-B-003](raw/wave-3-gaps-b.md#w3-b-003) |
| Effects / lifecycle | Returned obligations, interpreted commands, residency reactions, lexical scopes, staged transactions, resource bundles, or distributed escrow | [W1-A-006](raw/wave-1-near-field.md#w1-a-006), [W1-C-010](raw/wave-1-anti-machine.md#w1-c-010), [W1-A-011](raw/wave-1-near-field.md#w1-a-011), [W1-C-011](raw/wave-1-anti-machine.md#w1-c-011), [W1-C-008](raw/wave-1-anti-machine.md#w1-c-008), [W2-C-008](raw/wave-2-mutations-c.md#w2-c-008), [W3-B-006](raw/wave-3-gaps-b.md#w3-b-006) |

## Territories

### CV - Caller-Owned Values and Conversions

**Mechanisms:** Immutable typestate values move through constructors, free conversions, rebinding, or a position-specific move oracle; no persistent machine object need own evolution.

**Disagreements preserved:** Transitions may be methods or free functions, reassignment may be ordinary or compiler-tracked, and legal successors may be named statically or returned as opaque moves.

**Raw seeds:** [W1-A-001](raw/wave-1-near-field.md#w1-a-001), [W1-C-001](raw/wave-1-anti-machine.md#w1-c-001), [W1-D-001](raw/wave-1-impossible-language.md#w1-d-001), [W2-D-008](raw/wave-2-mutations-d.md#w2-d-008).

### AH - Authority Handles, Capabilities, and Leases

**Mechanisms:** State-specific authority is carried by epoch handles, revocable replacements, one-shot permits, revision lenses, affine leases, spent snapshots, or commit tickets.

**Disagreements preserved:** Observation and authority may be separate or fused; a service or external store may own truth; stale use may be rejected by a compiler, epoch check, revocation, or compare-and-swap.

**Raw seeds:** [W1-A-002](raw/wave-1-near-field.md#w1-a-002), [W1-C-002](raw/wave-1-anti-machine.md#w1-c-002), [W1-C-004](raw/wave-1-anti-machine.md#w1-c-004), [W1-C-009](raw/wave-1-anti-machine.md#w1-c-009), [W1-D-002](raw/wave-1-impossible-language.md#w1-d-002), [W2-A-001](raw/wave-2-mutations-a.md#w2-a-001), [W2-C-002](raw/wave-2-mutations-c.md#w2-c-002).

### SK - Scoped and State-Owned Knowledge

**Mechanisms:** Narrow knowledge and legal operations exist only inside a visit, branch callback, scoped module, or destination-owned constructor.

**Disagreements preserved:** The current source, the destination, or a lexical scope may own the API; values may be opaque or behaviorless; inbound invariants and outbound moves remain distinct arrangements.

**Raw seeds:** [W1-A-003](raw/wave-1-near-field.md#w1-a-003), [W1-C-003](raw/wave-1-anti-machine.md#w1-c-003), [W1-D-008](raw/wave-1-impossible-language.md#w1-d-008), [W2-A-002](raw/wave-2-mutations-a.md#w2-a-002), [W2-B-002](raw/wave-2-mutations-b.md#w2-b-002).

### IT - Inferred, Live, and Evidence Topology

**Mechanisms:** Edges emerge from handler return types, lazy properties, current-instance methods, conversion use sites, compiler overloads, consumer programs, or executed evidence.

**Disagreements preserved:** Topology may be prospective or retrospective, global or instance-local, authored by implementers or inferred from consumers, and statically exhaustive or deliberately open at runtime.

**Raw seeds:** [W1-A-005](raw/wave-1-near-field.md#w1-a-005), [W1-B-009](raw/wave-1-alien-mechanisms.md#w1-b-009), [W1-C-005](raw/wave-1-anti-machine.md#w1-c-005), [W1-C-012](raw/wave-1-anti-machine.md#w1-c-012), [W1-D-004](raw/wave-1-impossible-language.md#w1-d-004), [W1-D-012](raw/wave-1-impossible-language.md#w1-d-012), [W2-A-005](raw/wave-2-mutations-a.md#w2-a-005), [W2-C-007](raw/wave-2-mutations-c.md#w2-c-007).

### GN - Explicit Graph Notation and Dual Views

**Mechanisms:** Edge tables, tagged scripts, behavior-free graphs, rewrite rules, graph-behavior lenses, residency annotations, and temporal scores make topology directly readable.

**Disagreements preserved:** The graph may be sole authority, one side of a compiler-maintained duality, or notation checked against modules; behavior may attach to edges, state residency, rewrite clauses, or a separate implementation.

**Raw seeds:** [H-001](raw/human-seeds.md#h-001), [H-002](raw/human-seeds.md#h-002), [W1-A-004](raw/wave-1-near-field.md#w1-a-004), [W1-A-010](raw/wave-1-near-field.md#w1-a-010), [W1-D-005](raw/wave-1-impossible-language.md#w1-d-005), [W2-A-006](raw/wave-2-mutations-a.md#w2-a-006), [W2-D-005](raw/wave-2-mutations-d.md#w2-d-005).

### ER - Effects, Residency, and Resources

**Mechanisms:** Decisions return obligations or commands, pause on interpreted requests, open residency or lexical scopes, stage cleanup, or atomically replace resource bundles.

**Disagreements preserved:** The caller or runtime may execute effects; effects may be outputs or resumable control points; lifecycle may belong to an edge, residency, continuation, lexical scope, transaction, or resource bundle.

**Raw seeds:** [W1-A-006](raw/wave-1-near-field.md#w1-a-006), [W1-A-011](raw/wave-1-near-field.md#w1-a-011), [W1-A-012](raw/wave-1-near-field.md#w1-a-012), [W1-C-010](raw/wave-1-anti-machine.md#w1-c-010), [W1-C-011](raw/wave-1-anti-machine.md#w1-c-011), [W1-D-003](raw/wave-1-impossible-language.md#w1-d-003), [W2-A-003](raw/wave-2-mutations-a.md#w2-a-003), [W2-C-008](raw/wave-2-mutations-c.md#w2-c-008), [W2-D-001](raw/wave-2-mutations-d.md#w2-d-001), [W2-D-004](raw/wave-2-mutations-d.md#w2-d-004).

### FC - External Facts, Classifications, and Constraints

**Mechanisms:** State is derived from facts, predicates, live permissives, clocks, DOM preconditions, labels, crossings, or append-only fact projections rather than maintained as an independent slot.

**Disagreements preserved:** Classifications may be exclusive or concurrent, predicates total or partial, crossings explicit or synthesized, permissives continuously live or transactionally sampled, and facts mutable or append-only.

**Raw seeds:** [W1-A-009](raw/wave-1-near-field.md#w1-a-009), [W1-B-004](raw/wave-1-alien-mechanisms.md#w1-b-004), [W1-D-006](raw/wave-1-impossible-language.md#w1-d-006), [W1-D-007](raw/wave-1-impossible-language.md#w1-d-007), [W2-B-001](raw/wave-2-mutations-b.md#w2-b-001), [W2-B-004](raw/wave-2-mutations-b.md#w2-b-004), [W2-D-002](raw/wave-2-mutations-d.md#w2-d-002), [W2-D-003](raw/wave-2-mutations-d.md#w2-d-003).

### TL - Transactions, Ledgers, and Legal Authority

**Mechanisms:** Store transactions, bilateral duties, petitions, orders, quorum certificates, append-only rulings, provisional authority, and witness seals mediate changes.

**Disagreements preserved:** Authority may sit with a store, obligated roles, tribunal, quorum, or witnesses; requests may remain pending, become provisional, or commit atomically; present state may be rewritten directly or folded from orders.

**Raw seeds:** [W1-A-008](raw/wave-1-near-field.md#w1-a-008), [W1-B-001](raw/wave-1-alien-mechanisms.md#w1-b-001), [W1-B-008](raw/wave-1-alien-mechanisms.md#w1-b-008), [W1-B-012](raw/wave-1-alien-mechanisms.md#w1-b-012), [W1-C-008](raw/wave-1-anti-machine.md#w1-c-008), [W2-A-008](raw/wave-2-mutations-a.md#w2-a-008), [W2-B-003](raw/wave-2-mutations-b.md#w2-b-003), [W2-B-005](raw/wave-2-mutations-b.md#w2-b-005), [W2-B-006](raw/wave-2-mutations-b.md#w2-b-006), [W2-C-004](raw/wave-2-mutations-c.md#w2-c-004), [W2-D-006](raw/wave-2-mutations-d.md#w2-d-006).

### CP - Continuations, Parsers, and Scores

**Mechanisms:** Suspended coroutines, async sessions, callback continuations, event grammars, parser combinators, temporal scores, and dataflow equations carry protocol position.

**Disagreements preserved:** Progress may use `next`, callbacks, yields, grammar recognition, or score cues; topology may be explicit notation or opaque control position; effects may be emitted, awaited, or scoped by continuation lifetime.

**Raw seeds:** [W1-A-007](raw/wave-1-near-field.md#w1-a-007), [W1-B-006](raw/wave-1-alien-mechanisms.md#w1-b-006), [W1-C-006](raw/wave-1-anti-machine.md#w1-c-006), [W1-C-007](raw/wave-1-anti-machine.md#w1-c-007), [W1-C-013](raw/wave-1-anti-machine.md#w1-c-013), [W1-D-009](raw/wave-1-impossible-language.md#w1-d-009), [W1-D-010](raw/wave-1-impossible-language.md#w1-d-010), [W1-D-011](raw/wave-1-impossible-language.md#w1-d-011), [W2-B-008](raw/wave-2-mutations-b.md#w2-b-008), [W2-C-005](raw/wave-2-mutations-c.md#w2-c-005).

### GP - Goals, Plans, and Routes

**Mechanisms:** Callers request a destination or postcondition, discover contextual routes, inspect a prepared route capability, or let a service plan operations and cleanup.

**Disagreements preserved:** A goal may name a state, predicate, or capability; the service or caller may choose the route; a route may execute immediately, become an inspectable score, or wait as a one-shot capability.

**Raw seeds:** [W1-A-013](raw/wave-1-near-field.md#w1-a-013), [W1-B-010](raw/wave-1-alien-mechanisms.md#w1-b-010), [W1-D-013](raw/wave-1-impossible-language.md#w1-d-013), [W2-A-004](raw/wave-2-mutations-a.md#w2-a-004), [W2-A-007](raw/wave-2-mutations-a.md#w2-a-007), [W2-C-003](raw/wave-2-mutations-c.md#w2-c-003), [W2-D-007](raw/wave-2-mutations-d.md#w2-d-007).

### MO - Multi-Actor and Distributed Ownership

**Mechanisms:** Role cursors, linear tokens, schedulers, travelers, traces, referee projections, custody awards, causal DAGs, permits, merge phases, mobile authority, and effect escrow distribute evolution.

**Disagreements preserved:** Coordination may use rendezvous, arbitration, a shared field, a canonical referee, or monotone merge; authority may be centralized, possessed, auctioned, forked, or transferred; replicas may expose one result or explicit concurrent heads.

**Raw seeds:** [W1-B-002](raw/wave-1-alien-mechanisms.md#w1-b-002), [W1-B-003](raw/wave-1-alien-mechanisms.md#w1-b-003), [W1-B-005](raw/wave-1-alien-mechanisms.md#w1-b-005), [W1-B-007](raw/wave-1-alien-mechanisms.md#w1-b-007), [W1-B-011](raw/wave-1-alien-mechanisms.md#w1-b-011), [W1-B-013](raw/wave-1-alien-mechanisms.md#w1-b-013), [W2-C-006](raw/wave-2-mutations-c.md#w2-c-006), [W3-B-001](raw/wave-3-gaps-b.md#w3-b-001), [W3-B-002](raw/wave-3-gaps-b.md#w3-b-002), [W3-B-003](raw/wave-3-gaps-b.md#w3-b-003), [W3-B-004](raw/wave-3-gaps-b.md#w3-b-004), [W3-B-006](raw/wave-3-gaps-b.md#w3-b-006).

### EU - Epistemic Uncertainty and Proof

**Mechanisms:** Possibility frontiers, evidence-backed seals, contradictory witness graphs, information partitions, principal-indexed knowledge, contingent strategies, and causal-horizon proofs make uncertainty explicit.

**Disagreements preserved:** Uncertainty may be a set of worlds, an unresolved partition, or conflicting provenance; knowledge may be global or principal-relative; probes may reduce uncertainty while safe commands and total strategies may operate without resolving it.

**Raw seeds:** [W2-C-001](raw/wave-2-mutations-c.md#w2-c-001), [W3-A-001](raw/wave-3-gaps-a.md#w3-a-001), [W3-A-002](raw/wave-3-gaps-a.md#w3-a-002), [W3-A-003](raw/wave-3-gaps-a.md#w3-a-003), [W3-A-004](raw/wave-3-gaps-a.md#w3-a-004), [W3-A-005](raw/wave-3-gaps-a.md#w3-a-005), [W3-A-006](raw/wave-3-gaps-a.md#w3-a-006), [W3-B-005](raw/wave-3-gaps-b.md#w3-b-005).

### CD - Continuous and Spatial Dynamics

**Mechanisms:** Phase-space regions, differential control laws, path-owned effects, adaptive crossing proofs, geometric constraint solvers, and reachable tubes replace or surround discrete event steps.

**Disagreements preserved:** Truth may be a sample, bounded interval, trajectory, active law, or constraint solution; transitions may be region crossings, invariant exits, impacts, or inevitable handoffs; the sampler, solver, browser, or caller may own motion.

**Raw seeds:** [W3-C-001](raw/wave-3-gaps-c.md#w3-c-001), [W3-C-002](raw/wave-3-gaps-c.md#w3-c-002), [W3-C-003](raw/wave-3-gaps-c.md#w3-c-003), [W3-C-004](raw/wave-3-gaps-c.md#w3-c-004), [W3-C-005](raw/wave-3-gaps-c.md#w3-c-005), [W3-C-006](raw/wave-3-gaps-c.md#w3-c-006).

### RV - Reversible and Counterfactual History

**Mechanisms:** Preview patches, partial isomorphisms, certified inverse patches, temporal cursors, executable overlays, retractable facts, and groupoid paths represent alternatives and return paths.

**Disagreements preserved:** A counterfactual may stay a preview or run reversible effects; inversion may be supplied, proved, or algebraic; later change may roll back a branch, adopt it, or reinterpret prior facts; external effects may use duals or compensation.

**Raw seeds:** [W2-B-007](raw/wave-2-mutations-b.md#w2-b-007), [W3-D-001](raw/wave-3-gaps-d.md#w3-d-001), [W3-D-002](raw/wave-3-gaps-d.md#w3-d-002), [W3-D-003](raw/wave-3-gaps-d.md#w3-d-003), [W3-D-004](raw/wave-3-gaps-d.md#w3-d-004), [W3-D-005](raw/wave-3-gaps-d.md#w3-d-005), [W3-D-006](raw/wave-3-gaps-d.md#w3-d-006).

## Speculative Fringe

This fringe marks unusual language, ownership, world-model, or runtime dependencies. It is a browsing aid, not a quality judgment; raw files explicitly label some of these seeds speculative and leave others unlabeled.

| Fringe | What changes | Raw seeds |
| --- | --- | --- |
| Compiler-dependent | Bindings change type, handlers generate global topology, graph and behavior round-trip, clocks enter proofs, or consumers determine a protocol | [W1-D-001](raw/wave-1-impossible-language.md#w1-d-001), [W1-D-004](raw/wave-1-impossible-language.md#w1-d-004), [W1-D-005](raw/wave-1-impossible-language.md#w1-d-005), [W1-D-007](raw/wave-1-impossible-language.md#w1-d-007), [W1-D-012](raw/wave-1-impossible-language.md#w1-d-012), [W1-D-013](raw/wave-1-impossible-language.md#w1-d-013), [W3-D-002](raw/wave-3-gaps-d.md#w3-d-002) |
| Ownership-dependent | Correctness leans on consumption, revocation, affine authority, or transfer across aliases and async boundaries | [W1-A-002](raw/wave-1-near-field.md#w1-a-002), [W1-C-002](raw/wave-1-anti-machine.md#w1-c-002), [W1-D-002](raw/wave-1-impossible-language.md#w1-d-002), [W2-A-001](raw/wave-2-mutations-a.md#w2-a-001), [W2-B-008](raw/wave-2-mutations-b.md#w2-b-008), [W3-B-002](raw/wave-3-gaps-b.md#w3-b-002), [W3-B-004](raw/wave-3-gaps-b.md#w3-b-004) |
| Epistemic and distributed | Current state becomes a frontier, partition, provenance graph, principal-relative fact, causal DAG, merge phase, or split authority | [W3-A-001](raw/wave-3-gaps-a.md#w3-a-001), [W3-A-003](raw/wave-3-gaps-a.md#w3-a-003), [W3-A-004](raw/wave-3-gaps-a.md#w3-a-004), [W3-A-005](raw/wave-3-gaps-a.md#w3-a-005), [W3-B-001](raw/wave-3-gaps-b.md#w3-b-001), [W3-B-003](raw/wave-3-gaps-b.md#w3-b-003), [W3-B-005](raw/wave-3-gaps-b.md#w3-b-005), [W3-B-006](raw/wave-3-gaps-b.md#w3-b-006) |
| Continuous dynamics | Samples, trajectories, control laws, geometric constraints, and reachable tubes replace a purely discrete event model | [W3-C-001](raw/wave-3-gaps-c.md#w3-c-001), [W3-C-002](raw/wave-3-gaps-c.md#w3-c-002), [W3-C-003](raw/wave-3-gaps-c.md#w3-c-003), [W3-C-004](raw/wave-3-gaps-c.md#w3-c-004), [W3-C-005](raw/wave-3-gaps-c.md#w3-c-005), [W3-C-006](raw/wave-3-gaps-c.md#w3-c-006) |
| Reversible time | APIs expose inverse moves, history branches, operational alternatives, retractions, or invertible path algebra | [W2-B-007](raw/wave-2-mutations-b.md#w2-b-007), [W3-D-001](raw/wave-3-gaps-d.md#w3-d-001), [W3-D-002](raw/wave-3-gaps-d.md#w3-d-002), [W3-D-003](raw/wave-3-gaps-d.md#w3-d-003), [W3-D-004](raw/wave-3-gaps-d.md#w3-d-004), [W3-D-005](raw/wave-3-gaps-d.md#w3-d-005), [W3-D-006](raw/wave-3-gaps-d.md#w3-d-006) |

## Useful Donor Fragments

These are transplantable properties visible across otherwise different seeds. They are neither a selection deck nor a ranking.

| Property | Raw examples |
| --- | --- |
| Separate immutable observation from one-shot mutation authority | [W1-C-004](raw/wave-1-anti-machine.md#w1-c-004), [W2-C-002](raw/wave-2-mutations-c.md#w2-c-002) |
| Keep narrowed state knowledge inside a visit or branch | [W1-A-003](raw/wave-1-near-field.md#w1-a-003), [W1-C-003](raw/wave-1-anti-machine.md#w1-c-003) |
| Put entry invariants at the destination | [W2-A-002](raw/wave-2-mutations-a.md#w2-a-002), [W2-B-002](raw/wave-2-mutations-b.md#w2-b-002) |
| Make topology readable apart from implementation | [W1-A-004](raw/wave-1-near-field.md#w1-a-004), [W2-D-005](raw/wave-2-mutations-d.md#w2-d-005) |
| Return next state and effect intent as inspectable data | [W1-A-006](raw/wave-1-near-field.md#w1-a-006), [W1-C-010](raw/wave-1-anti-machine.md#w1-c-010) |
| Tie setup and cleanup to state residency | [W1-A-011](raw/wave-1-near-field.md#w1-a-011), [W2-A-006](raw/wave-2-mutations-a.md#w2-a-006) |
| Stage state, effects, and rollback behind one commit boundary | [W1-C-008](raw/wave-1-anti-machine.md#w1-c-008), [W2-B-005](raw/wave-2-mutations-b.md#w2-b-005) |
| Derive labels from external truth instead of mirroring them | [W1-A-009](raw/wave-1-near-field.md#w1-a-009), [W2-B-004](raw/wave-2-mutations-b.md#w2-b-004) |
| Inspect and delegate a route before spending it | [W2-A-007](raw/wave-2-mutations-a.md#w2-a-007), [W1-B-010](raw/wave-1-alien-mechanisms.md#w1-b-010) |
| Project role-specific facts and legal moves | [W1-B-013](raw/wave-1-alien-mechanisms.md#w1-b-013), [W3-A-005](raw/wave-3-gaps-a.md#w3-a-005) |
| Preserve provenance in append-only facts or orders | [W2-B-006](raw/wave-2-mutations-b.md#w2-b-006), [W2-D-003](raw/wave-2-mutations-d.md#w2-d-003) |
| Represent provisional work separately from final authority | [W2-C-004](raw/wave-2-mutations-c.md#w2-c-004), [W3-D-004](raw/wave-3-gaps-d.md#w3-d-004) |
| Carry cleanup as a coda, inverse, or compensation | [W1-B-006](raw/wave-1-alien-mechanisms.md#w1-b-006), [W2-A-004](raw/wave-2-mutations-a.md#w2-a-004), [W3-D-005](raw/wave-3-gaps-d.md#w3-d-005) |
| Admit actions only across every currently possible state | [W3-A-001](raw/wave-3-gaps-a.md#w3-a-001), [W3-B-005](raw/wave-3-gaps-b.md#w3-b-005) |
| Make crossings proof-carrying rather than sample-assumed | [W3-C-004](raw/wave-3-gaps-c.md#w3-c-004), [W3-A-002](raw/wave-3-gaps-a.md#w3-a-002) |

## Primary-Territory Coverage Ledger

Each stable seed ID appears exactly once in this ledger. Grouping is navigational only.

### CV

[W1-A-001](raw/wave-1-near-field.md#w1-a-001), [W1-C-001](raw/wave-1-anti-machine.md#w1-c-001), [W1-D-001](raw/wave-1-impossible-language.md#w1-d-001), [W2-D-008](raw/wave-2-mutations-d.md#w2-d-008)

### AH

[W1-A-002](raw/wave-1-near-field.md#w1-a-002), [W1-C-002](raw/wave-1-anti-machine.md#w1-c-002), [W1-C-004](raw/wave-1-anti-machine.md#w1-c-004), [W1-C-009](raw/wave-1-anti-machine.md#w1-c-009), [W1-D-002](raw/wave-1-impossible-language.md#w1-d-002), [W2-A-001](raw/wave-2-mutations-a.md#w2-a-001), [W2-C-002](raw/wave-2-mutations-c.md#w2-c-002)

### SK

[W1-A-003](raw/wave-1-near-field.md#w1-a-003), [W1-C-003](raw/wave-1-anti-machine.md#w1-c-003), [W1-D-008](raw/wave-1-impossible-language.md#w1-d-008), [W2-A-002](raw/wave-2-mutations-a.md#w2-a-002), [W2-B-002](raw/wave-2-mutations-b.md#w2-b-002)

### IT

[W1-A-005](raw/wave-1-near-field.md#w1-a-005), [W1-B-009](raw/wave-1-alien-mechanisms.md#w1-b-009), [W1-C-005](raw/wave-1-anti-machine.md#w1-c-005), [W1-C-012](raw/wave-1-anti-machine.md#w1-c-012), [W1-D-004](raw/wave-1-impossible-language.md#w1-d-004), [W1-D-012](raw/wave-1-impossible-language.md#w1-d-012), [W2-A-005](raw/wave-2-mutations-a.md#w2-a-005), [W2-C-007](raw/wave-2-mutations-c.md#w2-c-007)

### GN

[H-001](raw/human-seeds.md#h-001), [H-002](raw/human-seeds.md#h-002), [W1-A-004](raw/wave-1-near-field.md#w1-a-004), [W1-A-010](raw/wave-1-near-field.md#w1-a-010), [W1-D-005](raw/wave-1-impossible-language.md#w1-d-005), [W2-A-006](raw/wave-2-mutations-a.md#w2-a-006), [W2-D-005](raw/wave-2-mutations-d.md#w2-d-005)

### ER

[W1-A-006](raw/wave-1-near-field.md#w1-a-006), [W1-A-011](raw/wave-1-near-field.md#w1-a-011), [W1-A-012](raw/wave-1-near-field.md#w1-a-012), [W1-C-010](raw/wave-1-anti-machine.md#w1-c-010), [W1-C-011](raw/wave-1-anti-machine.md#w1-c-011), [W1-D-003](raw/wave-1-impossible-language.md#w1-d-003), [W2-A-003](raw/wave-2-mutations-a.md#w2-a-003), [W2-C-008](raw/wave-2-mutations-c.md#w2-c-008), [W2-D-001](raw/wave-2-mutations-d.md#w2-d-001), [W2-D-004](raw/wave-2-mutations-d.md#w2-d-004)

### FC

[W1-A-009](raw/wave-1-near-field.md#w1-a-009), [W1-B-004](raw/wave-1-alien-mechanisms.md#w1-b-004), [W1-D-006](raw/wave-1-impossible-language.md#w1-d-006), [W1-D-007](raw/wave-1-impossible-language.md#w1-d-007), [W2-B-001](raw/wave-2-mutations-b.md#w2-b-001), [W2-B-004](raw/wave-2-mutations-b.md#w2-b-004), [W2-D-002](raw/wave-2-mutations-d.md#w2-d-002), [W2-D-003](raw/wave-2-mutations-d.md#w2-d-003)

### TL

[W1-A-008](raw/wave-1-near-field.md#w1-a-008), [W1-B-001](raw/wave-1-alien-mechanisms.md#w1-b-001), [W1-B-008](raw/wave-1-alien-mechanisms.md#w1-b-008), [W1-B-012](raw/wave-1-alien-mechanisms.md#w1-b-012), [W1-C-008](raw/wave-1-anti-machine.md#w1-c-008), [W2-A-008](raw/wave-2-mutations-a.md#w2-a-008), [W2-B-003](raw/wave-2-mutations-b.md#w2-b-003), [W2-B-005](raw/wave-2-mutations-b.md#w2-b-005), [W2-B-006](raw/wave-2-mutations-b.md#w2-b-006), [W2-C-004](raw/wave-2-mutations-c.md#w2-c-004), [W2-D-006](raw/wave-2-mutations-d.md#w2-d-006)

### CP

[W1-A-007](raw/wave-1-near-field.md#w1-a-007), [W1-B-006](raw/wave-1-alien-mechanisms.md#w1-b-006), [W1-C-006](raw/wave-1-anti-machine.md#w1-c-006), [W1-C-007](raw/wave-1-anti-machine.md#w1-c-007), [W1-C-013](raw/wave-1-anti-machine.md#w1-c-013), [W1-D-009](raw/wave-1-impossible-language.md#w1-d-009), [W1-D-010](raw/wave-1-impossible-language.md#w1-d-010), [W1-D-011](raw/wave-1-impossible-language.md#w1-d-011), [W2-B-008](raw/wave-2-mutations-b.md#w2-b-008), [W2-C-005](raw/wave-2-mutations-c.md#w2-c-005)

### GP

[W1-A-013](raw/wave-1-near-field.md#w1-a-013), [W1-B-010](raw/wave-1-alien-mechanisms.md#w1-b-010), [W1-D-013](raw/wave-1-impossible-language.md#w1-d-013), [W2-A-004](raw/wave-2-mutations-a.md#w2-a-004), [W2-A-007](raw/wave-2-mutations-a.md#w2-a-007), [W2-C-003](raw/wave-2-mutations-c.md#w2-c-003), [W2-D-007](raw/wave-2-mutations-d.md#w2-d-007)

### MO

[W1-B-002](raw/wave-1-alien-mechanisms.md#w1-b-002), [W1-B-003](raw/wave-1-alien-mechanisms.md#w1-b-003), [W1-B-005](raw/wave-1-alien-mechanisms.md#w1-b-005), [W1-B-007](raw/wave-1-alien-mechanisms.md#w1-b-007), [W1-B-011](raw/wave-1-alien-mechanisms.md#w1-b-011), [W1-B-013](raw/wave-1-alien-mechanisms.md#w1-b-013), [W2-C-006](raw/wave-2-mutations-c.md#w2-c-006), [W3-B-001](raw/wave-3-gaps-b.md#w3-b-001), [W3-B-002](raw/wave-3-gaps-b.md#w3-b-002), [W3-B-003](raw/wave-3-gaps-b.md#w3-b-003), [W3-B-004](raw/wave-3-gaps-b.md#w3-b-004), [W3-B-006](raw/wave-3-gaps-b.md#w3-b-006)

### EU

[W2-C-001](raw/wave-2-mutations-c.md#w2-c-001), [W3-A-001](raw/wave-3-gaps-a.md#w3-a-001), [W3-A-002](raw/wave-3-gaps-a.md#w3-a-002), [W3-A-003](raw/wave-3-gaps-a.md#w3-a-003), [W3-A-004](raw/wave-3-gaps-a.md#w3-a-004), [W3-A-005](raw/wave-3-gaps-a.md#w3-a-005), [W3-A-006](raw/wave-3-gaps-a.md#w3-a-006), [W3-B-005](raw/wave-3-gaps-b.md#w3-b-005)

### CD

[W3-C-001](raw/wave-3-gaps-c.md#w3-c-001), [W3-C-002](raw/wave-3-gaps-c.md#w3-c-002), [W3-C-003](raw/wave-3-gaps-c.md#w3-c-003), [W3-C-004](raw/wave-3-gaps-c.md#w3-c-004), [W3-C-005](raw/wave-3-gaps-c.md#w3-c-005), [W3-C-006](raw/wave-3-gaps-c.md#w3-c-006)

### RV

[W2-B-007](raw/wave-2-mutations-b.md#w2-b-007), [W3-D-001](raw/wave-3-gaps-d.md#w3-d-001), [W3-D-002](raw/wave-3-gaps-d.md#w3-d-002), [W3-D-003](raw/wave-3-gaps-d.md#w3-d-003), [W3-D-004](raw/wave-3-gaps-d.md#w3-d-004), [W3-D-005](raw/wave-3-gaps-d.md#w3-d-005), [W3-D-006](raw/wave-3-gaps-d.md#w3-d-006)

## Canonical Order

Use [raw-seeds.md](raw-seeds.md) for the canonical append-only seed order.
