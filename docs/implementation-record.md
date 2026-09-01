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

### <a id="i14"></a>I14 — The handler's `state` parameter needs `NoInfer`

The shipped signature puts the state vocabulary `S` in a handler **parameter**
(`state: Extract<S, { name: … }>`). A parameter is an inference site, so a handler
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

The residual limitation is the mirror image, and it is TypeScript's rather than
the notation's: a handler that destructures **nothing** — `() => ({ … })` — is not
context-sensitive, so it is typed in the same pass that infers `states:` from the
sibling property, before `S` is known. Its return expression has no contextual
type and its literals widen, which a target pinning a literal field then rejects.
Reading `state` or `input` defers the handler to the pass after the vocabulary is
known and needs no annotation; an argument-free handler returning a pinned literal
needs `as const` or a return type. Nothing the library can express moves this: the
vocabulary and the table are properties of one object literal, and one is inferred
from the other.

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
- **The departure loop over `[acts, listeners]`, not a `leave` helper called
  twice.** The two-element array literal plus one nested loop measures smaller
  than factoring the row scan into a named function and calling it once per row
  array (1,790 B vs 1,810 B raw, pre-golf).

### <a id="i17"></a>I17 — The empty-payload encoding is tagged, not an index signature

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
… but required in type 'Data<{ name: "empty" } | { name: "draft"; … } |
{ name: "review"; … }, "review">'
```

Resolving the same computation **inline** reports against the one state the row
targets — `Omit<{ name: "review"; text: string; by: string }, "name">` — and this
holds with `S` as a real type parameter. This is the highest-traffic error in the
library, so the rule earns its residual cost: the `Omit<…, 'name'>` wrapper in
the message. The variant with perfect messages, keeping the tag in the handler's
return, was rejected for costing the arrow test
([design record §5](design-record.md#revision-the-shape-of-a-named-thing)).

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
it. Nothing there needs it: `current` and a handler's `state` are read for
`.name`, the input name is a string, `inputData` passes through unchanged, and a
handler result is only spread. `StateVocab`, `string | undefined`, `unknown`, and
`object` type the whole runtime with no cast added and a byte-identical bundle.

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
stops inferring the state vocabulary contravariantly from the table. A wrapper whose
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

The fix is a wider signature, the shape `Table` already uses for a payload-free
target: union `| void` in. That does not reopen the hole plain `undefined` was
chosen to close, because void-return bivariance fires only when a return type
**is** `void`; as one arm of a union, a wrong-shaped return, a stray `Teardown` on
an edge, and an `async` body's `Promise` are all still rejected. Keep `undefined`
in the union too: `Teardown | void` also rejects the stray teardown, but nothing
left in the signature would say which arm did it.

Pinned in `tests/actions.test-d.ts`, both directions — the plain body is accepted,
and each rejection still fires.

### <a id="i28"></a>I28 — `restart`'s predicate parameters need `NoInfer`, the same as a handler's `state`

`Restart<N>`'s predicate is `(from: N, to: N) => boolean`, contributed into
`Actions<I, S, A>` alongside the run function `Table` and `ResidencyAction`
already guard with `NoInfer` ([I14](#i14)). Left bare, a block-bodied predicate
— `restart: (from, to) => { return from.id !== to.id }` — reopens `S` as an
inference site the same way the unguarded `state` parameter did: `S` collapses,
every row in `transitions` is rejected as `not a transition: '…'`, and `initial`
stops resolving. An expression-bodied predicate does not trigger it, which is why
a probe that only writes `restart: (from, to) => from.id !== to.id` would call
this safe. The fix is the same shape as I14's: wrap both parameters in
`NoInfer`. Pinned in `tests/actions.test-d.ts`.

### <a id="i29"></a>I29 — A tuple union keeps separate send arguments correlated

`send` maps each input entry to one tuple, then accepts their union as its rest
parameter. Required data uses `[name, data]`; data that admits `undefined` uses
`[name, data?]`. This rejects a union-valued name beside an unrelated
union-valued payload. Narrowing the name first selects one tuple and permits
forwarding. A generic `(name: N, data: I[N])` accepts mismatched unions and is
therefore too broad.

### <a id="i30"></a>I30 — Input maps need a separate shape check

The generic constraint is `object` because interfaces do not satisfy a
`Record<string, unknown>` constraint without an index signature. That broad
constraint also admits arrays, functions, and unions, so the `inputs` property
checks those shapes separately. `AnyInputs` uses `Record<string, unknown>` only
as the default for APIs with no declared vocabulary to inspect.
