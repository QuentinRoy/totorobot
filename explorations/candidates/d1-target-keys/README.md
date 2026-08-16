# Notation D — targets as keys

Type-checks clean; `traces.ts` executes and passes.

```bash
pnpm exec tsc  -p explorations/candidates/d1-target-keys/tsconfig.json
pnpm exec node explorations/candidates/d1-target-keys/traces.ts
```

## What you write

```ts
empty: {
	on: {
		open: { draft: ({ input }) => ({ text: input.text, revision: 0 }) },
	},
},

draft: {
	data: data<{ readonly text: string; readonly revision: number }>(),
	on: {
		revise: {
			keep: ({ data, input, skip }) =>
				input.text === data.text
					? skip()
					: { text: input.text, revision: data.revision + 1 },
		},
		submit: {
			review: ({ data, input, skip }) =>
				input.route === 'review'
					? { text: data.text, revision: data.revision, reviewer: input.reviewer }
					: skip(),
			published: ({ data, input, skip }) =>
				input.route === 'publish' ? ([data.text, data.revision] as const) : skip(),
		},
		cancel: 'empty',
	},
},
```

**No type annotations anywhere.** The target is a key; the branch just returns
that target's data, which is what the `{ to, with }` shape was reaching for.
`keep` and `repeat` name the current state and are the only reserved keys.

**A state with no data declares nothing.** `empty` above has no `data` and no
placeholder — see below for why that is safe, which was not obvious.

## Why this works where the others did not

Every previous multi-target attempt put the target set at a **value** position —
a tuple, or two discriminant properties — and each one broke contextual typing,
because the edge type stopped being resolvable by a single string-literal
discriminant (see `../c3-target-list/README.md`).

Targets as **keys** of a homomorphic mapped type mean there is no union to
discriminate at all:

```ts
type Edge<S, I, K, E, C> = {
	readonly [N in keyof S]?: (
		ctx: BranchCtx<S, I, K, E, C>,
	) => DataOf<S[N]> | Skip
} & {
	readonly keep?: (ctx: BranchCtx<S, I, K, E, C>) => DataOf<S[K]> | Skip
	readonly repeat?: (ctx: BranchCtx<S, I, K, E, C>) => DataOf<S[K]> | Skip
}
```

Each branch is **one function**, so ordinary narrowing works inside it:
`input.route === 'review'` makes `input.reviewer` available. The guard-vs-
projection split that forced Proposition 2 to invent a `match` primitive never
arises.

## Why `data` can be omitted (and why that took two tries)

The first version required `data` on every state and shipped a `nothing`
constant for the empty ones. Making `data` optional _appeared_ to work — it
compiled — and was hollow: with no marker there is no inference candidate for
`S[K]`, so TypeScript substitutes the constraint and checking collapses.

Two things were measured, and they are the whole fix:

1. **The substitution is all-or-nothing.** If the inferred `S` fails its
   constraint on _one_ key, TypeScript discards the entire inferred map, not
   just that slot. `Record<string, Data<any>>` therefore poisoned every state
   the moment one state went bare. Widening the constraint to
   `Record<string, unknown>` lets a bare state infer `unknown` while every other
   state keeps its real type.
2. **The default belongs in `DataOf`, not the constraint.**
   `DataOf<X> = X extends Data<infer T> ? T : void` — no marker means no data.

Two other routes were tried and both fail, for reasons worth recording.

**Compute `S` from the raw literal.** Infer the states object as `D` and derive
`S` from it. TypeScript **fixes** a type parameter that appears in the
contextual type of a context-sensitive function, and computing that contextual
type is what types the argument in the first place — so `D` pins to its
constraint before any inference has happened. Every state came out data-free
(`Show<Record<string, object>>`). A wall, not an oversight.

**Take the names from a bare type parameter.** Inference to `{ [K in N]: … }`
with `N` a plain parameter goes through `getIndexType(source)` instead of
reverse mapping, which has no inferability guard — so it looked like the escape
hatch. It is worse on three counts: target keys are themselves an inference site
for `N`, so a typo'd target becomes _"Property 'bb' is missing"_ (it is read as
a state you forgot to define) rather than an unknown target; a mixed machine
loses its data types entirely; and `N` still collapses to `string` in the
pathological case anyway.

### The one case that still cannot work — and it is loud

Two conditions have to coincide, and **neither alone is enough** — which is why
the first explanation of this was wrong:

- **(a) nothing in the states object is inferable.** In pass one TypeScript
  types every un-annotated closure as an internal non-inferrable `any`, and
  `createReverseMappedType` refuses a source made only of those: _"reverse
  mappable if it has a string index signature or if it has one or more
  properties and is of a partially inferable type"_.
- **(b) `S` occurs in a closure _parameter's_ type.** Computing that contextual
  type fixes `S`, and with (a) there is nothing to fix it to, so it locks to its
  constraint and never recovers on the second inference pass. Measured
  separately: with (a) alone — a `ctx` type that does not mention `S` — the
  names infer fine.

(b) is not removable: `ctx.data` is `DataOf<S[K]>` by construction, which is the
whole point of the notation. So the residual case is (a): every state data-free
**and** every branch a closure. `machine` carries an unsatisfiable member for
it, so it is a compile error whose text is the fix:

```
Property ''Cannot infer the state names: every state is data-free and every
branch is a closure. Give one state a `data` marker, or write one transition as
a bare target name.'' is missing …
```

Any one anchor repairs it, and `check.ts` verifies three of them rather than
asserting them: a bare target name, a zero-argument branch (arity zero is not
context-sensitive), an `enter` hook. The toggle and the neutral machine both
clear it without trying.

## Measured

|                                              | value                                                              |
| -------------------------------------------- | ------------------------------------------------------------------ |
| toggle                                       | **8** definition lines                                             |
| neutral machine                              | **70** definition lines                                            |
| `submit` stays one input reaching two states | **yes**, proven at runtime                                         |
| `decide` stays one input reaching two states | **yes**, proven at runtime                                         |
| conditional refusal                          | **yes** — unchanged `revise` is `none/declined`, changed is `keep` |
| terminal state                               | `published` declares no `on`; every input is `none/unavailable`    |

Negative evidence (`errors.ts`), nine cases, every `@ts-expect-error` load-
bearing: unknown target name, wrong target data, invalid source-data read,
unknown input name, data given to a data-free target, data read from a data-free
source, typo'd `initial`, typo'd bare target in an all-data-free machine, and
the bare shorthand used on a data-carrying target.

## Versus notation B (the annotated outcome, `c2-annotated-outcome`)

|                             | B: annotated                      | D: target keys              |
| --------------------------- | --------------------------------- | --------------------------- |
| toggle                      | 8                                 | 8                           |
| neutral                     | **60**                            | 70                          |
| target lives in             | a type annotation                 | **a key**                   |
| multi-target                | one ternary in one body           | one branch per target       |
| the deciding condition      | written **once**                  | **written once per branch** |
| both/neither branch matches | impossible — the ternary is total | **silently `declined`**     |

D is what the `{ to, with }` shape becomes when it is made to work, and it
removes the type annotation the annotated notation needs. It costs 10 lines on
the neutral machine and one real safety property.

## Honest weaknesses

1. **The discriminating condition is repeated, once per branch, negated.**
   `submit` states `input.route === 'review'` in one branch and
   `input.route === 'publish'` in the other. That is one decision written twice,
   and the two statements can drift.
2. **A logic error where every branch skips is silent.** It produces a handled
   `declined` — indistinguishable from a deliberate refusal. Notation B's
   ternary is total, so the same mistake is a compile error. This is the most
   serious cost of the design and it is not fixable by better types: the
   compiler cannot know that the branch conditions were meant to be exhaustive.
3. **Branch priority is object key order.** Declaration order decides which
   branch wins when two match. That is a weak thing to lean on, and reordering
   keys silently changes behaviour.
4. **`keep` and `repeat` are reserved key names.** A machine with a state
   actually called `keep` collides. Documented, not solved.
5. **A guarded transition to a data-free target still reads oddly.**
   `{ empty: ({ input, skip }) => (input.force ? undefined : skip()) }` — the
   `undefined` is the state's absent data, not a decline, and a reader may not
   see the difference from `skip()` at a glance. The unguarded case is now the
   bare `cancel: 'empty'` and does not have this problem.
6. **Tuple targets need `as const`.** `([data.text, data.revision] as const)`,
   or the array widens and fails.
7. Cases 1, 3 and 4 are not written, so the overfitting test has not been run
   against this notation.
