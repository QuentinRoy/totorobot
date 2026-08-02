# Wave 3 - Reversible time gap

## W3-D-001
**Name:** Optic-pulled machine
**Speculative:** Yes
**Sketch:**
```ts
const open = reversible(
  at("#door", doorPrism),
  iso(closed => opened, opened => closed),
  dual(startMotor, stopMotor),
);
open.forward(model);
open.backward(model);
```
**Mechanism:** Machine state remains in an external model, while a prism-selected partial isomorphism supplies the legal forward move, backward move, and dual effect at one focus.
**Unlocks:** Nested browser state can move backward or sideways without cloning the model into a conventional FSM history.
**Unknown:** Can effect duals remain valid when another actor mutates the focused resource?

## W3-D-002
**Name:** Certified patch history
**Speculative:** Yes
**Sketch:**
```ts
type Move<A, B> = {
  patch: Patch<A, B>;
  inverse: Patch<B, A>;
  roundTrip: Proof<Equal<Apply<A, patch, inverse>, A>>;
};

const alternate = history.apply(oldNode, changeAddress).fork();
```
**Mechanism:** The source of truth is a DAG of immutable roots connected by proof-carrying patches, and accepting a transition means verifying that its supplied inverse round-trips the affected region.
**Unlocks:** Any historical node can fork safely, while rollback and cleanup come from certified inverse patches rather than handwritten handlers.
**Unknown:** How much proof can TypeScript infer before compiler or code-generation support becomes necessary?

## W3-D-003
**Name:** Capability cursors
**Sketch:**
```ts
const past = timeline.checkout(orderPaid, canReadPast);
const alternate = past.fork(canFork);
await alternate.move(changeAddress(nextAddress));
await live.adopt(alternate, canAdopt);
```
**Mechanism:** The machine is a persistent history graph, and each actor owns a typed temporal cursor whose capabilities determine whether it may inspect, fork, mutate, adopt, or abandon a branch.
**Unlocks:** UI controls can operate simultaneously on actual, past, and counterfactual states without pretending they share one current node.
**Unknown:** What should branch adoption mean when both branches contain already-observed effects?

## W3-D-004
**Name:** Operational counterfactuals
**Speculative:** Yes
**Sketch:**
```ts
const possible = machine.from(actual).suppose(applyCoupon("MAYBE"));
possible.render(summary);
await possible.perform(reserveStock.dual());
await possible.realizeInto(actual); // or possible.discard()
```
**Mechanism:** A transition request creates an executable counterfactual world whose reads use an overlay and whose effects accumulate paired do-and-undo obligations until the world is realized or discarded.
**Unlocks:** Validation, rendering, and resource acquisition can run against a possible future before choosing whether that branch becomes actual.
**Unknown:** Which external effects can honestly supply an inverse under failure and concurrency?

## W3-D-005
**Name:** Retractable interpretation
**Sketch:**
```ts
const paid = facts.assert({ at: t1, order, kind: "paid" });
facts.assert({ at: t0, order, kind: "card-stolen" });
facts.retract(paid);

for (const revision of machine.reinterpret()) revision.compensate();
```
**Mechanism:** The source of truth is a provenance graph of retractable facts, so state is a query result and retroactive transitions invalidate derivations while emitting inverse deltas for previously materialized consequences.
**Unlocks:** Late evidence can rewrite past typestate and drive targeted compensation without erasing the audit trail.
**Unknown:** How can consumers hold truthful typestate while reinterpretation is still propagating?

## W3-D-006
**Name:** Invertibility topology
**Speculative:** Yes
**Sketch:**
```ts
const machine = groupoid([rotate, swap, refocus]);
const path = machine.at(view).then(rotate).then(swap);
const cleanup = path.inverse();
const equivalentViews = machine.component(view);
```
**Mechanism:** The machine is a generated groupoid rather than a state table, with states discovered by composing invertible generators and irreversible operations represented only as explicit quotient boundaries.
**Unlocks:** Reachability, branch equivalence, loop detection, and cleanup follow from path composition and inversion instead of separate FSM features.
**Unknown:** How can a finite API expose typestate for an orbit whose states are discovered dynamically?
