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
