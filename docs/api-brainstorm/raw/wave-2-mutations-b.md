# Wave 2 - Mutations B

## W2-B-001
**Name:** Crossing Monitor
**Parents:** H-002, W1-A-009
**Speculative:** Yes
**Sketch:**
```ts
const interaction = watch(facts, classify({ idle, pressed, dragging }))`
  idle -> pressed ${onCross(startPress)}
  pressed -> dragging ${onCross(startDrag)}
`

facts.apply(pointerMoved(point))
```
**Mechanism:** The script declares observable crossings between classifications, but external facts remain the only stored truth and interpolations run when recomputation crosses an edge.
**Unlocks:** Browser signals can update shared facts without dispatching machine events while topology still exposes legal state changes and edge-scoped reactions.
**Unknown:** How should one fact update report overlapping, skipped, or cyclic crossings?

## W2-B-002
**Name:** Destination-Owned Entry
**Parents:** W1-C-005
**Sketch:**
```ts
const dragging = Dragging.enter.fromPressed(pressed, point)
const idle = Idle.enter.fromDragging(dragging, "cancel")
```
**Mechanism:** State values are behaviorless snapshots, and each destination type owns named constructors for the source states allowed to enter it.
**Unlocks:** Target construction requirements become the discovery surface, making incomplete destination data impossible to hide behind source-side commands.
**Unknown:** Can destination-owned entry remain local when source and target modules must not import each other?

## W2-B-003
**Name:** Ruling Stream
**Parents:** W1-C-006, W1-B-008
**Speculative:** Yes
**Sketch:**
```ts
const filed = await tribunal.open(closed).next({ petition: "reopen", evidence })
const served = await filed.next({ serve: otherParty })
const ruled = await served.next()
const opened = ruled.order.execute()
```
**Mechanism:** A proceeding is an async continuation whose legal replies change by phase, while only an authority-produced ruling yield can replace the separately held operative state.
**Unlocks:** Hearings, deadlines, cancellation, and backpressure gain protocol phases without making a pending request masquerade as a successful transition.
**Unknown:** What typed view should several concurrent proceedings expose over one operative state?

## W2-B-004
**Name:** Concurrent Classifications
**Parents:** W1-A-009
**Sketch:**
```ts
const labels = derive({
  hovered: f => f.pointer.inside,
  pressed: f => f.pointer.buttons > 0,
  blocked: f => f.modal.open,
})

labels.changes(facts).on({ enter, leave })
```
**Mechanism:** The exclusive state union and transition graph disappear, leaving a changing set of independently derived labels whose enter and leave boundaries drive reactions.
**Unlocks:** Orthogonal interaction conditions compose without product-state explosion, and each label naturally scopes effects to the duration of its truth.
**Unknown:** How are forbidden label combinations and atomic multi-label changes declared?

## W2-B-005
**Name:** Certified Edge Transaction
**Parents:** H-001, W1-B-012
**Sketch:**
```ts
const menu = define({
  "open: closed -> open": certify({
    voters: [trigger, focusManager, modalLayer],
    quorum: { approvals: 2, vetoes: 0 },
    stage: prepareOpen,
  }),
})

const proposal = menu.open()
const opened = await proposal.commit()
```
**Mechanism:** Invoking a parseable edge creates a tentative transaction that stages target data and effects, and only a quorum certificate atomically commits both.
**Unlocks:** Scan-readable topology can coordinate cross-component consent without leaking provisional state or running effects before acceptance.
**Unknown:** What invalidates or rebases a proposal when its source state advances before certification?

## W2-B-006
**Name:** Operative Order Fold
**Parents:** W1-B-008
**Sketch:**
```ts
const casefile = record(closed)
  .append(order.grant("reopen"))
  .append(order.stay("reopen", until(deadline)))
  .append(order.liftStay())

const current = casefile.materialize()
```
**Mechanism:** Operative state is a fold over an append-only chain of typed orders, stays, and reversals rather than a value directly mutated when a ruling arrives.
**Unlocks:** Appeals, delayed effect, audit, and historical reconstruction become ordinary additions to the source of truth instead of bespoke rollback paths.
**Unknown:** How are irreversible browser effects reconciled when a later order changes the historical fold's present result?

## W2-B-007
**Name:** Counterfactual Properties
**Parents:** W1-C-005, W1-A-009
**Speculative:** Yes
**Sketch:**
```ts
const release = interaction.read(facts).pressed.release
release.preview() // { patch, classification: "activated" }
const activated = release.commit(facts.version)
```
**Mechanism:** A state-specific property returns a typed counterfactual fact patch whose predicted destination is derived by classification, and only an explicit versioned commit changes reality.
**Unlocks:** Property completion reveals legal paths while inspection, preview, and composition remain non-effectful and stale decisions can be rejected.
**Unknown:** Can property types expose a precise destination when classification depends on runtime geometry?

## W2-B-008
**Name:** Compiled Continuation Graph
**Parents:** H-002, W1-C-006
**Speculative:** Yes
**Sketch:**
```ts
const begin = protocol<State, Event>`
  pointerDown: idle -> pressed ${pressedScope}
  pointerUp: pressed -> activated ${activationScope}
`

await using pressed = await begin.idle.next(pointerDown)
const activated = await pressed.next(pointerUp)
```
**Mechanism:** The edge script constructs one-shot async continuations and then disappears, so the held continuation owns current data while its interpolation owns effects until consumption or disposal.
**Unlocks:** Typestate follows linear session ownership, with cancellation, timers, listeners, and cleanup sharing the continuation's lifetime boundary.
**Unknown:** How can ordinary TypeScript prevent aliases from consuming the same continuation twice?
