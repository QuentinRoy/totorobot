# Wave 3 - Epistemic uncertainty gap

## W3-A-001
**Name:** Possibility-frontier machine
**Speculative:** Yes
**Sketch:**
```ts
upload: Possible<Queued | Sending>
upload.forAll.cancel()                 // legal from every possible state
upload.only(proof<Sending>()).pause() // unavailable without refinement
```
**Mechanism:** The machine stores a nonempty frontier of possible worlds, and a command is admitted only when its transition relation is defined for every member of that frontier.
**Unlocks:** Shared safe behavior can run under honest uncertainty while narrower behavior remains gated by proof.
**Unknown:** Can TypeScript compute useful result frontiers without exponential union growth?

## W3-A-002
**Name:** Earned-state seals
**Speculative:** Yes
**Sketch:**
```ts
const report = await latch.inspect()
const closed: Seal<Closed, typeof latch.epoch> = verifier.certify(report)
latch.lock(closed) // consumes the seal and advances the evidence epoch
```
**Mechanism:** State-specific knowledge lives in an evidence-backed affine seal rather than the machine, and relevant effects consume or revoke that seal.
**Unlocks:** Typestate can represent what a caller has actually established and prevent stale observations from silently becoming authority.
**Unknown:** Can asynchronous aliases be stopped from reusing consumed seals without affine types?

## W3-A-003
**Name:** Paraconsistent witness board
**Sketch:**
```ts
board.assert(camera, at(t1), Open)
board.assert(dom, at(t2), Not<Open>)
board.ask(Open) // Both<{ camera, t1 }, { dom, t2 }>
board.authorize(close, policy.supports(Open).despite(Not<Open>))
```
**Mechanism:** The source of truth is a timestamped provenance graph interpreted with paraconsistent logic, so a proposition and its negation can both be supported without authorizing unrelated claims.
**Unlocks:** Late sensors, split-brain observers, and domain-specific fusion rules become explicit authorization inputs instead of corrupting one state slot.
**Unknown:** Which fusion-policy language remains auditable when claims recursively depend on other claims?

## W3-A-004
**Name:** Partitioning probes
**Speculative:** Yes
**Sketch:**
```ts
using split = await session.probe(isAuthenticated, { timeout: 200 })
await split.cover({
  authenticated: knowledge => dashboard.enter(knowledge),
  anonymous: knowledge => login.enter(knowledge),
  inconclusive: knowledge => knowledge.probe(strongerSensor),
})
```
**Mechanism:** The machine is a hidden plant paired with an information partition, and probes transition only the partition while exposing leased effects that must be exhausted or disposed.
**Unlocks:** Information gathering becomes a typed action with exhaustive continuations, cleanup, and time semantics rather than an ad hoc read before a conventional transition.
**Unknown:** How should a delayed probe result rejoin a partition that newer control effects have already changed?

## W3-A-005
**Name:** Principal-indexed knowledge
**Speculative:** Yes
**Sketch:**
```ts
const seen: K<Camera, Open> = await camera.observe(door)
const relayed: K<Controller, Open> = attest(seen, controller)
door.close(relayed)
door.lock(await commonKnowledge([Controller, Interlock], Closed))
```
**Mechanism:** State knowledge belongs to named principals and moves only through attestations, with operations requiring local, mutual, quorum, or common knowledge instead of a global state fact.
**Unlocks:** Tabs, workers, devices, and servers can coordinate without pretending that any participant owns a uniquely knowable current state.
**Unknown:** Can common-knowledge requirements ever complete under lossy asynchronous delivery?

## W3-A-006
**Name:** Postcondition strategy request
**Speculative:** Yes
**Sketch:**
```ts
await player.achieve(Paused, {
  Playing: p => p.pause(),
  Buffering: p => p.await(Buffered).then(pause),
  Paused: p => p.stay(),
  Ended: p => p.rewind().then(pause),
}).within(2_000)
```
**Mechanism:** A transition request names a postcondition, and a total contingent strategy supplies different effect paths that all establish it without first selecting one current-state hypothesis.
**Unlocks:** Callers can express robust intent across uncertainty while generated proof obligations expose missing branches, cleanup, and deadline failures.
**Unknown:** What verifies branch postconditions when effects are opaque application code?
