# N2 — the transition table with a declared vocabulary

```bash
pnpm exec tsc  -p explorations/candidates/n2-declared-types/tsconfig.json
pnpm exec node explorations/candidates/n2-declared-types/traces.ts
```

Both clean. `traces.ts` prints `ALL PASSED`.

```ts
export type Publication = {
	inputs: {
		open: { readonly text: string }
		submit: Submit
		cancel: void
	}
	states: {
		empty: void
		draft: { readonly text: string; readonly revision: number }
		review: { readonly text: string; readonly reviewer: string }
	}
}

export const publication = machine({
	initial: 'empty',
	types: types<Publication>(),
	transitions: {
		'open: empty -> draft': ({ input }) => ({ text: input.text, revision: 0 }),
		'submit: draft -> review': ({ data, input, skip }) => …,
		'cancel: draft -> empty': () => {},
	},
})
```

Same key language as `n1`. The only change is that the vocabulary is **declared
as a type** instead of inferred from `state()` / `input()` marker values.

## It closes both of the silent holes found so far

**1. The `any` leak (n1, finding 6).** `state()` produced `State<any>`, because a
marker call's type parameter is inferred from a contextually-typed position — so
every data-free state silently accepted any data, and every payload-free input
accepted any payload. A written `void` has **nothing to infer**. The bug is not
fixed here, it is unrepresentable.

**2. The state-name inference cliff (d1).** When every state was data-free and
every handler a closure, `keyof S` collapsed to `string` and target names stopped
being checked — needing a guard whose error message was the fix. Names are now
declared, so they cannot be recovered wrongly. `check.ts` runs the exact machine
that broke `d1`; it infers correctly with no guard in the library at all.

Both are covered by `@ts-expect-error` cases, so a regression fails the build.

## Type cost, measured like-for-like

Same 20-state / 10-input stress test, same file set in both projects:

|                  | Types     | Instantiations | Time    |
| ---------------- | --------- | -------------- | ------- |
| n1, inferred     | 9 066     | 20 103         | 0.041 s |
| **n2, declared** | **8 400** | **14 864**     | 0.041 s |

~26% fewer instantiations. Real, but small — both are far inside any budget.
The reason to prefer declaring is correctness and ergonomics, not speed.

## What it gains beyond that

- **The vocabulary is an ordinary type.** `Publication` can be named, exported,
  imported, generated, made generic, or built with `Omit`/`&`. A marker map
  cannot: its types only exist inline at call sites.
- **`void` is honest.** No `state()` placeholder for data-free states — the
  thing that `d1` spent a whole round removing comes back as literally the type
  `void`.
- **One declaration instead of N calls.** 20 states is 20 lines of type, not 20
  `state()` invocations.

## What it costs

**1. States no longer exist at runtime.** This is the real new cost. `types<…>()`
erases to `{}`, so the machine object has no list of states — only transition
keys. Anything that wants to enumerate states loses its source: a visualiser, a
runtime exhaustiveness check, a dev-mode "valid states are …" message. A state
with no transitions at all disappears entirely. `n1` kept `states:` as a value
and had this for free.

**2. A second declaration site.** State names appear in the type and again in
every transition key, with nothing tying them together but the checker. Note this
is not a regression against `n1`, which already split `states:` from
`transitions:` — but it is one against `d1`, where a state's data and its
outgoing edges sat in one block.

**3. Hover and error text inline the whole literal** unless the type is named.
Writing `types<Publication>()` rather than `types<{ … }>()` fixes it, and should
be the documented idiom.

## An alternative shape

```ts
machine<Publication>()({ initial: 'empty', transitions: { … } })
```

Removes the `types:` property entirely, but needs the double call: TypeScript has
no partial type-argument inference, so specifying the vocabulary manually would
otherwise force the transitions literal to be specified too. `()()` reads worse
than one extra property, so the `types:` form is preferred here.
