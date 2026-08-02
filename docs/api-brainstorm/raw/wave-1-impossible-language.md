# Wave 1 - Impossible-language inventor

## W1-D-001
**Name:** Rebinding metamorphosis
**Speculative:** Yes
**Sketch:**
```text
let mode: Closed = door.closed()
mode <- await mode.open()     // `mode` is now Open; the Closed value is gone
mode.close()                  // valid
mode.open()                   // compile error
```
**Mechanism:** A transition expression atomically invalidates a binding and rewrites its static type to the returned typestate, with control-flow joins producing proven unions.
**Unlocks:** Straight-line interaction code carries exact current-state knowledge without a machine owner or manual reassignment to differently named variables.
**Unknown:** How should aliases, closures, and debugger time travel observe a binding whose type changes?

## W1-D-002
**Name:** Affine state leases
**Speculative:** Yes
**Sketch:**
```text
linear drag = await idle.down(pointer).capture()
drag = drag.move(next)         // consumes the previous Dragging handle
idle = drag.up()               // discharges pointer-capture cleanup
// Dropping `drag` on any path is rejected unless `cancel` is proven.
```
**Mechanism:** Each state is an affine lease over browser resources, and every transition consumes that lease while the compiler proves that all exits discharge its cleanup obligations.
**Unlocks:** Pointer capture, listeners, animation frames, and abort controllers become impossible to leak even across exceptions and cancellation.
**Unknown:** Whether ordinary UI code can tolerate ownership diagnostics during event fan-out remains unclear.

## W1-D-003
**Name:** Transition effects
**Speculative:** Yes
**Sketch:**
```text
state dragging(target) handles {
  PointerMove(p) => perform Paint(target, p)
  PointerUp      => perform Transition(idle)
} effects { Paint, CapturePointer(target) }
  finally { ReleasePointer(target) }
```
**Mechanism:** Transitions are delimited algebraic effects handled by the nearest interaction boundary, while effect rows describe capabilities retained by each continuation.
**Unlocks:** Pure decision logic can request state change, rendering, and cleanup without knowing which runtime owns or schedules them.
**Unknown:** What should happen when nested machines both claim the same transition effect?

## W1-D-004
**Name:** Codomain topology
**Speculative:** Yes
**Sketch:**
```text
on(idle,     PointerDown) -> Dragging
on(dragging, PointerMove) -> Dragging
on(dragging, PointerUp)   -> Idle

fn on(dragging, PointerUp e) -> idle(e.position) { ... }
```
**Mechanism:** The compiler constructs the entire graph from overloaded handler domains and dependent return types, so no machine definition exists apart from executable functions.
**Unlocks:** Adding a handler simultaneously adds its edge, and missing cases or dishonest targets fail at the function boundary.
**Unknown:** Separate compilation may make global exhaustiveness unknowable until link time.

## W1-D-005
**Name:** Graph-behavior lens
**Speculative:** Yes
**Sketch:**
```text
view graph Drag {
  Idle -down-> Dragging
  Dragging -move-> Dragging
  Dragging -up-> Idle
}

view behavior Drag {
  Dragging.up(e) = release(e.pointer); become Idle
}
```
**Mechanism:** Graph notation and typed behavior are bidirectional projections of one semantic artifact, with edits to either view reconciled by a compiler-maintained lens rather than one text being canonical.
**Unlocks:** Designers can reshape readable topology while implementers edit executable behavior without generated files or diagram drift.
**Unknown:** Conflicting simultaneous edits may have no principled round-trip resolution.

## W1-D-006
**Name:** Predicate states
**Speculative:** Yes
**Sketch:**
```text
state Hovering(t) := pointer.over(t) && t.connected
state Orphaned(t) := pointer.over(t) && !t.connected

observe DOMMutation
  proves Hovering(t) => Orphaned(t)
```
**Mechanism:** States are refinement predicates over observable world snapshots, and the compiler synthesizes transitions whenever updates change which proven pattern inhabits the snapshot.
**Unlocks:** DOM removal, focus loss, and media-query changes become first-class state changes without inventing corresponding command events.
**Unknown:** Real browser observations may be too partial or racy to prove that predicates are disjoint and total.

## W1-D-007
**Name:** Clock-indexed typestates
**Speculative:** Yes
**Sketch:**
```text
Pressed<t0> + Up<t> where t - t0 <= 500ms -> Click<t>
Pressed<t0> + Tick<t> where t - t0 > 500ms -> LongPress<t>

await press.before<t0 + 500ms>.up
```
**Mechanism:** Typestates carry logical clock indices and transitions require temporal proofs supplied by event timestamps or compiler-created timers.
**Unlocks:** Deadlines, debounce windows, stale events, and frame budgets become state-specific facts instead of comments around timeout arithmetic.
**Unknown:** The type system needs an honest model for clamped timers, suspended tabs, and clocks that disagree.

## W1-D-008
**Name:** States as scoped modules
**Speculative:** Yes
**Sketch:**
```text
with await enter Dragging(node) as Drag {
  Drag.move(PointerMove)       // exported only by this module instance
  Drag.paint()
} requires PointerCapture(node)
  closes with Drag.up | Drag.cancel
```
**Mechanism:** Entering a state instantiates a generative module whose exports are the legal protocol and whose scope owns resources that must be closed through one declared exit.
**Unlocks:** State-specific operations become ordinary names that cannot escape their state, while nested interactions receive distinct unforgeable protocols.
**Unknown:** Long-lived event callbacks do not fit lexical module scopes cleanly.

## W1-D-009
**Name:** Continuation machine
**Speculative:** Yes
**Sketch:**
```text
idle() = await pointer.down as d; shift dragging(capture(d), idle)

dragging(cap, returnTo) = select {
  pointer.move(p) => paint(p); recur(cap, returnTo)
  pointer.up      => release(cap); resume returnTo
}
```
**Mechanism:** A machine is a chain of delimited continuations with no persistent owner, and each transition replaces, nests, or resumes the current continuation.
**Unlocks:** Modal gestures and temporary substates can return to the exact suspended interaction context without encoding history states or parent pointers.
**Unknown:** Inspecting and serializing an opaque continuation graph may require language-level reflection.

## W1-D-010
**Name:** Event grammar
**Speculative:** Yes
**Sketch:**
```text
interaction Click :=
  down:PointerDown(target=$t)
  move:PointerMove(distance(move, down) < 4)*
  up:PointerUp(target=$t)
  => emit Click($t)

recover Click on PointerCancel => discard
```
**Mechanism:** Interaction states are parser continuations over the browser event stream, with grammar productions defining topology and semantic actions defining committed effects.
**Unlocks:** Gestures, repetition, alternatives, lookahead, and cancellation can use mature grammar concepts instead of hand-built boolean state.
**Unknown:** Ambiguous grammars could require buffering events past the point where low-latency effects must occur.

## W1-D-011
**Name:** Reactive interaction score
**Speculative:** Yes
**Sketch:**
```text
Dragging   := PointerDown ~> (PointerUp | PointerCancel)
position@t := latest PointerMove before t
paint@t    ! when Dragging@t && changed(position@t)
capture    ! during Dragging
```
**Mechanism:** The program is simultaneously a temporal score and a synchronous dataflow runtime whose state is the fixed point of equations evaluated for each event frame.
**Unlocks:** Concurrent regions, derived state, frame-coalesced rendering, and duration-bound resources can be read as relationships rather than transition plumbing.
**Unknown:** Cyclic equations need deterministic causality rules that still make sense to application developers.

## W1-D-012
**Name:** Consumer-mined protocol
**Speculative:** Yes
**Sketch:**
```text
infer Drag from consumers {
  test: idle.down.move*.up.idle
  view: match session { Idle => ..., Dragging => ... }
  caller: session.cancel? only after down
}

implementation Drag satisfies inferred
```
**Mechanism:** Tooling infers the least legal protocol accepted by all typed consumer programs, leaving topology as an IDE artifact rather than an authored machine definition.
**Unlocks:** The public FSM describes exactly what callers exercise, and implementation changes are checked directly against those demonstrated obligations.
**Unknown:** An accidental absence of consumers may silently make a desired transition nonexistent.

## W1-D-013
**Name:** Goal-property routing
**Speculative:** Yes
**Sketch:**
```text
await session.can.Drop(file)
             .without.Network
             .within.OneFrame

// Compiler result: Armed(file) -> LocalPreview(file) -> Droppable(file)
```
**Mechanism:** Virtual property access accumulates a dependent graph query whose compiler-selected route is legal only if it proves the requested capability, effect, and latency constraints.
**Unlocks:** Callers can request what must become true instead of naming an edge or even a destination state.
**Unknown:** Route choice can alter observable behavior even when every candidate satisfies the same type-level goal.
