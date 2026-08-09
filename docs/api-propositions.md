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

| #   | Axis                       | Status           | Current answer                                   |
| --- | -------------------------- | ---------------- | ------------------------------------------------ |
| 1   | Overall layout             | **REOPENED**     | three live: target keys / string keys / records   |
| 2   | Data-free states           | **settled**      | `void` in the declared vocabulary                 |
| 3   | Entry/exit actions         | **settled**      | out — attach listeners instead                    |
| 4   | Re-entry vs stay           | **settled**      | deleted; it had exactly one referent              |
| 5   | Self-transition spelling   | **settled**      | dissolved — just name the state twice             |
| 6   | Input vocabulary           | **settled**      | declared: `types<{ inputs, states }>()`           |
| 7   | Returned commands (`emit`) | **open**         | keep as data, or remove for purity                |
| 8   | Fall-through refusal       | **settled**      | no `else`; dev-mode warning instead               |
| 9   | Timers                     | **not started**  | the one thing that could revive axis 4            |

Axis 1 reopened because two later propositions beat the notation that had won
it. Axes 2, 5 and 6 closed as a **side effect** of that — see below.

---

## Axis 1 — overall layout

### The three that are live

| Name                | Dir  | Shape                                                | Evidence                                    |
| ------------------- | ---- | ---------------------------------------------------- | ------------------------------------------- |
| **target keys**     | `d1` | `submit: { review: fn, published: fn }`              | ✅ complete, traces pass                    |
| **string keys**     | `n2` | `'submit: draft -> review': fn`                      | ✅ complete, traces pass                    |
| **classic records** | `o1` | `{ event, from, to, with }`                          | ✅ complete, traces pass                    |

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

|                                | target keys      | string keys        | classic records   |
| ------------------------------ | ---------------- | ------------------ | ----------------- |
| neutral machine, transitions   | 77 (whole file)  | **41**             | 59                |
| all 4 coordinates on one line  | no               | **yes**            | no (Prettier)     |
| question B, "what can I do?"   | **one block**    | grep `: draft ->`  | grep `from:`      |
| question C / D by grep         | scan keys        | **yes, all three** | yes               |
| reverse index (`Sources`)      | derivable        | **free**           | **free**          |
| completions                    | per key          | key union          | **additive**      |
| instantiations @ 20 states     | —                | **14 864**         | 98 398 (6.6x)     |
| extensible (priority, labels)  | no               | no                 | **yes, add a field** |
| errors land on the bad line    | **yes**          | **yes**            | **yes**           |

### The settled failures

| Name              | ID  | Why it died                                     |
| ----------------- | --- | ----------------------------------------------- |
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
   cross-product of *three* (`event`, `from`, `to`) and TypeScript 7.0.2
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
   checking** against that member — a key is "known" if *any* intersection member
   has it. Cost `n1` its per-line errors until a second member restored them.
   Same class as the `object &` bug in `d1`.
6. **Reverse-mapped inference needs one non-closure leaf** *and* only bites when
   the type parameter also appears in a closure parameter. Neither alone is
   enough.

---

## Still open

- **Axis 7, `emit`.** Returned commands are data, not side effects — but they
  are still consequences in the definition. Removing them is the coherent end of
  the axis-3 argument and is what makes machines composable. Not decided.
- **Axis 9, timers.** Untouched, and the one thing that could revive re-entry: a
  state-scoped timer restarting is a real question, and it should be answered by
  the timer's own declaration, not by a keyword every edge makes room for.
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

| Directory                | Proposition                | State                                        |
| ------------------------ | -------------------------- | -------------------------------------------- |
| `n2-declared-types`      | **string keys + `types<>`**| ✅ whitespace-tolerant, listeners narrow      |
| `o1-classic-table`       | **classic records + `with`**| ✅ narrowing verified, traces pass           |
| `n1-transition-table`    | string keys, inferred vocab| ✅ has the `playground.ts` completions demo   |
| `d1-target-keys`         | target keys                | ✅ complete                                   |
| `d4-self-target`         | target keys + `&`          | ✅ compiles — moot since axis 4               |
| `c2-annotated-outcome`   | annotated outcome          | ✅ Cases 1–4, live runtime, send-site checks  |
| `d3-radical`             | by destination             | 🟡 lib + neutral only                         |
| `c1-edge-records`        | edge records               | 🟡 cannot express the neutral machine         |
| `c3-target-list`         | target list                | ⛔ intentionally does not compile             |
| `baselines`              | 3 rivals                   | ✅ switch-union, radix, sequential            |

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
