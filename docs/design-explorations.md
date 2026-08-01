# Design explorations

Totorobot began as an investigation into Robot3's TypeScript types. This
document records the experiments that led from that investigation to the
current API. For a reference focused on the design as it exists today, see
[Design notes](design-notes.md).

## Contents

- [Starting point: Robot3](#starting-point-robot3)
- [Goal: per-state context](#goal-per-state-context)
- [Attempt 1: infer states from the map](#attempt-1-infer-states-from-the-map)
- [Attempt 2: a Kysely-inspired builder](#attempt-2-a-kysely-inspired-builder)
- [Attempt 3: declare the spec first](#attempt-3-declare-the-spec-first)
- [Outcome](#outcome)
- [Considered: dropping `.create()` for a plain function call](#considered-dropping-create-for-a-plain-function-call)
- [Considered: a config object and top-level combinators](#considered-a-config-object-and-top-level-combinators)
- [Considered: defining the spec up front, with Robot3 underneath](#considered-defining-the-spec-up-front-with-robot3-underneath)

## Starting point: Robot3

We started with two example machines: a traffic light and an authentication
flow with an asynchronous login. Reading Robot3's declarations and running
those examples exposed several gaps between what its types appeared to
guarantee and what they actually checked.

### Modifier generics were not tied to the machine

Each `reduce`, `guard`, or `action` call was independently generic. Nothing
connected its context and event parameters to the real machine, so an
incorrect context annotation inside one modifier could compile.

### Event payloads were effectively untyped

`send` checked the event's `type`, but additional fields came from an
`[key: string]: any` index signature. This compiled:

```ts
send({ type: 'login', username: 42, password: 'secret' })
```

It then failed at runtime when the machine called `event.username.trim()`.

### `send` was not state-specific

The accepted events were the union across the whole machine. Sending an event
that the current state did not handle compiled and silently did nothing.

### Invocation wrappers were hidden from the types

A resolved promise arrived at a transition as `{ type: "done", data: value }`;
a rejection arrived as `{ type: "error", error }`. The invocation signature
did not describe those wrappers.

### Context and state could not narrow together

Robot3 exposed one flat context type and a separate current-state key. Narrowing
the state to `"authenticated"` did not narrow a nullable `token` field or
remove fields that only made sense while authenticating.

These trade-offs are reasonable for Robot3's goal: a tiny, dependency-free
state machine with a compact functional API. The experiment asked what the
types could guarantee if typestate took priority instead.

## Goal: per-state context

The central requirement became:

> Context should be declared by the state that owns it, and narrowing the
> current state should narrow that context.

For an authentication machine, `password` should exist only while
authenticating and `token` only after authentication.

That requirement creates a harder one: every transition reducer must return
the context declared by its target state. Most of the API exploration was
about finding where TypeScript could know both ends of an edge early enough to
check that reducer well.

## Attempt 1: infer states from the map

The first prototype declared state context inline:

```ts
defineMachine('red', {
	red: state((transition: TransitionBuilder<{ changes: number }>) => [
		transition('next', 'green', {
			reduce: (data) => ({ changes: data.changes + 1 }),
		}),
	]),
	// ...
})
```

This could verify source context, event payloads, and target context, but not at
the point where a reducer was written. While TypeScript checked the reducer
inside `red`, the type of `green` was still part of the same object literal
being inferred.

The prototype therefore collected invalid transitions and reported them later
at `defineMachine(...)`.

### What worked

- State-specific context was represented.
- Wrong source-context reads were rejected.
- Wrong targets and event payloads were rejected.
- Reducer output could eventually be compared with target context.

### Why it was abandoned

#### Errors appeared in the wrong place

A bad reducer produced a large
`StateDefinition<...> is not assignable to StateDefinition<...> & { ERROR: ... }`
message on the state definition. The useful explanation was buried inside it,
and the reducer itself was not highlighted.

#### `send` still could not narrow by current state

The machine-wide validation knew which events existed, but the resulting
service lost the per-state handled-event information needed for a narrowed
`send`.

#### Deferred validation was fragile

The validation machinery had to account for several conditional-type traps:

- `never` distributing through a conditional and poisoning the result;
- `unknown | Error` collapsing to `unknown` and hiding a bad transition;
- intersections of per-transition error objects reducing to `never` and
  rejecting valid machines.

Each failure mode required paired passing and failing tests to detect. The
complexity existed mainly to compensate for information arriving too late.
This prototype also never supported multiple guards on one transition.

## Attempt 2: a Kysely-inspired builder

The next proposal used a fluent API inspired by
[Kysely](https://kysely.dev/). Each method would return a new builder type that
accumulated the states, events, and transitions declared so far.

```ts
const authMachine = defineMachine()
	.state('idle', (state) =>
		state
			.data<{
				error: string | null
				attempts: number
			}>()
			.initial(),
	)
	.state('authenticating', (state) =>
		state.data<{
			username: string
			password: string
			attempts: number
		}>(),
	)
	.state('authenticated', (state) =>
		state
			.data<{
				username: string
				token: string
			}>()
			.final(),
	)
	.on('login', { from: 'idle', to: 'authenticating' }, (transition) =>
		transition
			.payload<{
				username: string
				password: string
			}>()
			.guard((_data, event) => event.username.trim().length > 0)
			.reduce((data, event) => ({
				username: event.username,
				password: event.password,
				attempts: data.attempts + 1,
			})),
	)
	.build()
```

This is a discarded API sketch. Its `.data()`, `.initial()`, and `.final()`
methods are not part of Totorobot's current API.

This shape had a real advantage: `.on(...)` named both ends of the edge before
its reducer was checked, without requiring a separate spec.

### Why it was abandoned

#### Payload inference became order-dependent

If the same event name appeared on multiple edges, its payload would have to
accumulate by intersection. A callback could only see the payload declarations
that appeared earlier in the chain.

Moving an `.on(...)` call could therefore change the type seen by its own
guard. The machine's meaning should not depend on the order in which equivalent
edges are declared.

#### Errors cascaded through the chain

Every call returned a builder with a larger type accumulator. One mistake in
the middle degraded the type of every later method, spreading errors beyond
their cause.

The fluent surface was attractive, but it traded one error-locality problem for
another.

## Attempt 3: declare the spec first

The current direction fixes declaration order directly: declare all state
contexts and event payloads as a type before building any edge.

```ts
type AuthSpec = {
	states: {
		idle: { error: string | null; attempts: number }
		authenticating: {
			username: string
			password: string
			attempts: number
		}
	}
	events: {
		login: { username: string; password: string }
	}
}

const authMachine = defineMachine<AuthSpec>().create(
	'idle',
	({ state, transition, reduce }) => ({
		idle: state(
			transition(
				'login',
				'authenticating',
				reduce((context, event) => ({
					username: event.username,
					password: event.password,
					attempts: context.attempts + 1,
				})),
			),
		),
		authenticating: state(),
	}),
)
```

Both ends of every transition are now known when its reducer is checked. A
wrong output is reported at `reduce(...)`, rather than later at the machine or
on every method after it.

The separate `defineMachine<Spec>().create(...)` calls are two deliberate
inference boundaries:

1. Fix the complete state and event vocabulary.
2. Infer the state map, including which events each state handles.

The second inference result powers the state-specific
`service.current.send`. Keeping builders inside the `create` callback ties them
to the fixed spec without exporting a mixture of bound and unbound helpers.

The current API keeps Robot3's state-map vocabulary rather than the fluent
prototype. It also follows Robot3's convention that `state()` with no outgoing
transitions is terminal.

Detailed rationale, guarantees, and limitations now live in
[Design notes](design-notes.md).

## Outcome

The prototypes established three constraints that shaped Totorobot:

1. Target context must be known before a reducer is checked.
2. Event payload meaning must not depend on declaration order.
3. Errors should remain local instead of propagating through a machine-wide
   validator or fluent type accumulator.

Declaring the spec first is more explicit than inferring everything from the
implementation, but it satisfies those constraints with the most predictable
errors found so far.

## Considered: dropping `.create()` for a plain function call

Parked, not yet adopted. `defineMachine<Spec>().create(initial, build)` still
reads as an object-method call bolted onto a functional API. Two syntax
alternatives were sketched to see whether the same two inference boundaries
could be expressed as plain function calls instead of a chain.

### Option A: the spec as a value

```ts
createMachine(
	defineMachine<AuthSpec>(),
	'idle',
	({ state, transition, ... }) => ({ ... }),
)
```

`defineMachine<S>()` returns a phantom `Spec<S>` marker instead of an object
carrying a `.create` method. `createMachine(spec, initial, build)` would infer
`S` from that marker, then `Initial` and `States` from the remaining arguments -
apparently the same two inference boundaries `.create()` has today, just
expressed as positional arguments rather than a chained call.

**As written, this does not compile** - the prototype is
[`explorations/option-a-spec-as-value.ts`](../explorations/option-a-spec-as-value.ts).
An earlier revision of this section claimed it did, on the strength of a
compiler run whose output turned out to be filtered and misleading; re-running
the compiler directly refuted it.

Inferring `S` in the _same call_ that infers `States` starves the builder's
return of the per-key contextual type `state()` needs, so `K` falls back to
`StateName<S>` and every source context degrades to `never`. The prototype file
carries the control that isolates this: the identical builder body with `S`
already concrete compiles clean.

The likely mechanism is the builder callback. Its unannotated parameter makes
the arrow context-sensitive, so it is deferred to a later inference round; there
the returned object literal has to be both the source `States` is inferred from
and the site where `state()` reads its contextual `K`, and `K` loses. A direct
object-literal argument is contextually typed property by property instead,
which is what [Option D](#option-d-the-state-map-as-a-second-argument) does.

That claim is scoped to this formulation, not to the shape. Several levers were
never tried, and any of them might rescue it - notably that `StateDefinition`'s
`state?: K` is optional here (Option D's equivalent is required, and inference
through optional properties is weaker), plus `NoInfer<>` on the mapped member,
or moving the exactness check off the callback's return type altogether. Read
this as "Option A as specified fails, and here is the mechanism", not "this shape
is impossible".

It is a somewhat academic question, though. A repaired Option A would still keep
the builder callback and the kit - the object-ish part the exercise set out to
shed - and still spend a separate `defineMachine<S>()` step to buy what Option D
gets for free. The interesting result is not that Option A breaks; it is that
Option D shows the callback was the only thing making the two-step necessary.

### Option B: `define` handed to a callback

```ts
createMachine(({ define }) =>
	define<AuthSpec>()('idle', ({ state, transition, ... }) => ({ ... })),
)
```

Here `createMachine` is the only export; `define` arrives as part of the kit
passed to its callback. This one does type-check - see
[`explorations/option-b-define-in-callback.ts`](../explorations/option-b-define-in-callback.ts) -
and `createMachine` itself barely needs its own generics: by the time the
callback returns, the inner `define<S>()(...)` call has already produced a
complete `Machine<S, States, Initial>`.

It works for the same reason Option A does not. `define<S>()` fixes the spec
before the call that infers `States`, so the two boundaries survive; they are
nested rather than chained, but they are still two.

Its cost is the reason it was set aside: `define` only exists inside that
callback's parameter list, so a spec can never be pulled out to module scope.
Every machine has to declare its spec inline, and the call nests three levels
deep (`createMachine` → `define<S>()` → `(initial, build)`).

### Option C: `define` handed to a callback, still three flat arguments

Not tested - sketched but not compiled or checked against the prototype.

```ts
createMachine(
	({ define }) => define<AuthSpec>(),
	'idle',
	({ state, transition, ... }) => ({ ... }),
)
```

Like Option B, `createMachine` stays the only export and `define` arrives
through a kit rather than as a top-level function. Unlike Option B, that kit
is only used to produce the spec; `initial` and the state-map builder go back
to being `createMachine`'s own second and third arguments instead of being
threaded through `define<S>()`'s own call. This would keep Option B's single
entry point while keeping Option A's flat, non-nested argument list.

Whether a spec could still be declared ahead of time under this shape is
open - the first argument is itself a plain callback
(`({ define }) => define<AuthSpec>()`), so that callback, rather than a bare
spec value, is what could potentially be hoisted and reused. This has not
been checked against the type-inference boundaries the way Options A and B
were.

### Direction

Nothing here is worth adopting. Option A, the one that looked best, does not
compile as specified - possibly repairable, but only into something still
carrying the callback and the extra step; Option B compiles but gives up spec
reuse and nests deeper than the chain it was meant to replace; Option C was
never tested.

The useful result is negative and applies beyond this section: as long as the
state map is produced by a builder callback, the spec has to be fixed _before_
the call that infers the map. Chaining, currying and nesting are just ways of
spelling that boundary, not ways of removing it. Removing the callback is what
removes it - which is what the
[next section](#considered-a-config-object-and-top-level-combinators) explores.

## Considered: a config object and top-level combinators

A different family altogether, and the more interesting one. Instead of fixing
the spec through an explicit type argument, carry it as a _value_ in a config
object:

```ts
import { createMachine, state, transition, reduce, guard } from 'totorobot'

createMachine({ types: {} as AuthSpec, initialState: 'idle' }, { ... })
```

Two things change at once. First, `types: {} as Spec` makes `S` inferrable from
an ordinary argument. Second, `state` and `transition` stop being kit members
handed to a builder callback and become plain top-level imports, which is what
makes the whole thing read like Robot3 again.

The second change is what enables the first. As the previous section found, the
builder callback is what forces the spec to be fixed in an earlier call; with no
callback in the way, `S` can be inferred alongside `States` in one call and the
two-step API dissolves. The Robot3-shaped surface and the single call are the
same change, not two.

Three shapes were prototyped and compiled under the project's strict flags. The
prototypes are in [`explorations/`](../explorations/README.md).

### The spec shape

All three assume a different spec type: discriminated unions keyed by `name`
rather than records keyed by state name.

```ts
type Spec = {
	states: ({ name: 'idle' } & IdleContext) | { name: 'foo'; prop: 'bar' }
	events: ({ name: 'bloop' } & BloopPayload) | { name: 'ping'; count: number }
}
```

This works and is arguably nicer to write - a state's context is spelled inline
with its name, and intersecting in a named interface reads well. The derivations
become `Omit<Extract<S['states'], { name: K }>, 'name'>` for a context and
`Extract<S['events'], { name: E }>` for an event object, both of which infer
correctly. The cost is that these are deferred types, which turns out to matter
(see [What broke](#what-broke-and-why) below).

### Option D: the state map as a second argument

```ts
createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	{
		idle: state(transition('login', 'authenticating', reduce(...))),
		authenticated: state(),
	},
)
```

This one works completely - prototype in
[`explorations/option-d-state-map-argument.ts`](../explorations/option-d-state-map-argument.ts).
`context` and `event` infer to the exact per-state context and per-event object
inside every `guard`/`reduce` callback, a wrong reducer output is still reported
on the `reduce()` call itself, an omitted-but-required reducer is rejected, and
unknown state names, event names, targets, missing keys and extra keys are all
caught. Per-state `send` narrowing survives too, which is the reason the state
map's own type has to be inferred.

It is also the only option examined that both collapses to a single call and
keeps the spec reusable - the thing Option A was wanted for and could not
deliver:

```ts
const authConfig = { types: {} as AuthSpec, initialState: 'idle' } as const
```

The sharp edge is `as const`. Without it `initialState` widens to `string` and
the call fails. A hoisted config carries a literal that can widen, so this is a
real cost rather than a formality.

### Option E: the state map inside the config object

```ts
createMachine({
	types: {} as AuthSpec,
	initialState: 'idle',
	states: { idle: state(...), foo: state(...) },
})
```

This does not work - prototype in
[`explorations/option-e-state-map-in-config.ts`](../explorations/option-e-state-map-in-config.ts).
`types` and `states` are siblings in one object literal, so when TypeScript
computes the contextual type for `states` it has not yet fixed `S` from `types`;
`S` falls back to its constraint and every callback parameter lands as
`unknown`. The state _keys_ still infer, which makes the failure especially
confusing - the machine's shape is checked but its contexts are not.

This is the ordinary same-object-literal inference limitation, and nothing about
the surrounding design avoids it. One level deeper costs all per-state typing.

### Option F: states as positional arguments

```ts
createMachine(
	{ types: {} as AuthSpec, initialState: 'idle' },
	state('idle', transition(...)),
	state('foo', transition(...)),
)
```

This one is a genuine trade-off rather than a flat failure, and the trade-off is
forced. Both halves are recorded in
[`explorations/option-f-positional-states.ts`](../explorations/option-f-positional-states.ts).

To narrow `send` per state and to reject a missing state at compile time,
`createMachine` has to infer the rest arguments as a _tuple_. But a naked
inferred tuple type parameter supplies no contextual type to the arguments
themselves, so `state(...)` never learns `S` and the callbacks land as `unknown`
again. Three formulations were tried - naked `States`, a mapped type over
`keyof States`, and `States & StateDefinition<S, ...>[]` (the intersection that
works for Option D's object literal). All three lose the spec.

Dropping the tuple fixes inference completely: with the rest parameter typed as
plain `StateDefinition<S, StateName<S>, EventName<S>>[]`, `S` propagates and
every callback types correctly. So the choice is:

- inferred tuple - exhaustiveness and `send` narrowing, no per-state contexts
- no tuple - per-state contexts, but exhaustiveness and duplicate detection move
  to runtime and `send` cannot be narrowed

Neither half is worth giving up. Separately, nothing in this shape catches the
same state being declared twice.

### What broke, and why

Worth recording, because it is not obvious and it bit the first version of all
three prototypes. It is spelled out at the definition site in
[`explorations/config-object-kit.ts`](../explorations/config-object-kit.ts).
Parameterising `transition` by the source state name:

```ts
declare function transition<
	S,
	K extends StateName<S>,
	E,
	To extends StateName<S>,
>(
	event: E,
	target: To,
	...modifiers: TransitionModifiers<
		ContextOf<S, K>,
		EventObject<S, E>,
		ContextOf<S, To>
	>
): TransitionDefinition<S, K, E>
```

makes `transition('login', 'authenticating', ...)` fail with `"authenticating"
is not assignable to "idle"`. `TransitionModifiers` is a conditional type
(`[Context] extends [Output]`, the rule that makes a reducer required only when
the shape changes). Resolving that conditional forces `To` before the `target`
argument has been read, and `To` collapses onto `K`.

The fix is what the current `Kit` already does for a different reason: carry
`Context` as its own free type parameter, inferred from the contextual type,
rather than deriving it from `K` inside the conditional. With
`TransitionModifiers<Context, EventObject<S, E>, ContextOf<S, To>>` everything
resolves. The existing design was already standing on this without the note
having been written down.

### Direction

Option D is the only one of the six options in this document that gives up
nothing. It removes the curried call rather than re-spelling it - which
[Option A](#option-a-the-spec-as-a-value) tried and could not do - and it moves
`state`/`transition` to top-level imports, closer to Robot3 than passing a kit
to a builder callback. Its costs are the `as const` requirement on a hoisted
config and a `types: {} as Spec` idiom that has to be explained.

Option E should be dropped - the nesting it buys costs all per-state typing.
Option F is only viable if compile-time exhaustiveness and `send` narrowing are
negotiable, which so far they have not been.

## Considered: defining the spec up front, with Robot3 underneath

Option D's one real cost is the `as const` on a hoisted config. Lifting the
config into its own constructor call removes it, and lands on a shape close
enough to Robot3's that the obvious next question is whether Robot3 could just
_be_ the runtime.

### Option G: `defineMachine` then `createMachine`

```ts
const spec = defineMachine<AuthSpec>()({ initialState: 'idle' })

createMachine(spec, {
	idle: state(transition('login', 'authenticating', reduce(...))),
	authenticated: state(),
})
```

This works, and everything Option D checks it also checks - prototype in
[`explorations/option-g-define-then-create.ts`](../explorations/option-g-define-then-create.ts).
Two things improve. Passing the config through a function whose
`Initial extends StateName<S>` constraint is in scope pins `'idle'` as a
literal, so no `as const` is needed and the spec is freely reusable. And a bad
`initialState` is reported at the `defineMachine` call rather than at
`createMachine`'s first argument.

That `S` is still inferred in the same call that infers `States` is fine: the
state map is a plain argument, not a builder callback.
[Option A](#option-a-the-spec-as-a-value) is nearly this signature _with_ a
callback, and that is what breaks it.

#### The spelling that does not exist

The idea was written as one call, with the spec explicit and the initial state
inferred:

```ts
defineMachine<AuthSpec>({ initialState: 'idle' }) // Expected 2 type arguments, but got 1
```

TypeScript has no partial type-argument inference. Naming `S` explicitly
switches the whole call to explicit type arguments, so `Initial` stops being
inferred from `config` and has to be written out too. Two spellings work
instead: currying, as above, or carrying the spec as a value again -
`defineMachine({ types: {} as AuthSpec, initialState: 'idle' })`, which infers
both and is one call, at the cost of the `{} as Spec` idiom.

### Option H: the marker as a config property, no currying

Currying two calls together (`defineMachine<S>()({...})`) was disliked
regardless of what it bought. The alternative: keep the phantom marker from
Option A, but put it as a property of the config object rather than passing it
as the first argument to a separate call, and keep the state map an ordinary
second argument rather than a callback.

```ts
createMachine(
	{ initialState: 'idle', specification: defineMachine<AuthSpec>() },
	{
		idle: state(transition('login', 'authenticating', reduce(...))),
		authenticated: state(),
	},
)
```

(The property name is unsettled - `specification` avoids the abbreviation in
`spec`; `definition` was the first name suggested and works identically, since
nothing here depends on the name.)

Works completely - prototype in
[`explorations/option-h-marker-in-config.ts`](../explorations/option-h-marker-in-config.ts).
`specification` and `initialState` are two sibling properties in one object
literal, which is exactly Option D's `types`/`initialState` shape with a
different carrier for `S`. It is not Option E's failure: nothing here is a
per-key mapped type needing `S` fixed first, since `Initial extends
StateName<S>` is a plain constraint check, not a per-key contextual type.
Every guarantee - exact per-state contexts, `send` narrowing, all the
rejections - carries over unchanged.

What it does not inherit is Option G's fix for the `as const` edge, and this
was checked rather than assumed. Currying bought a call whose `Initial extends
StateName<S>` constraint pins the literal in scope before anything is
assigned to a variable; without that call, hoisting the config to a variable
widens `initialState` to `string` again, exactly as Option D's does. Trading
the curry away brings the `as const` requirement back.

### Robot3 as the runtime

Option G and H's vocabulary is Robot3's vocabulary, so the wrapper was built
rather than argued about:
[`explorations/robot3-wrapper.ts`](../explorations/robot3-wrapper.ts), with
runtime coverage in
[`explorations/robot3-wrapper.test.ts`](../explorations/robot3-wrapper.test.ts).
Robot3 is a devDependency for this prototype only. The intent, once a wrapper
was on the table at all, was to cover Robot3's surface rather than a
convenient slice of it - so beyond `state`/`transition`/`guard`/`reduce`/
`action`/`createMachine`/`interpret`, it also wraps `immediate` (a transition
that fires on entry, with no event - not in `src/totorobot.ts` yet, but free
here) and `invoke` (a promise-returning source with `done`/`error` settlement
branches, matching the real `InvokeBuilder`'s shape).

It works, and "totorobot would mostly be types" is close to literal. The type
layer transplants unchanged - `TransitionModifiers`, per-state contexts,
exhaustive state maps, `send` narrowing - across every combinator, including
the two added for this pass. Nothing is reimplemented, except `invoke`'s
done/error routing, which is built from the wrapper's own `transition` rather
than a separate mechanism (see below).

Six mismatches have to be absorbed, the first five pinned by tests:

1. **`name` versus `type`.** Robot3 discriminates on `type`; the spec shape
   proposed above uses `name`. This is not cosmetic. Robot3 computes the key as
   `event.type || event`, so an untranslated `{ name }` object is used as the
   Map key itself, matches nothing, and is _silently dropped_ - no throw, no
   warning. The wrapper translates in `send`. Keying the spec on `type` would
   delete both the translation and the hazard, and is what
   [`src/totorobot.ts`](../src/totorobot.ts) already does.
2. **`onChange` is not optional.** Robot3's `.d.ts` marks it optional;
   `transitionTo` calls `service.onChange(service)` unconditionally, so omitting
   it throws on the first transition. The wrapper always passes a function.
3. **`action` can destroy the context.** It is implemented as
   `reduce((ctx, ev) => !!~fn(ctx, ev) && ctx)`, so an action returning `-1`
   sets the context to `false`. Typing the callback `=> void` does not prevent
   it - TypeScript permits returning a value from a void-returning callback.
4. **Reducer count.** Robot3 chains multiple reducers on one transition;
   `TransitionModifiers` permits at most one. The wrapper is stricter than the
   runtime, which is the safe direction.
5. **Invoke settlements arrive wrapped.** Robot3's invoke does not send the
   resolved value or rejection reason directly - it sends
   `{ type: 'done', data }` / `{ type: 'error', error }`, so a settlement
   reducer typed to receive `Result` would silently receive
   `{ type: 'done', data: Result }` instead. Found by running the tests, not
   by reading the source: the first version of the resolving-invoke test had
   `result.token` read as `undefined`. `invoke` rebuilds each modifier to
   unwrap the value first, the same shape of fix as `send` translating `name`
   to `type`.
6. **No cancellation.** `invoke`'s source still receives an `AbortSignal`,
   matching the real `InvokeBuilder`, but nothing ever aborts it. A stale
   settlement is already dropped correctly - Robot3 checks
   `machine2 === service.machine` before sending `done`/`error` - but the
   underlying async work (a `fetch`, say) is never told to stop. Doing so
   would mean aborting whatever was pending the moment a transition leaves the
   invoke state, and Robot3 exposes no hook for that; it would have to be a
   hidden action threaded onto every transition the wrapper builds. Not
   attempted, and not pinned by a test - the AbortSignal test only checks that
   a real signal is handed to the source.

Per-state context needs no bridging at all: Robot3 carries one context value
that reducers replace wholesale, which is exactly what per-state context is a
type-level discipline over.

Two things remain unwrapped entirely, rather than wrapped with a caveat:
Robot3's machine-valued `invoke` (nested/child machines, `service.child`) and
the `d`/`logging` debugging modules. Both look tractable; neither was
attempted, so "entire API" should be read as "everything exercised so far,"
not as a completed inventory.

### Direction

Between Option G and Option H: G removes an edge case at the cost of a curried
call, H removes the curry at the cost of the edge case. Neither is a strict
improvement on the other once currying itself is counted as a cost, so the
choice is a style preference, not a compilable one - `defineMachine<S>()()`
plus no `as const` versus `defineMachine<S>()` inline plus `as const` on any
hoisted config. Both beat Option D's `{} as Spec` idiom by giving the spec
marker a real call form.

Building on Robot3 is a separate, orthogonal decision from which config shape
wins. It is viable and would delete most of the runtime, at the cost of a
dependency whose `action` has a context-destroying edge case, whose invoke
settlements arrive wrapped and need unwrapping, whose `onChange` contract
disagrees with its own types, and whose cancellation and nested-machine
support are unexplored. The prototype exists so that decision can be made
against evidence rather than impressions.

If this family is adopted, adopt it in Option G's or Option H's form (not
Option D's bare `{} as Spec`) and key events on `type` rather than `name`.
