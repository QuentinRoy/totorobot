# FSM API acceptance cases

These cases provide common evidence for comparing coherent API candidates. They
describe behavior and evaluation tasks, not an API notation, state owner,
dispatch mechanism, or effect representation.

Early seeds do not need to cover them. Coherent candidates cover Cases 1-3;
finalists also cover Case 4 and the shared evaluation tasks.

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

| State     | State-specific data                                       |
| --------- | --------------------------------------------------------- |
| `idle`    | `nextToken`                                               |
| `startup` | `origin`, `stroke`, owned `timerToken`, `nextToken`       |
| `expert`  | `stroke`, `nextToken`                                     |
| `novice`  | current recursive `menu`, `center`, `stroke`, `nextToken` |

> **Note, 2026-08-19 — the tokens are an artefact of external timing.** They are
> correct as written, because v1 has no way for a machine to own an effect. But
> a prototype where the machine schedules its own dwell, and the cancel returned
> by the timer _is_ the residency teardown, removes them: leaving `startup`
> cancels the timer, so a stale `dwell` cannot arrive, and neither `timerToken`
> nor `nextToken` has anything left to guard
> (`explorations/composition/ex1-marking-menu/`,
> [design-record.md, §10](design-record.md#revision-the-composition-boundary)).
>
> The case stays as it is — it is normative for v1, and the bookkeeping it
> forces is a fair test of what v1 costs. Worth revisiting when `actions` lands,
> because passing it will then look different.

### Inputs and outcomes

| Current state | Input                    | Outcome                                                   |
| ------------- | ------------------------ | --------------------------------------------------------- |
| `idle`        | `down(point)`            | Enter `startup`; start interaction and schedule dwell     |
| `startup`     | `move(point)` nearby     | Commit a same-state stroke update                         |
| `startup`     | `move(point)` far enough | Enter `expert`; cancel dwell                              |
| `startup`     | matching `dwellElapsed`  | Enter `novice`; open the root menu                        |
| `startup`     | stale `dwellElapsed`     | No transition                                             |
| active state  | `up(point)`              | Enter `idle`; finish; cancel dwell when leaving `startup` |
| active state  | `cancel(point)`          | Enter `idle`; cancel; cancel dwell when leaving `startup` |
| `expert`      | `move(point)`            | Commit a same-state stroke update                         |
| `novice`      | `move(point)`            | Commit a same-state stroke update                         |
| any state     | unavailable input        | No transition                                             |

`startup`, `expert`, and `novice` are active states. Distance calculation,
stroke append, menu hit-testing, and finish behavior are ordinary domain
helpers rather than library features.

Effects occur only after a transition decision. Their representation is open,
but the complete integration must be able to start and finish interaction
feedback, schedule and cancel dwell, open a menu, and report selection or
cancellation. A stale timer callback must not alter state.

### Required traces

1. `down(p0)` from `idle(nextToken: 0)` enters `startup(timerToken: 0,
nextToken: 1)`, reports start, and schedules token `0`.
2. A nearby `move(p1)` commits a `startup` stroke update. A matching
   `dwellElapsed(0)` then enters `novice` and reports open.
3. In a fresh execution, a far `move(p2)` enters `expert` and cancels token
   `0`. A later `dwellElapsed(0)` produces no transition.
4. `cancel(p)` from `startup` returns to `idle`, cancels its dwell work, and
   reports cancellation.
5. An input unavailable in the current state produces no transition, not a
   same-state update.

The candidate must preserve precise state data and capabilities when a state is
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

The required race is:

1. Start request `0`.
2. Cancel request `0`.
3. Start request `1`.
4. Receive success for request `0`; produce no transition.
5. Receive success for request `1`; enter `success` with its result.

The candidate may represent work as returned descriptions, reactions, resource
lifetimes, or another supported integration. Tests must control settlement and
must not depend on wall-clock timing.

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

These traces apply only when a candidate provides a library-owned live
execution:

1. An observer of the two-state case submits a second `toggle` while observing
   `off` to `on`. The first commit and observation cycle finishes before the
   queued input is applied to `on`, producing `on` to `off`. The outermost
   `toggle` call returns only after that queue drains.
2. Disposing the asynchronous case while `loading` makes its work unable to
   affect later evolution, releases library-owned resources, and causes later
   submissions to receive the candidate's documented disposed outcome.

The candidate must record commit, effect, observation, nested-submission, and
disposal ordering. No trace may expose half-applied state or silently appear to
process a rejected input.

## Shared evaluation tasks

Use the repository's pinned TypeScript and Prettier versions. Apply identical
tooling and tasks to every candidate.

### Comprehension

1. Identify each `startup` input and possible outcome without tracing unrelated
   implementation code.
2. Explain why the stale dwell trace cannot enter `novice`.
3. Predict the state and effects after each required trace.

### Editing

1. Add an `escape` capability that cancels any active Marking Menu interaction.
2. Add required `activeItem` data to `novice` and update every path entering it.
3. Change `s10` so `next` enters `s12` while preserving exact target data.

Record whether each edit is correct, which source locations change, and whether
the same fact must be updated more than once.

### Diagnostics

Capture diagnostics for an invalid source-data read, unavailable capability,
unknown target, wrong target-state data, and an incomplete implementation
relative to the candidate's source of truth. Compare the location and useful
explanation, not merely whether compilation fails.

### Measurements

The pointer workload is 10,000 independent interactions. Each performs
`down`, one far `move`, 32 `expert` moves, then `up`, using a fixed point list
and no-op effect adapters. Measure transition computation separately from a
library-owned live runtime when both exist.

Before comparing finalists, pin and record the benchmark repository revision,
hardware, operating system, JavaScript runtime or browser, bundler and minifier,
options, warm-up count, sample count, and summary statistic. Bundle the code
needed by Cases 1-3 through each candidate's ordinary ESM entry point and report
raw, minified, and gzip-compressed sizes.

For the 20-state case, record emitted declaration size, cold TypeScript check
duration, and language-server completion and diagnostic latency using isolated
projects and the repository's pinned TypeScript version. Measurements inform
thresholds, which must be fixed before finalists are compared.
