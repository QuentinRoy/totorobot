# Implementation record

> **Read this if you are about to change the source.** It is the standing list of
> compiler behaviour this project has run into — what the type layer does, what it
> refuses to do, and which construction to reach for instead. It is written for
> whoever, or whatever, is editing `src/`; a reader who only wants to know why the
> API is shaped the way it is wants [the design record](design-record.md) instead,
> and a reader who wants the API itself wants [the README](../README.md).
>
> Almost every entry here was discovered by a test asserting that something
> **illegal** fails; no positive test has ever caught one. Where there is
> compilable evidence it is in [`explorations/`](../explorations/README.md), which
> `pnpm typecheck` covers, so a finding that stops holding fails the build rather
> than rotting here.

## How to cite an entry

Identifiers are stable for the life of the repository. A new finding is appended
with the next free number; a superseded one is marked superseded in place rather
than deleted; **nothing is ever renumbered**. Cite a finding as `I7`, or link it as
[`implementation-record.md#i7`](#i7) — never by position, and never by line number.
Each entry is measured against the TypeScript version it names.

## Findings

### <a id="i1"></a>I1 — The cross-product rule is narrower than first recorded

An early rule held that a cross-product of discriminants at value positions kills
contextual typing. It does not, in general. The classic-records encoding — a flat
row `{ event, from, to, … }`, a cross-product of _three_ discriminants (prototype
`explorations/candidates/o1-classic-table`) — is discriminated correctly by
TypeScript 7.0.2. The rule holds only for the encodings actually measured; measure
again before carrying it to a new one.

### <a id="i2"></a>I2 — Marker calls leak `any`

A marker written inside the map it describes — `state<T = void>()` sitting in the
state map — is contextually typed by a map that has not resolved yet, so `T`
infers as `any` and every check downstream of it silently passes. A parameterless
_overload_ has nothing to infer, and a **declared** vocabulary avoids the position
altogether.

### <a id="i3"></a>I3 — A type parameter in a closure's parameter type is fixed to its constraint

When a type parameter appears in the parameter type of a callback, it is fixed to
its constraint before inference runs. This is what killed "compute the state-name
union `S` from the raw object literal", and it is the mechanism behind the
state-name inference cliff: the names are wanted before the compiler is willing to
work them out. See also [I6](#i6), which is the other half of the same behaviour.

### <a id="i4"></a>I4 — `T[I]` inside a mapped-type template forces `T` to resolve

An indexed access inside the template of a mapped type forces the whole of `T` to
resolve, which collapses the result to `never`. A `const` type parameter does not
help. Per-row precision has to come from a union of row types instead of from
indexing one object type per row.

### <a id="i5"></a>I5 — Capturing a literal alongside a checking member disables excess-property checking

In an intersection, a key counts as "known" if _any_ member has it — so a member
added purely to capture the literal turns off excess-property checking against the
member that was supposed to do the checking. This cost the string-keys prototype
(`explorations/candidates/n1-transition-table`) its per-line errors until a second
checking member restored them.

### <a id="i6"></a>I6 — Reverse-mapped inference needs one non-closure leaf, and only bites in company

Reverse-mapped inference requires at least one non-closure leaf to infer from,
_and_ the failure only appears when the type parameter also occurs in a closure
parameter ([I3](#i3)). Neither condition alone reproduces it, which is why a
reduced repro that drops one of them looks like it disproves the finding.

### <a id="i7"></a>I7 — A union of an object type with an array of that object type destroys contextual typing

Typing a slot as `Outcome | readonly Outcome[]` — the natural encoding of "one
clause or a guarded list" — makes **every** bare object literal in the machine lose
its handler parameter types (three `TS7031`s, bisected in the edge-records
prototype's `blocker.ts`). Supplying the type arguments explicitly changes nothing,
so a second declaration site does not buy a way out. This is one of the two
blockers that ended the edge-records layout
([design record §4](design-record.md#4-layout)).

### <a id="i8"></a>I8 — `TS2820`'s did-you-mean is conditional on identifier length

`to: 'armd'` gets the did-you-mean suggestion; `to: 'onn'` gets a plain `TS2322`.
Short state names — common in the small machines this library targets — do not get
it, so a design must not be credited with that diagnostic
([design record §4](design-record.md#two-decisions-that-fell-out-of-the-comparison)).

### <a id="i9"></a>I9 — Omitting an inference site makes TypeScript discard the whole inferred map

Leaving one inference site unsupplied does not fall back for that site alone: the
entire inferred map is discarded. The fix is to widen the constraint and move the
default into the accessor type, so an omitted half degrades to a derived default
rather than to nothing ([design record §5](design-record.md#5-the-declared-vocabulary)).

### <a id="i10"></a>I10 — A homomorphic mapped type over inferred keys is the safe mechanism

`{ [K in keyof T]: Handler<Parse<K>> }` over the keys of an inferred object literal
is the construction that keeps working, including when the keys are compound
strings that a template-literal type has to take apart. The construction that
keeps failing is a standalone generic call that needs sibling context — each such
call is inferred in isolation and cannot see its siblings ([I12](#i12)). Reach for
the mapped type.

### <a id="i11"></a>I11 — Deriving a transition's source context from the state name forces the target early

Recorded in `explorations/config-object-kit.ts`. Deriving a transition's source
context from the state name `K` inside the modifier type makes resolving that
conditional force the target type `To` before the `target` argument has been read,
and `To` then collapses onto `K` — so `transition('login', 'authenticating', …)`
is rejected with `"authenticating" is not assignable to "idle"`. Carrying the
context as its own free type parameter avoids it. A spelling that keeps the target
a parsed string rather than a parameter to infer does not hit this at all.

### <a id="i12"></a>I12 — Per-helper generic calls cannot see their siblings; one callback for the whole machine can

The generation-1 architecture built each state through its own generic helper
call, so each call was inferred in isolation and target data was not known by the
time a reducer body was checked. Passing the helpers as parameters of a **single
contextually-typed callback for the whole machine** makes TypeScript defer the
context-sensitive properties and infer the non-function siblings first, so the
target's data _is_ known when the reducer is checked. The information was never
arriving too late in principle; it arrived too late _for that arrangement of
calls_ — which is why the conclusion drawn from it, that a single declaration site
necessarily produces remote errors, was false
([design record §3](design-record.md#3-what-generation-1-cost)). Measured on
TS 5.9.3 and 7.0.2: states, per-state data and transitions in one object literal,
errors on the exact sub-expression, with no `const` type parameter, no `NoInfer`,
no `satisfies` and no curried call.

### <a id="i13"></a>I13 — Two caveats on removing the second declaration site

Kept on record against [I12](#i12), because they bound how much to lean on it.
**It is fragile**: `@cassiozen/useStateMachine` removed the second declaration
site soundly and was silently broken by TypeScript 5.4, and Zag v1 deliberately
moved the other way, back to a hand-written schema. **And it is not free for every
consumer**: under `--isolatedDeclarations`, an inferred machine cannot be exported
at all (`TS9010`).

### <a id="i14"></a>I14 — The handler's `state` parameter needs `NoInfer`

The shipped signature puts the state vocabulary `S` in a handler **parameter**
(`state: Extract<S, { name: … }>`). A parameter is an inference site, so a handler
that destructures its argument makes the compiler infer `S` from the transition
table, competing with the `states` property that is meant to be its only source.
`S` lands on garbage, the key type built from it collapses, and **every row** is
reported as `not a transition` — the diagnostic for a malformed key, fired on rows
that are perfectly well formed.

The fix is one word, on the parameter rather than on `S` itself:

```ts
readonly state: NoInfer<Extract<S, { name: From<P> }>>
```

`states` is then the sole inference site, and the state half of the signature needs
no other machinery — it takes the same raw/declared pair the input half always had.

Two things worth keeping. The initial diagnosis was **wrong**: the symptom fits a
story about `S` being self-referentially derived from the same keys that index the
table, and that story cost a two-overload signature before the one-word fix was
found. And overloads are not an acceptable workaround anyway — they move errors
from individual rows up to the opening `machine({` and collapse several bad rows
into one, where the single signature with `NoInfer` preserves per-row errors.
Pinned on a miniature of the table, independently of the library, in
[`explorations/handler-param-inference.ts`](../explorations/handler-param-inference.ts),
with a tripwire that goes off if a future TypeScript stops inferring from that
position — the announcement that the wrapper could be dropped. TS 7.0.2.
