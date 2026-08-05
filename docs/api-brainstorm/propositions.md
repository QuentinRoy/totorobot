# General FSM API propositions

> **Status:** Design draft for review. These interfaces are intentionally more
> precise than brainstorm seeds, but they are not implementation commitments or
> the candidate evidence required by `requirements.md`.

## Conclusion first

Three definition interfaces over one shared FSM model survive the brainstorm
and generality review:

1. **Behavior-first states:** each source/input pair is one ordinary TypeScript
   decision function. Its return type is the possible topology.
2. **Rules as data:** each source/input pair is an ordered list of explicit
   `none`, `update`, and `change` clauses.
3. **Bound graph contract:** topology is declared without behavior, then every
   graph slot receives one compiler-checked decision function.

The first is the strongest default. It has the smallest interface, keeps each
decision in one place, and admits arbitrary synchronous logic without adding a
second transition language. The rules interface is the serious challenger when
runtime-inspectable topology or source-specific capability payloads justify a
more constrained notation. The graph contract is useful as a falsification
candidate, but its mandatory two-site edits conflict with the project's highest
priority.

This conclusion is about general finite-state-machine creation. The Marking
Menu is used only after the general interface has been established.

## Scope reset

The requirements describe three separable modules:

| Module             | Responsibility                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| FSM kernel         | Fixed states, state data, inputs, deterministic decisions, exact outcomes, pure caller-owned stepping    |
| Live execution     | Current-value ownership, serialized submission, commitment, observation, reentrancy, disposal            |
| Effect integration | Plain command execution, asynchronous feedback, cancellation, stale authority, clocks, residency cleanup |

Queues, timers, `AbortSignal`, effect scopes, and browser resources are not FSM
definition concepts. A useful machine must exist without any of them. The live
and effect modules host the same kernel rather than changing its meaning.

All three propositions obey these kernel rules:

- The control-state set is fixed and finite.
- One state is the canonical initial control state.
- Each state may carry arbitrary data, including no data, objects, tuples,
  primitives, or recursive values.
- Capability availability depends on the control state.
- A handled input makes one synchronous deterministic decision.
- The only ordinary outcomes are no transition, a same-state update, or a
  change to another control state.
- State values and outcomes are immutable wrappers. User values inside state
  data are not cloned or frozen.
- A reusable definition can evolve many independent values or host many live
  executions.
- Effects cannot select, revise, or roll back a target. They begin only after a
  decision is final and, when it commits, after its target is installed.

## Neutral test machine

The primary design example is a document-publication FSM. It exercises general
FSM concerns without assuming pointer input, timers, requests, or resources.

| State       | Data                                  |
| ----------- | ------------------------------------- |
| `empty`     | none; initial                         |
| `draft`     | `{ text, revision }`                  |
| `review`    | `{ text, revision, reviewer }`        |
| `published` | readonly `[text, revision]`; terminal |

Its behavior is:

| Source              | Input                      | Outcome                    |
| ------------------- | -------------------------- | -------------------------- |
| `empty`             | `open(text)`               | change to `draft`          |
| `draft`             | `revise(text)` unchanged   | no transition              |
| `draft`             | `revise(text)` changed     | update `draft`             |
| `draft`             | `submit(review, reviewer)` | change to `review`         |
| `draft`             | `submit(publish)`          | change to `published`      |
| `review`            | `revise(text)`             | change back to `draft`     |
| `review`            | `decide(approve)`          | change to `published`      |
| `review`            | `decide(reject, text)`     | change to `draft`          |
| `draft` or `review` | `cancel`                   | change to `empty`          |
| `published`         | any broad input            | no transition: unavailable |

This forces every proposition to cover:

- a data-free state without a placeholder object;
- structurally different state data, including a tuple;
- a guard-like refusal distinct from a same-state commit;
- one source/input pair with multiple possible targets;
- shared inputs and state-specific availability;
- an intentional terminal state;
- exact source/input/target records;
- narrow known-state use and broad dynamic use; and
- reusable pure evolution without a live runtime.

## Shared outcome algebra

The spelling may differ slightly between propositions, but their public outcome
contract is the same:

```ts
type StateValue = { readonly state: string }

type CommandList<Command> = [Command] extends [never]
	? readonly []
	: readonly Command[]

type None<
	Source,
	Input,
	Reason extends 'declined' | 'unavailable',
	Command = never,
> = Source extends unknown
	? Input extends unknown
		? Readonly<{
				kind: 'none'
				reason: Reason
				source: Source
				input: Input
				commands: CommandList<Command>
			}>
		: never
	: never

type Update<
	Source extends StateValue,
	Input,
	Target extends StateValue,
	Command = never,
> = Source extends unknown
	? Input extends unknown
		? Target extends unknown
			? Target['state'] extends Source['state']
				? Source['state'] extends Target['state']
					? Readonly<{
							kind: 'update'
							source: Source
							input: Input
							target: Target
							commands: CommandList<Command>
						}>
					: never
				: never
			: never
		: never
	: never

type Change<
	Source extends StateValue,
	Input,
	Target extends StateValue,
	Command = never,
> = Source extends unknown
	? Input extends unknown
		? Target extends unknown
			? Target['state'] extends Source['state']
				? never
				: Readonly<{
						kind: 'change'
						source: Source
						input: Input
						target: Target
						commands: CommandList<Command>
					}>
			: never
		: never
	: never
```

`none` has no target because nothing was committed. `update` and `change` both
have fresh target wrappers and are both observable commits. These leaf aliases
distribute state unions, but a machine does not derive its public type by
passing three independent unions. It first constructs a union of valid
source/capability/target route tuples, then maps each tuple to one leaf record.
This is invalid:

```ts
type BadRecord = {
	source: AnyState
	input: AnyInput
	target: AnyState
}
```

It invents combinations that no transition can produce.

The `input` field is always the complete input envelope, not only its payload.
A global input is `{ type, payload }` or `{ type }` for a data-free input. A
source-local input additionally has `from`. Decision functions receive the
payload for convenience, while outcomes retain the envelope and therefore its
identity.

Correlation is static, not clairvoyant. The kernel preserves the exact source
state, capability identity, payload type, and statically declared target union.
It cannot generally infer that one runtime payload value selects one target.
For example, a call to `submit({ route: "review" })` may still have the static
target union `Review | Published` because an ordinary decision function can use
arbitrary values and dependencies. A domain that requires payload-variant
correlation should declare separate capabilities or use an explicit matcher in
the rules proposition.

Command data is optional. An effect-free definition uses `never` and produces
an empty command tuple. A command-capable definition can attach plain values to
any handled decision, including `none`. The caller or live execution interprets
those values only after deciding and, for a commit, installing `target`.

Explicit same-state re-entry is not part of these first interfaces. `update`
always preserves residency. A finalist should prove that a later `reenter(data)`
extension can restart residency without making ordinary updates more complex;
P2 does not justify a fourth outcome in every initial machine.

## Proposition 1: Behavior-first states

### Model

The behavioral source of truth is a state-indexed object of ordinary decision
functions. The key of a handler declares input availability. Calls to `none`,
`update`, or `change.<target>` contribute the handler's statically declared
outcome upper bound. The interface does not claim to prove semantic
reachability through arbitrary TypeScript.

State and input data are fixed first so every handler knows its exact source,
input, and target contracts while TypeScript checks its body.

```ts
type PublicationModel = {
	states: {
		empty: void
		draft: {
			readonly text: string
			readonly revision: number
		}
		review: {
			readonly text: string
			readonly revision: number
			readonly reviewer: string
		}
		published: readonly [text: string, revision: number]
	}
	inputs: {
		open: { readonly text: string }
		revise: { readonly text: string }
		submit:
			| {
					readonly route: 'review'
					readonly reviewer: string
			  }
			| { readonly route: 'publish' }
		decide:
			| { readonly verdict: 'approve' }
			| {
					readonly verdict: 'reject'
					readonly text: string
			  }
		cancel: void
	}
}
```

One input name has one machine-wide payload contract. Availability remains
state-specific. This makes source-agnostic broad input values safe without
runtime payload schemas or source stamps.

A model may also declare `dependencies` and `commands`. Dependencies then
appear in every decision context and must be supplied explicitly to `capabilities`,
`offer`, or a live execution. A handler must not read mutable decision data from
an undeclared closure. Commands enable the optional `withCommands` helper
described later; effect-free models omit them.

### Definition

```ts
const publication = defineMachine<PublicationModel>()({
	initial: 'empty',
	states: {
		empty: state({
			open: ({ input, change }) =>
				change.draft({
					text: input.text,
					revision: 0,
				}),
		}),

		draft: state({
			revise: ({ data, input, none, update }) => {
				if (input.text === data.text) return none()

				return update({
					text: input.text,
					revision: data.revision + 1,
				})
			},

			submit: ({ data, input, change }) => {
				if (input.route === 'review') {
					return change.review({
						text: data.text,
						revision: data.revision,
						reviewer: input.reviewer,
					})
				}

				return change.published([data.text, data.revision])
			},

			cancel: ({ change }) => change.empty(),
		}),

		review: state({
			revise: ({ data, input, change }) =>
				change.draft({
					text: input.text,
					revision: data.revision + 1,
				}),

			decide: ({ data, input, change }) =>
				input.verdict === 'approve'
					? change.published([data.text, data.revision])
					: change.draft({
							text: input.text,
							revision: data.revision + 1,
						}),

			cancel: ({ change }) => change.empty(),
		}),

		published: terminal,
	},
})
```

The definition contains no event-edge objects, reducers, guards, or duplicated
graph. `change.review(...)` is a destination-bound constructor: it checks the
review data at the exact call that selected review. It does not organize the
machine by destination.

The two calls in `defineMachine<PublicationModel>()(...)` are one interface
cost, not aesthetic currying. The historical prototypes show why the model must
be fixed before TypeScript contextually checks source handlers and target data.
Alternative spellings are acceptable only if they preserve that inference
boundary and the resulting diagnostics.

### Pure use

```ts
const empty = publication.initial()

const opened = publication.capabilities(empty).open({
	text: 'First draft',
})
// Change<Empty, Open, Draft>

const draft = opened.target

const revised = publication.capabilities(draft).revise({
	text: 'First draft',
})
// None<Draft, Revise, "declined"> | Update<Draft, Revise, Draft>

const submitted = publication.capabilities(draft).submit({
	route: 'review',
	reviewer: 'Ada',
})
// Change<Draft, Submit, Review>
// | Change<Draft, Submit, Published>
```

The union is intentional even though this literal says `route: "review"`.
Argument-sensitive semantic reachability is not part of the contract.

`capabilities(source)` is pure. It binds an immutable source value and exposes
only the handlers authored for that source. It neither claims nor mutates a
live current state.

The broad path accepts the full input vocabulary:

```ts
const unavailable = publication.offer(empty, {
	type: 'decide',
	payload: { verdict: 'approve' },
})
// None<Empty, Decide, "unavailable">
```

An exhaustive consumer can use an ordinary `switch` or a derived visit:

```ts
const view = publication.visit(current, {
	empty: () => renderEmpty(),
	draft: ({ data, capabilities }) => renderDraft(data, capabilities),
	review: ({ data, capabilities }) => renderReview(data, capabilities),
	published: ({ data }) => renderPublished(data),
})
```

The visit is a consumption view, not another definition. Its branch-local
capabilities come from the handler keys already captured by the machine.
For a dependencyful machine the call is `visit(current, dependencies,
branches)`, and the branch capabilities are bound to that same dependency
snapshot.

### Semantics

1. `initial()` accepts no argument for a data-free initial state. Otherwise it
   requires exactly the initial state's data.
2. A handler runs synchronously against an immutable source wrapper and the
   caller-owned input payload reference. Payload and nested state values are not
   cloned or frozen.
3. `none()` returns `reason: "declined"` and commits nothing.
4. `update(data)` checks source-state data and creates a same-state target.
5. `change.<target>(data)` checks the selected target and creates a different
   control state. The current source is absent from `change`.
6. A missing handler makes broad `offer` return `reason: "unavailable"`.
7. A thrown handler applies nothing and surfaces the programming error.
8. A Promise is not a decision and is rejected by the interface.
9. `terminal` is required for an intentional state with no capabilities;
   `state({})` is invalid.
10. The definition rejects missing states, extra states, unknown inputs, invalid
    targets, and handlers whose returns are not decisions.
11. Declared dependencies are explicit handler inputs. Supplying different
    dependency values creates independent machine bindings; it does not create
    an evolving execution. Decision dependencies must be observationally pure.

### General strengths

- Conditions, computation, outcome selection, and target data stay in one
  ordinary TypeScript function.
- A source/input pair with many possible targets remains one decision, not a set
  of competing edges.
- Inference-captured return codomains provide precise static target unions
  without a second graph.
- Repeated capability names use one stable semantic payload throughout the
  machine.
- Arbitrary domain algorithms, local variables, pattern matching, and helper
  calls need no translation into a rule DSL.
- The valid definition is close to the code a developer would write without a
  library, while the module adds exhaustive checking and exact records.

### General weaknesses

- State and input vocabulary appears in the model and behavior map. The model
  declares data contracts while handlers alone declare topology, but adding or
  renaming a state or input is still a multi-location edit.
- Runtime topology cannot be fully recovered from opaque function bodies. Type
  declarations can expose possible targets, but `machine.topology` cannot do so
  without metadata, source analysis, or duplication.
- A capability name cannot have incompatible payloads in different states.
  Those operations must use different names or one discriminated payload.
- TypeScript must preserve each handler's inferred return codomain while also
  contextually typing its arguments. If it widens returns to every state, the
  proposition fails.
- An explicit broad return annotation, dead branch, or widened helper can
  deliberately over-approximate possible targets. The module promises static
  authorization and preserved inference, not reachability analysis.
- Hoisting a handler may require an exported contextual helper type. Inline
  definitions must not be the only reliable path.
- Purity is an interface contract. TypeScript cannot prevent a synchronous
  function from mutating user-owned values or performing an effect.

### Ceremony floor

```ts
type Toggle = {
	states: { off: void; on: void }
	inputs: { toggle: void }
}

const toggle = defineMachine<Toggle>()({
	initial: 'off',
	states: {
		off: state({
			toggle: ({ change }) => change.on(),
		}),
		on: state({
			toggle: ({ change }) => change.off(),
		}),
	},
})
```

There are no placeholder data values, effect declarations, runtime options, or
terminal conventions.

## Proposition 2: Rules as data

### Model

The source of truth is still source-local, but each source/input value is an
ordered rule list rather than an arbitrary decision function.

Every rule explicitly says `none`, `update`, or `change`. Guarded rules run in
order and one unguarded fallback is mandatory. The authored values therefore
make states, accepted inputs, outcome kinds, possible targets, and priority
inspectable without executing conditions or data projections.

State data is declared first. Input payloads are declared where each capability
is implemented. Optional dependency and command contracts are the second and
third type parameters: `defineRules<States, Dependencies, Command>()`; both
default away for an effect-free dependency-free machine.

```ts
type PublicationStates = {
	empty: void
	draft: {
		readonly text: string
		readonly revision: number
	}
	review: {
		readonly text: string
		readonly revision: number
		readonly reviewer: string
	}
	published: readonly [text: string, revision: number]
}
```

`on<Payload>(...)` declares a shared input identity. Reusing its property name
in another state requires the same payload. `on.local<Payload>(...)` declares a
source-qualified capability, allowing the same visible name to have a different
payload elsewhere.

### Definition

```ts
type Submit =
	| {
			readonly route: 'review'
			readonly reviewer: string
	  }
	| { readonly route: 'publish' }

type Decision =
	| { readonly verdict: 'approve' }
	| { readonly verdict: 'reject'; readonly text: string }

const publication = defineRules<PublicationStates>()({
	initial: 'empty',
	states: {
		empty: rules(({ on, change }) => ({
			open: on<{ readonly text: string }>(
				change.draft(({ input }) => ({
					text: input.text,
					revision: 0,
				})),
			),
		})),

		draft: rules(({ on, when, match, none, update, change }) => ({
			revise: on<{ readonly text: string }>(
				when(({ data, input }) => input.text === data.text, none()),
				update(({ data, input }) => ({
					text: input.text,
					revision: data.revision + 1,
				})),
			),

			submit: on<Submit>(
				match('route', {
					review: change.review(({ data, input }) => ({
						text: data.text,
						revision: data.revision,
						reviewer: input.reviewer,
					})),
					publish: change.published(({ data }) => [data.text, data.revision]),
				}),
			),

			cancel: on(change.empty()),
		})),

		review: rules(({ on, match, change }) => ({
			revise: on<{ readonly text: string }>(
				change.draft(({ data, input }) => ({
					text: input.text,
					revision: data.revision + 1,
				})),
			),

			decide: on<Decision>(
				match('verdict', {
					approve: change.published(({ data }) => [data.text, data.revision]),
					reject: change.draft(({ data, input }) => ({
						text: input.text,
						revision: data.revision + 1,
					})),
				}),
			),

			cancel: on(change.empty()),
		})),

		published: terminal,
	},
})
```

The rule list is total. A failed guard proceeds to the next clause. The final
unguarded clause always decides. A deliberate refusal must therefore be visible
as `none()` rather than emerging from implicit fallthrough.

`match(discriminant, cases)` is exhaustive over a discriminated payload union.
Each target projection receives the narrowed case payload. This extra primitive
is necessary because a refinement established in one arbitrary guard callback
does not flow into a separate projection callback.

`derive(selector, rules)` handles compute-once decisions. It evaluates the pure
selector once, adds its result as `derived` to nested guard and projection
contexts, then applies an ordered rule list. It is needed when routing and target
construction share parsing, lookup, or calculation.

### Pure use

Known-state use remains method-shaped:

```ts
const draft = publication.capabilities(someDraft)

const revised = draft.revise({
	text: 'Second draft',
})

const submitted = draft.submit({
	route: 'review',
	reviewer: 'Ada',
})
// Change<Draft, ReviewSubmit, Review>
```

Unlike an opaque behavior function, the explicit `match` lets the generated
capability correlate a discriminated input case with its case-specific static
target.

The broad representation of this shared capability does not need a source:

```ts
const revised = publication.offer(someDraft, {
	type: 'revise',
	payload: { text: 'Second draft' },
})
```

If a domain genuinely needs incompatible signatures under the same visible
name, every occurrence of that name must use `on.local`. Mixing shared and local
identity for one name is invalid:

```ts
draft: rules(({ on, update }) => ({
	revise: on.local<{ readonly text: string }>(update(/* ... */)),
}))

review: rules(({ on, change }) => ({
	revise: on.local<{
		readonly text: string
		readonly requestedBy: string
	}>(change.draft(/* ... */)),
}))
```

The broad forms are then source-qualified as `{ from: "draft", type:
"revise", ... }` and `{ from: "review", type: "revise", ... }`. Offering one
against the other source returns `none/unavailable` before any payload reaches a
handler.

Source qualification solves payload identity, not arbitrary-data validation.
An `unknown` network value still requires validation before becoming a typed
input.

### Semantics

1. Each nonterminal state uses `rules(...)` and defines at least one input.
2. Each input contains zero or more guarded clauses and exactly one final
   unguarded clause.
3. Guards run synchronously in declaration order and short-circuit on the first
   match.
4. Only the selected clause's data projection runs.
5. `none()` is a handled refusal, `update(...)` is a commit in the same control
   state, and `change.<target>(...)` is a commit to another state.
6. `change` excludes the current source. Same-state behavior must say `update`.
7. Shared input names have one payload contract. Local input names are distinct
   `(source, name)` identities and carry `from` on the broad path.
8. `match` is exhaustive over one payload discriminant and narrows every case
   projection. It is declarative topology, not an arbitrary pattern-matching
   language.
9. `derive` evaluates one selector once and makes the result available to every
   nested clause in that decision.
10. Missing capabilities, mismatched local sources, and terminal-state inputs
    return `none/unavailable` through broad `offer`.
11. Throws commit nothing and surface as programming errors.
12. The table exposes its authored topology upper bound without executing
    guards or projections. It does not prove a guard can ever be true.

### General strengths

- Runtime topology is the direct projection of authored rule values.
- Outcome kind and target are visible without reading function bodies.
- Guard ordering and fallback are explicit rather than accidental.
- Source-specific method signatures coexist safely with broad dynamic input.
- Target-data errors remain local to `change.<target>(...)`.
- The table can derive narrow capabilities, exhaustive visits, diagrams, and
  test case inventories from one definition.

### General weaknesses

- Developers must learn and use a transition mini-language even for logic that
  ordinary `if`, `switch`, and local variables express better.
- Type refinements established by an arbitrary guard callback do not flow into
  a separate target-data callback. `match` handles discriminated unions, but
  custom predicates may still require repeated narrowing or a domain helper.
- `match` adds another concept solely to recover control-flow narrowing that
  ordinary TypeScript gives behavior-first handlers for free.
- `derive` avoids repeated computation, but adds another callback layer and
  another value that the type layer must preserve through every nested clause.
- First-match priority is powerful but can hide accidental overlapping guards.
- Local inputs make external adapters more explicit because broad values need a
  source qualifier.
- Because a shared input is inferred from several state properties, a payload
  conflict may be diagnosed at the completed table rather than the offending
  `on` call. If that diagnostic is poor, shared inputs need a small declaration
  map and this proposition loses some inference advantage.
- Capturing every clause in public types risks large declarations and editor
  work. The returned machine type must normalize the table to a compact
  protocol.
- Hoisted clauses and generic reuse are harder to type than ordinary decision
  functions.

### Ceremony floor

```ts
const toggle = defineRules<{
	off: void
	on: void
}>()({
	initial: 'off',
	states: {
		off: rules(({ on, change }) => ({
			toggle: on(change.on()),
		})),
		on: rules(({ on, change }) => ({
			toggle: on(change.off()),
		})),
	},
})
```

This remains acceptable, but it is visibly more library-shaped than the
behavior-first equivalent.

## Proposition 3: Bound graph contract

### Model

The source of truth is a behavior-free authorization graph. It declares
accepted inputs and allowed outcome routes. A separate implementation supplies
one decision function for every source/input slot and can return only
graph-authorized outcomes.

This intentionally spends editing locality to gain an independent topology
artifact.

It uses the same explicit `PublicationModel` state and input contracts as
Proposition 1.

### Graph

```ts
const publicationGraph = defineGraph<PublicationModel>()({
	initial: 'empty',
	states: {
		empty: node({
			open: change('draft'),
		}),

		draft: node({
			revise: oneOf(none, update),
			submit: oneOf(change('review'), change('published')),
			cancel: change('empty'),
		}),

		review: node({
			revise: change('draft'),
			decide: oneOf(change('draft'), change('published')),
			cancel: change('empty'),
		}),

		published: terminal,
	},
})
```

`none` and `update` are graph tokens, not runtime results. `change('review')`
declares a possible control-state change without declaring target data or a
condition.

### Implementation

```ts
const publication = publicationGraph.implement({
	empty: {
		open: ({ input, outcome }) =>
			outcome.change.draft({
				text: input.text,
				revision: 0,
			}),
	},

	draft: {
		revise: ({ data, input, outcome }) =>
			input.text === data.text
				? outcome.none()
				: outcome.update({
						text: input.text,
						revision: data.revision + 1,
					}),

		submit: ({ data, input, outcome }) =>
			input.route === 'review'
				? outcome.change.review({
						text: data.text,
						revision: data.revision,
						reviewer: input.reviewer,
					})
				: outcome.change.published([data.text, data.revision]),

		cancel: ({ outcome }) => outcome.change.empty(),
	},

	review: {
		revise: ({ data, input, outcome }) =>
			outcome.change.draft({
				text: input.text,
				revision: data.revision + 1,
			}),

		decide: ({ data, input, outcome }) =>
			input.verdict === 'approve'
				? outcome.change.published([data.text, data.revision])
				: outcome.change.draft({
						text: input.text,
						revision: data.revision + 1,
					}),

		cancel: ({ outcome }) => outcome.change.empty(),
	},
})
```

The implementation does not redeclare arbitrary targets. `outcome.change` contains
only targets authorized for that graph slot. The graph is an upper-bound
contract: TypeScript can reject an unauthorized return, but it cannot prove that
every authorized route is semantically reachable through an opaque function.

The completed machine's public outcome uses the implementation's
inference-captured codomain intersected with graph authorization. The graph may
therefore expose a wider protocol than one concrete implementation. An
explicitly widened handler annotation widens the concrete outcome within that
protocol, just as it does in Behavior-first.

### Pure use

The completed machine normalizes to the same kernel interface:

```ts
const empty = publication.initial()
const opened = publication.capabilities(empty).open({
	text: 'First draft',
})

const unavailable = publication.offer(empty, {
	type: 'cancel',
})
```

The graph can also exist independently:

```ts
publicationGraph.topology.states.draft.inputs.submit
// { outcomes: [{ change: "review" }, { change: "published" }] }
```

This is the proposition's unique leverage. Tooling can inspect or publish the
complete allowed graph before behavior exists.

### Semantics

1. The graph exhaustively declares every state, terminal state, accepted input,
   allowed outcome kind, and allowed change target.
2. The implementation exhaustively supplies every nonterminal graph slot once.
3. One slot always receives one decision function, even when it has many
   possible targets.
4. Graph-derived outcome helpers check target data at the selected call.
5. A handler can return only declared outcome routes. It may use a subset; the
   graph is authorization, not a reachability proof.
6. `capabilities` exposes only graph-available inputs. Broad `offer` returns
   `none/unavailable` for an absent pair.
7. State values, decisions, exceptions, and commands otherwise follow the
   shared kernel contract.

### General strengths

- The allowed graph is authoritative, behavior-free, runtime-inspectable, and
  available before implementation.
- Architecture review, diagrams, impact analysis, capability derivation, and
  tests do not need to interpret function bodies.
- Multi-target behavior remains one deterministic decision function rather than
  competing edge handlers.
- The graph constrains implementation target choices and exact target data.
- A graph can serve as a package-level protocol contract implemented elsewhere.

### General weaknesses

- Adding a capability changes both graph and implementation. Making a newly
  authorized target reachable changes the graph and its implementation handler.
  The compiler prevents unauthorized behavior but cannot make the edit local.
- Source, input, and targets are visible near one another in the graph, while
  actual conditions and data conversion live elsewhere. Understanding behavior
  requires navigation.
- The graph may over-approximate implemented behavior. A dead authorization can
  survive because semantic reachability through arbitrary TypeScript is not
  decidable here.
- The independent graph primarily serves inspectability, a P2 requirement, at
  direct cost to P0 editing locality.
- The two-state machine pays for graph and implementation even though the graph
  reveals almost nothing the handlers would not.

### Ceremony floor

```ts
const toggleGraph = defineGraph<Toggle>()({
	initial: 'off',
	states: {
		off: node({ toggle: change('on') }),
		on: node({ toggle: change('off') }),
	},
})

const toggle = toggleGraph.implement({
	off: {
		toggle: ({ outcome }) => outcome.change.on(),
	},
	on: {
		toggle: ({ outcome }) => outcome.change.off(),
	},
})
```

This is coherent, but it shows the proposition's fixed tax clearly.

## Shared live execution

None of the definition propositions owns evolving state. All normalize to a
kernel interface that an optional live module can host:

```ts
type SubmitResult<Input, Outcome> =
	| {
			readonly kind: 'processed'
			readonly outcome: Outcome
	  }
	| {
			readonly kind: 'queued'
			readonly receipt: Receipt<Outcome>
	  }
	| {
			readonly kind: 'disposed'
			readonly input: Input
	  }

interface Receipt<Outcome> {
	status():
		| { readonly kind: 'pending' }
		| { readonly kind: 'processed'; readonly outcome: Outcome }
		| { readonly kind: 'disposed' }
}

const execution = createExecution(publication, publication.initial())

execution.current
execution.submit(input)
execution.subscribe((commit) => {})
execution.subscribeErrors((error) => {})
execution.dispose()
```

The live interface obeys these rules:

1. `current` returns an immutable observation. A value narrowed today never
   changes its state tag or data because of later execution activity.
2. A non-reentrant submission returns `processed` after deciding and, when
   applicable, committing synchronously.
3. A submission made during cleanup, residency setup, command execution, or an
   observer returns `queued`. Its receipt becomes `processed` when the queue
   reaches it, or `disposed` if disposal rejects the queue first.
4. Every public submission is considered once in FIFO order or explicitly
   rejected as disposed. The outermost submission drains the queue before
   returning unless disposal occurs during the cycle.
5. `none` produces no commit, residency change, or commit notification. A
   handled `none` may run its declared commands in the current residency before
   returning `processed`; generated `none/unavailable` has no commands.
6. For `update`, the execution commits the fresh target, preserves the current
   residency, runs commands in declaration order, then notifies a snapshot of
   observers in subscription order.
7. For `change`, the execution commits the target, invalidates and aborts the
   source residency, runs all source cleanup in reverse registration order,
   starts the target residency, runs commands in declaration order, then
   notifies a snapshot of observers in subscription order.
8. Cleanup, residency, command, and observer exceptions never roll back a
   commit. Each error is reported, and remaining cleanup, commands, or observers
   continue in deterministic order.
9. Reentrant submissions from any phase wait until the whole current cycle in
   rules 5, 6, or 7 finishes. They never observe a half-applied state.
10. `dispose()` immediately marks the execution disposed, aborts and cleans the
    active residency, rejects queued receipts, and rejects later submissions.
    No later command starts, but the current commit's observer snapshot still
    finishes so an already committed transition remains observable.
    Subscriptions are then cleared. `current` remains the last immutable
    observation and no more commits can occur.
11. Disposal is idempotent. No transition history is retained by default.

Initial residency setup is a synthetic outer cycle. Any synchronous submission
it makes is queued and drained before `createExecution` returns. Any unexpected
error during that bootstrap cycle fails creation: the execution is marked
disposed, its signal is aborted, all cleanup registered so far runs, bootstrap
receipts are rejected, and the error is thrown to the caller because no error
subscriber can exist yet. An adapter remains responsible for a resource it
acquires but neither returns nor registers before throwing.

These rules choose one order deliberately. A prototype must pin traces for
every phase rather than inheriting order from incidental loops.

## Shared effect integration

The optional effect module has two independent hooks:

- **Commands** are edge-local plain outputs attached to one handled decision.
- **Residencies** are state-local resource setup that runs for the initial state
  and whenever a change enters that state.

This distinction avoids duplicating state-owned setup across every incoming
transition and gives an initial state the same lifecycle as later states.

A command-capable model declares its command union:

```ts
type PublicationCommand = {
	readonly type: 'requestReview'
	readonly documentId: string
}

type EffectfulPublicationModel = PublicationModel & {
	commands: PublicationCommand
}

return withCommands(change.review(reviewData), {
	type: 'requestReview',
	documentId,
})
```

`withCommands` accepts handled `none`, `update`, or `change` decisions. Caller-
owned evolution installs a target when present, then interprets
`outcome.commands` itself. A live execution receives command and residency
adapters:

```ts
const execution = createExecution(
	effectfulPublication,
	effectfulPublication.initial(),
	{
		effects: {
			residencies: {
				review({ state, signal, submit }) {
					return reviews.observe(state.data.reviewer, {
						signal,
						onWithdrawn: () => submit({ type: 'cancel' }),
					})
				},
			},

			run(command, scope) {
				switch (command.type) {
					case 'requestReview':
						requestReview(command.documentId, {
							signal: scope.signal,
						})
						return
				}
			},
		},
	},
)
```

Creating the execution installs the initial value and starts its residency
before returning. A state absent from `residencies` has no state-owned setup.

Every command and residency receives an epoch-bound effect scope:

```ts
interface EffectScope<Input, Outcome> {
	readonly signal: AbortSignal
	defer(cleanup: () => void): void
	submit(
		input: Input,
	):
		| { readonly kind: 'processed'; readonly outcome: Outcome }
		| { readonly kind: 'queued'; readonly receipt: ScopedReceipt<Outcome> }
		| { readonly kind: 'stale' }
		| { readonly kind: 'disposed' }
}

interface ScopedReceipt<Outcome> {
	status():
		| { readonly kind: 'pending' }
		| { readonly kind: 'processed'; readonly outcome: Outcome }
		| { readonly kind: 'stale' }
		| { readonly kind: 'disposed' }
}
```

- `scope.signal` aborts when that residency ends or execution is disposed.
- `scope.defer(cleanup)` registers cleanup immediately, allowing multi-step
  setup to remain safe if a later step throws. Returning cleanup from the
  adapter is shorthand for one final `defer`.
- `scope.submit(input)` records the scope epoch. The epoch is checked again when
  the queued input reaches the front, not only when it is submitted. If the
  residency has ended, its receipt resolves to `stale` and the machine never
  sees the input.
- Cleanup returned by a residency or command runner is registered to that
  residency and called once when it ends.
- An `update` preserves the residency; a `change` replaces it.
- A controllable clock is an ordinary adapter dependency, not an FSM feature.
- Domain tokens remain useful when work can arrive outside a managed scope.

This is a general integration seam for requests, timers, listeners, pointer
capture, subscriptions, and other resources. None of those concepts appears in
an effect-free machine.

## Explicit dependencies

Decision dependencies are neither globals nor effects. A model can declare
them separately:

```ts
type Model = {
	states: States
	inputs: Inputs
	dependencies: {
		readonly now: number
		readonly policy: PublicationPolicy
	}
}

const capabilities = machine.capabilities(source, dependencies)
const result = machine.offer(source, input, dependencies)
```

The rules and graph propositions expose the same `dependencies` value in guard,
projection, and implementation contexts. A live execution fixes one dependency
value in its configuration. Different bindings or executions remain
independent with respect to machine-owned state. Decision dependencies must be
immutable values or observationally pure functions for the duration of one
step. Advancing time is a later input or a newly supplied dependency snapshot,
not a hidden `Date.now()` read. The interface cannot prevent closure capture,
but mutable undeclared decision data violates the machine contract.

## Loose typing

The generic-first examples show the strongest TypeScript path. Each proposition
also needs a JavaScript and incomplete-TypeScript overload using the same
runtime notation without explicit type arguments. State, input, and target data
then widen to `unknown`; runtime development checks can still catch malformed
state names, targets, empty nonterminal states, and invalid outcome objects.
They do not validate arbitrary user payload or state data.

This loose overload is a proof obligation, not permission to let the strict
surface collapse into `never` or leak `any`.

## Additional general probes

The publication machine is not the only basis for the recommendation.

### Guarded turnstile

A turnstile has `locked { credit }` and data-free `unlocked`. Positive coins
either update credit or unlock at a threshold; non-positive coins and a push
while locked decline; a push while unlocked returns to locked.

Behavior-first keeps the whole decision in ordinary code:

```ts
locked: state({
	coin: ({ data, input, none, update, change }) => {
		if (input.value <= 0) return none()

		const credit = data.credit + input.value
		return credit < price ? update({ credit }) : change.unlocked()
	},
	push: ({ none }) => none(),
})
```

Rules as data makes the route inventory more visible and needs `derive` to carry
the computed credit through separate guards and projections:

```ts
locked: rules(({ on, derive, when, none, update, change }) => ({
	coin: on<{ readonly value: number }>(
		derive(
			({ data, input }) => data.credit + input.value,
			[
				when(({ input }) => input.value <= 0, none()),
				when(
					({ derived }) => derived < price,
					update(({ derived }) => ({ credit: derived })),
				),
				change.unlocked(),
			],
		),
	),
	push: on(none()),
}))
```

The graph contract gives the clearest route summary, then repeats the slot in
its implementation:

```ts
locked: node({
	coin: oneOf(none, update, change('unlocked')),
	push: none,
})
```

This probe reinforces the core tradeoff rather than favoring publication:
ordinary control flow, inspectable clauses, and an independent graph each have
a visible cost.

### Twenty-state ring

The 20-state acceptance case changes the scale, not the abstraction. Every
proposition must author 20 state data contracts and 44 source-local
capabilities. Their expected source costs differ:

- Behavior-first repeats state and global input vocabulary between the model
  and handlers, then declares each route once in handler code.
- Rules as data repeats state vocabulary between the data map and rules, infers
  capability payloads at the rule sites, and records each route once as a
  clause.
- Bound graph repeats state and global input vocabulary, declares every allowed
  route in the graph, and implements every source/input slot separately.

Changing `s10.next` to `s12` is one behavioral location in the first two and a
graph plus implementation change in the third. Adding a new state or input is
not a one-location edit in any spec-first proposition because its data contract
and behavior are distinct facts. Actual declaration size, editor latency, and
formatted readability remain prototype evidence rather than claims made from
this sketch.

## Comparison

| Concern                                 | Behavior-first              | Rules as data                    | Bound graph                         |
| --------------------------------------- | --------------------------- | -------------------------------- | ----------------------------------- |
| Source/input/decision locality          | Strong                      | Strong                           | Split                               |
| Ordinary TypeScript control flow        | Excellent                   | Constrained                      | Excellent in implementation         |
| Multiple possible targets               | Natural return union        | Ordered clauses                  | Explicit graph set plus one handler |
| Exact target-data diagnostics           | Target-bound constructor    | Target-bound projection          | Graph-bound constructor             |
| Explicit `none/update/change`           | In function returns         | In every clause                  | In graph and function returns       |
| Source-specific payloads under one name | No                          | Yes, qualified                   | No in this proposition              |
| Safe broad input                        | Global input union          | Shared or source-qualified union | Global input union                  |
| Runtime topology                        | Partial                     | Authored upper bound             | Independent allowed graph           |
| Terminal intent                         | Explicit                    | Explicit                         | Explicit                            |
| Existing route edit                     | One handler                 | One rule list                    | Graph plus handler                  |
| Small-machine ceremony                  | Lowest                      | Moderate                         | Highest                             |
| Main type risk                          | Precise handler codomains   | Type/declaration growth          | Authorized-route typing             |
| Main human risk                         | Opaque topology inside code | DSL over arbitrary logic         | Navigation and duplicate edits      |

## Capability identity

The largest remaining product decision is orthogonal to handler versus rule
syntax:

- **Machine-global input:** a visible name has one payload contract everywhere.
  State handlers determine availability. Broad submission is a conventional
  event union.
- **State-qualified capability:** identity is `(source, visible name)`, so the
  same visible method may have different arguments in different states. Broad
  values need source qualification.

Behavior-first and Bound graph currently choose the first. Rules can express
both. The recommendation favors a machine-global input alphabet because it is
the smaller, conventional general-FSM contract and makes external submission
straightforward. State-qualified identity is stronger for session protocols;
if that is defining rather than optional, it can be transplanted into a
behavior-first handler interface and should not force adoption of the rule DSL
by itself.

## Recommendation

The current design recommendation is to advance **Behavior-first states** as the
primary prototype. This ranking remains provisional until its type contract and
20-state behavior are measured.

Its interface has the greatest depth: one source-local function gives callers
deterministic evolution, precise typestate conversion, narrow capabilities,
broad submission, correlated records, and reusable pure behavior. Complexity
remains behind the machine seam instead of reappearing as rule objects or graph
joins.

Advance **Rules as data** as the only equal-stage challenger if any of these
properties is considered defining rather than useful:

- runtime topology must include authored possible targets without source or type
  analysis; or
- discriminated input variants must preserve variant-specific target unions; or
- guard priority and compute-once derivations should be authored as inspectable
  values rather than ordinary control flow.

Keep **Bound graph contract** as a falsification probe, not a leading
candidate. It should advance only if a comprehension/editing study shows that
its independent protocol graph offsets split capability edits.

Do not merge all three. A behavior-first interface plus optional rule and graph
notations would create several sources of truth and make the module shallower.
Choose one definition interface; derive consumption views and live hosting from
it.

## Prior work decisions

The propositions retain these findings from previous approaches:

- The current spec-first design correctly fixes target data before checking a
  transition, but its Robot-style modifiers do not represent all ordinary
  outcomes and mix effects into transition execution.
- The current `state()`-means-terminal convention is superseded here by the
  explicit `terminal` value. An omitted implementation must not look identical
  to intentional completion.
- Inferring state data and behavior from one object literal produced remote
  machine-wide errors. None of these propositions gives up local target-data
  checking merely to remove a type declaration.
  > **Corrected 2026-08-05.** This inherits a false generalisation from
  > `design-explorations.md`. A single-declaration-site design _has_ since been
  > built and measured that keeps errors on the exact offending sub-expression;
  > the earlier prototype failed because it built each state through its own
  > generic call, not because one object literal cannot work. The conclusion
  > drawn from it — that these propositions must carry a separate model type —
  > is therefore unsupported. See
  > [research note 06](../research/06-typescript-type-engineering.md) and the
  > correction in [design-explorations.md](../design-explorations.md).
- The fluent builder made event inference order-dependent and spread one error
  through later calls. No proposition accumulates the graph through a chain.
- Top-level configuration prototypes showed that ordinary object state maps can
  preserve source context and narrowed capabilities. This supports both leading
  propositions.
- Parseable string keys and tagged templates improve visual density but not the
  underlying model. They impair rename tooling, complicate guarded decisions,
  and do not contextually type template interpolations in current TypeScript.
- Classes or constructors with transition methods are a useful consumption
  metaphor, but a hidden registry is still needed for exhaustive states, broad
  input, terminal intent, exact records, and topology. That registry becomes
  the real definition.
- Destination-owned construction is retained as `change.<target>(...)`, not as
  the organizing principle for the whole machine.
- Epoch handles and legal-move palettes are useful derived live or UI views,
  not kernel definitions.

## Seed lineage

The common kernel draws from:

- [W1-C-001](raw/wave-1-anti-machine.md#w1-c-001): caller-owned immutable
  values;
- [W1-A-006](raw/wave-1-near-field.md#w1-a-006) and
  [W1-C-010](raw/wave-1-anti-machine.md#w1-c-010): returned effect commands;
- [W1-A-003](raw/wave-1-near-field.md#w1-a-003): exhaustive scoped visits;
- [W1-A-011](raw/wave-1-near-field.md#w1-a-011): residency cleanup; and
- [W1-C-004](raw/wave-1-anti-machine.md#w1-c-004): stale authority separated
  from immutable observation.

Behavior-first states additionally draw from
[W1-A-005](raw/wave-1-near-field.md#w1-a-005), where handler returns are the
graph. Rules as data draw from
[W1-A-010](raw/wave-1-near-field.md#w1-a-010) and the source-local portion of
[W2-D-008](raw/wave-2-mutations-d.md#w2-d-008). The bound graph contract draws
from [W1-A-004](raw/wave-1-near-field.md#w1-a-004), while using the target
constructor fragment from
[W2-A-002](raw/wave-2-mutations-a.md#w2-a-002).

## Acceptance pressure check

Only after establishing the general interfaces should the interaction cases be
expanded. This table is a pressure map, not the complete formatted Case 1-3
evidence required of a coherent candidate:

| Acceptance concern        | General mechanism                                       |
| ------------------------- | ------------------------------------------------------- |
| Nearby startup move       | Same-state `update`                                     |
| Far startup move          | `change.expert`                                         |
| Matching or stale dwell   | Ordinary condition choosing `change.novice` or `none`   |
| Unavailable pointer input | Broad `offer` returning `none/unavailable`              |
| Timer cancellation        | Cleanup owned by startup residency in the effect module |
| Stale timer callback      | Scoped stale disposition plus ordinary token guard      |
| Request progress          | Same-state `update`                                     |
| Request result race       | Managed residency plus request identity in domain data  |
| Effect-free 20-state case | Kernel only; no execution or effect concepts            |

Nothing in this mapping changes the machine-definition vocabulary. That is the
test against overfitting.

## Proof obligations

Before selecting a finalist, each surviving proposition needs evidence for:

1. Precise inference-captured handler or clause codomains after declaration
   emit and downstream package consumption.
2. Local diagnostics for wrong source reads, wrong input payloads, unknown
   targets, wrong target data, missing states, accidental empty states, and
   unavailable narrow capabilities.
3. A 20-state declaration and editor-performance trial using normalized public
   machine types rather than leaked implementation structure.
4. Hoisted reusable behavior without loss of source, input, or target precision.
5. Automatically formatted publication, Marking Menu, request-race, and
   20-state definitions.
6. Deterministic pure traces for all three outcomes.
7. Deterministic live traces for commit, cleanup, commands, observation,
   reentrancy, stale work, and disposal.
8. Common editing tasks measured by changed locations and duplicated facts.

The first prototype should compare Behavior-first and Rules as data. Building a
runtime before their core type and editing evidence is known would repeat the
overfitting this document is intended to avoid.
