# Wave 1 - Anti-machine, caller-first

## W1-C-001
**Name:** Values, Then Conversions

**Sketch:**
```ts
const shut = Shut({ percent: 0 })
const moving = beginOpen(shut, { duration: 180 })
const opened = finishOpen(moving)
```

**Mechanism:** The caller owns immutable state values, and free functions accept one typestate and return another with no registry, machine object, event union, or persistent runtime.

**Unlocks:** Transitions become ordinary conversions that serialize, test, and compose without a library-owned lifecycle.

## W1-C-002
**Name:** Revocable Replacement Handles

**Speculative:** Yes

**Sketch:**
```ts
const up = attach(button)
const held = up.press(pointer)
const released = await held.release(pointer)
// up and held are now revoked
```

**Mechanism:** A live runtime issues state-specific handles whose transition methods atomically revoke the receiver and return its replacement handle.

**Unlocks:** Autocomplete exposes only legal moves while revocation makes stale aliases fail loudly instead of lying about live state.

**Unknown:** Can TypeScript communicate consumption well enough to avoid runtime-only surprises?

## W1-C-003
**Name:** Moves Born in Branches

**Sketch:**
```ts
const next = choose(snapshot, {
  resting: rest => rest.stay(),
  held: held =>
    held.pointer.inside
      ? held.releaseInside()
      : held.cancel(),
})
```

**Mechanism:** An eliminator narrows an immutable observation inside each callback, and only that branch's capability parameter defines its legal successor constructors.

**Unlocks:** Impossible moves never acquire names outside the branch where their preconditions are visible, and narrowing cannot leak.

## W1-C-004
**Name:** Authority in a Token

**Sketch:**
```ts
const view = controller.observe()
if (view.kind === "armed") {
  const permit = await controller.claim(view.revision, ArmedPermit)
  const spent = fire(view, permit)
}
```

**Mechanism:** Observation is immutable public data, while every state-changing operation requires a one-shot capability minted for one state and revision by the resource owner.

**Unlocks:** Read access, transition authority, and stale-write protection become independently passable across UI layers.

## W1-C-005
**Name:** Transition by Property

**Speculative:** Yes

**Sketch:**
```ts
const hover = idle.hover
const held = hover.press
const result = pointer.inside
  ? held.release.activate
  : held.release.cancel
```

**Mechanism:** Each state is a navigable object whose state-specific lazy properties perform transitions and evaluate to target-state objects, replacing dispatch and event names.

**Unlocks:** Legal topology is discoverable through ordinary property completion, and transition chains read as paths rather than commands.

**Unknown:** How can inspection avoid triggering a transition?

## W1-C-006
**Name:** Session-Typed Async Iterator

**Speculative:** Yes

**Sketch:**
```ts
const idle: AsyncSession<Idle> = pointerSession(node)
const pressed = await idle.next(pointerDown)
const released = await pressed.next()
const done = released.inside
  ? await released.next("activate")
  : await released.next("cancel")
```

**Mechanism:** The evolving owner is an async iterator continuation that returns a differently typed session after each legal input or environmental yield.

**Unlocks:** Waiting, cancellation, and backpressure use iterator semantics while each turn advertises only its legal replies.

**Unknown:** Can TypeScript express a useful changing `next` signature without generated protocol types?

## W1-C-007
**Name:** Continuations Are States

**Speculative:** Yes

**Sketch:**
```ts
await runPointer(node, idle =>
  idle({
    press: e => held => held({
      releaseInside: () => activate(),
      releaseOutside: () => cancel(),
    }),
    detach: () => stop(),
  }),
)
```

**Mechanism:** A state is a one-use continuation that accepts callbacks for its possible observations, and the callback selected by the environment must return the next continuation.

**Unlocks:** The caller writes protocol responses in temporal order with no mutable state slot, dispatcher, or separately named transition table.

**Unknown:** How should reentrancy interact with a continuation that is conceptually linear?

## W1-C-008
**Name:** Transition Transactions

**Sketch:**
```ts
const armed = await atomic(store, idle, tx => {
  const next = tx.replace(arm(idle))
  tx.afterCommit(() => button.focus())
  tx.onRollback(() => releaseCapture(pointerId))
  return next
})
```

**Mechanism:** The caller temporarily owns a transaction that stages the next immutable state, effects, and cleanup, with the external store becoming owner only at commit.

**Unlocks:** Multi-step interaction updates can publish once and either complete atomically or unwind resources without intermediate visible states.

## W1-C-009
**Name:** Revisioned Store Lenses

**Sketch:**
```ts
const idle = pointerLens(store).expect(isIdle)
const held = idle.compareAndSet(value => hold(value, event))
if (held.ok) render(held.lens.value)
```

**Mechanism:** A state-specific lens is a revision-bound view into caller-chosen external storage, and each transition performs compare-and-swap then returns a lens for the new typestate.

**Unlocks:** React stores, URL state, workers, or shared memory can own evolution without being mirrored into a machine runtime.

**Unknown:** What should a caller receive when an external writer wins the revision race?

## W1-C-010
**Name:** Plans Return Commands

**Sketch:**
```ts
const plan = press(idle, event)
// plan.next: Pressed
// plan.commands: [capturePointer(event.id), startTimer(500)]
const pressed = await browser.perform(plan)
```

**Mechanism:** Pure transition functions return a typed next value plus plain effect and cleanup commands, and the caller chooses an interpreter that performs them.

**Unlocks:** The same interaction logic can run against the browser, tests, replay, or server rendering without hiding effects inside transitions.

## W1-C-011
**Name:** Lexical Resource States

**Speculative:** Yes

**Sketch:**
```ts
await withPress(node, event, async held => {
  held.track(pointer => draw(pointer))
  await held.untilRelease(async released => {
    if (released.inside) released.activate()
  })
}) // capture, listeners, and timers are cleaned here
```

**Mechanism:** A live state is a lexical resource scope whose capability may be used only inside a callback and whose listeners, timers, and captures are cleaned when that scope exits.

**Unlocks:** Lifetime and cleanup follow visible nesting, making forgotten disposal and long-lived stale handles structurally difficult.

**Unknown:** Can asynchronous child work be prevented from outliving the scope in JavaScript?

## W1-C-012
**Name:** Topology From Use Sites

**Speculative:** Yes

**Sketch:**
```ts
export async function onPointerDown(idle: Idle, event: PointerEvent) {
  const held = await hold(idle, event)
  return event.shiftKey ? pin(held) : track(held)
}
// tooling derives Idle -> Held -> Pinning | Tracking
```

**Mechanism:** There is no machine definition because tooling derives the reachable graph from ordinary typed conversion calls in consumer code and treats uncalled paths as nonexistent.

**Unlocks:** A caller can add a legal path by writing the behavior itself, while diagrams and reachability reports remain generated artifacts.

**Unknown:** How much topology survives higher-order functions, dynamic imports, and dependency injection?

## W1-C-013
**Name:** Gestures as Parsers

**Sketch:**
```ts
const activation = seq(
  take(pointer.down),
  using(capturePointer, race(
    take(pointer.up.inside).map(() => "activate"),
    take(pointer.cancel).map(() => "cancel"),
  )),
)

for await (const result of parse(eventStream, activation)) handle(result)
```

**Mechanism:** The interaction is a parser over an event stream, with parser continuations as implicit states and combinators defining time, branching, repetition, and resource scopes.

**Unlocks:** Temporal gestures become composable values that return domain outcomes instead of exposing incidental state names or transition APIs.
