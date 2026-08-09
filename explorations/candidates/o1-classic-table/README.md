# O1 — the classic transition table

```bash
pnpm exec tsc  -p explorations/candidates/o1-classic-table/tsconfig.json
pnpm exec node explorations/candidates/o1-classic-table/traces.ts
```

Both clean. An array of records, every coordinate a named field:

```ts
transitions: [
	{
		event: 'open',
		from: 'empty',
		to: 'draft',
		with: ({ input }) => ({ text: input.text, revision: 0 }),
	},
	{
		event: 'submit',
		from: 'draft',
		to: 'review',
		with: ({ data, input, skip }) =>
			input.route === 'review'
				? { text: data.text, revision: data.revision, reviewer: input.reviewer }
				: skip(),
	},
	{ event: 'cancel', from: 'draft', to: 'empty' },
]
```

`with` is ONE function: it decides and projects. Required when the target
carries data, omittable when it does not — so a plain edge is
`{ event, from, to }`.

## It works — and that revises a round-1 finding

Round 1 concluded that a **cross-product of discriminants at value positions**
kills contextual typing, which is why notations A and C died. This is a
cross-product of **three** (`event`, `from`, `to`), and TypeScript 7.0.2
discriminates it correctly: `with` receives the source state's data and the
input's payload, and returns the target's data. The old finding is too strong
and should be narrowed to the encodings actually tested then.

Two things had to be right. `T[I]` cannot appear inside a mapped-type template
— that forces `T` to resolve and collapses everything to `never` (the first
attempt did exactly this, and `const T` did not save it). The per-row precision
has to come from a union of all legal rows instead.

Negative tests cover: unknown state, unknown event, wrong target data, reading a
field the source lacks, and `with` being **required exactly when the target
carries data** — so a plain edge is `{ event, from, to }` with no `() => {}`
filler, while a data-free target may still `skip()`.

## What it buys

- **Nothing to learn.** `event` / `from` / `to` are named fields. No key syntax,
  no arrow, no spacing question, no parsing.
- **Completions are additive, not multiplicative.** `from:` offers |states|,
  `event:` offers |inputs|. The string-key form needs a |inputs|x|states|²
  union to complete a key.
- **It is data.** Rows can be spread, concatenated, filtered, or generated in a
  loop — though generated rows lose their literal types and with them the
  per-row checking.
- **Extensible.** Priority, labels, metadata are just more fields. A string key
  has nowhere to put them.

## What it costs

**1. ~9x the type cost, and it scales badly.** Same 20-state / 10-input stress
test as `n1` / `n2`:

|                       | Types  | Instantiations | Time    | Memory |
| --------------------- | ------ | -------------- | ------- | ------ |
| n2, string keys       | 8 400  | 14 864         | 0.041 s | 13 MB  |
| **o1, classic table** | 21 782 | **128 535**    | 0.356 s | 38 MB  |

Both unions have 4 000 members, but these are object types with two closure
signatures each, not string literals. 0.356 s is still usable; the trajectory is
the concern, and it is paid on every keystroke in an editor.

**2. ~~Splitting `guard` from `map` loses narrowing.~~ FIXED by `with`.**

The first cut had a separate `guard` and `map`, and two closures cannot share a
narrowing: `guard` proving `input.route === 'review'` told `map` nothing, so the
neutral machine carried `reviewer: input.route === 'review' ? input.reviewer : ''`.

Folding both into one `with` removes it — `with-narrowing.ts` proves the
narrowing reaches the returned object with no re-test and no cast, and that the
other branch is still narrowed the other way.

Re-measured after the change, on the same 20-state stress test:

|                   | Types  | Instantiations | Time    |
| ----------------- | ------ | -------------- | ------- |
| `guard` + `map`   | 21 782 | 128 535        | 0.356 s |
| **single `with`** | 23 030 | **98 398**     | 0.336 s |

Instantiations fell 23%, but types rose slightly and wall time barely moved —
one closure signature per row instead of two is a smaller win than expected. It
is still ~6.6x n2's instantiations.

**3. It is wider — and `with` made it wider still.** The neutral machine's
transitions block: **41 lines** as string keys, 54 as records with `guard` +
`map`, **59** with a single `with` (the ternary costs more lines than two short
fields did) — and Prettier breaks each record across lines,
so `event` / `from` / `to` land on _separate lines_. The arrow test's whole
premise — four coordinates at fixed positions on one line — is gone. Grep still
works (`to: 'published'` is unambiguous), but scanning a column does not.

## Where it lands

The classic table is the most **conventional** and the most **extensible**
shape, and it needs no explanation to anyone who has seen an FSM before. With
`with` it also keeps the narrowing that makes the single-function handler worth
having.

What it still pays: **~6.6x n2's instantiations**, **18 more lines** on the
neutral machine, and the arrow test — Prettier breaks each record across lines,
so `event` / `from` / `to` never share one. Grep survives (`to: 'published'` is
unambiguous); scanning a column does not.

The remaining trade against `n2` is narrow and clear: **conventional and
extensible, versus dense and scannable.** Nothing else separates them now.
