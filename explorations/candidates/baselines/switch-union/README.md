# Baseline: plain `switch` over a discriminated union

Brief §4 item 2. No library at all. A discriminated union of state values with
per-state data, a discriminated union of input values, and one reduce-style
function that `switch`es on the state tag and then on the input tag. Ordinary
TypeScript exhaustiveness (`const unhandled: never = state`).

This is the **ceremony floor** every candidate is measured against. It was
written the way a competent TypeScript developer actually writes this, and then
formatted with the repository's pinned Prettier before anything was counted.

## Files

| File         | What                                     |
| ------------ | ---------------------------------------- |
| `toggle.ts`  | Case 2, the two-state toggle             |
| `neutral.ts` | The neutral document-publication machine |
| `case1.ts`   | Case 1, the reduced Marking Menu         |

All three type-check clean under `tsconfig.json` (extends
`../../tsconfig.base.json`, TypeScript 7.0.2) and all three run:

```
pnpm exec tsc -p explorations/candidates/baselines/switch-union/tsconfig.json
  -> TypeScript: No errors found

pnpm exec node .../toggle.ts   -> toggle: all assertions passed
pnpm exec node .../neutral.ts  -> neutral: all assertions passed
pnpm exec node .../case1.ts    -> case1: all five required traces passed
```

The two `@ts-expect-error` directives (one in `neutral.ts`, one in `case1.ts`)
are load-bearing negative evidence, not suppression of a mistake: they compile
only _because_ the baseline has no typestate. If it acquired typestate the
directives themselves would become errors.

## Measured, after Prettier

"Definition" means the machine only: type declarations through the closing
brace of `reduce`. It excludes the file header comment and the demonstration.

| Machine | Definition lines | Non-blank | Whole file |
| ------- | ---------------- | --------- | ---------- |
| toggle  | **17**           | 15        | 44         |
| neutral | **98**           | 91        | 198        |
| Case 1  | **208**          | 193       | 347        |

Case 1 breaks down as 50 lines of type declarations, 17 lines of ordinary
domain helpers (distance test, angular hit test), and 134 lines of `reduce`.

### Toggle variants, all formatted and all type-checked clean

| Variant                                          | Lines | Non-blank |
| ------------------------------------------------ | ----- | --------- |
| as shipped (string union + `never` check)        | 17    | 15        |
| drop the `never` check (TS still accepts it)     | 13    | 11        |
| tagged objects `{ state: 'off' }` + inner switch | 27    | 25        |
| degenerate `if` form, no switch at all           | 9     | 7         |

Two things worth saying plainly:

1. **The floor is not as low as "just use a switch" implies.** 17 lines for
   "flip" is barely better than the previous round's ~14-line toggle, and the
   tagged-object form (the style the neutral machine and Case 1 actually use) is
   **27 lines — worse than the propositions**. The baseline only wins the toggle
   by _abandoning its own style_ for a machine with no per-state data.
2. **But the concept count is what really matters here, and it is zero.**
   Every concept in the toggle is ordinary TypeScript. There is nothing to
   learn, nothing to import, no factory, no inference boundary, no lifecycle.

### Distinct concepts

| Machine | Concepts | Of which library-specific |
| ------- | -------- | ------------------------- |
| toggle  | 6        | 0                         |
| neutral | 8        | 0                         |
| Case 1  | 12       | 0                         |

Toggle: state union, input union, initial value, reducer signature, `switch`
dispatch, `never`-check. Neutral adds: `default: return state` meaning "input
unavailable here", and _object identity_ as the only signal separating "no
transition" from "same-state update". Case 1 adds: a `{ state, effects }`
return envelope, an effect union, a `stay()` helper, and machine configuration
(`root: Menu`) threaded as a third reducer parameter.

## Score

### A -- what abstract state is this in? **excellent**

`switch (state.state)` is TypeScript's home turf. Inside `case 'review':`,
hovering `state` shows `{ state: 'review'; text; revision; reviewer }` exactly.
The demonstration relies on this: `if (revised.state !== 'draft') throw ...`
narrows `revised`, and `revised.revision` then compiles.

The honest caveat: you must write the check yourself at every observation point,
the value arrives as the full union every time, and (measured fact §5.3)
narrowing dies inside callbacks created after the check.

### B -- what can I do in state X? **good**

The inner `switch (input.input)` under `case 'X':` is precisely the list of
capabilities for X, contiguous, in one block, at one indentation, and it exists
in exactly one place in the file. As a _reading_ answer that is very good.

It is only good and not excellent because the list is advisory: `default:
return state` silently absorbs everything else, there is no completion filtered
by state, and nothing at the call site is affected by it (see below).

### C -- in what states can I do Z? **partial**

`case 'revise':` occurs twice in `neutral.ts`, both at the same indentation, in
two different outer cases. Grep finds the occurrences reliably because the
syntactic form is uniform, but grep does not tell you the source state -- you
scroll up to the enclosing `case` each time. The `PublicationInput` union
declares that `revise` exists and says nothing about where it is available.

This is a _forced_ trade, not an accident. The reducer nests one way. Nesting
state-outer answers B well and C badly; nesting input-outer inverts it exactly.
There is no arrangement of one nested `switch` that answers both.

### D -- how do I get from X to Y? **partial**

Better than the previous round, and still not good.

Better: every entry into a state has the identical greppable form
`{ state: 'Y', ... }`, and the target literal is checked (see diagnostics).
`grep "state: 'published'"` over `neutral.ts` finds both entries.

Not good: both of those hits are _inside_ handler bodies, at two different
depths of the same ternary (`draft.submit`'s `:` branch and `review.decide`'s
`?` branch). Grep gives you the targets but not the sources; recovering
"published is reachable from draft and from review" requires scrolling up from
each hit to its enclosing `case`. Nowhere in the file is the topology stated.

### Arrow test: **partial** (2 of 4 recoverable without reading a body)

| Element      | Position                                      | Recoverable? |
| ------------ | --------------------------------------------- | ------------ |
| source       | outer `case 'draft':`, indent 2               | **yes**      |
| input        | inner `case 'revise':`, indent 3              | **yes**      |
| outcome kind | nowhere -- inferred by comparing tags         | **no**       |
| target       | `state:` property inside the returned literal | **no**       |

Source and input are genuinely excellent: they read down two columns at two
fixed indents, formatter-stable. The other half fails. The outcome kind has no
syntax at all -- "no transition" is `return state`, "same-state update" is a new
literal with the same tag, and you distinguish them by mentally comparing the
returned tag with the enclosing `case` label. And Erlang's `repeat_state`
(same state, _do_ re-run entry) cannot be expressed at all.

The target sits at a uniform property name but at arbitrary depth. In
`draft.submit` and `review.decide` -- the multi-target transitions -- the two
targets are the two branches of a ternary, which is precisely the shape the
evaluation brief quotes as the previous round's failure. **The plain switch
fails the arrow test for the same structural reason the propositions did.**

## Diagnostics (measured, not asserted)

Every diagnostic below was produced by mutating a copy of `neutral.ts` and
running the pinned `tsc`.

| Mutation                            | Diagnostic                                                                                     | Quality                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| typo'd target `{ state: 'emty' }`   | `TS2820 ... Did you mean '"empty"'?` at the literal's exact column                             | **best class** (§5.2 (d))   |
| retarget with wrong data            | `TS2322 ... missing the following properties ...: text, revision, reviewer`                    | exact column, names the gap |
| add a field to `draft`'s data       | 4 x `TS2322 ... Property 'author' is missing`, one per construction site                       | exact, complete, no cascade |
| add a state, forget its `case`      | 1 x `TS2322 Type '{ readonly state: "archived"; }' is not assignable to type 'never'`          | caught, but **remote**      |
| rename an input in the union        | 2 x `TS2678 Type '"revise"' is not comparable to ...` + 3 cascade `TS2339 ... on type 'never'` | caught, noisy               |
| **add an input, handle it nowhere** | **none**                                                                                       | **silently unavailable**    |
| **forget a transition**             | **none**                                                                                       | **silently unavailable**    |

The target-literal diagnostics are the surprise: because `state:` is a sibling
property of a contextually typed object literal, the plain switch already gets
encoding (d)'s TS2820 did-you-mean quality for free. A candidate does not beat
this baseline on target diagnostics; it can only match it.

The last two rows are the deep defect. `default: return state` is load-bearing
behavior (it _is_ "unavailable input") and a total blind spot: an input the
author forgot to handle is indistinguishable from an input deliberately
unavailable. Nothing in the compiler, and nothing in the source, tells them
apart.

## Edit locality

| Edit                        | Locations | Facts repeated | Notes                                                                                                                                                                                       |
| --------------------------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1 add a state              | 2 + N     | 2 + N          | union member + outer `case`; plus one entry per transition into it. The `never` check catches the missing `case`, remotely. Nothing flags that the new state is unreachable or has no exit. |
| E2 add a transition         | **1**     | **0**          | one `case` inside the source's inner `switch`. Best in class. But omission is undetectable.                                                                                                 |
| E3 add a field to one state | 1 + N     | N              | edit the union member; the compiler then points at all N construction sites with the field name. Spread-based same-state updates need no edit.                                              |
| E4 retarget a transition    | **1**     | **0**          | rewrite the returned literal in place; TS2820/TS2322 check the new target and its data.                                                                                                     |
| E5 rename an input          | 1 + N     | 1 + N          | union member + every `case` label. Compiler-guided (TS2678) but with `never` cascade noise. No rename refactor -- a measured floor, §5.3.                                                   |

Measured on `neutral.ts`: E1 to add `archived` = 1 union line + 1 case block +
1 entry per incoming transition. E3 for `draft.author` produced exactly 4
diagnostics at the 4 construction sites.

Edit locality is where this baseline is genuinely strong: **E2 and E4 are
one-location, zero-repeat edits**, which is as good as it can get. E1/E3/E5 are
N-location but every one of the N is pointed at by the compiler with a specific
message.

## Where it is weak -- the four the brief asked about

### 1. Per-state capabilities at the call site: **not enforced at all**

This is the headline failure, and it is total. `reduce` has signature
`(state: PublicationState, input: PublicationInput) => PublicationState`. Any
input from any state type-checks. These two lines are in `neutral.ts` precisely
because they **compile**:

```ts
const illegalFromEmpty = reduce(empty, { input: 'decide', verdict: 'approve' })
const illegalFromPublished = reduce(approved, { input: 'cancel' })
```

`decide` is legal only from `review`; `published` is terminal. Neither fact is
reachable by a caller. The only defence is the runtime `default: return state`.
Case 1 is worse, because there the illegal sends are the ones that matter:
`dwellElapsed` from `idle`, `down` from `expert`.

Related and equally total: **the reducer's return type is the whole union**, so
the target of a statically known transition is not statically known.
`reduce(empty, { input: 'open', text: 'x' })` is `PublicationState`, not
`draft` -- verified by the `@ts-expect-error` on `.text`, which compiles only
because the property genuinely does not exist on the union. Chaining two known
transitions requires a hand-written narrowing between them.

Per brief §4: "no surveyed library enforces per-state capabilities at the send
site". Neither does this. That is the gap, and this baseline does not touch it.

### 2. Timing and staleness: **nothing; it is all hand-written and untyped**

`case1.ts` carries `nextToken` in every state and `timerToken` in `startup`,
and the whole stale-dwell guarantee is the single expression
`input.token !== state.timerToken`. Both fields are `number`. Nothing relates
them. This compiles and is a silent bug:

```ts
i.token === s.nextToken // wrong field, well typed
```

There is no owned timer, no injectable clock, no identity type. The author
re-derives the token discipline in every machine that needs it, and every
re-derivation is unchecked. Threading `nextToken` through all six entries into
`idle` in `case1.ts` is pure manual bookkeeping.

### 3. Same-state update vs re-entry: **collapsed**

Three of the four outcomes in §6's algebra are squeezed into one return type:

- `next_state` -> a new literal with a different tag
- `keep_state` (same state, new data) -> a new literal with the same tag
- no transition -> return the **same object**, by reference

A caller distinguishes update from no-transition only by `next === previous`.
That is a convention, not a type; a well-meaning `return { ...state }` breaks it
invisibly. `repeat_state` -- same state, _do_ re-run entry -- has no encoding at
all, because there is no entry to re-run.

The demonstrations do assert the identity convention
(`if (unchanged !== opened) throw`), which is exactly the point: it needed an
assertion because nothing else enforces it.

### 4. Observing committed transitions: **there is nothing to observe**

`reduce` returns the next state. It never returns a record of
`(source, input, outcome, target)`. An observer that wants "we just moved from
`review` to `published` on `decide`" must keep the previous state itself, diff
the tags, and re-derive the input it just sent. Case 1's requirement that the
integration "report selection or cancellation" is only met because `case1.ts`
grew a second return channel by hand -- and that channel is untyped with respect
to the transition: `Step.effects` is `readonly MenuEffect[]` regardless of which
transition produced it, so nothing prevents `openMenu` being emitted on a
transition into `idle`.

There is also no run-to-completion story, no queue, no commit order, no
disposal. Those are not weaknesses of the _baseline_ so much as things it simply
does not have; the live-runtime traces in `acceptance-cases.md` are out of
scope for it entirely.

## §4.1 split analysis: where this baseline is strong vs weak across the two machines

The brief predicts this baseline "inverts" the sequential baseline's profile:
"fine on the neutral machine, poor once timing and staleness enter." **That is
broadly right, but it understates the neutral machine's cost and mis-locates the
Case 1 failure.**

### On the neutral machine: strong, and stronger than expected

The shape of the neutral machine is exactly the shape a nested `switch` was
made for. Any state can be entered from several others; the same input name
(`revise`, `cancel`) means different things in different states; there is no
sequence to un-invert. The reducer handles all of that with no machinery:
per-state data is just a union member, state-specific availability is just
which `case` labels are present, and the guard-like refusal (`revise` with
unchanged text) is an ordinary `if`. 98 formatted lines, zero imports.

Two things are better than the brief's framing suggests:

- **Target diagnostics are already best-in-class** (TS2820 did-you-mean), which
  §5.2 attributes to encoding (d) and to Zag v1. A candidate cannot win here.
- **E2 and E4 are one-location zero-repeat edits.** Adding or retargeting a
  transition is a single `case` clause. Most notations with a fixed target
  position do no better.

What it still loses on the neutral machine:

- The arrow test, for the same structural reason as the previous round: the two
  multi-target transitions put their targets in ternary branches.
- Question C, permanently, by the nesting choice.
- Per-state capabilities at the call site: nothing.
- An added input is silently unavailable everywhere: no diagnostic.

### On Case 1: weak, but not where the brief predicts

The brief says "poor once timing and staleness enter". Timing _is_ unhandled --
the token discipline is hand-rolled and untyped -- but that is a missing
feature, not a structural failure, and the reducer does express it correctly in
one line per state.

The real degradation is different and worse: **the definition grew 2.1x
(98 -> 208 lines) and the vocabulary silently changed shape.** `reduce` went
from `(state, input) => state` to `(state, input, root) => { state, effects }`.
Nothing forced that change to be principled, nothing checks it, and the two
machines in this same directory now have two different reducer contracts. A
library candidate cannot do this: its vocabulary is fixed, so if Case 1 forces a
change it is visible as overfitting. **The baseline gets to overfit invisibly,
and this evaluation should not credit it for that.**

Concretely, on Case 1 the baseline loses:

- 6 separate hand-written entries into `idle`, each repeating `nextToken`
  bookkeeping (E1-style repetition inside one machine).
- No relation between an effect and the transition that produced it.
- Illegal sends that actually matter (`dwellElapsed` from `idle`, `down` from
  `expert`) are unchecked -- and in an interaction machine those sends come from
  real event sources, so this is where a bug would land.
- The stale-timer guarantee rests on one hand-written `!==` over two
  interchangeable `number`s.

And it still wins on: no library to learn, narrowing that just works, and edits
E2/E4 remaining single-location even at 4 states and 13 transitions.

### Verdict on the split

The two machines do not split this baseline into "good" and "bad". They split
it into **"good and cheap" and "good and expensive and unchecked"**. There is no
machine in this evaluation that the plain switch cannot express. What changes
with Case 1 is the amount of unchecked hand-written bookkeeping, and the fact
that the file's own contract quietly moved.

**A candidate that beats this baseline must beat it on the three things the
switch structurally cannot do -- the arrow test, per-state capabilities at the
call site, and a typed relation between a transition and its effects/target --
while staying within a few lines of 17 / 98 / 208.** Beating it on lines alone
is not interesting; beating it on capability while losing 30 lines on the toggle
is, per the evaluation brief, a failure.
