# Wave 3 - Continuous dynamics gap

## W3-C-001
**Name:** Phase-space atlas
**Sketch:**
```ts
phase(pointer.xy, derivative(pointer.xy))
  .partition({
    captured: inside(handle).and(speed.below(40 * px / s)),
    transit: otherwise,
  })
  .onCross("transit -> captured", claimPointer)
```
**Mechanism:** The sampled phase point is the source of truth, while names are derived regions and transitions exist only where a trajectory crosses a shared boundary.
**Unlocks:** A drag can distinguish low-speed capture from merely passing through the same pixels without storing an event-driven mode.

## W3-C-002
**Name:** Control-law relay
**Speculative:** Yes
**Sketch:**
```ts
hybrid(pointer, panel)
  .law("follow", solve(panel.velocity.eq(pointer.velocity)))
  .invariant(panel.bounds.inside(viewport.inset(8 * px)))
  .replaceLaw(onInvariantExit, springToward(viewport.project(panel)))
```
**Mechanism:** The machine is an active differential control law, and a transition request replaces that law when a monitored invariant reaches its boundary.
**Unlocks:** Dragging, clamping, rebound, and inertia become one hybrid evolution instead of modes coordinated by pointer events and timers.

## W3-C-003
**Name:** Path-scoped effects
**Sketch:**
```ts
trajectory(pointer)
  .through(scrollGutter)
  .effect(overlap => scrollBy(overlap.integralY()))
  .until(path => path.exits(scrollGutter))
```
**Mechanism:** A trajectory segment owns effects, clocking, and cleanup, with activation and disposal determined by spatial predicates over the whole path rather than by named states.
**Unlocks:** Auto-scroll can accumulate from dwell distance inside a gutter and dispose at the exit crossing even when no sampled point lands on the edge.

## W3-C-004
**Name:** Certified crossing sampler
**Speculative:** Yes
**Sketch:**
```ts
const crossing: Certified<Outside, Inside> = await samples.adaptUntil(
  enclose(pointer.motion, deviceError),
  proveCrosses(dropZone.boundary),
)
crossing.effect(commitDrop)
```
**Mechanism:** The sampler refines time intervals until it can issue a proof-carrying boundary crossing, and only that certificate may change typestate.
**Unlocks:** Thin targets, high-speed motion, and noisy input can preserve truthful inside/outside types without equating the latest sample with reality.
**Unknown:** Can useful browser-input error bounds exist without trusted device and compositor timing?

## W3-C-005
**Name:** Constraint-manifold widget
**Speculative:** Yes
**Sketch:**
```ts
constrainedBody(panel, {
  manifold: inside(viewport) & rigidSize(panel),
  input: pointerForce(),
  contacts: [viewportEdge.onImpact(bounce(0.2)), dock.onTouch(add(coincident))],
})
```
**Mechanism:** State is the solution set of active geometric constraints, while impacts and separations transition by adding or removing constraints and the solver owns element motion.
**Unlocks:** Docking, tethering, collision, and elastic limits compose without each widget enumerating the other widgets' discrete states.

## W3-C-006
**Name:** Reachable-target handoff
**Speculative:** Yes
**Sketch:**
```ts
browser.reachable(pointer, { acceleration: handBound, horizon: 180 * ms })
  .offerTo(dom.regions("[data-flick-target]"))
  .transferWhen(inevitableIntercept)
  .followWith(target => target.controlLaw)
```
**Mechanism:** The browser continuously intersects a control-bounded reachable tube with advertised DOM regions, and control ownership transfers when one region becomes the uniquely inevitable intercept.
**Unlocks:** A fast flick can discover and commit to an off-pointer destination from trajectory feasibility rather than current-coordinate hit testing.
**Unknown:** How should moving or layout-changing targets invalidate inevitability?
