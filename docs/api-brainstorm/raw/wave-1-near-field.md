# Wave 1 - Near-field breaker

## W1-A-001
**Name:** Constructor typestates
**Sketch:**
```ts
const idle = (n = 0) => ({
  state: "idle" as const,
  n,
  press: (at: Point) => pressed(n, at),
});

const pressed = (n: number, at: Point) => ({
  state: "pressed" as const,
  n,
  at,
  release: () => idle(n + 1),
  move: (to: Point) => dragging(n, at, to),
});

let current: ReturnType<typeof idle> | ReturnType<typeof pressed> = idle();
if (current.state === "idle") current = current.press(point);
```
**Mechanism:** The caller owns an immutable current value whose state constructor supplies only that state's legal transition functions and returns replacement values.
**Unlocks:** State data, legal operations, and precise target types stay colocated without a machine object or event union.
**Unknown:** How can mutually recursive constructor return types remain pleasant without extensive annotations?

## W1-A-002
**Name:** Epoch capabilities
**Speculative:** Yes
**Sketch:**
```ts
const idle = await service.claim("idle");
const active = await idle.start(input); // consumes idle
await active.stop();
```
**Mechanism:** A service owns hidden evolving state and lends epoch-bound capability handles that are consumed by transitions and replaced with handles for the resulting state.
**Unlocks:** Concurrent callers can detect stale authority while each live handle exposes truthful state-specific methods.
**Unknown:** Can TypeScript make consumed handles meaningfully safe without relying mainly on runtime epoch checks?

## W1-A-003
**Name:** Knowledge in the visit
**Sketch:**
```ts
interaction.visit({
  idle: ({ data, start }) => button({ onPress: start }),
  dragging: ({ point, move, drop }) => canvas({ point, onMove: move, onUp: drop }),
});
```
**Mechanism:** The machine remains opaque outside an exhaustive visit, and state-specific knowledge exists only inside the callback selected for the current state.
**Unlocks:** Rendering and event wiring cannot retain a narrowed snapshot after the machine has moved on.
**Unknown:** What return type should a visit have when branches produce different UI or effect values?

## W1-A-004
**Name:** Graph before behavior
**Sketch:**
```ts
const topology = graph(
  edge("idle", "press", "pressed"),
  edge("pressed", "move", "dragging"),
  edge("pressed", "release", "idle"),
);

const interaction = topology.implement({
  press: ({ idle }, event) => ({ pressed: { origin: event.point } }),
  move: ({ pressed }, event) => ({ dragging: { ...pressed, at: event.point } }),
  release: () => ({ idle: {} }),
});
```
**Mechanism:** A behavior-free edge graph is the sole source of legal targets, while a separately checked implementation only computes data for those predetermined targets.
**Unlocks:** Topology can be read, analyzed, replaced, or visualized independently from behavioral code.
**Unknown:** How should parallel edges with the same event but different guards be represented without leaking behavior back into the graph?

## W1-A-005
**Name:** Returns are the graph
**Sketch:**
```ts
const idle = state("idle", {
  press: (_idle, event): Pressed => pressed(event.point),
});

const pressed = state("pressed", {
  move: (value, event): Pressed | Dragging =>
    farEnough(value.origin, event.point) ? dragging(value.origin, event.point) : value,
  release: (): Idle => idle.value(),
});
```
**Mechanism:** No topology is declared because directed edges are inferred from the concrete state values named in each handler's return type.
**Unlocks:** Changing executable behavior changes the graph in the same edit, while tooling can still derive a diagram from types.
**Unknown:** Can inference survive recursive state definitions and conditional returns without widening every target to a common state union?

## W1-A-006
**Name:** Caller-executed obligations
**Sketch:**
```ts
const decision = step(current, event);
current = decision.next;

for (const obligation of decision.obligations) {
  const outcome = await app.perform(obligation);
  if (outcome) ({ next: current } = step(current, outcome));
}
```
**Mechanism:** A pure reducer returns the next caller-owned state plus typed obligations, leaving effect execution and outcome delivery entirely to the caller.
**Unlocks:** Browser effects, timers, replay, and testing share one explicit data boundary without requiring a runtime service.
**Unknown:** Who guarantees cancellation when an obligation outlives the state that produced it?

## W1-A-007
**Name:** Coroutine topology
**Speculative:** Yes
**Sketch:**
```ts
function* interaction(): InteractionProtocol {
  while (true) {
    const press = yield idleView();
    try {
      let event = yield pressedView(press.point);
      while (event.type === "move") event = yield draggingView(event.point);
    } finally {
      yield releasePointerCapture();
    }
  }
}

const protocol = interaction();
protocol.next();
protocol.next(pointerEvent);
```
**Mechanism:** The machine is a suspended coroutine whose control-flow position owns state and whose yields define observations, accepted inputs, and effects.
**Unlocks:** Multi-step interaction, waiting, loops, and cleanup can use ordinary structured control flow instead of an explicit graph.
**Unknown:** Can TypeScript correlate each yielded state's input type with the next call to `next`?

## W1-A-008
**Name:** Transaction policy
**Sketch:**
```ts
await interaction.transact(appStore, (tx) => {
  tx.expect({ pointer: "up", modal: "closed" });
  tx.apply(pointerDown(event));
  tx.enter({ pointer: "pressed", origin: event.point });
});
```
**Mechanism:** Application storage owns all state, while the machine is only a typed transactional policy that validates and atomically rewrites selected store facts.
**Unlocks:** Several interactions and domain updates can transition together without synchronizing separate machine instances.
**Unknown:** How much store shape must the policy expose before it ceases to be a useful boundary?

## W1-A-009
**Name:** State as classification
**Sketch:**
```ts
const interaction = classify({
  idle: ({ pointer }) => pointer.buttons === 0,
  pressed: ({ pointer, drag }) => pointer.buttons > 0 && drag.distance < 4,
  dragging: ({ pointer, drag }) => pointer.buttons > 0 && drag.distance >= 4,
});

interaction.read(facts).match({
  idle: (idleFacts) => drawIdle(idleFacts),
  pressed: (pressedFacts) => drawPressed(pressedFacts),
  dragging: (dragFacts) => drawDrag(dragFacts),
});
```
**Mechanism:** State is a derived classification of external facts rather than stored machine data, and events only update those underlying facts.
**Unlocks:** Machine state cannot drift from pointer, geometry, or application data because it is recomputed from their current values.
**Unknown:** What should happen when predicates overlap or no predicate matches during a partial browser update?

## W1-A-010
**Name:** Ordered rewrite program
**Speculative:** Yes
**Sketch:**
```ts
const interaction = rules`
  idle + press(point)                    -> pressed(point)
  pressed(origin) + move(point)
    when distance(origin, point) >= 4    -> dragging(origin, point)
  pressed(_) + release                   -> idle
  dragging(_, _) + release               -> idle
`;
```
**Mechanism:** The graph is an ordered term-rewriting language in which matching, binding, guards, and target construction jointly define evolution.
**Unlocks:** Dense interaction topology can read as executable rules while names captured on the left become state-specific knowledge on the right.
**Unknown:** Can a tagged-template type layer report useful errors for bindings and exhaustiveness without code generation?

## W1-A-011
**Name:** Residency reactions
**Sketch:**
```ts
machine.while("dragging", ({ state, scope, send }) => {
  scope.listen(window, "pointermove", (event) => send.move(event));
  scope.listen(window, "pointerup", () => send.drop());
  scope.interval(1000, () => reportDrag(state.id));
});
```
**Mechanism:** Transitions stay pure while effects subscribe to periods of state residency and are automatically disposed when that residency ends.
**Unlocks:** Event listeners, timers, pointer capture, and cleanup gain one lifecycle boundary independent of transition handlers.
**Unknown:** Should a self-transition preserve the existing residency scope or replace it?

## W1-A-012
**Name:** Resumable effect requests
**Speculative:** Yes
**Sketch:**
```ts
const pressed = on("move", (state, event) =>
  request(capturePointer(event.id), {
    ok: (capture) => dragging({ ...state, capture }),
    denied: () => idle({ reason: "capture-denied" }),
  }),
);

runtime.interpret({ capturePointer: browser.capturePointer });
```
**Mechanism:** Transition evaluation may pause on a typed effect request whose named continuations determine the target after an external interpreter supplies an outcome.
**Unlocks:** Effect results can branch into precise states without embedding promises, browser APIs, or exception policy in state behavior.
**Unknown:** How should cancellation dispose an interpreter operation whose continuation is no longer reachable?

## W1-A-013
**Name:** Goal-seeking machine
**Speculative:** Yes
**Sketch:**
```ts
await interaction.become("idle", {
  from: currentObservation,
  context: { pointerId, animationPolicy: "respect-user" },
});

// Runtime may choose dragging -> settling -> idle,
// or dragging -> cancelled -> idle.
```
**Mechanism:** Callers request a desired state rather than an event or edge, and a service plans and executes a currently valid path through guarded topology.
**Unlocks:** Policy can choose intermediate cleanup, animation, retry, or cancellation states without exposing those routes to every caller.
**Unknown:** What static guarantee is honest when reachability depends on runtime guards and effects?
