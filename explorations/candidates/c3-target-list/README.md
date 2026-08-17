# Notation C — declared target list at a value position (NEGATIVE RESULT)

**This project intentionally does not compile.** It is kept as negative
evidence. Reproduce with:

    pnpm exec tsc -p explorations/candidates/c3-target-list/tsconfig.json

## What was being tried

Notation B puts a multi-target transition's targets in the handler's _return
annotation_:

```ts
submit: ({ data, input, at }): To<'review' | 'published'> => ...
```

That works, but the targets are a _type_, so the reader parses types and the
editor offers no completions unless the state-name union is nameable (note 06
F16). Notation C tried to move the same information to a **value** position,
where completions are free and the reader scans strings:

```ts
submit: { to: ['review', 'published'], with: ({ input, at }) => ... }
```

with `at` restricted to exactly the declared set, so the list cannot drift.

## Three encodings tried, all fail the same way

The target set was enumerated as a cross product of mapped types — one union
member per single target, one per ordered pair — so that `at` could be typed
against precisely the declared set.

| `to` encoding                                 | result                                     |
| --------------------------------------------- | ------------------------------------------ |
| `to: 'draft'` (single string)                 | works                                      |
| `to: ['review', 'published']` (tuple)         | **TS7031 on that edge's handler**          |
| `to: [...] as const`                          | **TS7031, unchanged**                      |
| `to: 'review', or: 'published'` (two strings) | **TS7031 on EVERY handler in the machine** |

The last row is the decisive one: adding the n² cross-product union made the
edge type too complex for TypeScript to select a member, so contextual typing
died for the _single_-target edges too, which had worked a moment earlier.

## The rule this establishes

Contextual typing of handler parameters survives only while the edge type is a
union TypeScript can resolve by a **single string-literal discriminant**.

- one string discriminant over n members — works
- an array of edge objects (notation A's guarded-clause list) — dies
- a tuple in the target position — dies
- a cross product of two discriminants — dies, and takes the simple cases with it

**Therefore a multi-target declaration cannot live at a value position in this
design family.** The return-type annotation is the only place a target _set_ can
go while keeping ordinary control flow in the body. That is not a preference; it
is the same wall hit from four directions.

This retroactively justifies notation B, and it means B's one real cost — that
the targets are a type rather than a value — is not a shortcut that a cleverer
value encoding can remove.
