# All propositions, organised

> **Start here.** Everything else in `docs/api-*.md` and every candidate
> `README.md` is evidence for one row of this document.

## First: a naming mess I created

`A`/`B`/`C`/`D` label **two unrelated things** in these documents: the four
**state-search questions** from Sunshine/Herbsleb/Aldrich, and the first four
**notation candidates**. Below, notations go by **name**; letters survive only
as historical IDs. Question letters are always written "question B", never bare.
There is **no proposition K** — the letter was skipped by accident.

## The decisions, and where each stands

| #   | Axis                       | Status       | Current answer                                   |
| --- | -------------------------- | ------------ | ------------------------------------------------ |
| 1   | Overall layout             | **REOPENED** | three live: target keys / string keys / records  |
| 2   | Data-free states           | **settled**  | `void` in the declared vocabulary                |
| 3   | Entry/exit actions         | **REOPENED** | actions are back in scope — see axis 10          |
| 4   | Re-entry vs stay           | at risk      | deleted; survives only if residency = the name   |
| 5   | Self-transition spelling   | at risk      | dissolved; depends on axis 4 staying deleted     |
| 6   | Input vocabulary           | **settled**  | declared: `types<{ inputs, states }>()`          |
| 7   | Returned commands (`emit`) | **settled**  | out — a listener recovers it from the transition |
| 8   | Fall-through refusal       | **settled**  | no `else`; dev-mode warning instead              |
| 9   | Async / work-in-flight     | **open**     | subsumed by axis 10 — effects, not timers        |
| 10  | Actions in the machine     | **open**     | `actions:`, trigger-keyed, wrappers for policy   |

Axis 1 reopened because two later propositions beat the notation that had won
it. Axes 2, 5 and 6 closed as a **side effect** of that — see below.

**Axis 10 supersedes axis 9** and reopens axis 3. The effect-free core was
costing more than it paid: keeping effects out of the definition forced either a
description vocabulary and a reconciling driver, or a `within(state, childFsm)`
that grows the input vocabulary through a fluent chain and reopens the declared
vocabulary. Actions are back in the machine.

**Where they go is decided by the concern structure, not by taste.** The
declaration is one block per job — `inputs` what can happen, `states` what we can
be, `transitions` how we move — and the transition handler was **already** doing
two jobs before actions arrived (`with` decides _and_ projects; o1 folded them to
recover narrowing). Every proposition that put actions on the edge took it to
three or four. So actions **attach to residency**, in their own block, with
`transitions` left exactly as it is.

There is also a merits argument, not only a structural one: a command placed on
an edge duplicates across every edge _into_ the state — `load: idle -> loading`
and `retry: failed -> loading` both have to start the fetch, and an edge added
later silently does not.

**The block is `actions:`, not `states:`.** States are already declared in
`types<>` and every one appears in the table; the block declares **what runs**.

Its shape: **keyed by trigger**, in the key languages that already exist — a bare
state name means residency, a key with a colon is an edge pattern. Values are
bare functions, or the result of a **wrapper** where the default does not hold:

```ts
actions: {
	'loading':            ({ data, send }) => fetchUser(data.id, …),      // residency
	'connected': persistent(({ data, send }) => subscribe(data.url, send)),
	'cancel: draft -> *': () => track('cancelled'),                       // an edge
	'*: * -> loading':    () => …,                                        // entry
	'*: draft -> *':      () => releaseLock(),                            // exit
}
```

Entry and exit need no vocabulary of their own — they are edge patterns with one
end pinned, which the existing grammar already parses. Axis 3's original question
answers itself.

Wrappers return the record a hand-written object value would have been
(`persistent(fn)` → `{ run: fn, restart: 'never' }`), so the block stays
inspectable as data and new policies — `keyed`, later `once` or `debounced` — are
new wrappers rather than new syntax. Constructors appear only at the exceptions,
which is the one thing that made them acceptable here.

Three consequences now live:

- **Axes 4 and 5 stay dissolved — via the action, not the notation.** They were
  closed _because_ axis 3 had removed entry/exit; restoring it gives
  self-transitions something to denote again. The answer is a per-action restart
  policy: the transition author declares movement, the action declares whether it
  is sensitive to it. `draft -> draft` remains an ordinary transition, and no
  keyword is added. **The default is to restart** — it fails safe (a missed
  opt-out costs a teardown, not a stale closure) and puts the wrapper on the rarer
  thing. This also subsumes the stale-resident-data question, since resident data
  can only change via a transition into the state you are already in.
- **Axis 6 stays shut.** Merging the state declaration — declaring each state once
  with its data type _and_ its behaviour — was briefly a candidate, since
  `actions:` names states a second time. It does not apply: `actions` is keyed by
  **trigger**, not by state, so `'cancel: draft -> *'` has no home in a per-state
  block. The marker-call `any`-leak that `types<>` solved stays solved.
- **One key language, one rule.** **A key with no `->` names a state; an edge
  always carries an arrow, even when both ends are `*`.** This replaces the
  listener language's bare-input arm
  ([`Pattern`'s first](../explorations/candidates/n2-declared-types/lib.ts:138)),
  so `.on('submit', …)` becomes `.on('submit: * -> *', …)`. Without it the same
  bare syntax would mean an input in `.on()` and a state in `actions`, and a name
  that is legally both would compile under the wrong reading with no error. The
  rule is decidable from the string alone — a reader never has to know which block
  they are in. Three lines to implement; nothing currently uses the bare form.
- **A latent runtime bug, now harmless.** `step` calls losing candidates'
  handlers ([lib.ts:269](../explorations/candidates/n2-declared-types/lib.ts:269)).
  Under this decision handlers only project, so nothing observable happens — but
  it becomes real the moment any proposition puts effects back in a handler.

Detail: [api-actions.md](api-actions.md)

---

## Axis 1 — overall layout

### The three that are live

| Name                | Dir  | Shape                                   | Evidence                 |
| ------------------- | ---- | --------------------------------------- | ------------------------ |
| **target keys**     | `d1` | `submit: { review: fn, published: fn }` | ✅ complete, traces pass |
| **string keys**     | `n2` | `'submit: draft -> review': fn`         | ✅ complete, traces pass |
| **classic records** | `o1` | `{ event, from, to, with }`             | ✅ complete, traces pass |

```ts
// target keys                    // string keys                 // classic records
draft: {                          transitions: {                 transitions: [
  data: data<{…}>(),                'submit: draft -> review':     { event: 'submit',
  on: {                                fn,                            from: 'draft',
    submit: {                       'submit: draft -> published':      to: 'review',
      review: fn,                      fn,                            with: fn },
      published: fn,                'cancel: draft -> empty':      { event: 'cancel',
    },                                 () => {},                        from: 'draft',
    cancel: 'empty',              }                                    to: 'empty' },
  },                                                             ]
},
```

|                               | target keys     | string keys        | classic records      |
| ----------------------------- | --------------- | ------------------ | -------------------- |
| neutral machine, transitions  | 77 (whole file) | **41**             | 59                   |
| all 4 coordinates on one line | no              | **yes**            | no (Prettier)        |
| question B, "what can I do?"  | **one block**   | grep `: draft ->`  | grep `from:`         |
| question C / D by grep        | scan keys       | **yes, all three** | yes                  |
| reverse index (`Sources`)     | derivable       | **free**           | **free**             |
| completions                   | per key         | key union          | **additive**         |
| instantiations @ 20 states    | —               | **14 864**         | 98 398 (6.6x)        |
| extensible (priority, labels) | no              | no                 | **yes, add a field** |
| errors land on the bad line   | **yes**         | **yes**            | **yes**              |

### The settled failures

| Name              | ID  | Why it died                                      |
| ----------------- | --- | ------------------------------------------------ |
| annotated outcome | B   | works, but the target lives in a type annotation |
| by destination    | E   | question B scatters; its one win is derivable    |
| transition table  | F   | unverified crux; superseded by `n2`              |
| combinator edges  | M   | one verb, per-edge tax; superseded by `o1`       |
| edge records      | A   | ❌ cannot express multi-target                   |
| target list       | C   | ❌ negative evidence, will not compile           |

### Recommendation

**String keys (`n2`) is now the strongest**, and this is a change of position.
It is the shortest, it is the only notation where all four coordinates sit on
one line at fixed positions, and it is the only one where all three search
questions are a plain text search. It also carries none of the inference
fragility (below).

**Target keys (`d1`) remains the choice if co-location matters more** — it is
the only live notation where a state's data and its outgoing edges are one
block. That is a real property and the research says question B dominates;
`n2` answers B with grep rather than with layout.

**Classic records (`o1`) is the choice if the table must be extensible** —
priority, labels, metadata are just more fields, and nothing needs explaining to
anyone who has seen an FSM. It costs 6.6x the instantiations and the arrow test.

Detail: [api-transition-table.md](api-transition-table.md) ·
[api-combinator-edges.md](api-combinator-edges.md) ·
[api-notations.md](api-notations.md) ·
[api-notations-round-2.md](api-notations-round-2.md) ·
[api-decision.md](api-decision.md)

---

## Axes 2, 5, 6 — closed by the declared vocabulary

```ts
types: types<{
	inputs: { submit: Submit; cancel: void }
	states: { empty: void; draft: { text: string; revision: number } }
}>()
```

This is **orthogonal to layout** — it lands on any of the three — and it settled
three axes at once:

- **Axis 6, input vocabulary.** Was "keep `inputs:` or drop it". The third
  option won: declare both maps together, as an ordinary named type that can be
  exported, imported, generated, or composed.
- **Axis 2, data-free states.** `empty: void`. Not `data: nothing`, not
  `state()` — the actual type.
- **Axis 5, self-transitions.** With axis 4 deleting re-entry, a self-transition
  is just a transition whose target is its source: `'revise: draft -> draft'`.
  No `keep`, no `&`, no `stay`, no symbols.

It also closed two silent holes — see findings 2 and 3.

### The ten self-transition propositions, all now moot

`keep`/`repeat` is observationally identical unless something runs on entry or
exit — which is how Erlang, XState and SCXML all define it. Axis 3 removed
entry/exit from the definition, so the distinction had nothing left to denote.
Recorded so the ground is not re-covered: reserved keys (T1), symbol keys (T2),
self-name (T3), return marker (T4), `&` (T5), per-state flag (T6), residency
identity (H), two blocks (I), restart rule (J), form dispatch (L).

Detail: [api-do-we-need-reentry.md](api-do-we-need-reentry.md) ·
[api-self-transitions.md](api-self-transitions.md) ·
[api-self-transitions-round-2.md](api-self-transitions-round-2.md)

---

## Findings — type-system rules learned the hard way

These are reusable and were each discovered by a test asserting something
**illegal** fails. No positive test has ever caught one.

1. **The round-1 cross-product rule was too strong.** It said a cross-product of
   discriminants at value positions kills contextual typing. `o1` is a
   cross-product of _three_ (`event`, `from`, `to`) and TypeScript 7.0.2
   discriminates it correctly. Narrow the old finding to the encodings actually
   tested then.
2. **Marker calls leak `any`.** `state<T = void>()` puts the call in a position
   contextually typed by the unresolved state map, so `T` infers as `any` — every
   data-free state silently accepted anything. A parameterless **overload** has
   nothing to infer. Declared vocabularies avoid it entirely.
3. **A type parameter in a closure's parameter type gets fixed to its
   constraint** before inference. This killed "compute `S` from the raw literal",
   and it is why the state-name inference cliff existed in `d1`. Declaring the
   vocabulary dissolves it.
4. **`T[I]` inside a mapped-type template forces `T` to resolve**, collapsing the
   result to `never`. `const T` does not help. Per-row precision has to come from
   a union instead.
5. **Capturing a literal alongside a checking member disables excess-property
   checking** against that member — a key is "known" if _any_ intersection member
   has it. Cost `n1` its per-line errors until a second member restored them.
   Same class as the `object &` bug in `d1`.
6. **Reverse-mapped inference needs one non-closure leaf** _and_ only bites when
   the type parameter also appears in a closure parameter. Neither alone is
   enough.

---

## Why axis 7 closed on (c)

`emit` let a handler return command descriptions for something outside to
interpret. It is gone, for three reasons, in ascending order of force:

1. **Another concept to learn and to type**, on a project whose whole thesis is
   that the table should be readable without explanation.
2. **Strictly redundant.** A listener receives `{ on, input, from, to }` with
   data on both ends, and a transition is identified by (source, input, target).
   Everything a pure handler could compute is already in `to.data`, so there is
   no command whose content a listener cannot recover.
3. **The direction is asymmetric.** Adding `emit` later is additive — one more
   optional context member. Removing it later is breaking. Starting without it
   keeps the option open; starting with it spends it.

It survives only in `d1`, which predates the decision. Note that `n2` and `o1`
never had it, so the recommended notation was already at (c) by omission.

Not an argument for keeping it: the async visibility problem. That is about
inputs arriving _on their own_ (`Sub`), which is outgoing `emit`'s opposite
direction. The two were briefly conflated; they are independent.

---

## Still open

- **Axis 9, async — the last real question.** Not "timers": a timer is the
  smallest case of _something starts, takes time, and produces an input later_,
  alongside a fetch, a socket, an animation, a child machine. Elm's split is the
  right frame, and it cuts along a real seam:
  - **`Cmd`** — one-shot, started _by a transition_. A fetch. Needs no residency
    scoping; under axis 7 it is a listener calling `send()` when it resolves.
  - **`Sub`** — continuous, a function of _which state you are in_, alive while
    you are there. A timer, a socket, a poll. This one needs residency scoping
    and cancellation, and it is the half that could revive axis 4: a countdown
    is the first thing that makes "did we re-enter or stay?" observable.

  Free win already in hand: the **stale-response problem is solved by the
  runtime**, not the types. A `loaded` arriving after we left `loading` matches
  no row and returns `{ kind: 'none', reason: 'unavailable' }`. That is
  _ignoring a result_, though — not _cancelling work_. The fetch still ran.

  Five options worked through in [api-async.md](api-async.md): `within` effects,
  triggers on the edge, declarative resources, input-declared sources, and async
  handlers. Then reframed by composition in
  [api-async-composition.md](api-async-composition.md): a promise _is_ a state
  machine, so the async vocabulary collapses into one leaf primitive plus a
  library of composable machines. Then constrained by
  [api-async-effect-free.md](api-async-effect-free.md), which is the one that
  governs: `step()` is **already pure**, and every `within` / `invoke` shape
  would take that away by putting IO closures in the definition and forcing a
  scheduler into the core. Describing effects as **data**, reconciled by a
  driver outside, keeps the engine pure and makes cancellation structural.
  Current lean: **ship nothing (P) now; grow into an out-of-machine
  `resources` function (R).**

  The real difficulty: every notation decision so far assumed a transition is
  `(data, input) -> data`, pure and instantaneous. `Sub` means the machine owns
  a lifecycle, and whatever declares it is a **second declaration site** — in
  direct tension with the one-table property that won axis 1.

- **Whitespace tolerance costs the grep story.** `n2` accepts `load:idle->booting`
  and normalises it. All type-level tooling normalises too — but **human grep
  cannot**. `->published` will not match `-> published`. Completions still emit
  the canonical form, so drift should be rare; a lint rule would close it.
- **Editor completion responsiveness at 4 000 union members is unmeasured.**
  TS 7.0.2 is the native port: no JS language-service API, and its `--lsp` did
  not answer `textDocument/completion` even for a 4-member union. Open
  `n1/playground.ts` and try it.

---

## Where the code is

| Directory              | Proposition                  | State                                        |
| ---------------------- | ---------------------------- | -------------------------------------------- |
| `n2-declared-types`    | **string keys + `types<>`**  | ✅ whitespace-tolerant, listeners narrow     |
| `o1-classic-table`     | **classic records + `with`** | ✅ narrowing verified, traces pass           |
| `n1-transition-table`  | string keys, inferred vocab  | ✅ has the `playground.ts` completions demo  |
| `d1-target-keys`       | target keys                  | ✅ complete                                  |
| `d4-self-target`       | target keys + `&`            | ✅ compiles — moot since axis 4              |
| `c2-annotated-outcome` | annotated outcome            | ✅ Cases 1–4, live runtime, send-site checks |
| `d3-radical`           | by destination               | 🟡 lib + neutral only                        |
| `c1-edge-records`      | edge records                 | 🟡 cannot express the neutral machine        |
| `c3-target-list`       | target list                  | ⛔ intentionally does not compile            |
| `baselines`            | 3 rivals                     | ✅ switch-union, radix, sequential           |

## The API as it currently stands

```ts
export const publication = machine({
	initial: 'empty',
	types: types<{
		inputs: { open: { text: string }; submit: Submit; cancel: void }
		states: {
			empty: void
			draft: { text: string; revision: number }
			review: { text: string; revision: number; reviewer: string }
		}
	}>(),
	transitions: {
		'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'revise: draft -> draft': ({ data, input, skip }) =>
			input.text === data.text
				? skip()
				: { text: input.text, revision: data.revision + 1 },
		'submit: draft -> review': ({ data, input, skip }) =>
			input.route === 'review' ? { ...data, reviewer: input.reviewer } : skip(),
		'submit: draft -> published': ({ data, input, skip }) =>
			input.route === 'publish' ? { …} : skip(),
		'cancel: draft -> empty': () => {},
	},
}).on('* -> published', (e) => notify(e.input))
```

No `enter`, no `exit`, no `keep`, no `repeat`, no `else`, no `nothing`, no
`state()`, no type annotations on any handler.
