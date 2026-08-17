# Baseline: the Radix lookup table

Brief §4 item 3. One nested `{state: {event: target}}` lookup over a reducer,
**no per-state context in the machine at all**, interaction data in mutable
cells outside it. This is what `radix-ui/primitives`
`packages/react/presence/src/use-state-machine.tsx` actually ships, and what
Radix and Ariakit built the whole accessible widget set on.

## Files

| File         | What it is                                                       |
| ------------ | ---------------------------------------------------------------- |
| `machine.ts` | the Radix kernel, transcribed; `useReducer`/`useRef` as closures |
| `toggle.ts`  | Case 2, the two-state ceremony floor                             |
| `neutral.ts` | the document-publication machine                                 |
| `case1.ts`   | the reduced Marking Menu                                         |

## What I ran

```
$ pnpm exec prettier --check explorations/candidates/baselines/radix-lookup/*.ts
Prettier: All files formatted correctly

$ pnpm exec tsc -p explorations/candidates/baselines/radix-lookup/tsconfig.json
TypeScript: No errors found          (exit 0)

$ pnpm exec node explorations/candidates/baselines/radix-lookup/toggle.ts
toggle.ts: all assertions passed
$ pnpm exec node explorations/candidates/baselines/radix-lookup/neutral.ts
neutral.ts: all assertions passed
$ pnpm exec node explorations/candidates/baselines/radix-lookup/case1.ts
case1.ts: all assertions passed
```

`case1.ts` asserts all five required traces from `acceptance-cases.md`,
including trace 3's stale `dwellElapsed(0)` after entering `expert` and trace
5's "no transition, **not** a same-state update".

## Measured facts (probes I ran, then deleted to keep the project clean)

Two probe files were added to this directory, checked with the pinned `tsc`
7.0.2, and removed. Verbatim output:

**Probe 1 — what the pattern checks.**

```
probe.ts(20,50): error TS2345: Argument of type '{ readonly empty: { readonly open: 'drafft'; }; ... }'
  is not assignable to parameter of type '... & Machine<MachineState<...>>'.
  ... Type '"drafft"' is not assignable to type 'MachineState<...>'. Did you mean '"draft"'?
probe.ts(23,6): error TS2345: Argument of type '"opne"' is not assignable to parameter of
  type 'MachineEvent<{ readonly empty: { readonly open: "draft"; }; ... }>'.
probe.ts(30,44): error TS2345: Argument of type '"emppty"' is not assignable to parameter of
  type 'MachineState<...>'.
probe.ts(34,5): error TS2367: This comparison appears to be unintentional because the types
  'MachineState<...>' and '"reviw"' have no overlap.
```

- Typo'd **target** in the table: **caught**, with a did-you-mean. But the error
  lands on the whole table argument (col 50), not the offending property, after
  a seven-level assignability cascade.
- Typo'd **event** at the send site: **caught**, exact column, no did-you-mean.
- Typo'd **initial state**: caught. Typo'd **state comparison**: caught.
- `send('approve')` where `getState()` is statically `'empty'`: **no error at
  all**. Absent from the output above; that is the finding.

**Probe 2 — per-state precision.**

```
probe2.ts(16,8): error TS2322: Type '{ readonly label: string; } | null' is not assignable
  to type '{ readonly label: string; }'.
probe2.ts(22,8): error TS2322: Type 'number | null' is not assignable to type 'null'.
```

Inside `if (getState() === 'novice')`, `menu.current` is still `Menu | null`.
Inside `if (getState() === 'expert')`, `timerToken.current` is still
`number | null`. Knowing the control state narrows **nothing** about the data.

## Formatted size (Prettier, tabs/no-semi/single-quote, code lines only)

| Unit                       | Lines | Of which the table |
| -------------------------- | ----- | ------------------ |
| kernel (`machine.ts`)      | 26    | —                  |
| toggle definition          | 3     | 1                  |
| neutral machine definition | 93    | 16                 |
| Case 1 definition          | 103   | 12                 |

The topology table is **16 %** of the neutral machine and **12 %** of Case 1.
The other 85 % is data cells, hand-written guards, a caller-side dispatcher and
hand-written effect placement — none of it visible from the beautiful table.

Toggle, in full:

```ts
const toggle = { off: { toggle: 'on' }, on: { toggle: 'off' } } as const
const [getState, send] = createStateMachine('off', toggle)
```

Three distinct concepts: (1) a nested object where the value **is** the target
state name, (2) `as const`, (3) `createStateMachine(initial, table)` returning
`[getState, send]` with string dispatch. Passing the table inline — Radix's own
call shape, which I verified compiles — removes `as const` and leaves two, at
the cost of the table no longer being nameable for the `can()` lookup that both
larger machines need.

## The three consequences the brief asks about

### Per-state data precision: destroyed, and not recoverable

There is nowhere to put per-state data, so every field becomes a cell visible
from every state. In `neutral.ts`, `record` (the `published` tuple) is
`readonly [string, number] | null` while the document is `empty`; `reviewer` is
`string | null` while it is `published`. In `case1.ts` every one of `origin`,
`stroke`, `menu`, `center`, `timerToken` is nullable in all four states.

Two costs follow. Reads need `!` or a null branch at every use, even where the
state makes the value certain — `case1.ts` contains
`distance(origin.current!, point)` and `center.current = origin.current!`.
And writes are unpoliced: nothing connects "entering `novice`" to "`menu` and
`center` must be set". `acceptance-cases.md`'s editing task 2 (add required
`activeItem` to `novice`, update every path entering it) gets **zero** compiler
help; you grep the table for `'novice'` as a value, which the table does make
easy, and then you are on your own.

### The stale dwell token: becomes a cell nothing owns

`timerToken` is `number | null` in `idle`, `expert` and `novice` as well as in
`startup` (verified above). The staleness test is two hand-written lines in the
caller:

```ts
if (getState() !== 'startup') return
if (token !== timerToken.current) return
```

Nothing structural forces either. Trace 3 passes only because I wrote both. The
matching cancellation is worse: "cancel dwell when leaving `startup`" is an
**exit** effect, and the table has no place to attach one, so
`if (getState() === 'startup') cancelDwell()` is written by hand in `up`, in
`cancel`, and again as `if (far) cancelDwell()` inside `move` — three copies of
one fact that the table already knows (three entries whose source is `startup`
and whose target is not).

### "What can I do in state X": perfectly readable, entirely unenforced

The events legal in `X` are literally the keys under `X`, in one contiguous
formatter-stable block. As documentation this is the best answer in the round.
As a guarantee it is nothing: `MachineEvent<M>` is
`keyof UnionToIntersection<M[keyof M]>`, the union of every event in the
machine, so `send` accepts any of them from any state and silently no-ops.
`neutral.ts` asserts this at runtime: `sendRaw('open')` on a machine in
`published` type-checks and returns `'published'`.

Worse, the reducer `machine[state][event] ?? state` is **total**, so its result
cannot distinguish a refusal from a same-state commit. `case1.ts` demonstrates
the collapse directly:

```ts
eq(sendRaw('move'), 'idle', 'raw: refused input returns the current state')
eq(sendRaw('moveNear'), 'startup', 'raw: same-state commit returns the same')
```

Both return an unchanged state name. To satisfy trace 5 at all I had to add a
`can(event)` helper that re-reads the table at the call site — re-deriving the
lookup the reducer just performed and threw away — and gate every data write on
it. That helper is the single largest source of duplication in both files.

### The transition the table cannot hold

A lookup stores exactly one target per `(state, event)` pair, so a
multi-target transition is inexpressible. The neutral machine has two
(`draft + submit`, `review + decide`) and Case 1 has the brief's own
discriminating example (`startup + move`). The Radix answer — and Radix's real
one, `ANIMATION_OUT` vs `ANIMATION_END` — is to **split the event** and move the
decision to the caller. So:

- `submit` and `decide` do not exist as machine events. The table's `INPUT`
  column holds `submitToReview` / `submitToPublish` / `approve` / `reject`,
  names invented for the encoding.
- `move` is spelled three ways (`moveNear`, `moveFar`, `move`), and choosing
  between them requires knowing the current state, so `case1.ts` contains

  ```ts
  const state = getState()
  if (state === 'startup') { ... } else if (state === 'expert' || state === 'novice') { ... }
  ```

  a `switch` over the very state the table already dispatched on. The
  centralisation a machine exists to provide is given back at the call site.

Likewise `draft + revise` is one table entry, `revise: 'draft'`, covering both
the refusal (text unchanged) and the same-state update. A reader who trusts the
arrows gets that row and `startup + move` wrong.

## Score

| Question                           | Rating        |
| ---------------------------------- | ------------- |
| A — what abstract state is this in | **good**      |
| B — what can I do in state X       | **good**      |
| C — in what states can I do Z      | **good**      |
| D — how do I get from X to Y       | **excellent** |
| Arrow test                         | **excellent** |

- **A (good).** `getState()` returns a nameable literal union; a typo'd
  comparison is TS2367 (verified). But narrowing the name narrows nothing else
  (TS2322 probe), so "which state" and "what that means" come apart.
- **B (good).** The keys under a state key are the answer, in one block, with
  no bodies. Zero enforcement at the send site, and in Case 1 the block lists
  split pseudo-events rather than real inputs.
- **C (good).** Scan an event name down the table; `up: 'idle'` appears under
  `startup`, `expert`, `novice`. Degraded by splitting: grepping `move` finds
  three different names and `submit` finds nothing.
- **D (excellent).** The target **is** the value. There are no bodies to read,
  ever. `grep "'expert'"` gives every inbound transition; a state's block gives
  every outbound target. Nothing in this round will beat it.
- **Arrow test (excellent, with a caveat that matters).** Source is the outer
  key, input the inner key, target the value, and outcome kind is
  value-vs-enclosing-key (`change` if different, `update` if equal, `none` by
  absence of the key). All four at fixed positions, after Prettier, with no body
  anywhere. This is jssm's win with target checking attached — and the same
  lesson applies: the arrows that _are_ there are perfect, and the arrows that
  cannot be there (multi-target, guarded refusal) are silently missing.

### Ceremony floor

2 definition lines, 3 distinct concepts, 26 lines of amortised kernel. Against
`propositions.md`'s ~14 lines and against SwingStates' ~4 lines per state, this
is the floor. Nothing that adds per-state data types will reach it.

### Edit locality

| Edit                        | Locations | Repeated facts | Note                                                                                                                    |
| --------------------------- | --------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| E1 add a state              | 4         | 2              | table (2 spots), a new cell, a new dispatcher method, plus every `state === …` branch list — the compiler flags none    |
| E2 add a transition         | 2         | 1              | one table line + one dispatcher method; the event name is written 3× (`key`, `can('x')`, `send('x')`), 2 of 3 checked   |
| E3 add a field to one state | 3–4       | 1              | new cell, set it on every inbound path, clear it in `clear()`, expose it; nullability re-asserted at every read forever |
| E4 retarget a transition    | 1         | 0              | **best result in the round** — one token, statically checked with did-you-mean; and silently wrong, see below           |
| E5 rename an input          | 2–3       | 1              | table key(s) + `send(…)` + `can(…)`; all compile-checked (TS2345), so the rename is safe if tedious                     |

E4 deserves its own sentence. Changing `moveFar: 'expert'` to `'novice'` is one
token, checked, with a suggestion on a typo. It also compiles clean while being
wrong, because `novice` needs `menu` and `center` set and `move` does not set
them. One location changed, one location silently missed. That is the whole
trade in miniature: the topology edit is the cheapest possible, and the data
consequence of the topology edit is invisible.

## §4.1 split analysis: where this baseline is strong and weak, on both machines

The brief predicts the sequential baseline wins on Case 1 and loses on the
neutral machine, and the `switch` baseline the reverse. **This baseline does not
split by machine shape at all.** It splits by how much per-state data a machine
carries.

**On the neutral machine — strong.** The terminal state is `published: {}`, free.
"Unavailable input in any state → no transition" is free and total, covering the
last row of the behaviour table with no code. `cancel: 'empty'` appears under
`draft` and `review` at the same syntactic position, so the shared-input row is
two lines. Sixteen formatted lines carry a topology that reads like the diagram.
Re-entry from several sources — the shape §4.1 says breaks the sequential
baseline — costs this one nothing at all, because a lookup table is indexed by
source.

**On the neutral machine — weak.** Two of ten behaviour rows are multi-target
and force the input vocabulary to be rewritten. One row (`draft + revise`) needs
a guard the table cannot express. The `published` tuple and the `review`
reviewer are nullable cells readable from `empty`.

**On Case 1 — strong.** The `up`/`cancel`-from-any-active-state rows are three
one-line entries each; a same-state stroke update is `move: 'expert'`, with no
`keep_state` vocabulary and no fourth outcome member — exactly where a
sequential/generator baseline has to invent a loop-with-accumulator and where
the outcome algebra costs other designs vocabulary. Recursive menu data is a
plain `Menu | null` cell and costs nothing, because it never touches the machine.

**On Case 1 — weak.** `startup + move` is the discriminating multi-target
transition and cannot exist; the split forces a caller-side switch on
`getState()`. Timing has no owner: the dwell token is statically live in all
four states and its cancellation is hand-copied three times. Per-state data is
five nullable cells where the spec names four disjoint records.

**The honest generalisation.** Radix's quality is a function of **data volume
and effect placement**, not of control-flow shape:

| Machine | Data-carrying states | Verdict                                                    |
| ------- | -------------------- | ---------------------------------------------------------- |
| toggle  | 0                    | unbeatable; nothing else in the round should try           |
| neutral | 3                    | best-in-round to _read_, no per-state precision            |
| Case 1  | 4 + timing           | topology still best-in-round, everything else hand-written |

## Verdict

**It does not beat every candidate on both machines, but it beats all of them on
two of the four scored dimensions and it sets the ceremony floor.** Any candidate
that costs more than ~2 lines for the toggle, or that hides a target inside a
body, is losing to 26 lines of transcribed production code with 69.2M weekly
downloads behind it.

What it cannot do is the exact gap the brief names in §4: it has **no per-state
data** and it enforces **no per-state capabilities at the send site**. Both are
demonstrated here with real compiler output, not asserted. It also cannot
represent a multi-target transition, which is both `submit`/`decide` in the
neutral machine and `startup.move` in Case 1 — so it fails, structurally, on
precisely the case §5.2 identifies as the discriminator between target
encodings (c) and (d).

The design lesson to steal, not the design: **the target belongs at the value
position of a `(source, input)` key path, and nothing should have to be read to
find it.** The design lesson to reject: totality. A reducer that returns the
current state for both a refusal and a same-state commit forces every caller to
re-implement the lookup to tell them apart, and that single decision generates
most of the duplication in both larger files.

## Weaknesses of this baseline

1. No per-state data. Every field is nullable in every state; narrowing the
   state narrows nothing (TS2322, verified).
2. No per-state capabilities. `send` accepts every event of the machine from
   every state and silently no-ops (verified: no diagnostic).
3. No multi-target transitions. Forces event splitting and a caller-side switch
   on the state the table already dispatched on.
4. No guards. `draft + revise` refusal-vs-update and `startup + move`
   near-vs-far are invisible in the table and hand-written outside it.
5. Refusal and same-state commit are indistinguishable from the reducer's
   result, so `can()` re-reads the table at every call site.
6. No effects, entry or exit. "Cancel dwell when leaving `startup`" is hand-
   copied three times.
7. Ordering hazard with no guard rail: the correct idiom is
   `can()` → `send()` → write cells, and getting it wrong corrupts data on a
   refused input. Nothing in the API steers you.
8. Target diagnostics are correct but poorly located: a seven-level cascade
   pointing at the whole table argument, with the did-you-mean at the bottom.
9. The table must be `as const` the moment it is named rather than inlined, and
   both larger machines need it named.
10. `machine[state]` is not resolvable on `M & Machine<MachineState<M>>`; Radix
    casts to `any` inside the kernel and so does this transcription.
