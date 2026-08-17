# Design notes

Totorobot is an experimental finite-state-machine library built around
per-state context. This document describes the current design and its known
trade-offs. For the experiments that led here, see
[the design record](api-rationale.md).

## Contents

- [Current API](#current-api)
- [Design decisions](#design-decisions)
- [Type guarantees](#type-guarantees)
- [Runtime semantics](#runtime-semantics)
- [Known limitations](#known-limitations)

## Current API

A machine starts with a spec that declares every state's context and every
event's payload:

```ts
type AuthSpec = {
	states: {
		idle: { error: string | null; attempts: number }
		authenticating: {
			username: string
			password: string
			attempts: number
		}
		authenticated: { username: string; token: string }
	}
	events: {
		login: { username: string; password: string }
	}
}
```

The spec is fixed first. `create` then infers and checks the initial state and
state map:

```ts
const authMachine = defineMachine<AuthSpec>().create(
	'idle',
	({ state, transition, invoke, guard, reduce }) => ({
		idle: state(
			transition(
				'login',
				'authenticating',
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
				done(
					'authenticated',
					reduce((context, result) => ({
						username: context.username,
						token: result.token,
					})),
				),
				error(
					'idle',
					reduce((context, invokeError) => ({
						error:
							invokeError instanceof Error
								? invokeError.message
								: String(invokeError),
						attempts: context.attempts,
					})),
				),
			],
		),

		// As in Robot3, a state with no transitions is terminal.
		authenticated: state(),
	}),
)

const service = interpret(authMachine, { error: null, attempts: 0 })
```

The builders are scoped to the `create` callback. `context`, `event`, promise
results, and invocation errors are inferred without annotations.

## Design decisions

### The spec and state map have separate inference boundaries

`defineMachine<Spec>().create(initial, build)` fixes the machine's state and
event vocabulary before TypeScript infers the state map.

Putting the spec and map on one generic call would require callers to supply
the inferred map type manually. The named `create` step makes the necessary
split explicit instead of exposing it as a bare curried function.

The inferred map type is also what allows `service.current.send` to know which
events each state actually handles.

> **Note added 2026-08-05.** The argument above is sound as far as it goes —
> partial type-argument inference is a real, open TypeScript gap
> (microsoft/TypeScript#53999). But it only rules out _keeping `Spec` explicit
> while inferring the map in the same call_. It does not rule out the third
> option: declaring no `Spec` at all and inferring states, their data and the
> vocabulary from the map alone. That option was written off on the strength of
> a conclusion since shown to be false; it has now been built and measured with
> errors landing on the exact offending sub-expression. See
> [research note 06](research/06-typescript-type-engineering.md) and the
> correction in [api-rationale.md](api-rationale.md). The split here
> is therefore a defensible choice, not a necessity.

### Builders come from the callback

`state`, `transition`, `invoke`, `guard`, `reduce`, and `action` all come from
the callback passed to `create`. This keeps the DSL attached to the fixed
machine spec and avoids mixing module-level builders with context-bound ones.

### Modifiers are real objects

`reduce`, `guard`, and `action` return objects with real `kind` and `apply`
fields. They are not phantom-branded markers.

Putting context and event types in `apply`'s parameter positions gives reusable
combinators useful contravariance. A guard written for `{ attempts: number }`
can be used by a state whose context contains that field plus additional ones.
Tuple branding would make those modifiers invariant and prevent that reuse.

### A transition has at most one reducer, and it comes last

Robot3 groups modifiers by kind, so the relative order of guards and reducers
is not meaningful. It also pipelines multiple reducers, with each reducer
receiving the previous reducer's output.

That pipeline cannot be represented honestly when context belongs to states:
the input of reducer _n_ depends on the output of reducer _n - 1_. Typing every
reducer as if it received the source state's context would compile but disagree
with runtime behavior.

Totorobot therefore allows guards and actions followed by at most one reducer.
The type signature and a runtime check enforce the same rule.

### Context-changing transitions require a reducer

The modifier list is a conditional tuple. A reducer is optional only when the
source context is already assignable to the target context. If the state shapes
differ, omitting the reducer is a compile error.

This makes context conversion part of the API contract rather than a
documentation convention.

### Invocation uses a callback

`invoke` receives its settlement branches from a callback:

```ts
invoke(source, ({ done, error }) => [
	done(
		'success',
		reduce((_context, result) => result),
	),
	error(
		'failure',
		reduce((_context, invokeError) => ({ invokeError })),
	),
])
```

The callback creates an inference boundary after `source` fixes the promise
result type. Passing `done(...)` as a sibling argument leaves that result
unresolved, so its reducer would receive `unknown`.

### Actions are shape-neutral

An action is its own modifier kind rather than reducer sugar. It receives the
source context and event, performs a side effect, and does not participate in
the target context's shape.

This allows actions on transitions between differently shaped states without
pretending that an action returns context.

Robot3 derives `action` from `reduce`, which requires an action's output shape
to equal its input shape. Its implementation also treats the action's return
value as part of a bitwise expression; returning `-1` can replace the context
with `false`. Keeping actions separate avoids both constraints.

### Services expose narrowed and unnarrowed views

`service.current` is a discriminated union of state, context, and a state-local
`send`:

```ts
const current = service.current

if (current.state === 'idle') {
	current.context.attempts
	current.send({ type: 'login', username: 'q', password: 'secret' })
}
```

Narrowing `state` narrows both `context` and `send`.

`service.send` is the Robot3-style escape hatch. It accepts the machine's full
event union and silently does nothing when the current state has no matching
transition.

## Type guarantees

The test suite includes rejected examples for each compile-time guarantee.

| Mistake                                                            | Result                        |
| ------------------------------------------------------------------ | ----------------------------- |
| Reducer returns the wrong target context                           | Rejected at `reduce(...)`     |
| Reducer reads context absent from its source state                 | Rejected                      |
| Transition targets an unknown state                                | Rejected                      |
| Transition uses an undeclared event                                | Rejected                      |
| Event payload has the wrong shape                                  | Rejected                      |
| Initial state is absent from the spec                              | Rejected                      |
| Initial context does not match the initial state                   | Rejected                      |
| State map has missing or extra states                              | Rejected                      |
| Context field is read without narrowing to its state               | Rejected                      |
| `service.current.send` receives an event not handled by that state | Rejected                      |
| Invocation settlement is sent as a public event                    | Not part of the event union   |
| Reducer is omitted between incompatible context shapes             | Rejected                      |
| Transition declares more than one reducer                          | Rejected by types and runtime |

### Error locality

Declaring the spec up front means both ends of an edge are known while its
reducer is checked. A bad reducer points to the reducer itself:

```text
error TS2345: Argument of type '[ReduceModifier<…, { attempts: number; }>]'
  is not assignable to parameter of type
  '[…, ReduceModifier<…, { token: string; }>]'.

Property 'token' is missing in type '{ attempts: number; }'
  but required in type '{ token: string; }'.
```

The conditional modifier tuple adds some noise, but the final lines identify
the actual context mismatch at its source.

## Runtime semantics

- Guards run in declaration order and short-circuit on the first `false`.
- Actions run in declaration order after every guard passes and before the
  state changes.
- A reducer, when present, maps the source context to the target context.
- A transition aborts the invocation belonging to the state it leaves.
- Invocation sources receive an `AbortSignal`.
- A promise that settles after its invocation state has been left is ignored.
- `state()` with no transitions is terminal by convention.
- `stop()` aborts a pending invocation and prevents future events.

## Known limitations

### Transitions need to stay inline

Hoisting a transition into a variable removes the state map's contextual return
type. The source state then falls back to the union of all states, and the error
appears at the variable rather than at the cause.

### Reducer omission permits structural width

TypeScript allows a context with extra fields to satisfy a narrower target
context. A reducer-less transition can therefore carry fields the target state
does not declare. Treat a state's context as a lower bound at runtime,
especially before serialization.

### Immediate transitions and lifecycle hooks are missing

There is no `immediate`, `entry`, or `exit` API yet.

### State definitions retain two type-only fields

`StateDefinition` carries optional `state?` and `handles?` members. They bind a
state key and its handled-event union for narrowed `send`. Deriving both from
the real transitions is possible but has not been validated.

### Type aliases are safer than interfaces for specs

An `interface` may fail the machine-spec constraint in some positions because
of TypeScript's implicit-index-signature behavior. Current examples use type
aliases.
