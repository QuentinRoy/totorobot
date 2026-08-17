# N — the transition table with string keys

```bash
pnpm exec tsc  -p explorations/candidates/n1-transition-table/tsconfig.json
pnpm exec node explorations/candidates/n1-transition-table/traces.ts
```

Both clean. `traces.ts` prints `ALL PASSED`.

```ts
transitions: {
	'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
	'revise: draft -> draft': ({ data, input, skip }) =>
		input.text === data.text
			? skip()
			: { text: input.text, revision: data.revision + 1 },
	'submit: draft -> review': ({ data, input, skip }) => …,
	'submit: draft -> published': ({ data, input, skip }) => …,
	'cancel: draft -> empty': () => {},
}
```

`ctx.data` is the **source** state's data, `ctx.input` is that input's payload,
and the return type is the **target** state's data — all three recovered by
parsing the key with template literal inference.

## The question this was built to answer

`Key<S, I>` is `inputs x states x states`. Does that size hurt?

**No.** `measurements.ts` is a 20-state, 10-input machine — a 4 000-member key
union, the size of acceptance Case 4's ring — with the union additionally forced
to materialise. `playground.ts` adds a second one.

| measured on the whole prototype | value       |
| ------------------------------- | ----------- |
| Types                           | 12 850      |
| Instantiations                  | 12 692      |
| Check time                      | **0.042 s** |
| Memory                          | 13 MB       |

For reference, the annotated-outcome notation at 20 states measured 1 867 types
/ 6 109 instantiations. This is ~2x that for a file set containing **two**
4 000-member machines, and the absolute cost is nothing.

**Error text does not print the union either.** A bad key at 20 states produces
a 722-character message, elided by TypeScript, that names the offender exactly:

```
not a transition: 'i1: s01 -> s99'
```

## What could not be measured here

Whether the **editor's completion list** stays responsive as you type — the
actual reduce-as-you-type question. The pinned `typescript@7.0.2` is the native
port: it ships no JavaScript language-service API, and its `--lsp` server did not
answer `textDocument/completion` even for a **4-member** union, so that failure
is the harness, not the union size.

`playground.ts` exists for this. Open it and try steps 1–7 in its header.

## Findings

**1. The mechanism is the safe one.** `{ [K in Key<S,I>]?: Handler<S,I,K> }` is
a mapped type in exactly the family already verified to work — not the
standalone-generic-call shape that made the transition table (F) and combinator
edges (M) risky. It compiled on the first attempt.

**2. Bad keys are caught at the CALL, not on the line.** This is the real cost
found. Reading the topology back out (`Handled`, `Targets`, `Sources`) needs the
literal captured as `T`, and that capture makes every key "known" to
excess-property checking, so EPC cannot fire. Keys are validated explicitly
instead — good message, wrong location.

_Same class as the `object &` finding in `d1`: capturing a literal alongside a
checking member silently disables structural checks against that member._

What still lands **on the offending line**: wrong target data, reading a field
the source state does not have, and a typo'd `initial`.

**3. Spacing is load-bearing.** `'go:a->b'` is rejected, `'go: a -> b'` accepted.
Prettier will not normalise inside a string literal, so this is a papercut the
author eats.

**4. The reverse index is free.** `Sources<T, 'published'>` — every state that
can reach `published` — falls out of the same keys, no extra declaration. That
is the by-destination notation's one advantage, obtained without its layout.

**5. Listener events are narrowed BY THE PATTERN.** The pattern already names
the input, so the payload is knowable:

```ts
publication
	.on('submit: draft -> review', (e) => {
		e.on // 'submit'
		e.input.route // Submit — the payload, because the pattern named the input
		e.from.data // draft's data, narrowed
		e.to.data // review's data, narrowed
	})
	.on('open', (e) => e.input.text) // bare input name: payload known, states not
	.on('* -> published', (e) => {
		// `*` gives a union DISCRIMINATED BY `on`, so it narrows:
		if (e.on === 'submit') e.input.route
		if (e.on === 'decide') e.input.verdict
	})
```

This is the replacement for `enter` / `exit`: `'* -> tracking'` is entry,
`'tracking -> *'` is exit, one line each.

**6. `state()` and `input()` had to become overloads, not defaults.** A real bug
found while testing the above. With `state<T = void>()`, the call sits in a
position contextually typed by the still-unresolved `S`, so `T` infers as `any`
— and every data-free state silently accepted **any** data, every payload-free
input silently accepted **any** payload. Same class as the `nothing` trap in
`d1`, and equally invisible: everything compiled.

A parameterless overload has nothing to infer, so `void` is guaranteed:

```ts
export function state(): State<void>
export function state<T>(): State<T>
```

Both holes are now covered by negative tests.

## What is in here

| file              | what                                                           |
| ----------------- | -------------------------------------------------------------- |
| `lib.ts`          | the key language, handler types, validator, runtime, listeners |
| `neutral.ts`      | the neutral machine — 9 transitions, one flat block            |
| `check.ts`        | type-level assertions + 8 negative cases                       |
| `measurements.ts` | the 20-state / 10-input stress test                            |
| `playground.ts`   | **scratch file — open this to try completions**                |
| `traces.ts`       | executed behaviour, including listeners                        |

## Still not decided

- Question B locality: `draft`'s outgoing transitions are grep-able (`: draft ->`)
  but contiguous only by convention.
- Adding a state touches two places, `states:` and `transitions:`.
- `state()` is a placeholder for data-free states, which the target-keys
  notation had removed — bought back here in exchange for the state-name
  inference cliff going away entirely.
