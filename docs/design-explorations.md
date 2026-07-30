# Design explorations

Started as a small TypeScript example exploring [robot3](https://thisrobot.life/)'s
typing. Along the way we found real gaps in what robot3's types can guarantee,
and ended up prototyping a replacement to see whether those gaps are actually
fixable in TypeScript, and at what cost. This README documents that arc.

There were two prototypes, and the second superseded the first:

- The first attempt declared states inline and deferred target checking to
  `defineMachine(...)`. Its source was removed before the first public commit,
  but its findings are preserved below.
- `src/totorobot.ts` — the spec declared up front, then a robot3-shaped builder.
  Same guarantees, local error messages, and more of them. Its extra size is
  features — explicit initial/final states, multiple guards, actions,
  `AbortSignal`, and `send` narrowed to the current state — not deferred
  transition validation machinery.

## What broke down in robot3

Working through robot3's `index.d.ts` and a couple of example machines
(a traffic light, an auth flow with an async login), we found and verified
(compiled + ran, not just read) several gaps between what the types *look*
like they guarantee and what they actually check:

- **`reduce`/`guard`/`action`'s `<C, E>` generics aren't checked against
  anything.** Each call is independently generic; nothing ties them back to
  the machine's real context type, so a wrong context type in one reducer
  isn't caught.
- **`send()`'s payload is effectively untyped.** Only the event's `type` field
  is checked; every other field is typed `any` (`{ type: T; [key: string]: any }`).
  `send({ type: 'login', username: 42, password: 'x' })` compiled cleanly and
  crashed at runtime (`ev.username.trim is not a function`).
- **Transition validity isn't checked per current state.** The event names
  `send()` accepts are the union across *every* state, not just the ones
  reachable from wherever the machine currently is. An irrelevant event
  compiles and just silently no-ops at runtime.
- **`invoke`'s event-wrapping isn't reflected in the types.** A resolved
  promise arrives as `{ type: 'done', data: T }`, a rejection as
  `{ type: 'error', error: E }` — but nothing in `invoke`'s signature says so;
  we only found this by reading the source and by crashing first.
- **No typestate.** `context: C` and `current: K` are two independent
  properties of one flat `Machine` type; states themselves carry no context at
  all. Narrowing `current === 'authenticated'` narrows nothing about
  `context` — a field like `token: string | null` stays nullable even in the
  one state where it's logically guaranteed to be set.

None of this is a knock on robot3's *design* for its actual goal (a ~2kb,
dependency-free FSM with a clean functional API) — it's what happens when a
tiny library optimizes for size and API ergonomics over exhaustive
compile-time checking. But it meant the type annotations were, in a few
concrete ways, decorative rather than enforced.

## What we wanted instead

The one gap worth taking seriously was typestate: **context should be declared
at the state that owns it**, not in one flat context shared by every state.
If `token` only exists once authenticated, the type of the machine's context
should say so, and narrowing the state should narrow the context.

That one requirement has a sharp consequence: a transition's reducer must
return exactly the context shape its *target* state declares. Getting the type
checker to enforce that turned out to be the hard part, and it is what
separates the two prototypes.

## First attempt

States are declared inline, each binding its own data:

```ts
defineMachine("red", {
  red: state((transition: TransitionBuilder<{ changes: number }>) => [
    transition("next", "green", { reduce: (data) => ({ changes: data.changes + 1 }) }),
  ]),
  // ...
})
```

This works, and it catches everything in the table further down. But the
target state's type genuinely isn't known while the checker is looking at a
reducer nested in the same state-map literal being built, so a reducer's
output *cannot* be checked at its call site. Bad transitions are collected
across the whole machine and surfaced at `defineMachine(...)` instead.

Three costs came with that, all found by building it rather than by
speculating:

1. **The deferred error messages are bad.** A wrong reducer output produces a
   wall of `StateDefinition<...> is not assignable to StateDefinition<...> & {
   ERROR: '...' }`. The English sentence is in there, but it points at the
   *state*, not the offending reducer.
2. **`send()` isn't narrowed to the current state** — the same weakness robot3
   had.
3. **The deferred-validation machinery is treacherous.** Getting it right meant
   working around `never` distributing through a conditional and poisoning the
   result, `unknown | Error` collapsing back to `unknown` (silently hiding one
   bad transition among good ones), and intersecting per-transition error
   objects reducing to `never` and firing on *correct* machines. Each bug was
   invisible until tested against both a passing and a failing machine — see
   its `BadTransitions`/`ValidateMachine` machinery.

Multiple guards and multiple reducers per transition were never supported.

## Second attempt: `src/totorobot.ts`

The root cause of all three is declaration order: the target's type isn't known
yet. So declare the spec — every state's context and every event's payload — up
front, as a type argument. Then both ends of every edge are known when a
transition is checked, and a wrong reducer output is reported on the
`reduce(...)` call itself.

The builder keeps robot3's shape: a state map, `state(...transitions)`, and
`transition(event, target, ...modifiers)`. All DSL helpers come from the
`create` callback, so the module only needs to export the machine entry points.

```ts
const retry = Symbol("retry")

type AuthSpec = {
  states: {
    idle: { error: string | null; attempts: number }
    authenticating: { username: string; password: string; attempts: number }
    authenticated: { username: string; token: string }
  }
  events: {
    login: { username: string; password: string }
    [retry]: Record<never, never>
  }
}

const authMachine = defineMachine<AuthSpec>().create("idle", ({
  state,
  final,
  transition,
  invoke,
  guard,
  reduce,
}) => ({
  idle: state(
    transition(
      "login",
      "authenticating",
      guard((_context, event) => event.username.trim().length > 0),
      reduce((context, event) => ({
        username: event.username,
        password: event.password,
        attempts: context.attempts + 1,
      })),
    ),
  ),

  authenticating: invoke(
    (context) => login(context.username, context.password),
    ({ done, error }) => [
      done("authenticated", reduce((context, result) => ({
        username: context.username,
        token: result.token,
      }))),
      error("idle", reduce((context, err) => ({
        error: err instanceof Error ? err.message : String(err),
        attempts: context.attempts,
      }))),
    ],
  ),

  authenticated: final(),
}))

const service = interpret(authMachine, { error: null, attempts: 0 })
```

`context`, `event`, `result` and `err` are all inferred. Nothing is annotated by
hand — the enclosing object key binds the source state, and TypeScript chains
return-type-driven inference from there down into each modifier's callback.

The first argument to `create` declares the initial state, so `interpret` only
needs its context. `final()` explicitly marks a terminal state and does not
accept transitions.

### Why the design looks like this

Every one of these was settled by compiling the alternative and reading what
the checker did, not by reasoning about it.

**The spec is a type argument, followed by a `create` step.**
`defineMachine<Spec>().create(initial, build)` needs two inference boundaries:
the spec is fixed first, then the initial state and state map are inferred by
`create`. That
inferred type is what lets a state key absent from the spec be rejected, and
what lets `send` be narrowed per state. Putting both type arguments on one call
would force the caller to write out the state map's type by hand. The named
`create` step makes that necessary split explicit instead of exposing it as a
bare curried call.

**Modifiers are real objects, not phantom-branded markers.** `reduce`, `guard`
and `action` return `{ kind, apply }`, both fields real. Branding them with a
tuple of their type parameters instead — `{ [brand]?: ["guard", D, E] }` —
makes them *invariant*, and a reusable combinator written against
`{ attempts: number }` stops fitting a state declaring
`{ attempts: number; tries: number }`:

```
Type 'GuardModifier<{ attempts: number; }, unknown>' is not assignable to
  'GuardModifier<IdleData, { username: string; }>'.
```

Putting the type parameters in `apply`'s parameter positions gives
contravariance for free, so third-party combinators compose. It also means the
public surface carries no `__types`/`__context` placeholders.

**The reducer comes last, and there is at most one.** robot3 partitions
modifiers by kind (`filter(guardType, args)` / `filter(reduceType, args)`), so
the relative order of guards and reducers was never meaningful there — only
order *within* a kind. But robot3 also *pipelines* reducers via `callForward`,
each receiving the previous one's output. That cannot be typed once context is
per-state: reducer *n*'s input is reducer *n-1*'s output, and that fold isn't
expressible through this inference path. Written naively it type-checks and
lies — the second reducer's `context` is typed as the source state's while the
runtime hands it the first reducer's output. Fixing the reducer's position in
the signature is what rules that out.

**A required reducer is expressed in the signature, not the docs.** The
modifier list is a conditional tuple: guards and actions, then a reducer that
is optional only when the source context is already assignable to the target's.
Omitting it across differently-shaped states is a compile error rather than a
convention.

**`invoke` takes a callback where `state` takes varargs.** `Result` has to be
fixed by `source` before `done`'s modifiers can be checked against it. Passing
`done(...)` as a sibling argument leaves `Result` unresolved and its reducer
sees `unknown` — verified. The callback form binds it first.

**`action` is its own kind.** robot3 derives it from `reduce`
(`action = fn => reduce((ctx, ev) => !!~fn(ctx, ev) && ctx)`), which forces an
action's output shape to equal its input shape, so it couldn't be attached to a
transition that changes shape. (That derivation also has a live footgun: an
action returning `-1` makes `~fn(...)` zero and silently replaces the context
with `false`.) Here it's shape-neutral, so any number can appear on any edge.

### What it catches

Each of these is a test in `tests/totorobot.test.ts`, written as a failing example
and confirmed rejected.

| Mistake | First attempt | Totorobot |
|---|---|---|
| Reducer returns the wrong target state's shape | ✅ (deferred) | ✅ (at the `reduce` call) |
| Reducer reads a field its source state lacks | ✅ | ✅ |
| Transition targets a state that doesn't exist | ✅ | ✅ |
| Event name isn't declared by the machine | ✅ | ✅ |
| `send()` with a wrong-typed payload field | ✅ | ✅ |
| `send()` an event the machine doesn't declare | ✅ | ✅ |
| Reading a state-specific field without narrowing | ✅ | ✅ |
| Wrong initial context for the initial state | ✅ | ✅ |
| Initial state name isn't declared by the spec | ❌ | ✅ |
| Declaring transitions on a final state | ❌ | ✅ |
| Sending an `invoke`-internal settlement event | ✅ | ✅ (not in the event union at all) |
| A state key that isn't in the spec | ❌ | ✅ |
| A spec state with no entry in the map | ❌ | ✅ |
| `send()` an event the *current state* doesn't handle | ❌ | ✅ (via `service.current`) |
| Omitting a reducer between differently-shaped states | ❌ | ✅ |
| More than one reducer on a transition | n/a | ✅ |

Error locality, which was the whole point:

```
error TS2345: Argument of type '[ReduceModifier<…, { attempts: number; }>]'
  is not assignable to parameter of type '[…, ReduceModifier<…, { token: string; }>]'.
  …
      Property 'token' is missing in type '{ attempts: number; }'
        but required in type '{ token: string; }'.

7  idle: state(transition("login", "authed", reduce((context) => ({ attempts: … })))),
                                             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

The squiggle is on the offending `reduce(...)`, and the last line names the
actual problem and links the declaration. The conditional tuple does add two
lines of noise above it — an honest cost of encoding "reducer required" in the
signature, and still far better than the deferred check's wall.

### Narrowed `send`

`service.current` is a discriminated union carrying `state`, `context` and a
`send` restricted to the events that state actually handles:

```ts
const current = service.current
if (current.state === "idle") {
  current.send({ type: "start" })
  current.send({ type: "cancel" }) // compile error: `idle` doesn't handle it
}
```

`service.send` remains available as an unnarrowed escape hatch, accepting the
whole event union and no-opping on an irrelevant event, as robot3 does.

### What's still rough

1. **Everything must stay inline in the state map.** Hoisting a transition into
   a variable breaks inference — with no contextual return type the source
   state falls back to the union of all states, and the failure surfaces at the
   variable (`Property 'attempts' does not exist on type 'AuthedData | IdleData'`)
   rather than at the cause. Same class of constraint as the first attempt's
   `TransitionBuilder<Data>` annotation, just implicit instead of explicit.
2. **Omitting a reducer permits structural width.** `{ username, token }` is
   assignable to `{ username }`, so a reducer-less transition carries the extra
   fields into a state whose type doesn't mention them. Harmless for reads;
   it leaks the moment anything serializes the context. Treat a state's context as
   a lower bound at runtime.
3. **No `immediate`, `entry` or `exit` yet.** robot3's `immediate` is
   `transition(null, target, ...)` and should drop into the same shape;
   entry/exit hooks are unspecified.
4. **`StateDefinition` still carries two optional type-only members**
   (`state?`, `handles?`). They're what bind the state key and the handled-event
   union for `send` narrowing. Removing them means deriving both from the real
   `transitions` field, which is possible but untested.
5. **A spec written as an `interface` rather than a `type` alias may not
   satisfy the constraint** in some positions — the usual implicit-index-signature
   gotcha. The examples use type aliases.

### The interface we didn't build

An earlier proposal had a fluent builder — `.state("idle", s => s.context<…>())`
then `.on("login", { from, to }, t => t.reduce(…))` — which also puts both ends
of an edge in scope. Two things ruled it out. Its payload rule (repeated event
names accumulate by intersection, and earlier callbacks see only what has
accumulated so far) makes typing order-dependent: moving an `.on(...)` block
changes what its own guard sees. And each link returns a new builder type with a
growing accumulator, so a mistake mid-chain degrades every later link. Declaring
events in the spec removes the accumulation rule entirely, and a state map has
no accumulator to grow.

## Current layout

- `src/totorobot.ts` — the current design.
- `examples/case-studies/traffic-light.ts` — minimal example; `yellow` carries a
  `blinking` flag the other states don't have.
- `examples/case-studies/auth-machine.ts` — `invoke` example; `password` exists
  only while authenticating, `token` only once authenticated.
- `examples/index.ts` — runs both, including the narrowed read of `token` with
  no null check.
- `tests/totorobot.test.ts` — runtime and type-level coverage.

## Running it

Requires Node ≥26 (runs `.ts` files directly, no build step) and pnpm.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm examples
```
