# Wave 2 - Blind spray D

## W2-D-001
**Name:** Consumable Residency
**Speculative:** Yes
**Sketch:**
```ts
let closed = Closed.mount(node)
let open = await closed.open() // closed is now unusable
await open[Symbol.asyncDispose]()
```
**Mechanism:** No machine definition exists: state constructors allocate resident resources, expose only valid mutations, and consume themselves when returning the next typed handle.
**Unlocks:** A state owns listeners, timers, and cleanup while illegal calls and leaked residency become representationally visible.
**Unknown:** How TypeScript could reject reuse of a consumed handle across aliases and async handoffs.

## W2-D-002
**Name:** Constraint DOM
**Speculative:** Yes
**Sketch:**
```html
<button mutate="#cart@data-mode=full"
        requires="#cart@data-mode=empty && #sku@valid">Add</button>
```
**Mechanism:** No machine definition exists: declarative preconditions and atomic patches live beside the DOM nodes whose physical shape authorizes each mutation.
**Unlocks:** Controls discover availability from the actual page, and stale actions fail like mechanical interlocks rather than corrupting hidden state.
**Unknown:** How to make multi-node DOM patches and their asynchronous effects genuinely atomic.

## W2-D-003
**Name:** Fact Projection
**Sketch:**
```ts
const order = project(orderFacts)
const paid = await order.append(Paid(card), { if: order.is("awaiting-payment") })
```
**Mechanism:** The machine is a query over append-only facts, and every mutation is a conditional fact append whose transaction also records effect intents.
**Unlocks:** Persistence, concurrent-tab conflict detection, replay, and an outbox effect boundary arise from one source of truth.

## W2-D-004
**Name:** Command Generator
**Sketch:**
```ts
function* Saving(draft: Draft) {
  const receipt: Receipt = yield Post(draft)
  return receipt.ok ? Viewing(receipt.document) : Editing(draft)
}
```
**Mechanism:** A state is a generator protocol that emits typed effect requests and returns another state function while an interpreter owns time, cancellation, and cleanup.
**Unlocks:** Behavior stays deterministic and event-union-free while effects remain inspectable outputs with typed replies.

## W2-D-005
**Name:** Contrapuntal Score
**Speculative:** Yes
**Sketch:**
```text
score Checkout {
  browsing -> paying  during "confirm"
  paying   -> receipt after  "network"
}
bind paying = PayingModule
```
**Mechanism:** A small score language defines readable temporal topology while separately authored state modules define typed behavior and residency.
**Unlocks:** Product flow can be read and revised as a score without flattening state-local capabilities into graph configuration.
**Unknown:** How to prove that handwritten score and modules correspond without quietly making either view canonical.

## W2-D-006
**Name:** Notarized Move
**Sketch:**
```ts
const published = await become(Published, draft)
  .witness(userGesture())
  .witness(serverCommit())
  .seal(before(timeout))
```
**Mechanism:** A transition is a legal instrument that changes state only after independent capability holders attach valid, expiring attestations.
**Unlocks:** User consent, server persistence, deadlines, and retries become explicit participants instead of incidental callback ordering.

## W2-D-007
**Name:** Convergent Service View
**Sketch:**
```ts
using openView = panel.observe({ kind: "open" }, open => render(open.content))
panel.ensure({ kind: "closed" })
```
**Mechanism:** The machine is a live service that owns mutable reality, publishes immutable narrowed observations, and accepts desired-state constraints instead of events or transition names.
**Unlocks:** UI code remains truthful under retries, remote changes, and convergence while subscription scope provides cleanup.

## W2-D-008
**Name:** Legal Move Palette
**Sketch:**
```ts
for (const move of legal(position)) renderButton(move.label, () => choose(move))
const { position: next, effects } = apply(position, chosen)
```
**Mechanism:** A pure rules oracle derives a position-specific set of opaque moves, each converting a caller-owned immutable value into its successor and an effect list.
**Unlocks:** The UI discovers only currently valid targets while history, speculative preview, and effect execution remain outside the rules oracle.
