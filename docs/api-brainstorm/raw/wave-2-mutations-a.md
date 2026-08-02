# Wave 2 - Mutations A

## W2-A-001
**Name:** Spend the Snapshot
**Parents:** W1-C-004
**Speculative:** Yes
**Sketch:**
```ts
const state = controller.take()
if (state.kind === "armed") controller.put(state.fire())
```
**Mechanism:** Observation itself is a linear lease that must be consumed into its successor, eliminating separate permits, revision checks, and concurrent ownership.
**Unlocks:** Typestate narrowing and exclusive mutation authority become one value that can be delegated through UI layers.
**Unknown:** How can the runtime recover when a holder abandons or indefinitely awaits with the lease?

## W2-A-002
**Name:** Target-Owned Entrances
**Parents:** H-001
**Sketch:**
```ts
target("activated", {
  "activate <- idle": ({ source, event }) => activated(source, event),
  "activate <- stopped": ({ event }) => activatedFromStop(event),
})
```
**Mechanism:** Each target state owns constructors for its admissible source-and-event pairs, replacing the central edge table with inbound state knowledge.
**Unlocks:** Every route into a target must establish that target's invariants in one place, while outgoing views can be derived separately.
**Unknown:** Can global reachability remain inspectable without recreating a central graph index?

## W2-A-003
**Name:** Covenanted Residency
**Parents:** W1-B-001, W1-A-011
**Speculative:** Yes
**Sketch:**
```ts
reside("dragging", {
  machineOwes: releasePointerCapture,
  environmentOwes: oneOf(pointerUp, pointerCancel),
  remedy: restoreOrigin,
})
```
**Mechanism:** Entering a state opens a bilateral ledger of machine and environment obligations, and exit either discharges them or activates their remedies.
**Unlocks:** Listeners, deadlines, cleanup, cancellation, and compensation share one explicit lifecycle rather than separate effect conventions.
**Unknown:** What constitutes enforceable default when the environment simply stops producing input?

## W2-A-004
**Name:** Goal-Composed Coda
**Parents:** W1-A-013, W1-B-006
**Speculative:** Yes
**Sketch:**
```ts
const performance = await interaction.compose("idle", observation)
await performance.play({ onCue: runEffect })
```
**Mechanism:** A desired-state request is compiled into an executable score whose motifs realize the chosen route and whose coda runs on completion, cancellation, or replanning.
**Unlocks:** Callers stay goal-oriented while temporal ordering, intermediate states, and guaranteed cleanup remain inspectable before execution.
**Unknown:** Can replanning splice scores without duplicating or skipping a coda?

## W2-A-005
**Name:** Live Continuation Topology
**Parents:** W1-D-004
**Speculative:** Yes
**Sketch:**
```ts
const dragging = (data: DragData) => ({
  move: (event: Move) => dragging(translate(data, event)),
  up: (event: Up) => idle(commit(data, event)),
})
```
**Mechanism:** Topology exists only as event methods on the current state value, with each returned continuation revealing its target at runtime instead of a compiler assembling a global graph.
**Unlocks:** Individual state instances can expose only transitions that are presently possible, making runtime-dependent typestates directly consumable.
**Unknown:** How can tooling prove graph-wide exhaustiveness without executing every state constructor?

## W2-A-006
**Name:** Residency-Interpolated Script
**Parents:** H-002, W1-A-011
**Sketch:**
```ts
define`
  state idle
  state dragging ${{ while: installDragScope }}
  pointerDown: idle -> dragging
  pointerUp: dragging -> idle
`
```
**Mechanism:** Interpolations attach behavior only to state residency declarations, while transition lines define pure topology and cannot own effects.
**Unlocks:** The graph remains compact notation and all listeners, timers, and cleanup for a state become one automatically bounded reaction.
**Unknown:** Should re-entering the same state replace its residency or preserve it?

## W2-A-007
**Name:** Tendered Route Capability
**Parents:** W1-C-004, W1-A-013
**Sketch:**
```ts
const route = await controller.prepare(view, { become: "idle" })
inspect(route.steps)
await route.spend()
```
**Mechanism:** Planning a desired state returns a one-shot route capability bound to the observed revision, and no transition or effect begins until its holder spends it.
**Unlocks:** Route selection can be inspected, delegated, or declined independently from execution while retaining stale-request protection.
**Unknown:** Which party owns recovery when external guard conditions invalidate a prepared route?

## W2-A-008
**Name:** Ledger Edge Lens
**Parents:** W1-B-001, H-001
**Speculative:** Yes
**Sketch:**
```ts
const edges = deal.asEdges({
  awaitingPayment: owes(buyer, "pay"),
  awaitingShipment: owes(seller, "ship"),
})
```
**Mechanism:** The obligations ledger remains authoritative while a transition-keyed edge table is generated as a consumer view whose state labels are queries over outstanding duties.
**Unlocks:** Debuggers and UI code gain scan-readable edges without forcing multi-party performance, default, and remedy into a central reducer.
**Unknown:** Can overlapping duty queries assign one ledger position to multiple truthful typestates without ambiguity?
