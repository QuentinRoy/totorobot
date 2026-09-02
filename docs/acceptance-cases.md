# FSM API acceptance cases

These cases are totorobot's conformance spec: behavior and evaluation tasks
the shipped library must keep passing, described independent of any one API
notation, state owner, dispatch mechanism, or effect representation.

## Effect placement

Effect representation is open, but where a given effect goes follows two
ordered rules:

1. **Internal and self-contained goes in `actions`. External — anything
   interacting with the world — goes to `observe`.**
2. Within `actions`, shape follows lifetime: **a residency for something with
   a lifetime, an edge for something that is a moment.**

Rule 2 only decides shape once rule 1 has judged something internal. Cases 1
and 3 apply both below.

## Case 1: Reduced Marking Menu

This is the primary acceptance case. It is distilled from Marking Menu commit
[`7fb63a59fa55a4ad6de416000843d079388cbf56`](https://github.com/QuentinRoy/Marking-Menu/commit/7fb63a59fa55a4ad6de416000843d079388cbf56),
particularly its pinned
[`machine.ts`](https://github.com/QuentinRoy/Marking-Menu/blob/7fb63a59fa55a4ad6de416000843d079388cbf56/src/engine/machine.ts)
and
[`runtime.ts`](https://github.com/QuentinRoy/Marking-Menu/blob/7fb63a59fa55a4ad6de416000843d079388cbf56/src/engine/runtime.ts).
The local behavior below is normative; the pin records provenance rather than
acting as an executable oracle. The reduced case deliberately completes
`novice.move` as a same-state stroke update although the pinned implementation
still treats novice hit-testing as unfinished. Runtime queueing and disposal
follow the requirements in this repository, not incidental behavior in the
pinned runtime. The local fixture remains stable if the source project changes.

Menu data is recursive:

```ts
type Item = { readonly label: string }
type Menu = {
	readonly label: string
	readonly children: readonly (Item | Menu)[]
}
```

### States

| State     | State-specific data                          |
| --------- | -------------------------------------------- |
| `idle`    | none                                         |
| `startup` | `origin`, `stroke`                           |
| `expert`  | `stroke`                                     |
| `novice`  | current recursive `menu`, `center`, `stroke` |

`idle` carries no data: with no caller-owned token to track, it has nothing
left to store.

> **Note, 2026-08-31 — the tokens stood until `actions` landed (#83).** The
> `startup` residency below, whose teardown cancels the dwell, is what
> replaced them; see [design-record.md, §10](design-record.md#revision-the-composition-boundary).

### Inputs and outcomes

| Current state | Input                    | Outcome                                                   |
| ------------- | ------------------------ | --------------------------------------------------------- |
| `idle`        | `down(point)`            | Enter `startup`; start interaction and schedule the dwell |
| `startup`     | `move(point)` nearby     | Commit a same-state stroke update                         |
| `startup`     | `move(point)` far enough | Enter `expert`; leaving `startup` cancels the dwell       |
| `startup`     | `dwellElapsed`           | Enter `novice`; open the root menu                        |
| active state  | `up(point)`              | Enter `idle`; finish; leaving `startup` cancels the dwell |
| active state  | `cancel(point)`          | Enter `idle`; cancel; leaving `startup` cancels the dwell |
| `expert`      | `move(point)`            | Commit a same-state stroke update                         |
| `novice`      | `move(point)`            | Commit a same-state stroke update                         |
| any state     | unavailable input        | No transition                                             |

`startup`, `expert`, and `novice` are active states. Distance calculation,
stroke append, menu hit-testing, and finish behavior are ordinary domain
helpers rather than library features.

Applied to [rule 1](#effect-placement), only the dwell is internal — nothing
outside the machine needs to know it is pending. It is therefore a `startup`
residency, per rule 2: something with a lifetime, scoped to the state that
owns it. Interaction feedback, menu display, and selection/cancellation
reporting are all external and stay `.observe()` observers.

### Required traces

1. `down(p0)` from `idle` enters `startup(origin: p0, stroke: [p0])`, reports
   start, and schedules the dwell.
2. A nearby `move(p1)` commits a `startup` stroke update. The dwell elapsing
   then enters `novice` and reports open.
3. In a fresh execution, a far `move(p2)` enters `expert`, and the `startup`
   residency's teardown cancels the dwell.
4. `cancel(p)` from `startup` returns to `idle`, cancels the dwell via the
   residency's teardown, and reports cancellation.
5. An input unavailable in the current state produces no transition, not a
   same-state update.

totorobot preserves precise state data and capabilities when a state is
known, target-data checking during evolution, and source/input/target
correlation whenever it exposes a transition record.

## Case 2: Two-state ceremony floor

`off` and `on` carry no state data. Each exposes `toggle`, which enters the
other state. The initial state is `off`.

This case checks that typestates without data need no placeholder object and
that the smallest useful machine is not dominated by declarations, lifecycle
configuration, or runtime setup unrelated to its behavior.

## Case 3: Asynchronous request race

### States

| State     | State-specific data                             |
| --------- | ----------------------------------------------- |
| `idle`    | `nextRequestId`                                 |
| `loading` | `requestId`, `nextRequestId`, latest `progress` |
| `success` | `result`, `nextRequestId`                       |
| `failure` | `error`, `nextRequestId`                        |

Inputs are `start`, `progress(requestId, value)`,
`succeed(requestId, result)`, `fail(requestId, error)`, `cancel`, and `reset`.
Starting from `idle` enters `loading` with the next request identity and begins
work after the decision while incrementing `nextRequestId`. The initial
`progress` is `0`. Matching progress commits a same-state update; matching
success or failure enters the corresponding state. Cancellation returns to
`idle` with the incremented `nextRequestId` and makes the work unable to affect
later evolution. Success and failure retain that next identity and can reset to
`idle` with it.

Like the dwell, the request is internal, so it lives in a `loading` residency
that owns an `AbortController`; its teardown aborts on any departure. Unlike
Case 1's timer, `requestId` stays: `clearTimeout` retracts a pending callback
outright, so once the dwell's timer is cancelled nothing can arrive at all —
but `abort()` does not retract a promise that has already settled, so a stale
`succeed` for an already-cancelled request can still arrive. `requestId` is
the guard that makes that arrival free. Residencies do not delete
identity-guarding everywhere; only where the cancellation itself is what
retracts the callback, as it does for Case 1's timer.

The required race is:

1. Start request `0`.
2. Cancel request `0`.
3. Start request `1`.
4. Receive success for request `0`; produce no transition.
5. Receive success for request `1`; enter `success` with its result.

**Tests must control settlement and must not depend on wall-clock timing** —
for Case 1's dwell as much as for Case 3's request.

## Case 4: Twenty-state type stress

Define states `s00` through `s19`. State `sNN` owns data
`{ visits: number; owner: "sNN" }`.

- The initial value is `s00 { visits: 0, owner: "s00" }`.
- `next(delta)` enters the next numbered state, wrapping `s19` to `s00`, adds
  `delta` to `visits`, and supplies the target's exact `owner` literal.
- `reset` enters `s00 { visits: 0, owner: "s00" }` from every state. From
  `s00`, this is an intentional same-state update, not re-entry.
- `s00`, `s05`, `s10`, and `s15` also expose `skip`, which advances five
  states, adds `1` to `visits`, and supplies the target's exact `owner`.

This gives 20 states and 44 transitions without effects. It measures formatted
source readability, target-data diagnostics, declaration size, type-checking,
and editor responsiveness rather than runtime throughput.

## Live-runtime traces

1. An observer of the two-state case submits a second `toggle` while observing
   `off` to `on`. The first commit and observation cycle finishes before the
   queued input is applied to `on`, producing `on` to `off`. The outermost
   `toggle` call returns only after that queue drains.
2. Leaving `loading` in the asynchronous case, for any reason, tears its
   residency down: the request's `AbortController` is aborted and its work
   can no longer affect later evolution. There is no separate `stop()`
   (README.md:533), and none is wanted — a caller disposes of a machine by no
   longer sending to it and unsubscribing its observers, and a state with no
   declared rows silently ignores whatever still arrives, which is the
   disposed outcome for a design that models one.

totorobot's commit ordering — teardown of the residency being left, the
commit, matching actions in declaration order, then observers — covers effect,
observation, and nested-submission ordering for every trace above. No trace
exposes half-applied state or silently appears to process a rejected input.

## Shared evaluation tasks

Use the repository's pinned TypeScript and Prettier versions. These are DX
regression checks: run them against the shipped library and treat a
regression as a regression to fix, not a number to update quietly.

### Comprehension

1. Identify each `startup` input and possible outcome without tracing unrelated
   implementation code.
2. Explain why no stale dwell can arrive at all.
3. Predict the state and effects after each required trace.

### Editing

1. Add an `escape` capability that cancels any active Marking Menu interaction.
2. Add required `activeItem` data to `novice` and update every path entering it.
3. Change `s10` so `next` enters `s12` while preserving exact target data.
4. Move the dwell back out to the caller: undeclare the `startup` residency
   and schedule it from outside instead.

Record whether each edit is correct, which source locations change, and
whether the same fact must be updated more than once. Edit 4 additionally
exercises the stranded-teardown diagnostic — only a residency may return a
teardown, so a first attempt that leaves it on an edge is a compile error
(README.md:346) — and is otherwise a hand test of the [internal/external
line](#effect-placement) above.

### Diagnostics

Capture diagnostics for an invalid source-data read, unavailable capability,
unknown target, wrong target-state data, and an incomplete implementation
relative to the machine's declared source of truth. Compare the location and
useful explanation, not merely whether compilation fails.

### Measurements

The pointer workload is 10,000 independent interactions. Each performs
`down`, one far `move`, 32 `expert` moves, then `up`, using a fixed point list
and no-op effect adapters. Measure transition computation separately from the
library-owned live runtime.

Pin and record the benchmark repository revision, hardware, operating system,
JavaScript runtime or browser, bundler and minifier, options, warm-up count,
sample count, and summary statistic alongside every reported run. Bundle the
code needed by Cases 1-3 through totorobot's ordinary ESM entry point and
report raw, minified, and gzip-compressed sizes.

For the 20-state case, record emitted declaration size, cold TypeScript check
duration, and language-server completion and diagnostic latency using isolated
projects and the repository's pinned TypeScript version. These measurements
are the regression thresholds the checks above watch going forward.
