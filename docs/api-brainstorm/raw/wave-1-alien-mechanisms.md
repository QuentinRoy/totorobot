# Wave 1 - Alien-mechanism miner

## W1-B-001
**Name:** Executory State
**Sketch:**
```ts
const deal = covenant({
  buyer: owes("pay").then("receive"),
  seller: owes("ship").after("pay"),
})

const paid = deal.perform(buyer, "pay", receipt)
paid.due(seller, "ship").by(tomorrow)
paid.default(seller).remedy(buyer, "refund")
```
**Mechanism:** The source of truth is a bilateral ledger of outstanding obligations, with performances discharging duties and failures activating role-specific remedies.
**Unlocks:** Multi-party phases, deadlines, compensation, and permissions become consequences of who owes what rather than branches in a central reducer.
**Unknown:** Can partial performance and nested remedies remain legible?

## W1-B-002
**Name:** Rendezvous Choreography
**Speculative:** Yes
**Sketch:**
```ts
const duet = choreograph`
  pointer: press -> [grip] -> move*
  card:    arm   -> [grip] -> follow*
`

const pointer = duet.role("pointer")
const atGrip = pointer.press(point)
const moving = await atGrip.rendezvous("grip")
```
**Mechanism:** Each participant owns a role-local cursor, and a transition occurs only when the required cursors rendezvous at the same named beat.
**Unlocks:** Simultaneous gestures, cancellation propagation, and role-specific typestates become expressible without one omniscient event union.
**Unknown:** What owns recovery when one performer never reaches a rendezvous?

## W1-B-003
**Name:** Linear Game Pieces
**Speculative:** Yes
**Sketch:**
```ts
const dragging = hand
  .spend(idleToken, pointerToken(pointerId))
  .gain(dragToken({ card, pointerId }))

const accepted = dragging.transfer(dragToken, dropZone)
```
**Mechanism:** Machine state is the multiset and ownership of linear tokens, while moves atomically consume, mint, or transfer those tokens.
**Unlocks:** Exclusivity, authorization, contention, and one-shot cleanup become type-visible as possession instead of boolean guards.
**Unknown:** How can ordinary TypeScript prevent duplication through token aliases?

## W1-B-004
**Name:** Live Permissive Circuit
**Speculative:** Yes
**Sketch:**
```ts
panel.wire(
  series(guard.closed, pressure.safe, not(motor.running)),
  motor.startCoil,
)
```
**Mechanism:** A requested action exists only as an energized circuit through live permissive contacts, so any opened interlock withdraws the action without dispatching a reverse event.
**Unlocks:** Safety invariants and cleanup on lost prerequisites become structural wiring, including races that snapshot guards cannot safely express.
**Unknown:** How should a typed API represent contacts that invalidate capabilities continuously?

## W1-B-005
**Name:** Actuated Phase Clock
**Sketch:**
```ts
const call = junction.request(pointerWantsDrag)
call.cancelWhen(pointerReleased)

for await (const grant of junction.run(raf)) {
  grant.openFor(card).atLeast(120)
  await grant.clearance(80)
}
```
**Mechanism:** Actors register cancellable demand calls, while a phase clock alone grants compatible movements and inserts mandatory clearance intervals.
**Unlocks:** Debounce, dwell time, fairness, and impossible simultaneous modes become scheduler semantics rather than timers scattered across handlers.
**Unknown:** Which fairness policy remains predictable under bursty input?

## W1-B-006
**Name:** Motif and Coda
**Sketch:**
```ts
const drag = motif`
  ${down}    !capture
  repeat(${move} !translate)
  choose(${up} !commit, ${escape} !restore)
  coda(!releaseCapture)
`

perform(drag, input).onCue(runEffect)
```
**Mechanism:** The machine is an executable score whose cursor advances through motifs, repeats, rests, and codas while emitting effect cues for a separate orchestra.
**Unlocks:** Temporal structure, reusable sub-interactions, guaranteed finales, and effect ordering become readable notation rather than nested transition tables.
**Unknown:** How should overlapping scores compete for the same input voice?

## W1-B-007
**Name:** Certified Traveler
**Sketch:**
```ts
const placed = pickAndPlace.accept(traveler(blankBoard)).run()
const inspected = opticalGate.inspect(placed)

match(inspected, {
  pass: board => reflow.accept(board),
  rework: board => repair.accept(board),
  scrap: board => bin.accept(board),
})
```
**Mechanism:** State rides with a typed traveler attached to the workpiece, and independent stations advertise which certifications they accept and which certified outputs or reject routes they produce.
**Unlocks:** Pipelines can grow by adding stations, while quality gates expose pass, rework, and scrap continuations without editing a global graph.
**Unknown:** How are competing stations selected without recreating a central router?

## W1-B-008
**Name:** Petition, Order, Appeal
**Sketch:**
```ts
const pending = clerk
  .file(closed.petition("reopen", evidence))
  .serve(otherParty)

const order = await tribunal.rule(pending)
match(order, {
  granted: ruling => ruling.execute(),
  denied: ruling => ruling.appeal(before(deadline)),
})
```
**Mechanism:** Callers cannot transition state directly; they file typed petitions into a proceeding, and only an authority's order changes operative state while creating appeal rights and deadlines.
**Unlocks:** Asynchronous validation, contested requests, audit history, timeout effects, and reversible decisions gain explicit homes without pretending every request succeeds.
**Unknown:** What should callers know while several petitions are pending?

## W1-B-009
**Name:** Receptor Field
**Speculative:** Yes
**Sketch:**
```ts
const pressR = card.express(receptor(pointerDown))
const bound = field.release(pointerDown(point)).bind(pressR)
const active = bound.transduce(startDrag)

active.receptor(pointerDown).refractoryUntil(pointerUp)
```
**Mechanism:** Signals enter a shared field and bind only to currently expressed receptors, whose transduction changes local cells and may desensitize those receptors for a refractory period.
**Unlocks:** Dynamic event interest, storm suppression, local adaptation, and topology emerging from component state become intrinsic instead of subscription bookkeeping.
**Unknown:** Is binding deterministic when one signal matches several receptors?

## W1-B-010
**Name:** Situated Atlas
**Sketch:**
```ts
let here = atlas.locate(ui)
const exits = here.routes({ pointer, hit: card, viewport })
const route = exits.named("begin drag")

here = await route.travel()
```
**Mechanism:** The caller owns a typed place value, and the atlas reveals only routes visible from that place under current terrain, with each route carrying its destination type and travel effects.
**Unlocks:** State-specific API discovery and contextual targets fall out of navigation, while hidden or blocked transitions never enter a global event vocabulary.
**Unknown:** Can route discovery stay finite and exhaustive when terrain is live?

## W1-B-011
**Name:** Stigmergic Surface
**Speculative:** Yes
**Sketch:**
```ts
pointer.deposit(surface, dragIntent({ card, ttl: oneFrame }))
card.sense(surface, dragIntent).deposit(armed({ card }))
dropZone.sense(surface, armed).deposit(accepting({ card }))
```
**Mechanism:** Independent actors coordinate only by depositing, sensing, and erasing typed traces in a shared environment, with global interaction state emerging from trace patterns.
**Unlocks:** Loose component coordination, ephemeral intent, priority gradients, and automatic expiry become possible without direct references or a central machine owner.
**Unknown:** How can emergent trace histories remain debuggable and deterministic?

## W1-B-012
**Name:** Certified Quorum
**Sketch:**
```ts
const proposal = current.propose(openMenu)
proposal.vote(trigger.approve())
proposal.vote(focusManager.approve())
proposal.vote(modalLayer.veto())

const opened = proposal.commit(quorum({ approvals: 2, vetoes: 0 }))
```
**Mechanism:** A transition begins as a proposal whose destination remains tentative until a declared quorum of role-weighted approvals and veto rules yields a commit certificate.
**Unlocks:** Cross-component consent, race resolution, provisional UI, and atomic effects become explicit without hard-coding one coordinator's permission checks.
**Unknown:** Which operations are legal against a tentative destination?

## W1-B-013
**Name:** Referee Projections
**Sketch:**
```ts
const scout = table.seat("scout", ana)
const view = await scout.view()

// View<Scout, Searching> contains only scout-visible facts and moves.
const nextView = await view.play(view.moves.inspect(card))
await scout.handoff(nextPlayer)
```
**Mechanism:** A referee holds the canonical position and projects a different typed view and legal move set to each role, including secrets and asymmetric authority.
**Unlocks:** Hidden information, state-specific permissions, spectator views, and role handoff can be truthful without exposing or duplicating the full machine state.
**Unknown:** How should types relate views that intentionally disagree about the same position?
