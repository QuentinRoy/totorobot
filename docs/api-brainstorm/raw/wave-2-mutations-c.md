# Wave 2 - Mutations C

## W2-C-001
**Name:** Ephemeral Verdicts
**Parents:** W1-B-008, W1-D-006, W1-A-002
**Speculative:** Yes
**Sketch:**
```ts
const petition = ask("mayDrag", target)
const proof = await tribunal.observe(petition)
await proof.drag() // valid only for the observed epoch
```
**Mechanism:** A petition asks an authority to prove a world predicate, and a granted order is an epoch-bound capability rather than a command that changes state.
**Unlocks:** External changes can revoke authority automatically while asynchronous adjudication, audit, and stale-proof rejection remain explicit.
**Unknown:** Can browser observations define a defensible instant at which the proof was true?

## W2-C-002
**Name:** Commit Tickets
**Parents:** W1-A-008, W1-C-002
**Sketch:**
```ts
const idle = store.ticket({ pointer: "idle" })
const pressed = await idle.commit(pointerDown(event))
// idle now fails its revision precondition
```
**Mechanism:** The application store issues state-specific revision tickets whose methods atomically rewrite facts, with a successful commit invalidating the old ticket and minting the replacement.
**Unlocks:** Truthful state APIs work across concurrent callers without a live machine object or alias-tracking type system.
**Unknown:** How narrowly can tickets cover store facts without allowing overlapping tickets to violate invariants?

## W2-C-003
**Name:** Desired-State Planner
**Parents:** W1-D-006
**Speculative:** Yes
**Sketch:**
```text
achieve MenuOpen(menu)
  where menu.matches(":popover-open") && focus.within(menu)
```
**Mechanism:** Predicate states become requested postconditions, and the machine is an effect planner that chooses browser operations until the requested predicate is observed.
**Unlocks:** Callers state intent while focus, DOM, and media-query mechanics, retries, and compensating cleanup stay behind the planner.
**Unknown:** What makes one valid effect plan preferable or safe when several satisfy the same predicate?

## W2-C-004
**Name:** Provisional Sovereignty
**Parents:** W1-B-008
**Sketch:**
```ts
const provisional = caseFile.reopen(evidence)
await provisional.use({ reversibleOnly: true })
const final = await provisional.ruling
```
**Mechanism:** Filing a petition changes operative state immediately to a typed provisional variant that the later order either seals or rolls back.
**Unlocks:** Latency-sensitive interaction can proceed while provisional APIs fence irreversible effects and the deadline owns automatic rollback.
**Unknown:** Which effects can be classified as safely reversible before the authority rules?

## W2-C-005
**Name:** Continuation Topology
**Parents:** W1-A-005
**Sketch:**
```ts
pressed.move(event, {
  stayed: next => loop(next),
  dragged: next => drag(next),
})
```
**Mechanism:** Handlers do not return next states; callers supply typed continuations for every target they are willing to receive, so the consumption site defines the reachable graph.
**Unlocks:** Different consumers can expose different subgraphs while every actual transition is handled exhaustively at its call site.
**Unknown:** Can recursive continuation trees remain readable for event loops that run indefinitely?

## W2-C-006
**Name:** Custody Auction
**Parents:** W1-B-007, W1-B-008, W1-A-002
**Speculative:** Yes
**Sketch:**
```ts
const bids = network.tender(certified(board))
const award = await allocator.rule(bids)
const next = await award.lease.transfer()
```
**Mechanism:** Compatible stations petition for custody of a traveler, and an allocator's epoch-bound award selects the next station while expiring every losing or stale claim.
**Unlocks:** Routing, capacity, backpressure, deadlines, and exclusive workpiece ownership become explicit without a fixed central graph.
**Unknown:** Can replay reproduce an allocation when station availability and bids are time-dependent?

## W2-C-007
**Name:** Evidence-Only Topology
**Parents:** W1-D-004
**Speculative:** Yes
**Sketch:**
```text
ledger += { before, input, after, effects }
api = projectCapabilities(ledger, session)
```
**Mechanism:** The machine has no prospective topology because only executed transitions appended to a ledger count as edges, and current state APIs are projected from that runtime evidence.
**Unlocks:** Unknown host behavior, plug-ins, and browser quirks can extend the machine without recompilation while retaining replayable provenance.
**Unknown:** How can the first traversal of an unseen edge be constrained before evidence exists?

## W2-C-008
**Name:** Lease-Bundle State
**Parents:** W1-A-008, W1-C-002
**Speculative:** Yes
**Sketch:**
```ts
const pressed = await effects.swap(idle, {
  add: [capture(pointer), timer(longPress)],
  remove: [],
})
const idleAgain = await effects.release(pressed)
```
**Mechanism:** Operative state is the transactionally committed bundle of listener, timer, and resource leases, and transitions atomically replace bundles instead of updating a separate state label.
**Unlocks:** State truth, effect setup, timeout ownership, and cleanup coincide, making leaked or impossible effect combinations observable as invalid states.
**Unknown:** Can browser resources be staged closely enough to approximate atomic bundle replacement?
