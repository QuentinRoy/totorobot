# API breakthrough deck

> **Status:** Grounding pass complete. Each card now defines the same reduced
> Marking Menu machine in its own design vocabulary.

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

## Shared grounding case

The original sketches exposed one mechanism at a time, but did not show how a
whole machine would hang together. Every card below now encodes this same
reduced slice of the real Marking Menu:

| State     | State-specific data                                  |
| --------- | ---------------------------------------------------- |
| `idle`    | `nextToken`                                          |
| `startup` | `origin`, `stroke`, owned dwell `timer`, `nextToken` |
| `expert`  | `stroke`, `nextToken`                                |
| `novice`  | current `menu`, `center`, `stroke`, `nextToken`      |

| Current state | Input                    | Outcome                                                    |
| ------------- | ------------------------ | ---------------------------------------------------------- |
| `idle`        | `down(point)`            | Enter `startup`; emit start and schedule dwell             |
| `startup`     | `move(point)` nearby     | Commit a same-state stroke update                          |
| `startup`     | `move(point)` far enough | Enter `expert`; cancel dwell                               |
| `startup`     | matching `dwellElapsed`  | Enter `novice`; emit open                                  |
| `startup`     | stale `dwellElapsed`     | No transition                                              |
| active state  | `up(point)`              | Enter `idle`; select; also cancel dwell from `startup`     |
| active state  | `cancel(point)`          | Enter `idle`; emit cancellation; cancel dwell if necessary |
| `expert`      | `move(point)`            | Commit a same-state stroke update                          |
| `novice`      | `move(point)`            | Commit a same-state stroke update                          |
| any state     | unavailable input        | No transition                                              |

`finish`, `distance`, `append`, and menu hit-testing stand for ordinary domain
helpers. In every notation, scheduling dwell means arranging a later
`dwellElapsed(token)` submission. Effects are always described or run after
deterministic state choice. The proposed libraries and languages do not exist,
so these are coherent API prototypes rather than executable implementations;
topology is shown in full instead of being hidden behind an ellipsis.

## Cards

### Knowledge in the visit ([W1-A-003](raw/wave-1-near-field.md#w1-a-003))

**Provenance:** Quiet-foundations nomination.

**Marking-menu machine:**

```text
define opaque machine MarkingMenu {
  state idle { nextToken: Token }
  state startup { origin: Point, stroke: Stroke, timer: Timer, nextToken: Token }
  state expert { stroke: Stroke, nextToken: Token }
  state novice { menu: Menu, center: Point, stroke: Stroke, nextToken: Token }
  initial idle { nextToken: 0 }

  idle(s) exposes {
    down(p) => change startup {
      origin: p, stroke: [p], timer: { token: s.nextToken },
      nextToken: s.nextToken + 1
    } after start(p), scheduleDwell(s.nextToken)
  }

  startup(s) exposes {
    move(p) => distance(s.origin, p) < threshold
      ? update startup { ...s, stroke: append(s.stroke, p) }
      : change expert { stroke: append(s.stroke, p), nextToken: s.nextToken }
        after cancelDwell(s.timer.token)
    dwellElapsed(t) => t == s.timer.token
      ? change novice { menu: rootMenu, center: s.origin, stroke: s.stroke,
                        nextToken: s.nextToken }
        after open(rootMenu, s.origin)
      : no-transition
    up(p) => change idle { nextToken: s.nextToken }
      after cancelDwell(s.timer.token), selected(finish(s, p))
    cancel(p) => change idle { nextToken: s.nextToken }
      after cancelDwell(s.timer.token), cancelled(p)
  }

  expert(s) exposes {
    move(p) => update expert { ...s, stroke: append(s.stroke, p) }
    up(p) => change idle { nextToken: s.nextToken } after selected(finish(s, p))
    cancel(p) => change idle { nextToken: s.nextToken } after cancelled(p)
  }

  novice(s) exposes {
    move(p) => update novice { ...s, stroke: append(s.stroke, p) }
    up(p) => change idle { nextToken: s.nextToken } after selected(finish(s, p))
    cancel(p) => change idle { nextToken: s.nextToken } after cancelled(p)
  }

  unavailable capability => no-transition
}

let interaction = MarkingMenu.start()

submit(input) = interaction.visit({
  idle: ({ data, down, unavailable }) => match input {
    down(p) => down(p)
    _ => unavailable(input)
  }
  startup: ({ data, move, dwellElapsed, up, cancel, unavailable }) => match input {
    move(p) => move(p)
    dwellElapsed(t) => dwellElapsed(t)
    up(p) => up(p)
    cancel(p) => cancel(p)
    _ => unavailable(input)
  }
  expert: ({ data, move, up, cancel, unavailable }) => match input {
    move(p) => move(p); up(p) => up(p); cancel(p) => cancel(p)
    _ => unavailable(input)
  }
  novice: ({ data, move, up, cancel, unavailable }) => match input {
    move(p) => move(p); up(p) => up(p); cancel(p) => cancel(p)
    _ => unavailable(input)
  }
})
```

**How to read it:** Once built, the execution exposes no snapshot or state tag.
Each submission must enter one exhaustive `visit`; only its selected callback
receives narrowed `data` and that state's capabilities. Those capabilities
produce `no-transition`, `update`, or `change`, and the runtime interprets their
`after` descriptions only after committing the result.

**What this makes concrete:** The execution owns state, while exhaustive visit
callbacks are the consumer's only temporary access to truthful typestate
knowledge.

**Mechanism:** The machine remains opaque outside an exhaustive visit, and state-specific knowledge exists only inside the callback selected for the current state.

**Unlocks:** Rendering and event wiring cannot retain a narrowed snapshot after the machine has moved on.

**Largest unknown:** What return type should a visit have when branches produce different UI or effect values?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Live Permissive Circuit ([W1-B-004](raw/wave-1-alien-mechanisms.md#w1-b-004))

**Provenance:** Alien and donor-fragments nominations.

**Marking-menu machine:**

```text
panel MarkingMenu {
  latch idle { nextToken: Token }
  latch startup { origin: Point, stroke: Stroke, timer: Timer, nextToken: Token }
  latch expert { stroke: Stroke, nextToken: Token }
  latch novice { menu: Menu, center: Point, stroke: Stroke, nextToken: Token }
  initialize idle { nextToken: 0 }

  wire series(at idle(i), pulse down(p))
    -> commit[start] startup {
      origin: p, stroke: [p], timer: { token: i.nextToken },
      nextToken: i.nextToken + 1
    }

  wire series(at startup(s), pulse move(p),
              closed(distance(s.origin, p) < threshold))
    -> update startup { ...s, stroke: append(s.stroke, p) }
  wire series(at startup(s), pulse move(p),
              closed(distance(s.origin, p) >= threshold))
    -> commit expert { stroke: append(s.stroke, p), nextToken: s.nextToken }
  wire series(at startup(s), pulse dwellElapsed(t),
              closed(t == s.timer.token))
    -> commit[open] novice {
      menu: rootMenu, center: s.origin, stroke: s.stroke,
      nextToken: s.nextToken
    }
  wire series(at startup(s), pulse up(p))
    -> commit[finish] idle { nextToken: s.nextToken }
  wire series(at startup(s), pulse cancel(p))
    -> commit[cancel] idle { nextToken: s.nextToken }

  wire series(at expert(s), pulse move(p))
    -> update expert { ...s, stroke: append(s.stroke, p) }
  wire series(at expert(s), pulse up(p))
    -> commit[finish] idle { nextToken: s.nextToken }
  wire series(at expert(s), pulse cancel(p))
    -> commit[cancel] idle { nextToken: s.nextToken }

  wire series(at novice(s), pulse move(p))
    -> update novice { ...s, stroke: append(s.stroke, p) }
  wire series(at novice(s), pulse up(p))
    -> commit[finish] idle { nextToken: s.nextToken }
  wire series(at novice(s), pulse cancel(p))
    -> commit[cancel] idle { nextToken: s.nextToken }

  default unmatched(latch, pulse) -> no-transition
  wire at startup(s) -> drive dwellCoil(s.timer.token)
}

effect adapter for MarkingMenu {
  energized dwellCoil(t) => scheduleDwell(t, () => MarkingMenu.pulse(dwellElapsed(t)))
  withdrawn dwellCoil(t) => cancelDwell(t)
  committed[start](c) => emit(start(c.input.point))
  committed[open](c) => emit(open(c.target.menu, c.target.center))
  committed[finish](c) => emit(selected(finish(c.source, c.input.point)))
  committed[cancel](c) => emit(cancelled(c.input.point))
}
```

**How to read it:** The panel's active latch holds state. An input pulse changes
state only when one complete series circuit conducts; a stale timer opens its
contact and therefore produces no transition. `update` rewrites the same latch,
while `commit` changes latches. The dwell lifetime sits behind an output coil;
the other effects observe labeled commits. Leaving `startup` withdraws
`dwellCoil` without needing a reverse event.

**What this makes concrete:** The latched typestate is current state, while a
continuously energized coil is the authority for state-lifetime work.

**Mechanism:** A requested action exists only as an energized circuit through live permissive contacts, so any opened interlock withdraws the action without dispatching a reverse event.

**Unlocks:** Safety invariants and cleanup on lost prerequisites become structural wiring, including races that snapshot guards cannot safely express.

**Largest unknown:** How should a typed API represent contacts that invalidate capabilities continuously?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Values, Then Conversions ([W1-C-001](raw/wave-1-anti-machine.md#w1-c-001))

**Provenance:** Quiet-foundations nomination.

**Marking-menu machine:**

```ts
type Idle = Readonly<{ kind: 'idle'; nextToken: number }>
type Startup = Readonly<{
	kind: 'startup'
	origin: Point
	stroke: Stroke
	timer: { token: number }
	nextToken: number
}>
type Expert = Readonly<{
	kind: 'expert'
	stroke: Stroke
	nextToken: number
}>
type Novice = Readonly<{
	kind: 'novice'
	menu: Menu
	center: Point
	stroke: Stroke
	nextToken: number
}>
type Active = Startup | Expert | Novice
type PointerInput = Readonly<{ point: Point }>

function down(state: Idle, input: PointerInput) {
	const token = state.nextToken
	return changed('start', state, input, {
		kind: 'startup',
		origin: input.point,
		stroke: [input.point],
		timer: { token },
		nextToken: token + 1,
	} satisfies Startup)
}

function moveStartup(state: Startup, input: PointerInput) {
	const stroke = append(state.stroke, input.point)
	return distance(state.origin, input.point) < threshold
		? updated(state, input, { ...state, stroke } satisfies Startup)
		: changed('toExpert', state, input, {
				kind: 'expert',
				stroke,
				nextToken: state.nextToken,
			} satisfies Expert)
}

function dwellElapsed(state: Startup, token: number) {
	if (token !== state.timer.token) return none(state, { token })
	return changed('open', state, { token }, {
		kind: 'novice',
		menu: rootMenu,
		center: state.origin,
		stroke: state.stroke,
		nextToken: state.nextToken,
	} satisfies Novice)
}

const moveExpert = (state: Expert, input: PointerInput) =>
	updated(state, input, {
		...state,
		stroke: append(state.stroke, input.point),
	})
const moveNovice = (state: Novice, input: PointerInput) =>
	updated(state, input, {
		...state,
		stroke: append(state.stroke, input.point),
	})
const up = <S extends Active>(state: S, input: PointerInput) =>
	changed('finish', state, input, {
		kind: 'idle',
		nextToken: state.nextToken,
	} satisfies Idle)
const cancel = <S extends Active>(state: S, input: PointerInput) =>
	changed('cancel', state, input, {
		kind: 'idle',
		nextToken: state.nextToken,
	} satisfies Idle)
const unavailable = <S, I>(state: S, input: I) => none(state, input)

function afterCommit(commit: Commit, effects: Effects) {
	switch (commit.edge) {
		case 'start':
			effects.emit(start(commit.input.point))
			effects.scheduleDwell(
				commit.target.timer.token,
				effects.submitDwellElapsed,
			)
			return
		case 'toExpert':
			effects.cancelDwell(commit.source.timer.token)
			return
		case 'open':
			effects.emit(open(commit.target.menu, commit.target.center))
			return
		case 'finish':
			if (commit.source.kind === 'startup')
				effects.cancelDwell(commit.source.timer.token)
			effects.emit(selected(finish(commit.source, commit.input.point)))
			return
		case 'cancel':
			if (commit.source.kind === 'startup')
				effects.cancelDwell(commit.source.timer.token)
			effects.emit(cancelled(commit.input.point))
	}
}
```

**How to read it:** The caller holds an immutable `Idle | Startup | Expert |
Novice` value and invokes a source-specific conversion. `none`, `updated`, and
`changed` return no transition, a same-state replacement, or a different
typestate. The caller installs the result before passing its commit to
`afterCommit`. Source-specific functions reject a wrong source type;
`unavailable` is the explicit fallback for a broad-input adapter.

**What this makes concrete:** There is no authored graph or persistent machine
object; ordinary conversion functions collectively define the topology.

**Mechanism:** The caller owns immutable state values, and free functions accept one typestate and return another with no registry, machine object, event union, or persistent runtime.

**Unlocks:** Transitions become ordinary conversions that serialize, test, and compose without a library-owned lifecycle.

**Largest unknown:** How does a conversion acquire external resources, survive waiting, and guarantee cleanup?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Graph-behavior lens ([W1-D-005](raw/wave-1-impossible-language.md#w1-d-005))

**Provenance:** Tensions nomination.

**Marking-menu machine:**

```text
lens machine MarkingMenu(rootMenu: Menu, threshold: number) {
  state idle { nextToken: Token }
  state startup { origin: Point, stroke: Stroke, timer: Timer, nextToken: Token }
  state expert { stroke: Stroke, nextToken: Token }
  state novice { menu: Menu, center: Point, stroke: Stroke, nextToken: Token }
  initial idle { nextToken: 0 }

  editable view graph {
    idle -down-> startup
    startup ~move [distance(origin, point) < threshold]~> startup
    startup -move [distance(origin, point) >= threshold]-> expert
    startup -dwellElapsed [token == timer.token]-> novice
    startup -up-> idle
    startup -cancel-> idle
    expert ~move~> expert
    expert -up-> idle
    expert -cancel-> idle
    novice ~move~> novice
    novice -up-> idle
    novice -cancel-> idle
    every other state/input, including stale dwell -/-> no-transition
  }

  editable view behavior {
    idle.down(p) = become startup {
      origin: p, stroke: [p], timer: { token: nextToken },
      nextToken: nextToken + 1
    }
    startup.move(p) = distance(origin, p) < threshold
      ? update startup { origin, stroke: append(stroke, p), timer, nextToken }
      : become expert { stroke: append(stroke, p), nextToken }
    startup.dwellElapsed(t) = t == timer.token
      ? become novice { menu: rootMenu, center: origin, stroke, nextToken }
      : no-transition
    startup.up(_) | startup.cancel(_) = become idle { nextToken }
    expert.move(p) = update expert { stroke: append(stroke, p), nextToken }
    expert.up(_) | expert.cancel(_) = become idle { nextToken }
    novice.move(p) = update novice { menu, center, stroke: append(stroke, p), nextToken }
    novice.up(_) | novice.cancel(_) = become idle { nextToken }
    every other state/input = no-transition
  }
}

effects after MarkingMenu commits {
  idle.down -> startup =>
    emit start(input.point)
    schedule dwell(target.timer.token, t => submit dwellElapsed(t))
  startup.move -> expert => cancel dwell(source.timer.token)
  startup.(up | cancel) -> idle => cancel dwell(source.timer.token)
  startup.dwellElapsed -> novice => emit open(target.menu, target.center)
  (startup | expert | novice).up -> idle =>
    emit selected(finish(source, input.point))
  (startup | expert | novice).cancel -> idle => emit cancelled(input.point)
}
```

**How to read it:** The runtime holds one immutable state value. `~>`/`update`
means a committed same-state update, `->`/`become` a state change, and
`-/->`/`no-transition` no commit. The graph and behavior blocks are both
editable compiler-reconciled views of one artifact; effects observe that
artifact's commits afterward.

**What this makes concrete:** Neither authored view is canonical: topology and
executable behavior are bidirectional projections of compiler-owned semantics.

**Mechanism:** Graph notation and typed behavior are bidirectional projections of one semantic artifact, with edits to either view reconciled by a compiler-maintained lens rather than one text being canonical.

**Unlocks:** Designers can reshape readable topology while implementers edit executable behavior without generated files or diagram drift.

**Largest unknown:** Conflicting simultaneous edits may have no principled round-trip resolution.

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Consumer-mined protocol ([W1-D-012](raw/wave-1-impossible-language.md#w1-d-012))

**Provenance:** Alien nomination.

**Marking-menu machine:**

```text
state-data idle { nextToken: Token }
state-data startup { origin: Point, stroke: Stroke, timer: Timer, nextToken: Token }
state-data expert { stroke: Stroke, nextToken: Token }
state-data novice { menu: Menu, center: Point, stroke: Stroke, nextToken: Token }
input down(point) | move(point) | up(point) | cancel(point)
input dwellElapsed(token)

mine protocol MarkingMenu from consumers {
  consumer exhaustive view controls(s) = visit s {
    idle(x) => bind(x.down)
    startup(x) => bind(x.move, x.up, x.cancel, x.dwellElapsed)
    expert(x) => bind(x.move, x.up, x.cancel)
    novice(x) => bind(x.move, x.up, x.cancel)
  }

  fixtures:
    distance(p0, near) < threshold <= distance(p0, far)
    matching == timer.token; stale != timer.token

  consumer trace expertPath:
    idle -down(p0)-> startup
    startup ~move(near)~> startup -move(far)-> expert
    expert ~move(p1)~> expert -up(p1)-> idle

  consumer trace novicePath:
    idle -down(p0)-> startup -dwellElapsed(matching)-> novice
    novice ~move(p1)~> novice -up(p1)-> idle

  consumer trace remainingClosures:
    startup -up(p)-> idle; startup -cancel(p)-> idle
    expert -cancel(p)-> idle; novice -cancel(p)-> idle

  consumer exhaustive unavailable:
    idle -[move, up, cancel, dwellElapsed]-/-> no-transition
    startup -[down, dwellElapsed(stale)]-/-> no-transition
    expert -[down, dwellElapsed]-/-> no-transition
    novice -[down, dwellElapsed]-/-> no-transition

  consumer effects after commits {
    idle.down -> startup => emit start; schedule dwell
    startup.move -> expert => cancel dwell
    startup.(up | cancel) -> idle => cancel dwell
    startup.dwellElapsed -> novice => emit open
    active.up -> idle => emit selected
    active.cancel -> idle => emit cancelled
  }
}

provider MarkingMenu satisfies mined protocol, excluded from inference {
  initial = idle { nextToken: 0 }
  idle.down(s, p) = startup {
    origin: p, stroke: [p], timer: { token: s.nextToken },
    nextToken: s.nextToken + 1
  }
  startup.move(s, p) = distance(s.origin, p) < threshold
    ? update startup { ...s, stroke: append(s.stroke, p) }
    : expert { stroke: append(s.stroke, p), nextToken: s.nextToken }
  startup.dwellElapsed(s, t) = t == s.timer.token
    ? novice { menu: rootMenu, center: s.origin, stroke: s.stroke,
               nextToken: s.nextToken }
    : no-transition
  startup.(up | cancel)(s) = idle { nextToken: s.nextToken }
  expert.move(s, p) = update expert { ...s, stroke: append(s.stroke, p) }
  expert.(up | cancel)(s) = idle { nextToken: s.nextToken }
  novice.move(s, p) = update novice { ...s, stroke: append(s.stroke, p) }
  novice.(up | cancel)(s) = idle { nextToken: s.nextToken }
  unavailable submission = no-transition
}
```

**How to read it:** The provider execution holds current state, but consumers
determine its public state-specific capabilities and expected targets. The
traces distinguish same-state updates, state changes, and no transition; the
provider must implement all mined obligations but cannot create an unobserved
public edge. Consumer effect handlers run only from correlated commits.

**What this makes concrete:** Consumer code, rather than the provider's
definition, is the source of truth for the public protocol topology.

**Mechanism:** Tooling infers the least legal protocol accepted by all typed consumer programs, leaving topology as an IDE artifact rather than an authored machine definition.

**Unlocks:** The public FSM describes exactly what callers exercise, and implementation changes are checked directly against those demonstrated obligations.

**Largest unknown:** An accidental absence of consumers may silently make a desired transition nonexistent.

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Target-Owned Entrances ([W2-A-002](raw/wave-2-mutations-a.md#w2-a-002))

**Provenance:** Tensions nomination.

**Marking-menu machine:**

```text
entrance-machine MarkingMenu(rootMenu: Menu, threshold: number) {
  state idle { nextToken: Token }
  state startup { origin: Point, stroke: Stroke, timer: Timer, nextToken: Token }
  state expert { stroke: Stroke, nextToken: Token }
  state novice { menu: Menu, center: Point, stroke: Stroke, nextToken: Token }
  initial idle { nextToken: 0 }

  target startup owns constructors {
    entrance down(p) <- idle(s) => {
      origin: p, stroke: [p], timer: { token: s.nextToken },
      nextToken: s.nextToken + 1
    }
    update move(p) <- startup(s) when distance(s.origin, p) < threshold => {
      ...s, stroke: append(s.stroke, p)
    }
  }

  target expert owns constructors {
    entrance move(p) <- startup(s) when distance(s.origin, p) >= threshold => {
      stroke: append(s.stroke, p), nextToken: s.nextToken
    }
    update move(p) <- expert(s) => { ...s, stroke: append(s.stroke, p) }
  }

  target novice owns constructors {
    entrance dwellElapsed(t) <- startup(s) when t == s.timer.token => {
      menu: rootMenu, center: s.origin, stroke: s.stroke,
      nextToken: s.nextToken
    }
    update move(p) <- novice(s) => { ...s, stroke: append(s.stroke, p) }
  }

  target idle owns constructors {
    entrance up(_) <- startup(s) => { nextToken: s.nextToken }
    entrance cancel(_) <- startup(s) => { nextToken: s.nextToken }
    entrance up(_) <- expert(s) => { nextToken: s.nextToken }
    entrance cancel(_) <- expert(s) => { nextToken: s.nextToken }
    entrance up(_) <- novice(s) => { nextToken: s.nextToken }
    entrance cancel(_) <- novice(s) => { nextToken: s.nextToken }
  }

  no-transition idle on move | up | cancel | dwellElapsed
  no-transition startup(s) on down | dwellElapsed(t) when t != s.timer.token
  no-transition expert on down | dwellElapsed
  no-transition novice on down | dwellElapsed
}

effects after MarkingMenu commits {
  idle.down -> startup => emit start; schedule dwell(target.timer.token)
  startup.move -> expert => cancel dwell(source.timer.token)
  startup.(up | cancel) -> idle => cancel dwell(source.timer.token)
  startup.dwellElapsed -> novice => emit open(target.menu, target.center)
  active.up -> idle => emit selected(finish(source, input.point))
  active.cancel -> idle => emit cancelled(input.point)
}
```

**How to read it:** Every committed target value, including a same-state
replacement, is built in the block owned by that target. The derived dispatcher
chooses an inbound entrance, a target-owned update, or a listed no-transition
rule. State remains an immutable execution value, and effects observe
successful constructions only after commitment.

**What this makes concrete:** Target states centralize every route that must
establish their invariants; outgoing topology is derived from those entrances.

**Mechanism:** Each target state owns constructors for its admissible source-and-event pairs, replacing the central edge table with inbound state knowledge.

**Unlocks:** Every route into a target must establish that target's invariants in one place, while outgoing views can be derived separately.

**Largest unknown:** Can global reachability remain inspectable without recreating a central graph index?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Operative Order Fold ([W2-B-006](raw/wave-2-mutations-b.md#w2-b-006))

**Provenance:** Tensions nomination.

**Marking-menu machine:**

```ts
type States = {
	idle: { nextToken: number }
	startup: {
		origin: Point
		stroke: Stroke
		timer: { token: number }
		nextToken: number
	}
	expert: { stroke: Stroke; nextToken: number }
	novice: { menu: Menu; center: Point; stroke: Stroke; nextToken: number }
}

const marking = operativeOrders<States>`
  idle.down(point) => become startup
    { origin: point, stroke: [point], timer: { token: nextToken },
      nextToken: nextToken + 1 } as begin
  startup.move(point) when distance(origin, point) < threshold => stay startup
    { origin, stroke: append(stroke, point), timer, nextToken }
  startup.move(point) when distance(origin, point) >= threshold => become expert
    { stroke: append(stroke, point), nextToken } as expert
  startup.dwellElapsed(token) when token == timer.token => become novice
    { menu: rootMenu, center: origin, stroke, nextToken } as open
  startup.dwellElapsed(token) otherwise => none
  startup.up(point) => become idle { nextToken }
  startup.cancel(point) => become idle { nextToken }
  expert.move(point) => stay expert { stroke: append(stroke, point), nextToken }
  expert.up(point) => become idle { nextToken }
  expert.cancel(point) => become idle { nextToken }
  novice.move(point) => stay novice
    { menu, center, stroke: append(stroke, point), nextToken }
  novice.up(point) => become idle { nextToken }
  novice.cancel(point) => become idle { nextToken }
  otherwise => none
`

let live = marking.record('idle', { nextToken: 0 })

function submit(input: InputOf<typeof marking>) {
	const before = live.materialize()
	const order = marking.issue(before, input)
	if (order.kind === 'none') return order

	live = live.append(order)
	const after = live.materialize()
	reactions.run({ order, before, input, after })
	return order
}

const reactions = marking.afterAppend(({ order, before, input, after }) => {
	if (order.name === 'begin' && after.state === 'startup') {
		emit(start(input.point))
		clock.schedule(after.data.timer.token, dwellMs, () =>
			submit({ type: 'dwellElapsed', token: after.data.timer.token }),
		)
	}
	if (
		before.state === 'startup' &&
		(order.name === 'expert' || input.type === 'up' || input.type === 'cancel')
	) {
		clock.cancel(before.data.timer.token)
	}
	if (order.name === 'open' && after.state === 'novice')
		emit(open(after.data.menu, after.data.center))
	if (input.type === 'up' && before.state !== 'idle')
		emit(selected(finish(before, input.point)))
	if (input.type === 'cancel') emit(cancelled(input.point))
})
```

**How to read it:** `live` is an initial value plus an append-only chain of
orders; `materialize()` folds it to the current typestate. `none`, `stay`, and
`become` represent no transition, same-state update, and state change. An input
issues at most one order, appends it, then runs reactions against the resulting
fold.

**What this makes concrete:** The operative order chain, not a mutable current
state slot, is the live run's source of truth.

**Mechanism:** Operative state is a fold over an append-only chain of typed orders, stays, and reversals rather than a value directly mutated when a ruling arrives.

**Unlocks:** Appeals, delayed effect, audit, and historical reconstruction become ordinary additions to the source of truth instead of bespoke rollback paths.

**Largest unknown:** How are irreversible browser effects reconciled when a later order changes the historical fold's present result?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Compiled Continuation Graph ([W2-B-008](raw/wave-2-mutations-b.md#w2-b-008))

**Provenance:** Blind random sample from unnominated seeds.

**Marking-menu machine:**

```ts
type States = {
	idle: { nextToken: number }
	startup: {
		origin: Point
		stroke: Stroke
		timer: { token: number }
		nextToken: number
	}
	expert: { stroke: Stroke; nextToken: number }
	novice: { menu: Menu; center: Point; stroke: Stroke; nextToken: number }
}
type Input =
	| { type: 'down' | 'move' | 'up' | 'cancel'; point: Point }
	| { type: 'dwellElapsed'; token: number }

const noResources = lifetime(() => undefined)
const startupResources = lifetime<States['startup']>(({ data, offer }) => {
	emit(start(data.origin))
	return clock.schedule(dwellMs, () =>
		offer({ type: 'dwellElapsed', token: data.timer.token }),
	)
})
const noviceResources = lifetime<States['novice']>(({ data }) => {
	emit(open(data.menu, data.center))
})
const selected = afterCommit<'up'>(({ from, input }) =>
	emit(selectedEvent(finish(from, input.point))),
)
const cancelled = afterCommit<'cancel'>(({ input }) =>
	emit(cancelledEvent(input.point)),
)

const begin = continuationProtocol<States, Input>`
  state idle scope ${noResources}
    next.down(point) -> startup { origin: point, stroke: [point],
      timer: { token: nextToken }, nextToken: nextToken + 1 }

  state startup scope ${startupResources}
    next.move(point) when distance(origin, point) < threshold
      -> update startup { origin, stroke: append(stroke, point), timer,
                          nextToken } keep scope
    next.move(point) when distance(origin, point) >= threshold
      -> expert { stroke: append(stroke, point), nextToken }
    next.dwellElapsed(token) when token == timer.token
      -> novice { menu: rootMenu, center: origin, stroke, nextToken }
    next.dwellElapsed(token) otherwise -> no-transition retain
    next.up(point) -> idle { nextToken } after ${selected}
    next.cancel(point) -> idle { nextToken } after ${cancelled}

  state expert scope ${noResources}
    next.move(point) -> update expert
      { stroke: append(stroke, point), nextToken } keep scope
    next.up(point) -> idle { nextToken } after ${selected}
    next.cancel(point) -> idle { nextToken } after ${cancelled}

  state novice scope ${noviceResources}
    next.move(point) -> update novice
      { menu, center, stroke: append(stroke, point), nextToken } keep scope
    next.up(point) -> idle { nextToken } after ${selected}
    next.cancel(point) -> idle { nextToken } after ${cancelled}

  offer(any input not listed by the current state) -> no-transition retain
`

await using startup = await begin.idle({ nextToken: 0 }).next.down(point)
const next = await startup.next.move(farPoint) // Startup | Expert; consumes `startup`.
```

**How to read it:** The held continuation contains current data and exposes
only that state's generated `.next` methods. A successful method consumes the
handle and returns its successor; `retain`, `update`, and another state denote
no transition, same-state replacement, and state change. The startup scope owns
the timer, so consuming or disposing its continuation cancels the timer.

**What this makes concrete:** The continuation itself owns typestate and
resource lifetime after the edge script has been compiled away.

**Mechanism:** The edge script constructs one-shot async continuations and then disappears, so the held continuation owns current data while its interpolation owns effects until consumption or disposal.

**Unlocks:** Typestate follows linear session ownership, with cancellation, timers, listeners, and cleanup sharing the continuation's lifetime boundary.

**Largest unknown:** How can ordinary TypeScript prevent aliases from consuming the same continuation twice?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Legal Move Palette ([W2-D-008](raw/wave-2-mutations-d.md#w2-d-008))

**Provenance:** Quiet-foundations nomination.

**Marking-menu machine:**

```ts
type States = {
	idle: { nextToken: number }
	startup: {
		origin: Point
		stroke: Stroke
		timer: { token: number }
		nextToken: number
	}
	expert: { stroke: Stroke; nextToken: number }
	novice: { menu: Menu; center: Point; stroke: Stroke; nextToken: number }
}
type Input =
	| { type: 'down' | 'move' | 'up' | 'cancel'; point: Point }
	| { type: 'dwellElapsed'; token: number }

const rules = legalMovePalette<States, Input>({
	authority: revisionAuthority({ mismatch: 'stale-move' }),
	idle: (state, move) => [
		move.accept('down', (input) =>
			move.change(
				'startup',
				{
					origin: input.point,
					stroke: [input.point],
					timer: { token: state.nextToken },
					nextToken: state.nextToken + 1,
				},
				[fx.start(input.point), fx.scheduleDwell(state.nextToken)],
			),
		),
	],
	startup: (state, move) => [
		move.accept('move', (input) => {
			const stroke = append(state.stroke, input.point)
			return distance(state.origin, input.point) < threshold
				? move.update('startup', { ...state, stroke }, [])
				: move.change('expert', { stroke, nextToken: state.nextToken }, [
						fx.cancelDwell(state.timer.token),
					])
		}),
		move.accept('dwellElapsed', (input) =>
			input.token === state.timer.token
				? move.change(
						'novice',
						{
							menu: rootMenu,
							center: state.origin,
							stroke: state.stroke,
							nextToken: state.nextToken,
						},
						[fx.open(rootMenu, state.origin)],
					)
				: move.none(),
		),
		move.accept('up', (input) =>
			move.change('idle', { nextToken: state.nextToken }, [
				fx.cancelDwell(state.timer.token),
				fx.selected(finish(state, input.point)),
			]),
		),
		move.accept('cancel', (input) =>
			move.change('idle', { nextToken: state.nextToken }, [
				fx.cancelDwell(state.timer.token),
				fx.cancelled(input.point),
			]),
		),
	],
	expert: (state, move) => [
		move.accept('move', (input) =>
			move.update(
				'expert',
				{ ...state, stroke: append(state.stroke, input.point) },
				[],
			),
		),
		move.accept('up', (input) =>
			move.change('idle', { nextToken: state.nextToken }, [
				fx.selected(finish(state, input.point)),
			]),
		),
		move.accept('cancel', (input) =>
			move.change('idle', { nextToken: state.nextToken }, [
				fx.cancelled(input.point),
			]),
		),
	],
	novice: (state, move) => [
		move.accept('move', (input) =>
			move.update(
				'novice',
				{ ...state, stroke: append(state.stroke, input.point) },
				[],
			),
		),
		move.accept('up', (input) =>
			move.change('idle', { nextToken: state.nextToken }, [
				fx.selected(finish(state, input.point)),
			]),
		),
		move.accept('cancel', (input) =>
			move.change('idle', { nextToken: state.nextToken }, [
				fx.cancelled(input.point),
			]),
		),
	],
})

let position = rules.initial('idle', { nextToken: 0 })

function submit(input: Input) {
	const palette = rules.legal(position)
	const chosen = palette.bind(input)
	if (chosen === undefined) return { kind: 'no-transition', position }

	const result = rules.apply(position, chosen)
	if (result.kind !== 'committed') return result
	position = result.position
	result.effects.forEach((effect) => effectRunner.run(effect))
	return result
}
```

**How to read it:** The caller owns immutable `position`, and `legal(position)`
derives its complete palette without seeing an input. Because browser inputs
carry payloads, each opaque palette move accepts one input kind; `bind` chooses
and fills that move, or reports an unavailable input. `move.none`,
`move.update`, and `move.change` encode the three outcomes. `apply` rejects a
move retained past its source revision; the caller then installs a committed
successor and runs its effect descriptions.

**What this makes concrete:** The position is authoritative state, while the
pure palette is the sole authority for revision-bound legal conversions.

**Mechanism:** A pure rules oracle derives a position-specific set of opaque moves, each converting a caller-owned immutable value into its successor and an effect list.

**Unlocks:** The UI discovers only currently valid targets while history, speculative preview, and effect execution remain outside the rules oracle.

**Largest unknown:** What freshness and authority contract applies to a move retained after its source position changes?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Possibility-frontier machine ([W3-A-001](raw/wave-3-gaps-a.md#w3-a-001))

**Provenance:** Donor-fragments nomination.

**Marking-menu machine:**

```ts
type State =
	| { state: 'idle'; nextToken: number }
	| {
			state: 'startup'
			origin: Point
			stroke: Stroke
			timer: { token: number }
			nextToken: number
	  }
	| { state: 'expert'; stroke: Stroke; nextToken: number }
	| {
			state: 'novice'
			menu: Menu
			center: Point
			stroke: Stroke
			nextToken: number
	  }
type Input =
	| { type: 'down' | 'move' | 'up' | 'cancel'; point: Point }
	| { type: 'dwellElapsed'; token: number }

const marking = possibilityFrontier<State, Input>`
  idle({ nextToken: n }) + down(p)
    => change(startup({ origin: p, stroke: [p], timer: { token: n },
                        nextToken: n + 1 }))
       .describe(start(p), scheduleDwell(n))
  startup(s) + move(p) when distance(s.origin, p) < threshold
    => update(startup({ ...s, stroke: append(s.stroke, p) }))
  startup(s) + move(p) when distance(s.origin, p) >= threshold
    => change(expert({ stroke: append(s.stroke, p), nextToken: s.nextToken }))
       .describe(cancelDwell(s.timer.token))
  startup(s) + dwellElapsed(t) when t == s.timer.token
    => change(novice({ menu: rootMenu, center: s.origin, stroke: s.stroke,
                       nextToken: s.nextToken }))
       .describe(open(rootMenu, s.origin))
  startup(s) + dwellElapsed(t) when t != s.timer.token => none
  startup(s) + up(p)
    => change(idle({ nextToken: s.nextToken }))
       .describe(cancelDwell(s.timer.token), selected(finish(s, p)))
  startup(s) + cancel(p)
    => change(idle({ nextToken: s.nextToken }))
       .describe(cancelDwell(s.timer.token), cancelled(p))
  expert(s) + move(p)
    => update(expert({ ...s, stroke: append(s.stroke, p) }))
  expert(s) + up(p)
    => change(idle({ nextToken: s.nextToken })).describe(selected(finish(s, p)))
  expert(s) + cancel(p)
    => change(idle({ nextToken: s.nextToken })).describe(cancelled(p))
  novice(s) + move(p)
    => update(novice({ ...s, stroke: append(s.stroke, p) }))
  novice(s) + up(p)
    => change(idle({ nextToken: s.nextToken })).describe(selected(finish(s, p)))
  novice(s) + cancel(p)
    => change(idle({ nextToken: s.nextToken })).describe(cancelled(p))
  any + otherwise => unavailable
`

let possible = marking.certain(idle({ nextToken: 7 }))
let result = possible.apply(down(p0))
possible = result.next
effects.run(result.effects)

possible = possible.afterUnobservedOrder(
	[move(pFar), dwellElapsed(7)],
	[dwellElapsed(7), move(pFar)],
) // Lost cross-worker ordering leaves an expert | novice frontier.

possible.offer(down(p1)) // Runtime no-transition: `down` is unavailable.
possible = possible.forAll(move(p1)).next // Both states accept move.
result = possible.forAll(cancel(p1)) // Both states accept cancel.
possible = result.next // Both worlds converge to idle.
effects.run(result.effects.common)
```

**How to read it:** The live value is a nonempty set of complete worlds,
initially a singleton and later `expert | novice` when event ordering is not
known locally. `none` is a defined no-transition, while `unavailable` makes a
broad `offer` return no-transition and blocks `forAll`; `update` and `change`
remain committed outcomes. Transitions produce effect descriptions, but the
uncertain replica runs only effects proven common.

**What this makes concrete:** The possibility frontier itself, not one guessed
state, is the current source of truth and capability boundary.

**Mechanism:** The machine stores a nonempty frontier of possible worlds, and a command is admitted only when its transition relation is defined for every member of that frontier.

**Unlocks:** Shared safe behavior can run under honest uncertainty while narrower behavior remains gated by proof.

**Largest unknown:** Can TypeScript compute useful result frontiers without exponential union growth?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Paraconsistent witness board ([W3-A-003](raw/wave-3-gaps-a.md#w3-a-003))

**Provenance:** Alien nomination.

**Marking-menu machine:**

```ts
type State =
	| { state: 'idle'; nextToken: number }
	| {
			state: 'startup'
			origin: Point
			stroke: Stroke
			timer: { token: number }
			nextToken: number
	  }
	| { state: 'expert'; stroke: Stroke; nextToken: number }
	| {
			state: 'novice'
			menu: Menu
			center: Point
			stroke: Stroke
			nextToken: number
	  }
type Input =
	| { type: 'down' | 'move' | 'up' | 'cancel'; point: Point }
	| { type: 'dwellElapsed'; token: number }

const topology = witnessRules<State, Input>`
  prior idle({ nextToken: n }) & pointer:down(p)
    => propose(change(startup({ origin: p, stroke: [p], timer: { token: n },
                                nextToken: n + 1 })))
       .describe(start(p), scheduleDwell(n))
  prior startup(s) & pointer:move(p)
    when distance(s.origin, p) < threshold
    => propose(update(startup({ ...s, stroke: append(s.stroke, p) })))
  prior startup(s) & pointer:move(p)
    when distance(s.origin, p) >= threshold
    => propose(change(expert({ stroke: append(s.stroke, p),
                               nextToken: s.nextToken })))
       .describe(cancelDwell(s.timer.token))
  prior startup(s) & timer:dwellElapsed(t) when t == s.timer.token
    => propose(change(novice({ menu: rootMenu, center: s.origin,
                               stroke: s.stroke, nextToken: s.nextToken })))
       .describe(open(rootMenu, s.origin))
  prior startup(s) & timer:dwellElapsed(t) when t != s.timer.token
    => propose(none)
  prior startup(s) & pointer:up(p)
    => propose(change(idle({ nextToken: s.nextToken })))
       .describe(cancelDwell(s.timer.token), selected(finish(s, p)))
  prior startup(s) & pointer:cancel(p)
    => propose(change(idle({ nextToken: s.nextToken })))
       .describe(cancelDwell(s.timer.token), cancelled(p))
  prior expert(s) & pointer:move(p)
    => propose(update(expert({ ...s, stroke: append(s.stroke, p) })))
  prior expert(s) & pointer:up(p)
    => propose(change(idle({ nextToken: s.nextToken })))
       .describe(selected(finish(s, p)))
  prior expert(s) & pointer:cancel(p)
    => propose(change(idle({ nextToken: s.nextToken }))).describe(cancelled(p))
  prior novice(s) & pointer:move(p)
    => propose(update(novice({ ...s, stroke: append(s.stroke, p) })))
  prior novice(s) & pointer:up(p)
    => propose(change(idle({ nextToken: s.nextToken })))
       .describe(selected(finish(s, p)))
  prior novice(s) & pointer:cancel(p)
    => propose(change(idle({ nextToken: s.nextToken }))).describe(cancelled(p))
  prior any & otherwise => propose(none)
`

const policy = authorization<State>({
	idle: supports(control('idle')).despite(negated(control('idle'))),
	startup: supports(control('startup')).despite(negated(control('startup'))),
	expert: supports(control('expert')).despite(negated(control('expert'))),
	novice: supports(control('novice')).despite(negated(control('novice'))),
	choose: newestWitnessThen(['pointer', 'timer', 'controller']),
	none: retainPriorAsNoTransition(),
})

const board = witnessBoard({
	logic: 'paraconsistent',
	exclusiveControl: ['idle', 'startup', 'expert', 'novice'],
	topology,
	policy,
})
board.assert(controller, at(0), initial(control(idle({ nextToken: 7 }))))

let result = board.epoch().assert(pointer, at(1), down(p0)).authorize()
effects.run(result.effects)

const conflict = board
	.epoch()
	.assert(pointer, at(20), move(pFar))
	.assert(timer, at(20), dwellElapsed(7))
result = conflict.authorize()
board.ask(control('expert')) // Both(pointer support, timer-derived negation)
board.ask(control('novice')) // Both(timer support, pointer-derived negation)
effects.run(result.effects) // Pointer wins this explicit tie-break.
```

**How to read it:** Timestamped witness and derived control claims, including
contradictions, live on the board. Each epoch proposes `none`, `update`, or
`change` from one prior authorized state; the explicit policy then projects one
control state without deleting losing evidence. Only the authorized proposal's
effect descriptions run.

**What this makes concrete:** The provenance board is authoritative evidence,
while a separate policy owns the singular state projection used by the menu.

**Mechanism:** The source of truth is a timestamped provenance graph interpreted with paraconsistent logic, so a proposition and its negation can both be supported without authorizing unrelated claims.

**Unlocks:** Late sensors, split-brain observers, and domain-specific fusion rules become explicit authorization inputs instead of corrupting one state slot.

**Largest unknown:** Which fusion-policy language remains auditable when claims recursively depend on other claims?

**Human response:** _Pending._

**Follow-up request:** _Pending._

### Retractable interpretation ([W3-D-005](raw/wave-3-gaps-d.md#w3-d-005))

**Provenance:** Donor-fragments nomination.

**Marking-menu machine:**

```ts
type State =
	| { state: 'idle'; nextToken: number }
	| {
			state: 'startup'
			origin: Point
			stroke: Stroke
			timer: { token: number }
			nextToken: number
	  }
	| { state: 'expert'; stroke: Stroke; nextToken: number }
	| {
			state: 'novice'
			menu: Menu
			center: Point
			stroke: Stroke
			nextToken: number
	  }
type Input =
	| { type: 'down' | 'move' | 'up' | 'cancel'; point: Point }
	| { type: 'dwellElapsed'; token: number }

const interpretation = retractableInterpretation<State, Input>`
  prior idle({ nextToken: n }) + fact down(p)
    => derive(change(startup({ origin: p, stroke: [p], timer: { token: n },
                               nextToken: n + 1 })))
       .causes(start(p), scheduleDwell(n))
  prior startup(s) + fact move(p) when distance(s.origin, p) < threshold
    => derive(update(startup({ ...s, stroke: append(s.stroke, p) })))
  prior startup(s) + fact move(p) when distance(s.origin, p) >= threshold
    => derive(change(expert({ stroke: append(s.stroke, p),
                              nextToken: s.nextToken })))
       .causes(cancelDwell(s.timer.token))
  prior startup(s) + fact dwellElapsed(t) when t == s.timer.token
    => derive(change(novice({ menu: rootMenu, center: s.origin,
                              stroke: s.stroke, nextToken: s.nextToken })))
       .causes(open(rootMenu, s.origin))
  prior startup(s) + fact dwellElapsed(t) when t != s.timer.token => derive(none)
  prior startup(s) + fact up(p)
    => derive(change(idle({ nextToken: s.nextToken })))
       .causes(cancelDwell(s.timer.token), selected(finish(s, p)))
  prior startup(s) + fact cancel(p)
    => derive(change(idle({ nextToken: s.nextToken })))
       .causes(cancelDwell(s.timer.token), cancelled(p))
  prior expert(s) + fact move(p)
    => derive(update(expert({ ...s, stroke: append(s.stroke, p) })))
  prior expert(s) + fact up(p)
    => derive(change(idle({ nextToken: s.nextToken })))
       .causes(selected(finish(s, p)))
  prior expert(s) + fact cancel(p)
    => derive(change(idle({ nextToken: s.nextToken }))).causes(cancelled(p))
  prior novice(s) + fact move(p)
    => derive(update(novice({ ...s, stroke: append(s.stroke, p) })))
  prior novice(s) + fact up(p)
    => derive(change(idle({ nextToken: s.nextToken })))
       .causes(selected(finish(s, p)))
  prior novice(s) + fact cancel(p)
    => derive(change(idle({ nextToken: s.nextToken }))).causes(cancelled(p))
  prior any + otherwise => derive(none)
`

const effects = compensatingEffects({
	start: reversible(publishStart, retractStart),
	scheduleDwell: reversible(scheduleDwell, cancelPendingOrRetractElapsed),
	cancelDwell: reversible(cancelDwell, restoreCancelledSchedule),
	open: reversible(openMenu, closeOpenedMenu),
	selected: reversible(publishSelected, retractSelected),
	cancelled: reversible(publishCancelled, retractCancelled),
})

const facts = interpretation.facts(
	system.at(0).assert(initial(idle({ nextToken: 7 }))),
)

function reconcile() {
	for (const revision of interpretation.reinterpret(facts)) {
		for (const effect of revision.withdrawnEffects) effects.compensate(effect)
		for (const effect of revision.addedEffects) effects.materialize(effect)
	}
}

const downFact = facts.assert(pointer, at(10), down(p0))
reconcile()
facts.assert(timer, at(300), dwellElapsed(7))
reconcile()
facts.assert(pointer, at(310), up(p1))
reconcile()

const lateMove = facts.assert(pointer, at(200), move(pFar))
reconcile() // Withdraw novice open/selection; derive expert cancellation/selection.
facts.retract(lateMove)
reconcile() // Restore the novice derivation and its effects.
facts.retract(downFact)
reconcile() // Compensate the entire interaction.
```

**How to read it:** Active timestamped facts and their provenance graph are the
source data; current typestate is a query result. Assertion or retraction
replays the ordered facts through distinct `none`, `update`, and `change`
outcomes. Reinterpretation emits consequence deltas, and only then does
`reconcile` compensate withdrawn effects and materialize new ones.

**What this makes concrete:** Control state and effect obligations are
retractable derivations rather than irreversible committed history.

**Mechanism:** The source of truth is a provenance graph of retractable facts, so state is a query result and retroactive transitions invalidate derivations while emitting inverse deltas for previously materialized consequences.

**Unlocks:** Late evidence can rewrite past typestate and drive targeted compensation without erasing the audit trail.

**Largest unknown:** How can consumers hold truthful typestate while reinterpretation is still propagating?

**Human response:** _Pending._

**Follow-up request:** _Pending._

Edit reactions directly into each card's **Human response** and **Follow-up request** fields so feedback remains on disk.
