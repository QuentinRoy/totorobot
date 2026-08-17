# Rival baseline: async / un-inverted sequential code

Brief section 4, item 1; synthesis finding 14 ("the strongest untested
competitor"). Both required machines are written here as ordinary sequential
control flow driven by an awaitable input channel, with **no state names in the
control flow** wherever the shape allows it.

| File         | What it is                                                        |
| ------------ | ----------------------------------------------------------------- |
| `harness.ts` | the input channel + injectable clock. **Baseline cost.**          |
| `neutral.ts` | the document-publication machine (`empty/draft/review/published`) |
| `case1.ts`   | the reduced Marking Menu                                          |
| `toggle.ts`  | Case 2, the ceremony floor                                        |

## What was actually run

```
pnpm exec prettier --write explorations/candidates/baselines/sequential/*.ts
pnpm exec tsc -p explorations/candidates/baselines/sequential/tsconfig.json
  -> TypeScript: No errors found   (exit 0)
pnpm exec node explorations/candidates/baselines/sequential/toggle.ts
  -> toggle.ts: all checks passed -> off on off on
pnpm exec node explorations/candidates/baselines/sequential/neutral.ts
  -> neutral.ts: all checks passed -> empty draft draft review draft review draft empty draft published
pnpm exec node explorations/candidates/baselines/sequential/case1.ts
  -> case1.ts: all traces passed
```

Every claim below about behaviour is backed by an assertion in one of those
three runs (`if (a !== b) throw`, via `check()` in `harness.ts`).

## Line accounting (Prettier-formatted, code lines excluding blanks/comments)

| Piece                                | Lines  |
| ------------------------------------ | ------ |
| channel harness (`createChannel`)    | 45     |
| clock harness (`createManualClock`)  | 29     |
| **fixed baseline cost**              | **74** |
| toggle machine                       | 12     |
| neutral machine body                 | 62     |
| neutral `DocInput` union             | 16     |
| neutral `Commit` union (observation) | 14     |
| Case 1 machine body                  | 66     |
| Case 1 `MenuInput` + `Effects`       | 13     |

The 74-line harness is charged to the baseline and to nothing else: sequential
code cannot exist without something that turns pushed events into awaitable
values, and without something that owns the timer it races. A `switch` baseline
pays neither.

## The three questions the task asked

### 1. The dwell timer race and the stale `dwellElapsed`

**`dwellElapsed` stops being an input.** In `case1.ts` the dwell is a `Timer`
the code owns and races at exactly one lexical place:

```ts
const winner = await Promise.race([
	input.peek().then(() => 'input' as const),
	dwell.elapsed.then(() => 'dwell' as const),
])
```

Consequences, all of them real:

- **`timerToken` and `nextToken` disappear from the state data entirely.** The
  Case 1 spec gives every state a `nextToken` and gives `startup` a
  `timerToken`. This baseline has neither and does not need them.
- **Staleness becomes structurally impossible rather than filtered.** Once
  control leaves the `startup` block nothing is awaiting `dwell.elapsed`, so a
  late timer resolves a promise no one reads. `createManualClock` deliberately
  still fires cancelled timers, and `case1.ts` trace 3 fires one after entering
  `expert` and asserts the effect log is unchanged. This is the single
  strongest result in the whole baseline: the token is not made cheap, it is
  made unnecessary.
- **But the win is conditional on owning the timer.** If `dwellElapsed(token)`
  stayed an external input, sequential code needs _exactly_ the same token as
  the FSM: `down -> far move -> up -> down` starts a second `startup` block
  while the first timer is still in flight, and only a token distinguishes
  them. So the finding is about **timer ownership**, not about sequential
  control flow — a `switch` machine that owns its timer gets the same benefit.
- **Cancellation does not disappear; it moves.** `startup` has four exit paths
  (dwell wins, far move, up, cancel) and every one must release the timer. The
  sequential form gets `try { ... } finally { dwell.cancel() }` — one location,
  which is genuinely better than four explicit cancels. That is a real,
  narrow win for language-level scoping.

### 2. "An input unavailable in the current state produces no transition"

It is expressed by **absence plus a comment**, and it is not checked anywhere.

- `case1.ts`: each block is a chain of `if (ev.type === ...)`; an input with no
  branch falls off the end of the loop body and is silently discarded. The only
  record that this was intentional is the line
  `// 'down' is unavailable in startup: no transition.`
- `neutral.ts`: the same role is played by `default: continue draft` and
  `default: continue review`. A `default` clause cannot say _which_ inputs it
  is refusing, so the machine's unavailability table is not readable from the
  source at all.
- `empty` needs a different shape again (`while (start.type !== 'open')`)
  because the loop head is a commit point.
- Delete a branch by accident and nothing complains: the input is now silently
  ignored instead of handled. There is no exhaustiveness pressure, because the
  "handle nothing else" case is legal and common.

**Negative evidence, measured.** A temporary probe file (created, checked,
deleted; the shipped project is clean) established:

```
probe.ts(32,9): error TS2339: Property 'state' does not exist on type 'Promise<never>'.
probe.ts(41,24): error TS2448: Block-scoped variable 'draftText' used before its declaration.
probe.ts(41,24): error TS2454: Variable 'draftText' is used before being assigned.
probe.ts(47,32): error TS2339: Property 'reviewer' does not exist on type '{ readonly type: "submit"; readonly to: "publish"; }'.
```

Note what is _not_ in that list: `menu.push({ type: 'move', point: [0, 0] })`
against a machine sitting in `idle`, and `doc.push({ type: 'decide', verdict:
'approve' })` against a machine sitting in `empty`. Both compile with **zero**
errors. **Per-state capabilities are not enforced at the send site in any
form** — `push` accepts the whole input union always. This baseline scores zero
on the one property the brief (section 4, closing) identifies as the gap the
library exists to fill.

The two errors that _do_ fire are worth recording as the baseline's genuine
type strength: lexical scoping enforces per-state data reachability for free
(TS2448/TS2454 — `draft` data is unreadable at the `empty` await point because
it has not been declared yet), and discriminated-union narrowing gives exact
per-input data (TS2339 on `submit(publish).reviewer`).

### 3. Can a caller observe the current abstract state?

**No.** The abstract state is the program counter, and JavaScript cannot reify
it. `runMarkingMenu` returns `Promise<never>`; `runDocument` returns
`Promise<void>`. There is nothing to read (`probe.ts(32,9)` above).

To make the neutral machine usable at all — a document workflow whose UI cannot
tell whether it is in review is not a serious answer — `neutral.ts` has to
announce every commit through an `emit` callback, and that forces a
hand-written `Commit` union:

```ts
export type Commit =
	| { readonly phase: 'empty' }
	| { readonly phase: 'draft'; readonly text: string; readonly revision: number }
	| { readonly phase: 'review'; ...; readonly reviewer: string }
	| { readonly phase: 'published'; readonly doc: readonly [string, number] }
```

That is 14 lines of **a separately declared state-to-data map that behaviour
merely happens to satisfy** — the exact shape brief section 7 lists as
known-bad, and the reason XState removed typestates. Nothing checks it against
the control flow. It is not a design choice here; it is the only way out.

It also costs precision at the _commit_ points. The loop head is not a
transition point: `continue draft` is used both for "declined revise, no
transition" and for "same-state update", so `emit` cannot live at the loop head
and must be repeated at all eight commit sites instead. Miss one and the state
silently stops being observable, with no diagnostic.

`case1.ts` deliberately does **not** pay this cost, because an interaction
technique communicates through effects rather than through an observable state.
That asymmetry is most of the split below.

## Section 4.1: where this baseline is strong and where it is weak

The brief predicted the profile would split. It does, sharply, and the split is
larger than the section-4.1 text suggests.

**Strong on Case 1** — because the Marking Menu really is a sequence:

- The three phases read top to bottom in the order they happen. No dispatch, no
  reinstatement of context, no "what was I doing".
- Per-state data is lexical scope. `origin` exists from the press onward;
  `opened` only after the dwell. Nothing needs declaring twice.
- The dwell race and its cancellation are three lines and one `finally`.
- `nextToken`/`timerToken` vanish (above).
- Editing task 2 ("add `activeItem` to `novice` and update every path entering
  it") is a **one-location** edit, because `novice` is entered at exactly one
  place. The FSM formulations have to touch every incoming edge.

**Weak on Case 1 anyway** — two costs the brief did not predict:

- `startup` has three outgoing edges to three different targets, and `break`
  has exactly one destination. I had to introduce `let opened: Menu | null` to
  record _which_ state was entered. That is a state tag under another name, and
  it is unchecked. Section 5.2 flags `startup.move` as the multi-target
  transition that discriminates between encodings; the sequential form fails it
  by reintroducing a variable.
- `expert` and `novice` have identical control flow and different data, so they
  collapse into one `active:` loop. That is a genuine deduplication _and_ a
  genuine loss: **nothing in the source says there are two states there.** A
  reader asked "what can I do in `novice`?" has to first work out that `novice`
  exists.

**Weak on the neutral machine** — as predicted, and for the predicted reason:

- The nesting only works because this graph happens to be **reducible**: every
  back edge (`review -> draft`, `draft -> empty`, `review -> empty`) targets a
  lexical ancestor, so a labelled `continue` reaches it. Add one edge that is
  not — `empty --restore--> review`, say — and **no arrangement of loops
  expresses it.** You are forced back to a top-level dispatch loop, which is
  the `switch` baseline with async overhead bolted on. The baseline is one
  requirement change away from collapsing, and nothing warns you.
- `review` is a switch nested inside `case 'submit'` of the `draft` switch,
  four levels deep. Its data is legible (`reviewer` is in scope) but its
  identity is not.
- The same input in different states is at different indentation depths in
  different switches: `revise` appears twice, `cancel` twice, and answering "in
  what states can I do `revise`?" requires grepping and then computing lexical
  depth by hand.
- `published` is a `return`. The spec says a broad input in `published`
  produces "no transition: unavailable"; here the machine has simply ceased to
  exist, the input is queued forever, and no caller can distinguish that from a
  hang. `neutral.ts` asserts the observable behaviour matches; the _reason_ it
  matches is not the spec's reason.
- Adding a field to one state's data touches six locations (below).

**Verdict on the split.** On Case 1 this baseline is competitive with anything
in the round on authoring comfort and beats every FSM formulation on the timer.
On the neutral machine it is worse than a plain `switch` on every axis except
per-state data scoping, and it is worse than every FSM candidate on
observability, because it has none. Per the brief's instruction: this baseline
does **not** beat every candidate on both machines, so it is not the verdict.
But its Case 1 timer result is a real finding and should be adopted rather than
argued around: **the library should own timers, and a state-scoped owned timer
removes the token from Case 1 for the FSM formulation too.**

## Scores

| Axis           | Rating | Why (visible in the formatted source)                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** state?   | bad    | No state value exists; `runDocument` returns `Promise<void>` and a probe for `.state` gives TS2339. Inside the function your cursor answers it; nowhere else can.                                                                                                                                                                                                  |
| **B** in X?    | good   | A block lists its own inputs and nothing else (`startup:` in `case1.ts` shows dwell/move/up/cancel together). Grouping is by indentation rather than a key, so it degrades with block length, and unavailable inputs are a comment.                                                                                                                                |
| **C** where Z? | bad    | `revise` sits at two different depths in two different switches in `neutral.ts`; `move` in three blocks in `case1.ts`. No column to scan; you must compute lexical nesting to name the state each occurrence belongs to.                                                                                                                                           |
| **D** X to Y?  | bad    | Entering a nested state has **no syntactic marker at all** (`review` begins by falling into `case 'submit'`). `break startup` names the loop being left, not the target, and does so twice with two different targets.                                                                                                                                             |
| **Arrow test** | bad    | Source = indentation (partially rescued by loop labels), input = a subexpression in an `if`/`case`, outcome kind = **not recoverable** (`continue startup` means both "same-state update" and, by falling off the body, "no transition"), target = only for back-edges via `continue <label>`. Everything requires reading bodies, because everything _is_ a body. |

`continue empty` / `continue draft` are the one place this baseline does pass
the arrow test — a labelled continue puts a checked target name at a fixed
syntactic position, and the compiler rejects an unknown label. That is worth
stealing as an argument that _checked, visible, single-token targets_ are
achievable. It only ever covers back-edges to ancestors.

### Ceremony floor (Case 2)

12 formatted code lines for the machine, plus the 45-line channel harness it
cannot run without. Distinct concepts: (1) an awaitable input channel with
push/peek/drop/next, (2) `async` + `await` as the read primitive, (3) an
unbounded loop, (4) a mutable boolean, (5) an observation callback, (6) state
names as bare emitted string literals. Six concepts for "flip".

The honest reading is worse than the number: **there is no sequence in a
toggle.** `off -> on -> off` has no beginning, middle or end, so every piece of
async machinery is pure overhead, and the machine degenerates to `on = !on`.
Without the requirement to be driven by pushed inputs, the whole thing is one
line. The baseline's ceremony floor is therefore not 12 lines but 12 + 45, and
it buys nothing at this size.

### Edit locality

Counted on `neutral.ts` unless stated. "Locations" = distinct source places
that change.

| Edit                             | Locations | Repeated facts | Note                                                                                                                                                                                                                                                     |
| -------------------------------- | --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E1** add a state               | 3         | 2              | `DocInput`, `Commit`, one new nested loop — **only if the new state's edges nest.** If it is reachable from two non-nested places, the whole function is rewritten.                                                                                      |
| **E2** add a transition          | 1         | 1              | One `case` + `continue <ancestor>` when the target is an ancestor or terminal. If the target is a lexical _sibling_, it is not expressible: 3+ locations plus a new tag variable, as `opened` already shows in `case1.ts`.                               |
| **E3** add a field to state data | 6         | 5              | Worst edit. `Commit` variant + the local declaration + **all four** `emit({ phase: 'draft', … })` sites. In `case1.ts`, which has no observation, the same edit is ~2 locations and 0 repeats — the cost is entirely the hand-written state-to-data map. |
| **E4** retarget a transition     | 1         | 1              | `continue empty` -> `emit(...); return` is one token-ish edit and the label is a fixed position. Retargeting _into_ a non-ancestor (`empty --open--> review`) cannot be written at all without moving the block.                                         |
| **E5** rename an input           | 3         | 3              | Union member + 2 `case` labels. No rename support (measured fact 5.3), but the compiler finds every stale site: **TS2678** for a dead `case`, **TS2367** for a dead `if (x.type === ...)`. Verified with a probe.                                        |

## Weaknesses (the list)

1. **Zero per-state capability enforcement.** `push` takes the full input union
   from every state. Verified: pushing `move` at `idle` and `decide` at `empty`
   both compile clean.
2. **No observable state.** `Promise<never>` / `Promise<void>`. Any observation
   requires a hand-written state-to-data map that nothing checks — the exact
   known-bad shape from brief section 7.
3. **Outcome kinds are not distinguishable in the source.** "no transition",
   "same-state update" and "change" are all spelled `continue <label>` or
   nothing at all.
4. **Structural fragility.** Correctness of the whole shape depends on the state
   graph being reducible. One non-nesting edge and it collapses to a dispatch
   loop. Nothing detects this; you find out when you try to write the edge.
5. **Multi-target transitions need a tag variable** (`opened`), which is an
   unchecked state name reintroduced through the back door.
6. **Merged states are invisible.** `expert` and `novice` are one loop; the
   source does not admit there are two states.
7. **Unavailable inputs are silent.** No exhaustiveness pressure; a deleted
   branch becomes a silently ignored input.
8. **A 74-line harness before any behaviour**, and a subtle one: `peek`/`drop`
   exist only so that losing a `Promise.race` does not swallow the next input.
   Writing `input.next()` inside the race instead is a silent input-loss bug
   that no type catches. That trap is intrinsic to racing an async iterator.
9. **Terminal states are `return`**, which is stronger than terminality:
   the machine stops existing and cannot report a refusal.
10. **Testing needs an injected clock and a `settle()` pump.** Deterministic,
    but every assertion is separated from its cause by an `await`, so failures
    report the wrong place.
11. **Nothing to serialise, inspect, visualise or replay.** There is no
    transition record, so the "source/input/target correlation whenever it
    exposes a transition record" requirement is vacuously met by exposing none.
