# Wave 3 - Distributed timelines gap

## W3-B-001
**Name:** Frontier machine
**Sketch:**
```ts
const tab = timeline.fork("tab-a");
tab.move(addItem("tea"), { after: tab.frontier });

const view = timeline.join(tab.export(), phone.export()).view();
// At<Frontier, Settled<Cart> | Fork<ReadonlyArray<Cart>>>
```
**Mechanism:** The source of truth is a causally indexed move DAG whose merge is set union, while evaluation quotients commuting schedules and exposes incompatible maximal heads as a `Fork` value.
**Unlocks:** Offline transitions remain first-class, and callers can handle concurrent realities without pretending that one replica is current.
**Unknown:** How can implementations bound the number of schedules represented by a fork?

## W3-B-002
**Name:** Causal permits
**Speculative:** Yes
**Sketch:**
```ts
type Permit<Claim, F extends Frontier> = Affine<{
  proves: Claim;
  at: F;
}>;

account.spend(withdrawPermit, withdraw(20));
// Accepted<Account> | Reconcile<ConflictingSpends>
```
**Mechanism:** Each noncommuting move spends an affine capability derived from causal evidence, and merge accepts capability histories only when their combined proof preserves the declared invariant.
**Unlocks:** Replicas can act offline under bounded authority while double-spends become typed reconciliation values rather than hidden last-writer wins.
**Unknown:** Can useful permits be delegated without making proof payloads grow with history?

## W3-B-003
**Name:** Merge-shaped phases
**Sketch:**
```ts
const checkout = mergeMachine({
  join: facts.union,
  phase: matchFacts({
    paidAndReserved: "ready",
    paidOnly: "awaiting-stock",
    reservedOnly: "awaiting-payment",
  }),
});

checkout.assert(paid(receipt));
checkout.merge(stockReplica).phase(); // "ready"
```
**Mechanism:** The machine is a join-semilattice of facts, with named states discovered by a classifier after merge rather than selected as transition targets.
**Unlocks:** Concurrent branches can synthesize a new phase that neither branch requested, making reconciliation part of the topology itself.
**Unknown:** Which classifier restrictions keep derived phases stable as more facts arrive?

## W3-B-004
**Name:** Traveling authority
**Speculative:** Yes
**Sketch:**
```ts
const [sealedAlice, offer] = alice.offerAuthority("bob");
const bob = accept(offer, bobFrontier);

sealedAlice.move; // absent
mergeAuthority(bob, carReplica);
// Owned<State, "bob"> | SplitAuthority<ReadonlyArray<Claim>>
```
**Mechanism:** Authority is a mobile affine token whose handoff seals the donor epoch and whose concurrent successor claims merge into an explicit `SplitAuthority` value.
**Unlocks:** Ownership can migrate between devices while noncommutative operations remain impossible outside a represented authority branch.
**Unknown:** What attests that an offline donor did not clone the token before handoff?

## W3-B-005
**Name:** Epistemic typestate
**Speculative:** Yes
**Sketch:**
```ts
type View<S, F extends Frontier> = Knowledge<{
  observed: S;
  possibleRemote: ReachableAfter<S, F>;
}>;

const proof = view.prove(necessarily(canRefund));
machine.move(proof, refund());
```
**Mechanism:** A handle denotes knowledge over all states still reachable beyond its causal horizon, and guarded moves require a proof that the guard holds throughout that possibility set.
**Unlocks:** UI and domain code can distinguish locally observed, globally inevitable, and merely possible phases before acting.
**Unknown:** How can reachable possibility sets stay compact enough for interactive use?

## W3-B-006
**Name:** Escrowed effects
**Speculative:** Yes
**Sketch:**
```ts
const intent = replica.move(sendReminder(orderId));
const run = effects.claim(intent, replica.vouchers.take("email", 1));

effects.merge(remoteReceipts, timerExpiries, cleanupRevocations);
// Owed<Intent> | Running<Claim> | Settled<Receipt> | Cancelled<Cause>
```
**Mechanism:** Transitions only publish effect intents, while an escrow CRDT allocates executable vouchers and merge combines spends, receipts, timer expiries, and cleanup revocations monotonically.
**Unlocks:** Replicas can schedule bounded external work offline and later reconcile which effects ran, remain owed, or were causally cancelled.
**Unknown:** Which effect guarantees survive a lost voucher holder without consensus or duplicated execution?
