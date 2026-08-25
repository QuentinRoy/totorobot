# TypeScript type-system engineering for state-dependent APIs

> Research note. Evidence levels: [READ] full text, [ABSTRACT] abstract only,
> [SECONDARY] cited elsewhere. One extra tag is used: **[MEASURED]** means the
> claim comes from an experiment run for this note against
> `typescript@5.9.3` and `typescript@7.0.2` (the Go-native compiler already in
> this repo's `devDependencies`), with the minimal reproduction inlined here.

## Scope and questions asked

1. Is the **second declaration site** — a hand-written model type plus a
   `defineMachine<Model>()(...)` double call — actually forced by current
   TypeScript? The project's "Attempt 1"
   (`../design-record.md`) concluded yes, before `const` type
   parameters (5.0), `satisfies` (4.9) and `NoInfer` (5.4).
2. What techniques let a library check one property of an object literal
   against a contract derived from a **sibling** property of the same literal,
   with the error **on the offending property**?
3. Which techniques survive `.d.ts` emit and downstream consumption, and which
   break — exhaustively, since the project requires declaration survival.
4. What do the three target-visibility encodings from `10-synthesis.md` cost as
   _type_ problems: check time, error shape, declaration emit, tooling?
5. What are the real checker limits, and what does the editor cost?

Everything below about "the checker" was verified either by reading the shipped
`typescript.js` of 5.9.3 or by running both compilers.

## Key sources

**Peer-reviewed**

- Bastiaan Heeren, Jurriaan Hage, S. Doaitse Swierstra, "Scripting the Type
  Inference Process", _Proc. 8th ACM SIGPLAN Int. Conf. on Functional
  Programming (ICFP '03)_, 2003, pp. 3–13.
  DOI [10.1145/944705.944707](https://doi.org/10.1145/944705.944707);
  PDF at <https://cs.ou.nl/members/bastiaan/heeren-scripting.pdf> — [READ]
- Bastiaan Heeren, Daan Leijen, Arjan van IJzendoorn, "Helium, for learning
  Haskell", _Proc. 2003 ACM SIGPLAN Workshop on Haskell_, 2003, pp. 62–71.
  DOI [10.1145/871895.871902](https://doi.org/10.1145/871895.871902).
  Authors/pages verified against dblp — [ABSTRACT]

**Compiler primary sources**

- `typescript@5.9.3`, `lib/typescript.js` — checker constants read directly
  (`checkCrossProductUnion`, `instantiateType`, `isDeeplyNestedType`,
  `structuredTypeRelatedTo`) — [READ]
- microsoft/TypeScript wiki, "Performance",
  <https://github.com/microsoft/TypeScript/wiki/Performance> — [READ]
- "Announcing TypeScript 7.0", Microsoft DevBlogs, 8 July 2026,
  <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/> —
  [READ]
- microsoft/TypeScript#12936 "Exact Types", opened 2016-12-15, **open**,
  labels _Suggestion / Awaiting More Feedback_ — [READ]
- microsoft/TypeScript#53999 "New type param modifier to allow for partial
  inference based on signature declaration" (Andarist, an XState maintainer),
  opened 2023-04-24, **open**, label _In Discussion_, no milestone — [READ]
- microsoft/TypeScript#51679 "satisfies operator for generic type
  constraints", opened 2022-11-29, **closed as not planned**, label
  _Declined_ — [READ]
- microsoft/TypeScript#9998 "Trade-offs in Control Flow Analysis";
  PR#56908 (Hejlsberg) "Preserve type refinements in closures created past
  last assignment" — [ABSTRACT]
- Declaration-emit portability issues: #36800, #42873, #47663, #56107 —
  [ABSTRACT]
- PR#28854 (Hejlsberg) "Improve excess property checks" — [ABSTRACT]

**Engineering documentation**

- XState v5 `setup()` docs, <https://stately.ai/docs/setup> — [READ]
- TanStack Router "Type Safety" docs (the `Register` declaration-merging
  idiom) — [ABSTRACT]
- Kysely, "Dealing with the Type instantiation is excessively deep..." recipe,
  <https://kysely.dev/docs/recipes/excessively-deep-types> — [ABSTRACT]
- Zod v4 release notes / performance page — [ABSTRACT]
- ts-pattern README (`NonExhaustiveError`) — [ABSTRACT]
- `expect-type`, `tsd`, `@ark/attest` docs — [ABSTRACT]
- TypeScript 4.7 release notes, variance annotations — [ABSTRACT]

**Opinion / vendor**

- Prisma engineering blog, "Why Prisma ORM Checks Types Faster Than Drizzle",
  <https://www.prisma.io/blog/why-prisma-orm-checks-types-faster-than-drizzle>
  — [READ]. Vendor benchmark of a competitor; the _methodology_ is reusable,
  the framing is not neutral.

## Findings

### F1 — The single declaration site works. Attempt 1's conclusion is false under TS 5.9 and TS 7. [MEASURED]

A state's data can be declared as a **non-function-valued** phantom marker in
the same object literal as the transition handlers, and the handlers get a
contextual type computed from _every sibling state's_ data. Full reproduction:

```ts
declare const brand: unique symbol
export interface D<T> {
	readonly [brand]?: (t: T) => T
}
export declare function d<T>(): D<T>
type Un<X> = X extends D<infer T> ? T : never
type To<S extends Record<string, D<any>>> = {
	[N in keyof S]: (next: Un<S[N]>) => { to: N; data: Un<S[N]> }
}
type Next<S extends Record<string, D<any>>> = {
	[N in keyof S]: { to: N; data: Un<S[N]> }
}[keyof S]
type StateDef<S extends Record<string, D<any>>, K extends keyof S> = {
	data: S[K]
	on?: Record<string, (a: { data: Un<S[K]>; to: To<S> }) => Next<S>>
}
declare function defineMachine<S extends Record<string, D<any>>>(m: {
	[K in keyof S]: StateDef<S, K>
}): { states: S }
```

With three deliberate mistakes in `idle`, both compilers report:

```
(23,49) TS2353: Object literal may only specify known properties, and 'z'
        does not exist in type '{ x: number; y: number; tries: number; }'.
(25,29) TS2339: Property 'nope' does not exist on type 'To<{ idle: ...
(27,54) TS2339: Property 'nosuch' does not exist on type '{ tries: number; }'.
```

Errors land on the exact sub-expression, with exact columns. No `const` type
parameter, no `NoInfer`, no `satisfies`, no second declaration, no curried
call. TS 5.9.3 and TS 7.0.2 produce byte-identical diagnostics here.

**Why it is non-obvious:** it looks circular — `idle`'s handler is checked
against `armed`'s data while both are being inferred from one literal.

### F2 — The mechanism is `CheckMode.SkipContextSensitive`, and it explains exactly why Attempt 1 failed.

TypeScript infers type arguments in two passes. In the first, an argument that
is _context-sensitive_ (a function expression with unannotated parameters, or
an object literal containing one) is checked with the context-sensitive parts
replaced by a placeholder; every other property still contributes inferences.
Only then is the type parameter fixed and the function bodies re-checked with
a complete contextual type. So `data: d<{...}>()` — a plain call, not a
function — is inferred in pass 1 for _all_ states, and pass 2 hands every
handler a fully populated `S`.

Attempt 1 broke this in a specific, avoidable way: it built each state with its
**own generic call**, `state((transition: Builder<...>) => [...])`. A nested
call expression is inferred in isolation from its own arguments; it cannot see
`defineMachine`'s type parameter, so `transition('next', 'green', ...)` had no
way to know what `green` is. The library was then forced to compare results
_after_ both calls resolved, which is why the diagnostics were machine-wide.

**The rule that follows:** per-state and per-transition helpers must be
**passed in** (parameters of a contextually-typed callback, like `to`/`at`
above) rather than **imported and called** at each site. Contextual typing
flows down; inference flows up and cannot see sideways.

### F3 — Excess-property checking is best-effort and is silently suppressed by a sibling error. [MEASURED]

A misspelled key that is caught _only_ by excess-property checking disappears
as a diagnostic if any other property of the same object literal fails
assignability — in either order, in both compilers:

```ts
on: {
  'p1 -> armd':  ({ data }) => ({ x: 0, n: data.n }),   // misspelled target
  'p2 -> armed': ({ data }) => ({ n: data.n }),         // missing `x`
}
// reported: only the TS2322 for 'p2 -> armed'.  The typo is silent.
```

In isolation the typo does report (`TS2353`). Excess-property checking also
requires a _fresh_ literal: it is lost through a variable, a spread, or a type
assertion (PR#28854; TS FAQ). Any design whose only defence against a
misspelled target is excess-property checking has a hole exactly when the user
is already in trouble.

### F4 — There are no exact/closed object types, and there will not be soon.

microsoft/TypeScript#12936 is open since December 2016 with the labels
_Suggestion_ and _Awaiting More Feedback_ [READ]. Nine and a half years of
"awaiting feedback" is a decision. Freshness-based excess-property checking is
the only closure mechanism available, with the limits in F3.

### F5 — The real checker limits, read from the compiler. [READ, typescript@5.9.3]

| Limit                          | Constant in `typescript.js`                                                                               | Diagnostic    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------- |
| Instantiation depth            | `instantiationDepth === 100`                                                                              | TS2589        |
| Instantiation count            | `instantiationCount >= 5e6`                                                                               | TS2589        |
| Cross-product union size       | `size >= 1e5` in `checkCrossProductUnion`                                                                 | TS2590        |
| Subtype-reduction bail         | `count === 1e5` and estimate `> 1e6`                                                                      | TS2590        |
| Tuple length                   | `>= 1e4` elements                                                                                         | TS2589-family |
| Relation recursion             | `sourceDepth === 100 \|\| targetDepth === 100`                                                            | depth bail    |
| "Deeply nested type" heuristic | `isDeeplyNestedType(..., maxDepth = 3)`; `10` for mapped types; **`2` for reverse mapped type inference** | silent bail   |

The last row matters for F1's design: `inferReverseMappedType` — the mechanism
that recovers `S` from `{ [K in keyof S]: StateDef<S, K> }` — pushes source and
target onto their own stacks and stops inferring once _both_ look deeply nested
at `maxDepth = 2`. Nesting machines inside machines through the same mapped type
would meet this limit long before any of the headline ones.

The TypeScript team has repeatedly declined to make these configurable
[SECONDARY, issue threads]; they are implementation details, not contract.

### F6 — At interaction-technique scale, check time is a non-issue; it becomes one at ~80 states. [MEASURED]

Per-state cost of three encodings, single file, `--extendedDiagnostics`,
TS 5.9.3 on Apple Silicon. (a) = target as a checked string argument;
(b) = target in a template-literal key `'press -> armed'`; (d) = target as a
sibling property in a discriminated edge record. Two transitions per state.

| states | (a) types / inst / check | (b) types / inst / check | (d) types / inst / check |
| ------ | ------------------------ | ------------------------ | ------------------------ |
| 4      | 448 / 1 073 / 0.03s      | 522 / 1 445 / 0.03s      | 524 / 800 / 0.03s        |
| 20     | 976 / 4 865 / 0.05s      | 1 962 / 7 445 / 0.06s    | 1 620 / 4 216 / 0.05s    |
| 80     | 2 956 / 19 085 / 0.13s   | 16 482 / 43 625 / 0.20s  | 10 320 / 30 736 / 0.13s  |

Encoding (a) is linear in states (~37 types, ~240 instantiations each).
Encoding (b) is quadratic in _types_ — the template-literal mapped type
materialises one pattern index signature per state name per state — 5.6× (a)
at n=80. At the project's stated 2–20 states, all three are indistinguishable:
**type-check cost cannot be used to choose between the encodings.**

For calibration: Zod v4 reports ~175 instantiations for a typical schema
against 25 000+ in v3 [ABSTRACT], and Prisma's benchmark puts a Northwind
Drizzle schema at 41 150 instantiations versus Prisma's 428 [READ, vendor].
A 20-state machine at 4 216 instantiations is a small object by these
standards.

### F7 — TypeScript 7 changes the constant factor, not the semantics. [MEASURED]

On the same 80-state file: TS 5.9.3 check time 0.13 s / wall 0.34 s;
TS 7.0.2 check time 0.051 s / wall 0.06 s (3 runs each, identical to 0.01 s).
Instantiation counts are the same to within 5 (19 085 vs 19 090). Every
diagnostic in every experiment in this note was identical in text and position
between the two compilers, except that TS 7 sometimes picks a more specific
code (TS2741 where 5.9 used TS2345) and orders union members differently.

The official announcement claims 7.7×–11.9× on full builds (vscode
125.7 s → 10.6 s), memory −6 % to −26 %, and "opening a file with an error"
in vscode from 17.5 s to under 1.3 s [READ]. It also states 7.0 is built to be
compatible with 6.0's type-checking behaviour.

**Consequence:** TS 7 does not license type-level extravagance. It divides the
wall clock by ~10 and leaves every limit in F5 exactly where it was.

### F8 — Declaration emit survives the single-declaration design, and the emitted `.d.ts` is small. [MEASURED]

```ts
export declare const m: import('./lib.ts').Machine<{
	idle: import('./lib.ts').D<{ tries: number }>
	armed: import('./lib.ts').D<{ x: number; y: number; tries: number }>
}>
```

Handler bodies do not appear. A local, _unexported_ interface used in a
state's data is re-declared inside the `.d.ts`, which is fine.

### F9 — Declaration emit breaks in three specific, predictable ways.

1. **TS4023** — `Exported variable 'm' has or is using name 'D' from external
module "..." but cannot be named.` Triggered [MEASURED] by making the
   phantom marker type non-exported. **Rule: every type that can appear inside
   an inferred machine type must be exported from the library's public
   entry.** This includes phantom brands, `Machine<>`, and any helper alias
   the inferred type mentions.
2. **TS2742** — `The inferred type of X cannot be named without a reference to
Y. This is likely not portable.` Arises from package layout, not from the
   type: pnpm's symlinked store, Yarn PnP virtual paths, duplicated typings,
   and `exports`-map deep paths the emitter cannot express (#36800, #47663,
   #58474, #56107) [ABSTRACT]. Mitigation is to keep the _whole_ public type
   surface reachable from one entry point so the emitter never needs a deep
   specifier.
3. **TS9010** under `--isolatedDeclarations` — `Variable must have an explicit
type annotation` [MEASURED]. This is fatal for the whole approach _in the
   consumer's build_: a downstream project that enables `isolatedDeclarations`
   (increasingly common for fast oxc/swc-based `.d.ts` builds) cannot `export`
   an inferred machine at all. Non-exported machines are unaffected — and an
   interaction technique is usually internal — but a library that also wants
   to be _re-exported_ needs an explicit-model escape hatch. That escape hatch
   is exactly the second declaration site, now optional rather than mandatory.

### F10 — Narrowing dies in callbacks, which is the only place interaction code lives. [MEASURED]

Given `declare const m: { state: Idle | Armed }`:

| situation                                                           | narrowed?           |
| ------------------------------------------------------------------- | ------------------- |
| `if (m.state.name === 'armed') m.state.data.x`                      | yes                 |
| ... then an intervening `g()` call, then `m.state.data.x`           | **yes — unsoundly** |
| `setTimeout(() => m.state.data.x)` after the check                  | **no** (TS2339)     |
| `const s = m.state; if (s.name==='armed') setTimeout(()=>s.data.x)` | yes                 |
| same with `let s`, reassigned anywhere later                        | **no**              |

Two problems at once. The unsound one: TypeScript does not invalidate
narrowing across arbitrary calls (#9998 records the deliberate trade-off), so
`m.state` stays narrowed after a call that could have driven the machine
somewhere else. The inconvenient one: narrowing is not carried into closures
created after the check, unless the value is captured in a `const` whose last
assignment precedes the closure (Hejlsberg, PR#56908, shipped in 5.4)
[ABSTRACT]. So the only correct pattern is `const s = m.state` — a snapshot,
which is honest, because by the time the callback runs the snapshot may be
stale anyway.

**Non-obvious consequence:** "narrow the live machine and get its capabilities"
is not a typestate guarantee in TypeScript. It is a guarantee _about a
snapshot_. A design that hands the current state's capabilities to the handler
as a parameter is strictly sounder than one that asks users to narrow a shared
object.

### F11 — `satisfies` cannot express a self-referential contract, and the request to make it do so was declined.

`satisfies` needs a concrete, already-named type on its right-hand side. There
is no `satisfies Machine<infer _>`. microsoft/TypeScript#51679, which asked for
`satisfies` against a generic constraint, was **closed as not planned** with
the _Declined_ label [READ]. So `satisfies` is not a route to a single
declaration site; the identity-function wrapper (`defineMachine(...)`) remains
the only way to get a constraint checked while keeping inference.

Two further `satisfies` facts, both commonly misreported [MEASURED]:

- It **does** perform excess-property checking on a fresh literal (TS2353).
- It **does not** universally preserve literal types. `{ b: 'q' } satisfies
{ b: string }` gives `b: string`. Literals survive only when the target type
  admits them (`b: 'q' | 'r'`) or is loose (`Record<string, unknown>`).

### F12 — The double call is a workaround for a known, unresolved TypeScript gap — filed by an XState maintainer.

`defineMachine<Model>()(...)` exists because type-argument inference is
all-or-nothing: supplying one argument forces you to supply all. #53999 asks
for a type-parameter modifier that allows partial inference; it is open,
labelled _In Discussion_, with no milestone, and was opened by Andarist
citing XState's needs [READ]. `NoInfer` (5.4) and `const` type parameters
(5.0) are mentioned there as partial substitutes, not solutions.

**Reading:** the curried call is not a design choice, it is scar tissue over a
compiler gap. If the design does not _need_ an explicit type argument — and
F1 says it does not — the curry disappears with it.

### F13 — What the comparable libraries actually do, stripped of marketing.

- **Zod**: a builder where each call returns a new schema object carrying an
  inferred output type; the "single declaration site" is trivially satisfied
  because there is only one site. v4's headline change was cutting
  instantiations ~100× by simplifying the base class's generics [ABSTRACT].
  Nothing here is transferable to sibling-property checking.
- **Drizzle**: schema-as-TypeScript, no codegen, types re-derived at each query
  site. Prisma's benchmark blames "non-homomorphic mapped types", deeply
  nested conditionals and intersection-heavy unions for the 96× instantiation
  gap [READ, vendor]. The transferable part is the _diagnosis_, not the score:
  keep mapped types homomorphic (`{[K in keyof S]: ...}`, not
  `{[K in Names<S> as ...]: ...}`), and prefer interfaces to intersections.
- **Kysely**: the fluent builder is the inference boundary. It ships an
  official recipe for TS2589 and an explicit `$assertType` escape hatch that
  _collapses_ a complex inferred type to a user-asserted equivalent
  [ABSTRACT]. A type-collapse escape hatch is a shipping requirement for this
  class of library, not an admission of failure.
- **tRPC / TanStack Router**: both reach for **declaration merging** into a
  global `Register` interface to make an inferred type nameable everywhere
  else in the program [ABSTRACT]. This is the standard answer to "I need this
  inferred union at a site that cannot see the value". TanStack additionally
  needs codegen for the route tree, which this project has excluded.
- **ts-pattern**: encodes failure as a _value-level_ type, `NonExhaustiveError<
RemainingCase>`, returned from `.exhaustive()`; the error then surfaces as an
  ordinary assignability failure naming the missing case [ABSTRACT]. This is
  the cleanest available imitation of a library-defined type error.
- **XState v5 `setup()`**: a genuine curried double call,
  `setup({...}).createMachine({...})`, with types declared by assertion —
  `types: { context: {} as {...}, events: {} as ... }` [READ]. Note what this
  is: XState removed typestates (note 07, F1) _and still_ kept a second
  declaration site for context and events. It is not evidence that the second
  site is necessary; it is evidence that XState never tried F1's arrangement,
  which is unsurprising given that its own maintainer filed #53999.

### F14 — Encoding (a), target as a checked string argument: best data locality, no navigation. [MEASURED]

`press: ({ data, go }) => go('armed', { x: 0, n: data.n })`

- Wrong target: `TS2345: Argument of type '"armd"' is not assignable to
parameter of type '"idle" | "armed"'.` — on the string, exact column.
- Wrong data: error on the data literal, `Property 'x' is missing...`.
- **Completions: yes.** tsserver returns `idle`, `armed` inside the quotes.
- **Go-to-definition: no.** `definition` returns `[]`.
- **Rename: effectively no.** Renaming the state key `armed:` returns only
  locations on the declaration line. Renaming _from_ the string reports
  `canRename: true` but returns a single location — the string itself. With
  `findInStrings: true` the target string is found, but that is a textual
  match over strings, so it will also rewrite unrelated occurrences.
- Declaration emit: clean.

**This contradicts `10-synthesis.md`, inference 4**, which asserted that a
string-literal target "participates in rename". It participates in
_completion_; it does not participate in rename or go-to-definition.

### F15 — Encoding (b), target in a template-literal key: passes the arrow test, loses completions entirely. [MEASURED]

`'press -> armed': ({ data }) => ({ x: 0, n: data.n })`

- Data errors: reported, but as a whole-function-type mismatch on the
  property, not on the returned literal.
- Misspelled target: only via excess-property checking — see F3, so it can
  vanish.
- **Completions: none.** A mapped type over `` `${string} -> ${Names<S>}` ``
  produces _pattern index signatures_, and tsserver falls back to global scope
  inside the quotes (verified: empty `entries`).
- Cost: quadratic type growth (F6).
- Declaration emit: works, but the `.d.ts` carries index signatures.

**But**: if the key set is _finite_, completions come back in full. With
`` type Arrow = `${Inputs} -> ${Names<S>}` `` where `Inputs` is a known union,
tsserver offers the whole cartesian product (`press -> armed`,
`press -> idle`, `cancel -> armed`, ...). That requires the input vocabulary to
be declared independently of the map — a _second declaration site for inputs_,
which is a much smaller tax than a full model type, and it is what causes the
type-count blow-up.

### F16 — Encoding (c), target in the handler's declared return type: works, but completion depends on a nameable union. [MEASURED]

The Rust-style version needs the whole state map named (`At<S1, 'armed'>`),
which is the second declaration site. A **cheaper hybrid** works and appears
not to have been considered: annotate only the _target name_, and let a passed
-in `at` do the data check.

```ts
export type To<N extends string> = { readonly to: N; readonly data: unknown }

press:  ({ data, at }): To<'armed'>          => at('armed', { x: 0, n: data.n }),
cancel: ({ data, at }): To<'idle' | 'armed'> =>
  data.x > 3 ? at('idle', { n: data.n }) : at('armed', { x: data.x, n: data.n }),
```

- Annotation/body disagreement: `Type 'To<"idle">' is not assignable to type
'To<"armed">'.` — short, readable, on the returning expression.
- Multi-target transitions need no mini-language: an ordinary ternary works,
  and the union in the annotation still states the arrows at a fixed position.
- Declaration emit: clean.
- **Completions inside `To<'…'>`: none** — string-literal completion in a type
  argument comes from the type parameter's declared _constraint_. Changing the
  declaration to `To<N extends 'idle' | 'armed'>` restores completions
  immediately (verified). So (c) buys arrow-test compliance at the cost of
  discoverability, unless the state-name union is nameable — via a tiny
  separate declaration, or via the `Register` declaration-merging idiom of F13.

### F17 — Encoding (d), target as a sibling property of a discriminated edge record: the best error messages of the four. [MEASURED]

```ts
on: { press: { to: 'armed', with: ({ data }) => ({ x: 0, n: data.n }) } }
```

with `Edge<S,K> = { [N in Names<S>]: { to: N; with: (a) => Un<S[N]> } }[Names<S>]`.

- Misspelled target: **`TS2820: Type '"armd"' is not assignable to type
'"idle" | "armed"'. Did you mean '"armed"'?`** — a spelling suggestion, on
  the `to:` value. No other encoding produces this.
- **Completions on `to:`: yes** (`idle`, `armed`).
- Wrong data: anchored on the whole edge object rather than the returned
  literal, but the elaboration is exact: _"The types returned by `with(...)`
  are incompatible… Property 'x' is missing"_.
- Cost: between (a) and (b) — 1 620 types / 4 216 instantiations at 20 states,
  slightly _fewer_ instantiations than (a) at that size, though it crosses over
  and costs ~60 % more by 80 states.
- Declaration emit: clean.

This is the only encoding that is simultaneously arrow-test compliant
(`to:` sits immediately after the input key, formatter-stable), completion-
driven, and equipped with did-you-mean errors. Its weakness is that a
multi-target transition needs several entries or a nested union.

### F18 — Library-defined type errors have 22 years of research behind them and no TypeScript equivalent.

Heeren, Hage and Swierstra propose four externally-supplied "type inference
directives" for a constraint-based inferencer, all implemented in Helium:
**specialized type rules** with library-authored messages (§3.1), **phasing**
— assigning constraints to numbered phases so they are solved in a chosen
order (§3.2), **sibling functions** — declaring `<*>` and `<*` related so the
compiler can suggest the swap (§3.3), and **permuted arguments**, on by
default, which reports _"probable fix: flip the arguments"_ (§3.4) [READ]. The
directives are checked for soundness against the underlying type system, and
live in a separate `.type` file so no compiler change is needed.

Their diagnosis of the problem is exactly this project's: for a combinator
library, "all type errors are reported in terms of the host language"
(Heeren et al., ICFP 2003), not the library's concepts.

TypeScript offers none of this. The available substitutes are weak and each
costs something:

- **Error-carrying types** in the ts-pattern style: make the failing branch
  resolve to `{ ERROR: 'transition to `armed`must supply`x`' }` so the
  message quotes your sentence. Works; but the sentence appears inside an
  assignability failure whose other half is your internal type, and the error
  attaches wherever the value flows, not where the mistake is. Attempt 1's
  `StateDefinition<...> & { ERROR: ... }` was this technique, and its failure
  was locality, not the technique.
- **Overload ordering**: TypeScript reports the _last_ overload's failure by
  default, so a deliberately-narrow final overload can shape the message.
  Fragile and hostile to editors.
- **`@ts-expect-error`, `expect-type`, `tsd`, `@ark/attest`**: the testing
  layer. `expect-type` is dependency-free and used by tRPC and Prisma Client;
  `tsd` ships a patched TypeScript (~2.6 MB); `@ark/attest` uniquely reports
  **deterministic instantiation counts**, which is how the Prisma/Drizzle
  numbers in F6 were produced [ABSTRACT]. For a library that promises specific
  diagnostics, negative tests are the only regression net — TypeScript will
  happily change a message across minor versions.

### F19 — Variance annotations are a performance tool, not a correctness tool, and this design will not need them.

TS 4.7's `in` / `out` / `in out` let a library assert a type parameter's
variance so the checker can skip structural comparison; the release notes
recommend them for _deeply recursive_ library types and point at
`analyze-trace` to decide whether variance computation is a bottleneck
[ABSTRACT]. A 2–20 state machine with a non-recursive `S` will never reach
that. Method-shorthand parameters remain bivariant even under
`strictFunctionTypes` (which only applies to function-type _properties_), so
declaring handlers as properties `on?: Record<string, (a) => ...>` rather than
methods is what actually buys strictness here — and F1's shape already does.

### F20 — Measurement, concretely.

`tsc --extendedDiagnostics` gives Parse/Bind/Check/Total and, crucially,
**Instantiations**, which is deterministic across machines and therefore the
only number worth putting in a regression test. `tsc --generateTrace <dir>`
emits a Chrome-tracing JSON plus a types dump; `@typescript/analyze-trace`
summarises the hotspots. `--generateCpuProfile` profiles the compiler itself.
For the editor, `"typescript.tsserver.log": "verbose"` plus _TypeScript: Open
TS Server log_ [READ, Performance wiki]. TS 7.0.2 supports `--diagnostics`,
`--extendedDiagnostics` and `--generateTrace`, and adds `--checkers`
(default 4), `--builders` and `--singleThreaded` [READ + MEASURED].

## Design moves worth stealing

1. **Pass helpers in; never import-and-call them per state.** `to`, `at`, `go`
   arrive as parameters of a contextually-typed handler. Source: F2, and the
   diagnosis of Attempt 1. Cost: handlers gain a destructured parameter; the
   API cannot offer free-standing combinators.
2. **Declare state data as a non-function value in the literal.** A
   `d<Data>()` phantom marker is inferred in pass 1 and unlocks sibling
   visibility. Source: F1. Cost: one extra exported type and one nonsense-
   looking call per state; the brand type must be exported (F9).
3. **Keep every mapped type homomorphic.** `{ [K in keyof S]: ... }` supports
   reverse inference and is cheap; `as`-clause remapping and pattern index
   signatures are not (F6, F13). Cost: the key set must literally be `keyof S`.
4. **Target as a discriminant sibling property.** `{ to: 'armed', with: ... }`
   buys `TS2820` did-you-mean errors and completions (F17). Cost: one extra
   nesting level, and multi-target transitions must be split.
5. **Ship a type-collapse escape hatch.** Kysely's `$assertType` (F13) — a
   method that replaces a complex inferred type with a user-supplied
   structurally-equal one. Cost: a small API surface; the payoff is that users
   who hit TS2589, TS9010 or an editor stall have somewhere to go.
6. **Offer `Register` declaration merging as an _optional_ nameability hook.**
   tRPC/TanStack (F13). It makes the state-name union nameable at annotation
   sites, which is precisely what encoding (c) needs for completions (F16).
   Cost: a global; it only works for one machine per program unless keyed.
7. **Error-carrying types for the diagnostics you care most about**, in the
   ts-pattern `NonExhaustiveError<Case>` style, and only where the error can
   still attach locally. Source: F18, and the research precedent in Heeren et
   al.'s specialized type rules. Cost: worse messages than none when the value
   flows somewhere unexpected — Attempt 1's actual failure.
8. **Regression-test the diagnostics, not just the types.** `expect-type` for
   assertions plus `@ark/attest` for instantiation counts, both cheap; add a
   fixture that asserts _positions_, since that is the property this whole
   note is about (F20).

## Traps, negative results, and things that failed

- **Attempt 1's architecture, not object-literal inference, was the bug** (F2).
  Re-running its conclusion under TS 5.9/7 does not reproduce it once the
  per-state helper calls are removed.
- **`satisfies` is a dead end for self-referential contracts** and the feature
  request was declined (F11).
- **Excess-property checking cannot be relied on** for misspelled targets: it
  is suppressed by any sibling assignability error and lost on non-fresh
  values (F3). Encoding (b) depends on it and therefore has a real hole.
- **Template-literal keys kill completions** unless the key set is finite
  (F15), and cost quadratic type growth.
- **String-literal targets do not rename** (F14) — this contradicts the
  project's own synthesis.
- **Narrowing a shared machine object is unsound across calls and dead inside
  callbacks** (F10).
- **`--isolatedDeclarations` is categorically incompatible** with exporting an
  inferred machine (F9.3). This is the one hard argument for keeping an
  explicit-model path available.
- **Reverse mapped-type inference bails at depth 2** (F5) — nested/hierarchical
  machines through the same mechanism will fail quietly.
- **Deferred whole-machine validation is fragile** for the reasons Attempt 1
  listed (`never` distributing, `unknown | Error` collapsing, intersections of
  error objects reducing to `never`). Those hazards are real and unchanged;
  the point of F1 is that you no longer need the machinery that triggers them.
- **TS 7 rescues nothing structural** (F7). Anyone arguing "the new compiler is
  fast enough for heavier types" is arguing against a 10× constant, with every
  hard limit unmoved.

## Disagreements and open questions in the literature

- **Type-level complexity: cost or investment?** Drizzle's position is that
  inference-from-schema with no codegen is worth the compiler bill; Prisma's
  benchmark says the bill is 96× [READ, vendor]. Both sides measure
  instantiations, which is at least a shared instrument. Neither has published
  an _authoring-time_ measurement, which is the quantity this project actually
  cares about.
- **Is XState's retreat evidence?** XState removed typestates for unsoundness
  (note 07) and kept a curried `setup()`. But its maintainer's #53999 shows the
  curry is a workaround for a compiler gap, not a considered API. The two
  facts are usually cited together as one verdict; they are not.
- **Does the research on library-defined type errors transfer at all?** Heeren
  et al. rely on a constraint-based inferencer with a clean separation between
  generating and solving constraints, and on directives _checked for soundness_
  against the type system. TypeScript has neither. Whether the error-carrying-
  type imitation is worth its locality cost is genuinely open, and Attempt 1 is
  one data point against.
- **Unmeasured:** nobody publishes editor-latency numbers for these libraries.
  All the public evidence is batch `tsc` time, which is not what an author
  experiences. `tsserver.log` timings would settle it and appear in no
  comparison I found.

## Implications for a typestate FSM library for interaction techniques

**The second declaration site is not forced by current TypeScript. Verdict:
drop it.** F1 is a working counter-example with local diagnostics at exact
columns, on both the 5.x and 7.x compilers, using nothing newer than
homomorphic mapped-type inference and context-sensitive argument deferral —
both of which long predate Attempt 1. Attempt 1's finding was a correct
observation about a specific architecture — per-state generic helper calls —
generalised into a false claim about object-literal inference. It should be
retired, and `../design-record.md` should say so.

Two caveats keep an explicit-model path alive, but only as an _option_:
`--isolatedDeclarations` consumers who re-export a machine (F9.3), and users
who hit TS2589 in a pathological machine (F5, Kysely's precedent in F13).
Neither is the common case for a 4-state Marking Menu.

**Kill the curried `defineMachine<Model>()(...)`.** It exists to supply one
type argument while inferring the rest — the exact hole #53999 documents
(F12). If nothing has to be supplied, nothing has to be curried. Note 09's
measured result that factories are slower to use than constructors (p = 0.005)
makes the double call a _measured_ DX cost, not an aesthetic one.

**On the arrow test, the synthesis's ranking should change.** Its inference 4
— that a string-literal target "checks, drives completion, and participates in
rename" — is two-thirds right: completion yes, rename no, go-to-definition no
(F14). No encoding tested gives rename. That removes rename from the decision
and leaves error quality and completion, on which the ranking is:

|                             | arrow test               | completions               | bad-target error             | data error locality           | check cost |
| --------------------------- | ------------------------ | ------------------------- | ---------------------------- | ----------------------------- | ---------- |
| (d) `{ to: 'armed', with }` | **yes**                  | **yes**                   | **TS2820 + did-you-mean**    | on the edge, good elaboration | low        |
| (a) `go('armed', {...})`    | only if body is one call | **yes**                   | union mismatch on the string | **on the data literal**       | lowest     |
| (c) `: To<'armed'> =>`      | **yes**                  | no (needs nameable union) | on the annotation, 2 errors  | via `at`, precise             | low        |
| (b) `'press -> armed':`     | **yes**                  | **no**                    | **can vanish (F3)**          | on the property               | quadratic  |

Encoding (b) — the one the synthesis flagged as "unexplored" and worth
re-examining now that template-literal types can check keys — is the **worst**
of the four on type grounds: no completions, a defeatable misspelling check,
and quadratic type growth. Re-examined, it should be dropped, not revived.

The interesting result is (d), which appears in none of the propositions and
is not in the synthesis's list of three. It puts the target at a fixed
position immediately after the input key, gets did-you-mean errors for free,
and costs fewer instantiations than the argument form. Its cost is real —
multi-target decisions must be split into several keyed entries with guards,
which is the trade the evaluation brief predicted a fixed target position would
force. **(c') is the escape valve for exactly that case:** an annotated return
type of `To<'idle' | 'armed'>` keeps ordinary ternaries and early returns while
still stating the arrows at a fixed position (F16). A library could offer both:
(d) as the default one-target form, (c') for the branching handler. Neither
needs a mini-language.

**Stop promising typestate through narrowing.** F10 says the property "knowing
the current control state statically gives you only the legal capabilities" is
delivered soundly only inside a handler that _receives_ its state, and is
delivered unsoundly by any `if (m.state.name === …)` in user code — which then
also stops working the moment the user writes `setTimeout` or
`addEventListener`, i.e. always, in this domain. The typestate guarantee this
library can honestly make is **at the declaration site** (a transition must
produce its target's data) and **inside handlers** (a handler sees its own
state's data and its own legal targets), not at arbitrary observation points.
This is a smaller promise than `requirements.md` implies, and it is the one
that survives contact with browser callbacks.

**Cheap operational rules for the implementation.** Export every type that can
appear in an inferred machine type (F9.1). Keep the machine type reachable
from one entry so the emitter never writes a deep specifier (F9.2). Keep
mapped types homomorphic over `keyof S` (F6). Declare handlers as properties,
not methods, so `strictFunctionTypes` applies (F19). Add `expect-type`
fixtures that assert error _positions_, and an `@ark/attest` instantiation
budget — around 4 000 instantiations for a 20-state machine is the measured
baseline (F6), and a regression past ~10× that is the signal to stop.
