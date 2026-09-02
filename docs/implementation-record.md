# Implementation record

> **Read this if you are about to change the source.** It is the standing list of
> what the type layer does, what it refuses to do, which construction to reach for
> instead, and what the shipped bundle costs. It is written for whoever, or
> whatever, is editing `src/`. For why the API is shaped the way it is, read
> [the design record](design-record.md); for the API itself,
> [the README](../README.md).
>
> `src/totorobot.ts` cites these entries by identifier rather than restating them,
> so an argument lives in exactly one place. Almost every type-layer entry was
> discovered by a test asserting that something **illegal** fails; no positive test
> has ever caught one. Where there is compilable evidence it is in
> [`explorations/`](../explorations/README.md), which `pnpm typecheck` covers, so a
> finding that stops holding fails the build rather than rotting here.

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

### <a id="i14"></a>I14 — A handler's source parameter needs `NoInfer` while it names `S` directly

> **Narrowed by #98.** The parameter is `fromData: S[From<P> & keyof S]` now, and
> TypeScript does not infer to an indexed access, so the position below is no
> longer an inference site. `Table` keeps the wrapper as insurance; the mechanism
> is live one property over, on `Restart`'s predicate ([I28](#i28)).

While a state was a tagged object, the signature put the state vocabulary `S` in a
handler **parameter** (`state: Extract<S, { name: … }>`), a distributive
conditional over the naked `S`. A parameter is an inference site, so a handler
that destructures its argument makes the compiler infer `S` from the transition
table, competing with the `states` property that is meant to be its only source.
`S` lands on garbage, the key type built from it collapses, and **every row** is
reported as `not a transition` — the diagnostic for a malformed key, fired on rows
that are perfectly well formed.

**The mechanism is contravariance.** A parameter type is a contravariant
position, so `S` is inferred _out of_ the table's handlers — and only a handler
that destructures its argument is context-sensitive enough to be checked in the
pass where that inference happens, which is why the failure looks intermittent.
`NoInfer` on the parameter closes the site and leaves variance untouched
everywhere else.

The residual limitation is the mirror image, it survives #98, and it is
TypeScript's rather than the notation's: a handler that destructures **nothing**
— `() => ({ … })` — is not context-sensitive, so it is typed in the same pass
that infers `states:` from the sibling property, before `S` is known. Its return expression has no contextual
type and its literals widen, which a target pinning a literal field then rejects.
Destructuring any of the argument's fields defers the handler to the pass after
the vocabulary is known and needs no annotation; an argument-free handler
returning a pinned literal needs `as const` or a return type. Nothing the library
can express moves this: the vocabulary and the table are properties of one object
literal, and one is inferred from the other. The same pass is why an argument-free `() => {}` is checked as
`() => void` rather than against its contextual return type, which is what
[I27](#i27) has to widen the return for.

The fix is one word, on the parameter rather than on `S` itself:

```ts
readonly fromData: NoInfer<Payload<S, From<P>>>
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
which now carries both shapes: the tagged one, whose `@ts-expect-error` must keep
firing, and the map one, which compiles without the wrapper and turns red if a
future TypeScript starts inferring from an indexed access — the announcement that
`Table`'s wrapper is load-bearing again. TS 7.0.2.

### <a id="i15"></a>I15 — The runtime is golfed for bundle size, on purpose

Nothing in the API shows this, and it is exactly what a reader would otherwise
undo while "cleaning up". The shipped file is minified, so **short identifiers and
terse formatting buy nothing** — every module-local name is renamed and every
comment stripped. What moves the number is code _shape_: how many distinct shapes
exist, whether helpers are shared or duplicated, closures versus objects, and
where allocation happens. Module-local and type-layer names are therefore free to
be as long as they need to be; the type layer is erased entirely, so everything it
checks costs a consumer nothing at runtime.

`pnpm size` arbitrates. It prints raw, gzip and brotli for `dist/totorobot.js`;
brotli is the headline, measured with node's own zlib at default settings, which
is what `preactjs/compressed-size-action` uses — so the local number and the number
CI comments on a pull request are the same number. Measure before and after any
change to the shapes in [I16](#i16), and treat a non-zero delta on a
comments-and-names-only change as a bug rather than as noise: an internal property
name survives minification when it is accessed dynamically.

The same measurement is recorded per release. `scripts/size-changelog.ts` runs
inside the `version` script, right after `changeset version` opens the new
CHANGELOG section, and writes a `### Size` line into it: brotli, gzip and raw,
with the brotli delta measured against the _published_ tarball of the previous
version rather than against a rebuild of an old commit. The same line reaches
the release notes, because `changesets/action` builds the release body by
slicing that section out of the file. A version whose tarball cannot be fetched costs the delta, not the
release.

### <a id="i16"></a>I16 — The measured shapes, and what each alternative cost

The ledger that [I15](#i15) exists to protect. Each line is an alternative that
was built and measured against the real toolchain, not estimated. Brotli unless
said otherwise; percentages are from the pre-implementation prototypes. A byte
figure is only meaningful against the build it was taken on, so each one names
its build: **pre-golf** is the 1,790 B raw / 865 B brotli bundle, **golfed** the
1,517 B / 767 B one the rewrite landed. A pre-golf delta has not been re-measured
since; treat it as the reason the shape was chosen, not as a current number.

- **`SKIP` as a symbol, not a self-returning function.** `const skip = () => skip`
  makes the function its own sentinel and saves a binding, at single-digit bytes,
  but silently accepts a handler that returns `skip` _without calling it_.
  Rejected on behaviour, not on size.
- **One shared `skip` function, not a closure per call.** The sentinel carries no
  per-call information, so a fresh closure would capture nothing.
- **An index built once, not a prefix scan per dispatch.** Within 1.6% of each
  other — not a basis for choosing. The index wins on behaviour: dispatch is a
  lookup rather than a scan, and a malformed key arriving from untyped code cannot
  accidentally prefix-match.
- **The index key encodes both boundaries and input presence.** Names are
  arbitrary strings, so a separator cannot divide them: `'a\0b' -c>` and
  `a -b\0c>` join alike. The source length makes that boundary unambiguous. An
  immediate transition has no input; `''` is a supplied input name. The key must
  distinguish those cases, or `send('')` can dispatch an immediate row.
- **Patterns parsed at registration, not matched by generation.** Generating the
  eight patterns a transition could answer to and testing membership: 4.8% larger,
  plus a `Set` allocated per transition. Parsing at registration also shares
  `parse` with the index build, which is part of why it compresses better.
- **Null-prototype index.** 4 B golfed (17 raw, 15 gzip), the whole cost of an
  untyped `send('toString')` finding nothing rather than finding
  `Object.prototype`'s method and calling it as a handler. Was +10 B over two
  levels pre-golf; the keyspace is flat now, so the prototype is bought once.
- **`current` as a closure variable behind a getter, not a property `send`
  mutates.** The assigned property comes out larger: mutating a bound object costs
  more than a getter closing over a local, and the getter needs no identifier for
  the object itself.
- **Listeners copy-on-write at registration, not a mutable list.** Mutating with
  `push`/`splice` and snapshotting with `slice` per dispatch is 20 B larger
  (29 raw, 14 gzip), and it allocates on the path that runs most. Observable
  behaviour is identical under both.
- **One `step`, called twice.** Folding the input hop and the immediate chain into
  a single loop by reassigning `rows`: 13 B larger pre-golf, and three mutable
  locals where the nested form has one. A `commit` helper called from two
  near-identical scanning loops: 49 B larger pre-golf.
- **A row that simply ends, not one padded to full width.** An edge row stops at
  its handler, since `key` and `restart` mean nothing on one; padding both slots
  so every row is the same length is 10 B larger golfed. Reading an absent slot
  is `undefined` either way, which is what the padding would have spelled.
- **A teardown cleared in the assignment that calls it.** `row[6] = void row[6]?.()`
  against calling it and blanking the slot on the next line: 9 B larger golfed
  (4 raw). Both run a teardown at most once; the one-expression form is also what
  keeps `clear` an arrow with no body.
- **The drain loop iterates the queue live, rather than shifting off it.** A
  `for (let run; (run = queue.shift()); )` loop is 14 B larger golfed. The array
  iterator re-reads `length` each step, so both pick up work queued by running
  work; the `finally` empties the queue under either.
- **`draining` as a counter, not a boolean.** A tie on brotli, 4 B on raw and 2 on
  gzip. `draining++` raises the flag in the expression that tests it, and
  `queue.length = draining = 0` puts it back down in the assignment that empties
  the queue, so the counter is two statements shorter for the same behaviour.
- **`machine` as an annotated `let`, not an overloaded `function`.** The overload
  pair — declared signature, then an implementation one taking `unknown` — is 5 B
  larger golfed (7 raw). The annotated binding states the caller-facing type once
  and casts its initializer, and the emitted declaration is the same either way.
- **`dispatch(work?)`, not a required parameter.** The optional call is one cheap
  token; a required parameter pushes `send` into allocating a closure per call
  just to hand its `queue.push` over. Re-measured against the golfed bundle,
  where the closure would have been the only argument at that call site: the
  required form is 8 B larger (775 vs 767), so it loses on size as well as on
  allocation, and the optional parameter stays.
- **`send` attached by `fire`, once per call.** A restart predicate must not be
  handed `send`, so a hop builds the six facts and `fire` spreads the capability
  onto them for the callbacks that get one. Five shapes were measured against the
  787 B brotli bundle that reused a single record and leaked `send` to the
  predicate: building both objects in `step` costs 12 B (respelled) or 18 B
  (spread from the facts); deriving the facts back out of the record with a rest
  pattern, 15 B; a shared module-level helper doing the same, 26 B; attaching
  `send` inside `fire` costs 10 B, and 1 B if it is attached per matching row
  instead of per call. The per-row form is not taken: it moves an allocation onto
  the notify path, which is the same trade the listener list is copy-on-write to
  avoid. Attaching lazily, so nothing is allocated when no row matches, spends the
  saving again on reading the coordinates off the other object (16 B).
- **The departure loop over `[acts, listeners]`, not a `leave` helper called
  twice.** The two-element array literal plus one nested loop measures smaller
  than factoring the row scan into a named function and calling it once per row
  array (1,790 B vs 1,810 B raw, pre-golf).

### <a id="i17"></a>I17 — The empty-payload encoding is tagged, not an index signature

> **Retired by #98.** A payload-free state declares `undefined`, so a handler's
> return is `undefined` rather than an object minus a tag and never reduces to
> `{}`. `EmptyObject` is gone from the source; the finding is kept because the
> `{}` hazard it records applies to any type that reduces a target to `{}`.

A payload-free target reduces to `{}` under the bare `Omit<S, 'name'>` form, and
`{}` accepts every object literal — TypeScript's weak-type and excess-property
checks both need at least one known property before either fires. The fix is a
type that is not `{}`: an optional property keyed by a module-private
`unique symbol`, never populated, which nothing can satisfy but `{}` or the `void`
arm.

Compared against an index-signature form (`Record<string, never>` and kin), both
on TS 7.0.2, both pinned in
[`explorations/empty-state-payload.ts`](../explorations/empty-state-payload.ts):
**strictness is identical** — both reject a fresh literal with extra properties, a
variable of a wider object type, an interface-typed value, and a spread of a wider
state; both accept `{}` and `undefined`. The tagged form wins on two other grounds:

- **Error quality.** It reports that the value is not assignable to `EmptyObject`.
  The index-signature form reports a property incompatible with the index
  signature _and_ a string literal not assignable to `never` — machinery the
  caller never wrote, on the most common row in a table.
- **Read safety.** Reading a foreign property off a `Record`-shaped member of a
  union infers `never` rather than erroring; the tagged form errors. Not reachable
  through this library's types today, but the tagged form does not depend on that
  continuing to hold.

Costs nothing at runtime either way; the argument the encoding serves is in
[design record §5](design-record.md#the-empty-payload-encoding-closing-the-negative-result).

### <a id="i18"></a>I18 — Never put a handler's return type behind an alias that takes `S`

A wrong-shaped handler return, checked through a named alias parameterized over
the state vocabulary, produces an error naming the **whole** vocabulary:

```
… but required in type 'Data<{ empty: undefined; draft: … ; review: … }, "review">'
```

Resolving the same computation **inline** reports against the one state the row
targets — `{ text: string; by: string }` — and this holds with `S` as a real type
parameter. This is the highest-traffic error in the library, so `Table` spells
`S[To<P> & keyof S]` out rather than reaching for the `Payload<V, N>` alias its
parameters use. Since #98 the message carries no wrapper at all: the payload is
what the vocabulary declares, not an `Omit` of it.

### <a id="i19"></a>I19 — An invalid inference candidate falls back to the constraint, not to the default

A type parameter constrained to bare `T` with a default rejects a candidate of
`undefined` as a constraint violation, and TypeScript's fallback for an invalid
candidate is **the constraint** — not the default. So `inputs: undefined`, written
explicitly, widened every input name to `string`, where an omitted `inputs`
correctly inferred `InputsFromKeys<K>`: two call sites meant to be
indistinguishable were not.

Constraining to `T | undefined` instead makes `undefined` a legal, non-widening
inference target, and the default moves into an accessor type (`Declared<Raw,
Default>`) that resolves it. This is why the vocabulary needs the `RawI`/`I` and
`RawS`/`S` parameter pairs rather than one parameter each — collapsing a pair is
the version that fails. Same shape as [I9](#i9), reached from the other direction.

### <a id="i20"></a>I20 — A second inference site for the table stops error elaboration

`K` is inferred from the mapped type in `transitions`, because a mapped type over
a bare type parameter infers its own key set. Adding a second parameter for the
same property — `transitions: T` alongside `Table<I, S, K>` — infers the same
thing, but makes the contextual type of every row an **intersection**: enough call
signatures that the compiler stops elaborating into the handler, and a
wrong-shaped return is reported against the whole row instead of against the
expression that is wrong.

### <a id="i21"></a>I21 — `initial` must not be a state-vocabulary inference site

Letting `initial` infer `S` makes the name it invented the only legal state name.
Every real row is then rejected, and the error moves off the row onto the whole
table. A plain `NoInfer` position is the fix, not a conditional; intersecting with
`Init` recovers the initial state's _name_ without reopening the inference, which
is what lets `start`'s arity follow that one state's data.

### <a id="i22"></a>I22 — A machine type is read back through the carrier, not through `Machine`

Matching `Machine` itself to extract its parameters cannot work: a partly-inferred
`start` is not assignable to a fully-inferred one, so the conditional simply
fails. Matching the carrier interface instead — which holds the vocabulary and the
keys in one optional, never-present function property — infers all three at once,
after which each derived type indexes the result rather than repeating the match.

### <a id="i23"></a>I23 — The implementation half never needed `any`

The runtime was written against `type Unchecked = any`, on the sound argument that
the type layer above had already checked those positions. But an alias does not
narrow `any`; what the name bought was that `any` stopped answering to a search for
it. Nothing there needs it: dispatch reads three names, all strings, and every
payload passes through untouched — since #98 a handler's result is not even
spread. `string | undefined`, `unknown` and `object` type the whole runtime with
no cast added and a byte-identical bundle.

The golfed runtime reintroduced three, and none of them survived either, at a
byte-identical bundle: an item that is read for both `run` and a call is an
intersection rather than a union (a union makes `run` unreadable on the function
arm), the `restart` predicate is `Extract<Registration[5], Function>` where its
`.call` is tested, and the annotated `machine` binding casts its initializer to
`typeof machine` rather than to `any`. Assertions are erased, so a cast is free;
`any` buys nothing here that a name for the shape does not.

`machine`'s implementation half took `any` on the recorded grounds that a row's
value can be the poison string literal. `unknown` implements it too: the body
casts before reading, and what the implementation must satisfy is an
assignability check either way — against the other half of an overload pair when
`machine` was a `function`, against the annotation when it became an annotated
`let` whose initializer is cast (I16). Not academic, since declarations are
generated from these signatures — a rollup that preferred the implementation half
to the declared one would hand callers `any` rather than merely losing
precision.

### <a id="i24"></a>I24 — A generic call in a table value cannot see a vocabulary that arrives as a default

> **Measured on the tagged vocabulary, and no longer reproducible in the
> miniature.** With name-to-payload maps, `explorations/wrapper-inference.ts`
> section 3 narrows under both tiers: an indexed access degrades to `never` where
> `Omit<Extract<…>>` degraded to `{}`, and the contextual return type now recovers
> the row key with the tier in place. A wrapper still fails against the shipped
> signature, by alias identity ([I25](#i25)) rather than by the tier.

`machine` resolves the vocabulary in two tiers: `RawI`/`RawS` infer from the
`inputs`/`states` properties, and `I`/`S` are defaulted type parameters computed
off them through `Declared`. Defaults resolve after inference, so a generic call in
a row value is checked while `I` and `S` are still absent: its own row parameter
falls back to `string`, `Key<I, S>` collapses, and every row is rejected as
`not a transition: '…'`, well formed or not. The collapse does not stay in the table
either; with `S` gone, `initial` stops resolving against `StateName<NoInfer<S>>`.

Isolated in [`explorations/wrapper-inference.ts`](../explorations/wrapper-inference.ts)
to the tier alone: the same alias and the same call pass under a signature that
infers `I`/`S` directly and fail under one that defaults them. The pair cannot be
collapsed to remove the tier ([I19](#i19)). A **record** value has none of this,
because it is not a call: contextual typing reaches its function-valued field from
the table directly.

**The scope is the block, not the value.** This bites where the block is an
inference site. `transitions` is one, since `K` comes from it. A block keyed off the
already-declared vocabulary, which is the shape `actions` would take, contributes
nothing to inference, is therefore checked after `S` resolves, and accepts a wrapper with
its narrowing intact, in the same two-tier signature. The wrapper still has to be
handed the vocabulary ([I25](#i25)); recovering it from context leaves the
payload `never` while the trigger key stays constrained by the mapped type, so a
probe that only checks whether bad keys are rejected will call that a success.

### <a id="i25"></a>I25 — Inference through a wrapper recovers the row key by alias identity, not structurally

Where a wrapper does work, on a single-tier vocabulary handed to it up front, the
row key comes back from the contextual return type only while the table's row type
and the wrapper's signature name the **same alias**. Write the identical expression
out twice instead and the key falls back to `string`, with nothing else changed.
Satisfying this means factoring the row type behind an alias over `S`, which is
what [I18](#i18) forbids. Between them the two findings leave the wrapper no
spelling that works.

### <a id="i26"></a>I26 — A wrapper's return type reopens the inference site `NoInfer` closes on the parameters

[I14](#i14) put `NoInfer` on the handler's parameters so a context-sensitive handler
stops inferring the state vocabulary contravariantly from the table — a guard the
table still carries, whatever the payload's spelling. A wrapper whose
type parameters are recovered from context rather than handed in defeats that: its
**return** type names the vocabulary outside the guard, the table becomes an
inference site again, and the vocabulary widens to whatever the rows say, so an
undeclared state name in a key stops being an error. This is a soundness hole rather
than a lost narrowing, and the well-formed rows a probe writes first do not show
it.

### <a id="i27"></a>I27 — A block-body action with no `return` infers `void`, not `undefined`

In an `actions` block, a plain block body — `on: () => { log.push('setup') }` — is
inferred **independently**, as `() => void`, rather than checked against the
property's contextual type. `void` is not assignable to `undefined`, so every
ordinary no-teardown action failed under `undefined | Teardown` alone, though the
identical body typechecks given straight to a variable of that type. It holds even
with `inputs`/`states` declared, so it is not [I24](#i24)'s defaulting tier.

The fix is a wider signature, the shape `Table` uses wherever the destination's
payload admits `undefined`: union `| void` in. Since #98 that arm is conditional
— `undefined extends Payload ? Payload | void : Payload` — so a destination that
carries something still rejects a handler with nothing to return, and `void` is
never a way to _declare_ a payload-free state.

**It cannot be narrowed to empty bodies alone.** `() => {}` and
`() => cleanUp()`, where `cleanUp` returns `void`, have the same inferred type,
so no return type accepts one and rejects the other; TypeScript's rule that lets
an `undefined`-returning function omit its `return` needs a _contextual_
signature, which an argument-free handler never gets here ([I14](#i14)). A
returned `void` therefore type-checks wherever an empty body does, and lands the
destination's `undefined` either way. Both directions are pinned in
`tests/state-data.test-d.ts`, alongside the rejections the conditional keeps: a
teardown-shaped return, a `{}`, and either spelling against a destination that
carries data.

The `void` arm does not reopen the hole plain `undefined` was
chosen to close, because void-return bivariance fires only when a return type
**is** `void`; as one arm of a union, a wrong-shaped return, a stray `Teardown` on
an edge, and an `async` body's `Promise` are all still rejected. Keep `undefined`
in the union too: `Teardown | void` also rejects the stray teardown, but nothing
left in the signature would say which arm did it.

Pinned in `tests/actions.test-d.ts`, both directions — the plain body is accepted,
and each rejection still fires.

### <a id="i28"></a>I28 — `restart`'s predicate parameter needs `NoInfer`

`Restart<I, S, N>`'s predicate takes one record of the hop's facts,
`(facts: Transition<I, S, "N -> N", {}>) => boolean`, contributed into
`Actions<I, S, A>`. Left bare, a block-bodied predicate —
`restart: (facts) => { return facts.fromData.id !== facts.toData.id }` — makes
that record an inference site: it is a mapped type over `keyof S`, which
TypeScript reverse-maps ([I10](#i10)), so `S` collapses, every row in
`transitions` is rejected as `not a transition: '…'`, and `initial` stops
resolving. An expression-bodied predicate does not trigger it, which is why a
probe writing only
`restart: ({ fromData, toData }) => fromData.id !== toData.id` would call this
safe.

This is the entry that outlived [I14](#i14)'s: a handler's payload is an indexed
access and no longer inferred from, while the predicate's whole record still is.
The fix is one `NoInfer` around that parameter. Pinned in
`tests/actions.test-d.ts`, and re-measured after #98 by removing the wrapper,
which reproduces the collapse.

### <a id="i29"></a>I29 — A tuple union keeps separate send arguments correlated

`send` maps each input entry to one tuple, then accepts their union as its rest
parameter. Required data uses `[name, data]`; data that admits `undefined` uses
`[name, data?]`. This rejects a union-valued name beside an unrelated
union-valued payload. Narrowing the name first selects one tuple and permits
forwarding. A generic `(name: N, data: I[N])` accepts mismatched unions and is
therefore too broad.

### <a id="i30"></a>I30 — Vocabulary maps need a separate shape check

The generic constraint is `object` because interfaces do not satisfy a
`Record<string, unknown>` constraint without an index signature. That broad
constraint also admits arrays, functions, and unions, so the `inputs` and
`states` properties check those shapes separately, through `VocabMap`. A
rejected `states` leaves no state name behind, so `initial` stops resolving too;
that second error is the collapse, not a separate fault. `AnyVocab` uses
`Record<string, unknown>` only as the default for APIs with no declared
vocabulary to inspect.

### <a id="i31"></a>I31 — A name narrows the payload beside it only through a union of records

Two sibling fields, `from` and `fromData`, correlate only if the record is a
union with one member per pairing: TypeScript narrows a discriminant against the
union it is a member of, and nothing else. So `Transition` is the product of the
sources, destinations and inputs its pattern admits — the same |states|² ×
|inputs| the key union already costs — and a check on any one of the three names
narrows all six fields. Intersecting the shared half onto each member (`X &
{ … }`, where `X` is `{ send }` or `{}`) keeps that narrowing intact, which is
what lets one type serve a committed record and a restart predicate's facts.
[#99](#i32) filters the product against the table, which this entry described
before that filtering existed.

### <a id="i32"></a>I32 — Filtering the product against the table is a mapped type over the row union

[I31](#i31) built `Transition` as the product of a _pattern's_ own wildcards —
every source, destination and input the pattern admits, whether or not the
_table_ declares that pairing. #99 filters it: `Transition<I, S, K, P>` maps
over the declared rows `K`, keeping only those a pattern's `From`, `Label` and
`To` each individually admit (`MatchingRows`), then builds one record per
surviving row from that row's own three coordinates — never from the
pattern's. A mapped type distributes over a union of string-literal keys, so
each surviving row keeps its coordinates correlated for free; the per-coordinate
`Select` machinery I31 described, which independently widened each position to
"every declared name," is gone with it.

An omitted pattern label matches any row's label, named or absent alike — the
same rule the runtime's own comparison already used (`l === '' || l ===
e.input`, in `fire`); a specific label matches only its own name. Residency and
restart facts reuse `Transition` rather than widening their own coordinates
(`Residency<I, S, K, N>`, unioned with the arrival `Transition` never carries).

**A hop no declared row supports resolves to `never`, not to a widened guess.**
A `restart` predicate for a state with no self-transition row, or a residency
read against a table with no row reaching it, now takes `never`: every field
read off it is then a type error, rather than silently admitting the whole
vocabulary. Existing tests that attached such a predicate, or read such a
residency's `from`, had exploited I31's over-permissiveness; they now either
declare the missing row or expect the narrower union
(`tests/patterns.test-d.ts`, `tests/actions.test-d.ts`,
`tests/state-data.test-d.ts`).

Measured: the emitted bundle is byte-identical (`pnpm size`, before and after —
types are erased). The suite's combined runtime-plus-type check stays in the
same tens-to-few-hundred-millisecond range, the twenty-state/forty-four-row
fixture (`tests/scale.test-d.ts`) included — expected, since a union of
forty-four declared rows is smaller than the |states|² × |inputs| product it
replaces. `scripts/measure-completions.mjs` exercises the table's own
key-completion candidates, a different surface than `Transition`/`Actions`; no
completion or hover instrument covers this one, so no new number is recorded
for it.

### <a id="i33"></a>I33 — A residency action's arrival member is live only on the initial state

[I32](#i32)'s `Residency<I, S, K, N>` — every declared row landing on `N`,
plus the arrival no transition caused — was shared unchanged between a
residency action and a residency observer for the same bare state, `N`
noninitial included. That shared type is broader than what an action can ever
actually receive: `enter` hands the synthetic arrival to `actions` exactly
once, at startup, gated on `to === initial` (`src/totorobot.ts`, the
`dispatch` call in `machine`'s `start`) — no other call reaches a declared
action with it. A residency observer has no such restriction, since a caller
can `observe()` a bare key at any point in a running host's life and find
that state already occupied, `initial` or not (the immediate-registration
case in `Host.observe`).

`ActionArrival<I, S, K, Init, N>` narrows this per key: `Residency<I, S, K,
N>` where `N` is exactly `Init`, and a plain `Transition<I, S, K, '* -> N'>`
— real rows only, no arrival — everywhere else. `Actions` now takes `Init` as
a fifth parameter to make this comparison, consumed rather than inferred a
second time, the same guard [I20](#i20) already holds `K` to; `ObserveAction`
is untouched, since `observe`'s own arrival is not conditioned on `Init` at
all. A noninitial residency action's `from` therefore excludes `undefined`
outright, needing no narrowing to read, where before it carried the member
unconditionally; `tests/actions.test-d.ts` pins both the noninitial exclusion
and the initial-state case where `actions` and `observe` still agree.

This narrows past what #99's own acceptance criteria asked for — "retain the
shared type for noninitial actions as well" — on the grounds that a member no
declared action can ever receive is exactly the kind of impossible
combination the rest of that ticket exists to reject; keeping it here for
uniformity's sake would have been the one place the row-correlation work left
a synthetic case in, unchecked. [#100](#i35) adds a second, independent check
alongside this one rather than replacing it: `from` stays precise here, and
whether a noninitial action is legal to declare at all is decided separately.

### <a id="i34"></a>I34 — `Transition`'s default `K` collapses every field to `never`, not to conservative facts

`Transition<I, S, K, P>`'s row filtering (`MatchingRows<K, P>`, [I32](#i32))
is unsound at `K`'s own default. Widen `K` to plain `string` and
`MatchingRows<string, P>` still evaluates to `string`: `From<string>`,
`Label<string>` and `To<string>` are all `never`, and `never extends
anything` is true, so every coordinate check in `Matches` trivially passes.
But indexing the row-mapped type by the bare `string` key produces an index
signature evaluated once at `R = string`, not distributed per literal, so
`From<R>` and its siblings resolve to `never` there too — a record with
`from`, `to` and named inputs all `never`, in place of the conservative,
pattern-only facts [I31](#i31) built before #99 narrowed `Transition` against
declared rows.

The fix reintroduces that pre-#99 construction as `PatternFacts<I, S, P, X>`
and gates `Transition` on `string extends K`: true only when `K` is the bare
`string` default, false for any literal row-key union, however large
(`tests/scale.test-d.ts`'s forty-four rows included) — so an exact machine
keeps full row-correlated precision and only a genuinely widened `K` falls
back.

**No known public call site reaches this today.** `Host`, `Transition` and
their siblings are module-local, so a caller cannot name them to construct
one with `K` left at its default; `machine()`'s own `transitions` parameter
is typed `Table<I, S, K>`, which requires literal row keys to check each row
and rejects a `Record<string, …>`-shaped argument outright — confirmed by
casting one through `machine(definition as Table<I, S, string>)`, which
`Table` refuses independently of this finding. The only reproduction found
casts around that refusal entirely (`machine(definition as any)`), which is
a deliberate opt-out rather than a scenario an unwitting caller reaches. The
fix stands regardless: `K`'s own declared default is `string`
(`K extends string = string`), and a type should not collapse to `never` at
its own default, reachable or not.

### <a id="i35"></a>I35 — Registration eligibility is a second check, layered on `ActionArrival`'s own `Init` comparison

#100 needs a noninitial residency action naming a state with no incoming row
rejected outright: unlike a listener, whose argument merely narrows to
`never` and stays perfectly legal to declare ([I32](#i32)), a callback
argument's type cannot itself make the _declaration_ an error — a function
typed to take `never` still accepts any implementation, by contravariance.
[I33](#i33)'s narrowing is exactly right about what an action's argument can
describe, and stays; it says nothing about whether the declaration should
exist at all, which is the separate question #100 answers.

`Actions<I, S, K, Init, A>` now checks the key `P` directly for that second
question, the same way it already reports `not a trigger: '${P}'` for a
malformed one: `[P] extends [Init]` is eligible on the startup arrival alone,
no incoming row required, matching `ActionArrival`'s own branch; anything
else additionally needs `NoMatch<K, '* -> ${P}'>` to be `false`. Both checks
share the one `[P] extends [Init]` discriminant rather than computing it
twice under different names. `ActionArrival` is unchanged: a noninitial
action's `from` still excludes `undefined` outright, and eligibility is
checked on top of that precision, not instead of it.

### <a id="i36"></a>I36 — Rejecting a dead pattern is a parameter type, inferred through its own conditional

A pattern naming only declared state and input names, but no declared row
(`NoMatch<K, P>`, built on [I32](#i32)'s `MatchingRows`), needs a diagnostic
at the registration site, the same class of problem `Table` already solves
for a malformed transition key: turn the offending value's own type into a
literal message, `` `no row matches '${P}'` ``, so the caller's string
argument fails to match it.

`Actions` applies this per mapped key, exactly like `not a trigger: '${P}'`
already does — no new mechanism. `Host.observe`'s first overload has no
object-literal keys to map over, one `pattern` parameter instead; TypeScript
still infers `P` from the argument through `NoMatch<K, P> extends true ?
`no row matches '${P}'` : P`, the naked `P` in the conditional's true branch,
confirmed against `TypeScript 7.0.2` with an isolated repro before landing it
in `src/`. A widened `K` (`string extends K`) falls back to `false` — never
rejects — the same conservative gate [I34](#i34)'s `Transition` fallback
uses, for the same reason: a wrapper that erased the exact rows cannot tell a
dead pattern from a live one, and a false rejection is worse than a missed
one.

The type layer is erased: `pnpm size` reports 1,580 B raw, unchanged.

### <a id="i37"></a>I37 — A deferred conditional falls back to its type parameter's constraint for completions; a plain intersection does not

[I36](#i36)'s rejection is correct and, per its own repro, reaches the
caller — but completion in an editor still lists every name-valid pattern,
not just the ones a declared row can fire. `NoMatch<K, P> extends true ?
`no row matches '${P}'` : P` is a conditional keyed on the unresolved type
parameter itself; while `P` is still unresolved (exactly the moment
completion needs an answer), TypeScript cannot evaluate the conditional and
falls back to `P`'s own constraint, `Pattern<I, S>`, for _both_ the check
and the branch it substitutes back in. The crafted rejection message
survives because it fires later, once the caller's literal has resolved `P`
and the conditional is no longer deferred — but the completion list, asked
before that, sees only the constraint.

Confirmed with an isolated two-function repro before touching `src/`: a
constraint-narrowed generic parameter (`<P extends Narrow>(p: P)`) and a
constraint-wide one whose parameter type is instead a plain intersection
(`<P extends Wide>(p: P & Narrow)`) both offer only `Narrow`'s members —
because an intersection is not a conditional and does not need `P` resolved
to evaluate. A conditional gains nothing from moving the intersection into
one of its own branches; substituting the constraint into the _whole_
expression, deferred conditional included, is what produces today's
over-wide fallback, and nesting the same expression one level deeper inside
it does not change that.

The fix adds `MatchedPattern<I, S, K>` — the `NoMatch`-filtered subset of
`Pattern<I, S>`, built with no call-site `P` in its own definition — and
intersects it into the existing conditional's live branch: `pattern:
NoMatch<K, P> extends true ? `no row matches '${P}'` : P &
MatchedPattern<I, S, K>`. Confirmed against the real `observe-machine`
fixture (`scripts/completion-fixtures/`, the twenty-state, forty-four-row
acceptance machine): the conditional still resolves to its constraint under
completion, `Pattern<I, S> & MatchedPattern<I, S, K>`, which simplifies to
`MatchedPattern<I, S, K>` alone since it is already a subset — no change to
the conditional's own shape, so [I36](#i36)'s repro and every existing
acceptance/rejection case (`tests/patterns.test-d.ts`) needed no update.

This settles #116's own experiment in favor of the non-breaking shape: the
type parameter's constraint, `P extends Pattern<I, S>`, is untouched, so
existing code keeps compiling. `Patterns<M>`, `Carried<M>` applied to
`MatchedPattern`, ships as the convenience the issue's other branch would
have made mandatory — a public constraint matching what `observe` accepts,
for a caller who cannot otherwise name `Pattern` or `Host` (both
module-local). `Listener<M, P>` is the same move on the second argument:
`EdgeListener`'s four parameters collapse to two, since `Carried<M>` supplies
three of them, and `P` defaults to the whole `Patterns<M>` union, which
`Matches` admits every row against.

This entry claimed, until [I39](#i39), that a caller's helper _generic over
`P`_ keeps compiling. That was true of the constraint and false of the call:
forwarding an unresolved `P` to `observe` was rejected, and nobody had measured
it against one. I39 is that measurement, and the signature it adds.

A genuinely widened `K` (`string extends K`) falls back to `Pattern<I, S>`
unfiltered, the same gate [I34](#i34)'s `Transition` fallback and
[I36](#i36)'s rejection both use, and — like I34 — has no known public call
site: `machine()`'s own `Table<I, S, K>` parameter requires literal row
keys, so a caller cannot construct a `Machine` with `K` left at its default
through the public surface either.

Measured (`scripts/measure-completions.mjs`, `observe-machine`, TypeScript
7.0.2, `tsc --lsp`), offered-entry count and response size for
`host.observe('`, nothing typed:

|        | entries | response | warm  |
| ------ | ------- | -------- | ----- |
| before | 1 784   | 347 KB   | 13 ms |
| after  | 219     | 42 KB    | 11 ms |

219 is the row keys (44) plus their wildcard generalizations, filtered
against the table; it is not merely proportionally smaller than the 1.7 MB
`design-record.md` §"Completion payload grows as \|states\|²" reports for the
unfiltered _transition-table_ key surface, but the shrink is the same shape:
completions now cost what the declared table implies, not the name-valid
cross-product.

The type layer is erased: `pnpm size` reports 1,580 B raw, unchanged.

### <a id="i38"></a>I38 — `observe`'s completions fix does not transfer to `actions`: the same intersection is paid at every declaration, not per call site

`Actions<I, S, K, Init, A>`'s `[P in A]` is a homomorphic mapped type over the
caller's own literal keys, `A`; with nothing typed, `A` defaults to `never`
(§9 Actions), so the mapped type has zero known members and an editor offers
nothing. [I37](#i37)'s fix for the equivalent problem on `observe` — intersect
the conditional's live branch with a `NoMatch`-filtered, call-site-free union —
does not transfer: `observe`'s pattern is one function parameter, so the
intersection is paid once, when that call is checked. `actions` is a
_property_ of the object literal `machine()` takes, and adding
`& Partial<Record<NoInfer<MatchedTrigger<I, S, K, Init>>, unknown>>` to its
type (`MatchedTrigger` being `MatchedPattern<I, S, K>` plus every bare name
[I35](#i35)'s eligibility rule, factored out as `Eligible`, accepts) does not
wait for `A`: `I`, `S`, `K` and `Init` are already resolved by the time
`machine()`'s parameter type is built, so the mapped type inside
`MatchedTrigger` evaluates immediately, on every `machine()` declaration,
whether or not `actions` is written at all.

Measured (isolated repro reusing the `actions-machine` completion fixture —
docs/acceptance-cases.md case 4, the twenty-state, forty-four-row acceptance
machine — via `tsc --extendedDiagnostics`, TypeScript 7.0.2), instantiations
and check time for one `machine()` declaration, no other file in the project:

|                               | instantiations | check time |
| ----------------------------- | -------------- | ---------- |
| no `actions` property         | 12 097         | 0.19 s     |
| `actions: {}`, before         | 12 411         | 0.19 s     |
| `actions: {}`, after          | 965 173        | 0.37 s     |
| `actions` with 2 keys, before | 14 241         | 0.18 s     |
| `actions` with 2 keys, after  | 966 017        | 0.59 s     |

Writing `actions: {}` — no keys, nothing for a caller to complete — is enough
to multiply one declaration's cost ~78×, because the phantom key set does not
look at `A` before evaluating. `no actions property` barely moves (12 097 →
12 350 in the same before/after pair), confirming the cost is conditioned on
the property being present in the literal, not proportional to what a caller
puts in it. `observe`'s own [I37](#i37) fix costs nothing analogous because a
project can contain many machines and, per machine, at most as many `observe`
calls as are actually written; every one of those calls already pays only for
itself.

This is the stop condition #117 carried in from the start: unlike `observe`'s
constraint, paid per call site, this one is paid by every `machine()` call
that writes an `actions` property at all, whether or not it declares a single
key — a much larger share of declarations than the ones an editor is actually
asked to complete for. The issue's own
estimate — "roughly `|Pattern| x |K|` conditional evaluations, about 4 851 x
44 on the 20-state acceptance case" — is the right order of magnitude; this
entry's own count (≈953 000 additional instantiations) is the measured number
in its place. **The finding is unacceptable, and the change described in
#117's prototype was not made.** `Actions` keeps the three-way fork it always
had; only the eligibility rule itself was extracted into `Eligible`
([I35](#i35)), read by `Actions` alone, with no measurable cost either way (12
097 → 12 097, 14 241 → 14 241, prefactor against unchanged `src/`). `actions`
still offers no completions.

The type layer is erased: `pnpm size` reports 1,580 B raw, unchanged.

### <a id="i39"></a>I39 — A conditional parameter type cannot be forwarded a type parameter; a second signature beside it can

[I37](#i37) put `observe`'s pattern behind a conditional on that pattern, and
[I36](#i36) is why: the rejection for a dead pattern is the parameter's own
type, produced by whichever branch `NoMatch<K, P>` selects. A conditional on
`P` stays deferred while `P` is unresolved, and an unresolved type parameter is
assignable to a deferred conditional only when it is assignable to both
branches. It is not assignable to `` `no row matches '${P}'` ``. So a caller's
helper, generic in its own pattern, could not pass that pattern to `observe` at
all: resolution moved on to the bare state key signature and rejected the
pattern against `Name<S>`.

Measured before the fix on a helper taking a pattern and nothing else, so that
neither `Patterns<M>` nor `Listener<M, P>` is implicated in the failure:

```
Argument of type '"* -> *" | ... | "empty -open> draft"'
  is not assignable to parameter of type 'Name<States>'.
```

The fix is a second signature ahead of it, taking a matchable pattern directly:

```ts
<P extends MatchedPattern<I, S, K>>(
	pattern: P,
	listener: EdgeListener<I, S, K, P>,
): () => void
```

Nothing in it is conditional on `P`, so an unresolved one satisfies it through
its constraint and arrives at `EdgeListener` as itself: a caller of the helper
keeps the narrowed record rather than the whole union. A dead literal fails
this signature's constraint instead of matching it, falls through to I37's, and
is rejected there as before. The diagnostic is identical in both arrangements,
byte for byte. The bare state key signature is untouched.

Measured (`scripts/measure-completions.mjs` and `tsc --extendedDiagnostics`,
TypeScript 7.0.2, the twenty-state, forty-four-row `observe-machine` fixture):

|        | entries | response | warm | instantiations | check time |
| ------ | ------- | -------- | ---- | -------------- | ---------- |
| before | 219     | 55 KB    | 7 ms | 12 336         | 0.167 s    |
| after  | 219     | 55 KB    | 5 ms | 12 519         | 0.168 s    |

Completions do not move, which is what [I37](#i37) constrains: the new
signature's parameter is `MatchedPattern<I, S, K>` by its constraint, the same
set I37's intersection offers. The 183 extra instantiations are paid once per
host type rather than per `observe` call — the count is the same with the
fixture's two calls deleted — so this is not [I38](#i38)'s shape, where the
cost landed on every declaration whether or not a caller used the feature.

The type layer is erased: `pnpm size` reports 1,580 B raw, unchanged.
