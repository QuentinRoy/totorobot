# API breakthrough deck

> **Status:** Generation complete. The 12-card deck is ready for reaction.

This is an unranked, deliberately varied reaction deck. It is not a shortlist or
a feasibility judgment, and its stable-ID order implies no preference.

## Selection provenance

The [quiet-foundations](raw/curation-quiet-foundations.md),
[alien](raw/curation-alien.md),
[donor-fragments](raw/curation-donor-fragments.md), and
[tensions](raw/curation-tensions.md) curators nominated exactly three raw seeds
each. `W1-B-004` was the sole overlap, nominated by the alien and donor-fragments
curators, yielding 11 distinct nominations. One blind random sample from the
unnominated seeds, `W2-B-008`, filled the fixed pool to 12.

## Coverage

- Cards: 12.
- Waves: Wave 1 = 5, Wave 2 = 4, Wave 3 = 3.
- Source agents represented: W1-A, W1-B, W1-C, W1-D, W2-A, W2-B, W2-D, W3-A, W3-D (9). This describes the uncut pool, not a quota.
- Mechanisms represented: live interlock wiring; consumer-mined topology; contradictory evidence; possibility-frontier safety; retractable derivations; callback-scoped knowledge; immutable conversions; legal-move oracle; graph/behavior duality; target-owned entry; append-only operative orders; disposable continuations.
- Quiet foundations: 3 curator nominations, all retained.
- Donor fragments: 3 curator nominations, all retained, with `W1-B-004` also alien-nominated.
- Explicitly speculative cards: 5 (`W1-B-004`, `W1-D-005`, `W1-D-012`, `W2-B-008`, `W3-A-001`).

## Cards

### Knowledge in the visit ([W1-A-003](raw/wave-1-near-field.md#w1-a-003))

**Provenance:** Quiet-foundations nomination.

**Sketch:**
```ts
interaction.visit({
  idle: ({ data, start }) => button({ onPress: start }),
  dragging: ({ point, move, drop }) => canvas({ point, onMove: move, onUp: drop }),
});
```

**Mechanism:** The machine remains opaque outside an exhaustive visit, and state-specific knowledge exists only inside the callback selected for the current state.

**Unlocks:** Rendering and event wiring cannot retain a narrowed snapshot after the machine has moved on.

**Largest unknown:** What return type should a visit have when branches produce different UI or effect values?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Live Permissive Circuit ([W1-B-004](raw/wave-1-alien-mechanisms.md#w1-b-004))

**Provenance:** Alien and donor-fragments nominations.

**Sketch:**
```ts
panel.wire(
  series(guard.closed, pressure.safe, not(motor.running)),
  motor.startCoil,
)
```

**Mechanism:** A requested action exists only as an energized circuit through live permissive contacts, so any opened interlock withdraws the action without dispatching a reverse event.

**Unlocks:** Safety invariants and cleanup on lost prerequisites become structural wiring, including races that snapshot guards cannot safely express.

**Largest unknown:** How should a typed API represent contacts that invalidate capabilities continuously?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Values, Then Conversions ([W1-C-001](raw/wave-1-anti-machine.md#w1-c-001))

**Provenance:** Quiet-foundations nomination.

**Sketch:**
```ts
const shut = Shut({ percent: 0 })
const moving = beginOpen(shut, { duration: 180 })
const opened = finishOpen(moving)
```

**Mechanism:** The caller owns immutable state values, and free functions accept one typestate and return another with no registry, machine object, event union, or persistent runtime.

**Unlocks:** Transitions become ordinary conversions that serialize, test, and compose without a library-owned lifecycle.

**Largest unknown:** How does a conversion acquire external resources, survive waiting, and guarantee cleanup?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Graph-behavior lens ([W1-D-005](raw/wave-1-impossible-language.md#w1-d-005))

**Provenance:** Tensions nomination.

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

**Largest unknown:** Conflicting simultaneous edits may have no principled round-trip resolution.

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Consumer-mined protocol ([W1-D-012](raw/wave-1-impossible-language.md#w1-d-012))

**Provenance:** Alien nomination.

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

**Largest unknown:** An accidental absence of consumers may silently make a desired transition nonexistent.

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Target-Owned Entrances ([W2-A-002](raw/wave-2-mutations-a.md#w2-a-002))

**Provenance:** Tensions nomination.

**Sketch:**
```ts
target("activated", {
  "activate <- idle": ({ source, event }) => activated(source, event),
  "activate <- stopped": ({ event }) => activatedFromStop(event),
})
```

**Mechanism:** Each target state owns constructors for its admissible source-and-event pairs, replacing the central edge table with inbound state knowledge.

**Unlocks:** Every route into a target must establish that target's invariants in one place, while outgoing views can be derived separately.

**Largest unknown:** Can global reachability remain inspectable without recreating a central graph index?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Operative Order Fold ([W2-B-006](raw/wave-2-mutations-b.md#w2-b-006))

**Provenance:** Tensions nomination.

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

**Largest unknown:** How are irreversible browser effects reconciled when a later order changes the historical fold's present result?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Compiled Continuation Graph ([W2-B-008](raw/wave-2-mutations-b.md#w2-b-008))

**Provenance:** Blind random sample from unnominated seeds.

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

**Largest unknown:** How can ordinary TypeScript prevent aliases from consuming the same continuation twice?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Legal Move Palette ([W2-D-008](raw/wave-2-mutations-d.md#w2-d-008))

**Provenance:** Quiet-foundations nomination.

**Sketch:**
```ts
for (const move of legal(position)) renderButton(move.label, () => choose(move))
const { position: next, effects } = apply(position, chosen)
```

**Mechanism:** A pure rules oracle derives a position-specific set of opaque moves, each converting a caller-owned immutable value into its successor and an effect list.

**Unlocks:** The UI discovers only currently valid targets while history, speculative preview, and effect execution remain outside the rules oracle.

**Largest unknown:** What freshness and authority contract applies to a move retained after its source position changes?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Possibility-frontier machine ([W3-A-001](raw/wave-3-gaps-a.md#w3-a-001))

**Provenance:** Donor-fragments nomination.

**Sketch:**
```ts
upload: Possible<Queued | Sending>
upload.forAll.cancel()                 // legal from every possible state
upload.only(proof<Sending>()).pause() // unavailable without refinement
```

**Mechanism:** The machine stores a nonempty frontier of possible worlds, and a command is admitted only when its transition relation is defined for every member of that frontier.

**Unlocks:** Shared safe behavior can run under honest uncertainty while narrower behavior remains gated by proof.

**Largest unknown:** Can TypeScript compute useful result frontiers without exponential union growth?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Paraconsistent witness board ([W3-A-003](raw/wave-3-gaps-a.md#w3-a-003))

**Provenance:** Alien nomination.

**Sketch:**
```ts
board.assert(camera, at(t1), Open)
board.assert(dom, at(t2), Not<Open>)
board.ask(Open) // Both<{ camera, t1 }, { dom, t2 }>
board.authorize(close, policy.supports(Open).despite(Not<Open>))
```

**Mechanism:** The source of truth is a timestamped provenance graph interpreted with paraconsistent logic, so a proposition and its negation can both be supported without authorizing unrelated claims.

**Unlocks:** Late sensors, split-brain observers, and domain-specific fusion rules become explicit authorization inputs instead of corrupting one state slot.

**Largest unknown:** Which fusion-policy language remains auditable when claims recursively depend on other claims?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Retractable interpretation ([W3-D-005](raw/wave-3-gaps-d.md#w3-d-005))

**Provenance:** Donor-fragments nomination.

**Sketch:**
```ts
const paid = facts.assert({ at: t1, order, kind: "paid" });
facts.assert({ at: t0, order, kind: "card-stolen" });
facts.retract(paid);

for (const revision of machine.reinterpret()) revision.compensate();
```

**Mechanism:** The source of truth is a provenance graph of retractable facts, so state is a query result and retroactive transitions invalidate derivations while emitting inverse deltas for previously materialized consequences.

**Unlocks:** Late evidence can rewrite past typestate and drive targeted compensation without erasing the audit trail.

**Largest unknown:** How can consumers hold truthful typestate while reinterpretation is still propagating?

**Human response:** _Pending._

**Follow-up request:** _Pending._

Edit reactions directly into each card's **Human response** and **Follow-up request** fields so feedback remains on disk.
