# The JS/TS state-machine library landscape (completion)

> Research note. Evidence levels: [READ] full text, [ABSTRACT] abstract only,
> [SECONDARY] cited elsewhere.
>
> Supersedes the earlier partial version of this file. Findings F1-F5 of that
> version survive as F1-F4 and F9 here; F9 corrects the old F5. Everything
> else is new.
>
> **[PROBE]** marks a claim established by running a compiler or a program in
> this pass rather than by reading a document. Every probe is reproducible from
> the code shown; the toolchain is recorded in "Method" below.

## Scope and questions asked

For every JS/TS state-machine library with meaningful use, and for the
architectures that compete with them at 2-9 control states:

1. What is the definition notation, and **where does the target state appear**
   (the arrow test of note 00 / note 08)?
2. Is the target statically checked? Is it checked at all?
3. Is there **per-state data** — does knowing the control state narrow the data
   type? Are per-state capabilities enforced?
4. What is the effect model, the bundle size, the maintenance status?
5. What do real users complain about?
6. What is the actual unmet need, and is there evidence anyone wants it?

### Method

Bundle sizes are measured, not quoted: each package's public entry was bundled
with `esbuild --bundle --minify --format=esm --platform=browser` and gzipped at
level 9. This measures the whole public API, so it is an upper bound and is
_not_ comparable to a library's own marketing number (which usually measures one
import path, or uses brotli). Download counts are from the npm registry API for
the week 2026-07-28 to 2026-08-03. Type probes were run with `tsc --noEmit
--strict` at the TypeScript versions named in each finding.

## Key sources

**Engineering documentation and source code**

- XState `CHANGELOG.md` (packages/core), statelyai/xstate, entries for 4.29.0,
  4.35.0, 5.0.0-alpha.0 and 5.0.0,
  <https://raw.githubusercontent.com/statelyai/xstate/main/packages/core/CHANGELOG.md>
  — [READ].
- Matt Pocock, "Introducing: TypeScript typegen for XState", Stately blog,
  2022-01-27, <https://stately.ai/blog/2022-01-27-introducing-typegen> —
  [READ] via document summary.
- Stately, "Introducing XState Store", 2024-04-10,
  <https://stately.ai/blog/2024-04-10-xstate-store> — [READ] via summary.
- Stately docs, `setup()` and `@xstate/fsm` pages, <https://stately.ai/docs/setup>,
  <https://stately.ai/docs/xstate-fsm> — [READ].
- Robot3 type definitions, `packages/core/index.d.ts`, matthewp/robot,
  <https://raw.githubusercontent.com/matthewp/robot/main/packages/core/index.d.ts>
  — [READ] in full (253 lines).
- `@zag-js/core@1.43.0` type definitions, `dist/types.d.ts` and
  `dist/create-machine.d.ts`, <https://unpkg.com/@zag-js/core@1.43.0/> —
  [READ] in full (235 lines).
- `@zag-js/core@0.82.2` `dist/index.d.ts` (pre-v1 API, for the rewrite
  comparison) — [READ] targeted sections.
- Zag docs, "Building Machines", <https://zagjs.com/guides/building-machines>
  and migration guide <https://zagjs.com/overview/migration> — [READ] via
  summary.
- Segun Adebayo, answer in chakra-ui/zag Discussion #355, "How does zagjs's
  machine differ with xstate's machine?",
  <https://github.com/chakra-ui/zag/discussions/355> — [READ].
- `@cassiozen/useStateMachine` source, `src/types.ts` (543 lines) and
  `src/index.ts`, <https://github.com/cassiozen/useStateMachine> — [READ] in
  full.
- Radix Primitives, `packages/react/presence/src/use-state-machine.tsx` and
  `presence.tsx`,
  <https://raw.githubusercontent.com/radix-ui/primitives/main/packages/react/presence/src/use-state-machine.tsx>
  — [READ] in full.
- Radix Primitives docs, Introduction,
  <https://www.radix-ui.com/primitives/docs/overview/introduction> — [READ].
- `typescript-fsm` README and `dist/stateMachine.d.ts` (v1.6.0) — [READ].
- `jssm` README (v5.163.6), StoneCypher/jssm — [READ] head.
- `javascript-state-machine` README (v3.1.0), jakesgordon — [READ] head.
- `little-state-machine` README (v5.0.1) — [READ] head.
- Kingly documentation v1, API overview and concepts,
  <https://brucou.github.io/documentation/v1/api/index.html> — [READ] via
  summary.
- statecharts.dev, <https://statecharts.dev/> — [READ] via summary.
- `@doeixd/machine` README, <https://github.com/doeixd/machine> — [READ] via
  summary.
- microsoft/TypeScript issues #51377 ("Case for inference failure in
  `T extends F<T>`", open, Backlog) and #44821 (closed as duplicate) —
  [READ] via summary.

**Opinion (blogs, forums, issue threads)**

- David Khourshid, "You don't need a library for state machines", dev.to —
  [READ] via summary. Note: written by XState's author.
- Martijn Arts, "tstate — strongly typed TypeScript state machines",
  <https://blog.martijnarts.com/tstate-strongly-typed-typescript-state-machines/>
  — [READ] via summary. The library is **not published on npm**; treat as a
  statement of demand, not as an artifact.
- Maurício R. D., "xState: My Practical Experience and Insights" — [ABSTRACT]
  only; the site returned 403 and the claims below come from the search
  engine's extract, so they are weaker evidence than the rest of this note.
- Hacker News comment threads on XState and statecharts, retrieved via the
  Algolia HN API — [READ]. Thin: the "XState v5 Is Here" submission
  (id 38489029) drew 34 points and **two** comments.

**Registry / repository metadata** — npm registry API, npm downloads API,
GitHub REST API, all queried 2026-08-05 — [READ].

## Findings

**F1 — XState shipped typestates, then removed them, and published the
reason.** The changelog entry for 5.0.0-alpha.0 (2022-05-26), PR #2876 by
davidkpiano, repeated in the 5.0.0 entry (2023-12-01), states that typestate
typings were removed because

> "types for typestates needed to be manually specified, which is unsound"

— specifically, because a hand-written mapping can name a state `value` and a
`context` pairing that the machine can never actually reach. [READ, XState
CHANGELOG, entries `## 5.0.0-alpha.0` and `## 5.0.0`]

This remains the most important single data point for this project: the only
case of a mainstream JS library shipping exactly this feature and retreating.

**F2 — The failure mode was a _separate declaration_, not typestate itself.**
Read precisely, the complaint is not "per-state data is a bad idea". It is that
XState's typestates were a hand-written mapping from state value to context type
that the machine definition did not have to satisfy — an assertion, not a
consequence. Nothing checked that a declared `{ value: 'loading', context: ... }`
pair was reachable, or even producible.

**F3 — This is a partly-avoided hazard for the propositions' model type.** All
three propositions declare states and their data in a model type separate from
behavior. They do better than XState in one respect: target-bound constructors
(`change.draft({...})`) check the data at the site that selects the target, so a
state's data cannot drift from what transitions produce. But the declaration can
still name a state whose data no transition can construct, and nothing detects
that. The XState critique lands partially, not fully.

**F4 — The v5 direction was to derive types from a single `setup()` call rather
than declare them separately.** The migration guide attributes improved
inference to `setup()` and says typegen's main use cases are no longer needed.
[READ, Stately migration docs and `setup()` docs]

**F5 — XState's typing crisis came from _indirection_, not from the machine
shape, and the three-step fix is a legible history.** The sequence is:

| Date                | Move                                                                                                            | Evidence                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 4.x, pre-typegen    | `createModel(...)`: a second declaration of context+events                                                      | CHANGELOG                                                            |
| 2022-01-27 (4.29.0) | `tsTypes: {}` typegen — a **VS Code extension statically analyses the machine and writes a `.typegen.ts` file** | CHANGELOG 4.29.0, PR #2674 (Andarist, mattpocock); typegen blog post |
| 2022-12-05 (4.35.0) | `createModel(...)` deprecated, "use Typegen instead"                                                            | CHANGELOG 4.35.0, PR #3607 (davidkpiano)                             |
| 2023-12-01 (5.0.0)  | typegen dropped; `setup({types, actions, guards, actors}).createMachine(...)`                                   | CHANGELOG 5.0.0; `setup()` docs                                      |

The root cause is worth naming exactly. XState machines refer to actions,
guards, services and delays **by string name**, and implement them in a
_separate_ options object (`createMachine(config, options)` /
`machine.withConfig`). TypeScript therefore could not know which event type
reaches which action implementation. Codegen was the 2022 answer — an
out-of-band static analyser producing a file. `setup()` is the 2023 answer:
put the implementations in the _same call_ as the types, and inference flows
without codegen. [READ, changelog + typegen blog]

Matt Pocock's framing of what typegen bought is that the extension could
"statically analyze your machine" and thereby remove defensive type-narrowing
from every action. [READ, typegen blog — one short quote]

**F6 — Therefore the arrow test and type inference are in direct tension, and
this is the central design fact of the whole landscape.** Keeping a transition
row scannable — target at a fixed position, effects named rather than inlined —
pushes handler bodies out of the transition, which breaks contextual typing of
the event into the handler, which forces either codegen or a hand-written schema
type. Inlining the handler restores inference and hides the target. Every
library in this survey sits on one side of this trade:

- Scannable table, implementations elsewhere, **second declaration required**:
  XState v5 (`setup({types})`), Zag v1 (`MachineSchema`), Kingly.
- Inline handlers, inference works, **target hidden in a body**: Tinder
  StateMachine (note 08), the three propositions.
- Scannable table, implementations elsewhere, **no types at all**: jssm,
  javascript-state-machine, robot3's reducers.

The single exception that tried to have both is `@cassiozen/useStateMachine`,
and F13 records what happened to it.

**F7 — XState v5 has no per-state data typing and no per-state capabilities;
this is verifiable in four lines.** [PROBE, xstate@5.32.5, TypeScript 5.9.3 and
7.0.2, `--strict`]

```ts
const snap = createActor(machine).start().getSnapshot()
if (snap.matches('done')) {
	const u: string = snap.context.url // ERROR: 'string | null'
}
a.send({ type: 'OK', url: 'x' }) // OK, even though 'OK' is illegal in 'idle'
```

`matches()` narrows nothing about `context`. `send()` accepts any event of the
machine regardless of the current state. `snapshot.nextEvents` was removed
outright in 5.0.0 (changelog: "Removed `MachineSnapshot['nextEvents']`"). So
after the typestate removal, XState offers _neither_ half of typestate:
neither state-specific data nor state-specific capabilities.

**F8 — XState v5 does not statically check transition targets, but does throw
eagerly at machine-construction time.** [PROBE] `on: { GO: 'bTYPO' }` inside
`setup({}).createMachine({...})` produces **no** TypeScript error at
`--strict`; at runtime `createMachine` itself throws
`Invalid transition definition for state node '(machine).a': Child state
'bTYPO' does not exist`. This corrects note 08's arrow-test table, which
records XState's target as checked "in v5, via `setup()`". It is not. The
recovery is a good eager runtime error, not a type error.

**F9 — Robot3's target is _not_ checked, at compile time or at construction
time, and its failure mode is a bare `TypeError`.** This contradicts note 08's
F10 and the earlier version of this note. The published signature is
unambiguous:

```ts
export function transition<F extends string, C, E>(
	event: F,
	state: string, // <- target: plain `string`
	...args: (Reducer<C, E> | Guard<C, E> | Action<C, E>)[]
): Transition<F>
```

[READ, robot3 `index.d.ts`]. `Transition<F>` carries only the _event_ name in
its type; the target is erased. [PROBE, robot3@1.2.0, TS 5.9.3 and 7.0.2]
`transition('down', 'startupTYPO')` type-checks; `createMachine` does not throw;
the first `send('down')` throws
`TypeError: Cannot read properties of undefined (reading 'enter')`.

What survives of the old F5 is the _position_ claim, which is the point that
matters for the arrow test: robot3 puts input at argument 1 and target at
argument 2, at fixed, formatter-stable positions. It just doesn't check them.

**F10 — Robot3 gives no context typing inside reducers, guards or actions at
all.** [PROBE, robot3@1.2.0, TS 5.9.3] In

```ts
createMachine(
	'a',
	{
		a: state(
			transition(
				'go',
				'b',
				reduce((ctx, ev) => ctx),
			),
		),
	},
	() => ({ count: 0 }),
)
```

both `ctx` and `ev` resolve to `unknown`. The cause is structural:
`reduce<C, E>(fn?: (context: C, event: E) => C)` has no type-level link to the
`ContextFunction<C>` passed as `createMachine`'s third argument, so `C` is
inferred from the unannotated callback and lands on `unknown`. Robot3's typing
is therefore roughly "the event union is checked at `send`, and nothing else
is". This is a sharper picture of the project's stated inspiration than the
README suggests.

**F11 — Robot3's `machine.current` is typed with a union that includes the
implementation's own property names.** [PROBE, robot3@1.2.0] `typeof m.current`
resolves to `AllStateKeys<{...}>` and accepts `'enter'`, `'final'`,
`'transitions'` and `'immediates'` alongside the real state names, because

```ts
type AllStateKeys<T> = NestedKeys<T> | keyof T
```

and `NestedKeys` maps over each _state value object_, harvesting the keys of
`MachineState` rather than the state names. This is a plain bug in a library at
1.34M downloads/week, unfixed at 1.2.0 (published 2025-09-20) and unchanged on
`main`. It is worth recording because the project inherited robot3's _shape_;
it should not inherit the assumption that the shape was carefully typed.

**F12 — `@xstate/fsm` is deprecated by documentation only, and it out-downloads
XState itself.** The docs page says the package "is deprecated in XState v5" and
directs users to XState; **no reason is given**, and the npm `deprecated` field
is not set on 2.1.0 (published 2023-06-21). [READ, Stately docs + npm registry]
It still records 5,462,505 weekly downloads against XState's 5,248,988 — i.e.
the deprecated 2 KB FSM is pulled more often than the 12.7 KB statechart engine.
Almost all of both numbers are transitive; the point is only that a
minimal-FSM-shaped dependency is at least as load-bearing in the ecosystem as
the full statechart one.

**F13 — The most cleverly typed small FSM in JS achieved real per-state typing
with a self-referential constraint — and TypeScript 5.4 silently broke it.**
`@cassiozen/useStateMachine` is defined as

```ts
type UseStateMachine =
  <D extends Machine.Definition<D>>(definition: A.InferNarrowestObject<D>) =>
    [state: Machine.State<...>, send: Machine.Send<...>]
```

i.e. F-bounded self-constraint over a single object literal — exactly the
"one declaration site" the project wants — plus a hand-rolled
`InferNarrowestObject` to preserve literal types (this predates `const` type
parameters, TS 5.0) and an `A.CustomError<Message, Place>` type that reports
errors as string-literal mismatches **at the offending position**, not
machine-wide.

Most importantly, it _derives_ per-state types instead of declaring them:
`EntryEventForStateValue<D, S>` scans every state's `on` map for transitions
whose target is `S` and returns the union of those event types. This is the
sound version of what XState's typestates were (F1/F2) — derived from the
transition table, so an impossible pairing cannot be written.

The bisect [PROBE, `@cassiozen/usestatemachine@1.0.1`, `--strict
--skipLibCheck`]:

| TypeScript | per-state entry event narrows | per-state `nextEventsT` | bad target rejected | `TS2313` circular constraint |
| ---------- | ----------------------------- | ----------------------- | ------------------- | ---------------------------- |
| 4.5.5      | yes                           | yes                     | yes                 | no                           |
| 4.9.5      | yes                           | yes                     | yes                 | no                           |
| 5.0.4      | yes                           | yes                     | yes                 | no                           |
| 5.1.6      | yes                           | yes                     | yes                 | no                           |
| 5.2.2      | yes                           | yes                     | yes                 | no                           |
| 5.3.3      | yes                           | yes                     | yes                 | no                           |
| **5.4.5**  | **no**                        | yes                     | **no**              | **yes**                      |
| 5.9.3      | no                            | yes                     | no                  | yes                          |
| 7.0.2      | no                            | yes                     | no                  | yes                          |

From TypeScript 5.4 the library's own `types.d.ts` reports
`error TS2313: Type parameter 'D' has a circular constraint`, and with
`skipLibCheck` on — which most projects enable, so the breakage is _silent_ —
the entry-event narrowing collapses to the initial event and typo'd targets stop
being rejected. The repository was last pushed 2024-04-22 and the last release
is 1.0.1 (2022-01-15), so nobody fixed it. I did not identify the specific TS
5.4 change responsible; treat the _cause_ as unverified and the _behaviour_ as
measured.

Related open TypeScript issue: microsoft/TypeScript#51377, "Case for inference
failure in `T extends F<T>`", still open and on the Backlog milestone; #44821 on
the same pattern was closed as a duplicate. [READ] The pattern is known-shaky
and unowned.

**F14 — Zag.js — the most production-heavy FSM in the JS UI world — went the
_opposite_ way in v1: more declaration, not less.** Zag v0 (`0.x`, from
2022-04-27) had
`createMachine<TContext, TState extends StateSchema, TEvent>(config, options?)`
— three type parameters and a separate implementations object, i.e. XState v4's
shape. Zag v1 (2025-02-22) replaced this with a single hand-written schema
interface:

```ts
interface MachineSchema {
  props?; context?: Record<string, any>; refs?; computed?;
  state?: string; tag?: string; guard?: string; action?: string;
  effect?: string; event?: { type: string } & Dict;
}
declare function createMachine<T extends MachineSchema>(config: Machine<T>): Machine<T>;
declare function setup<T extends MachineSchema>(): { createMachine: ...; guards: ...; choose: ... };
```

[READ, `@zag-js/core@1.43.0` types] Three things follow.

1. `createMachine` is an **identity function**. Its entire job is to be a type
   boundary; the machine work moved into the framework `useMachine` hook. The
   project's `defineMachine<Model>()(...)` double call is the same device, and
   Zag _and_ XState both ship a `setup<T>()`-then-`createMachine` currying
   precisely to create that boundary. This is the state of the art, not an
   idiosyncrasy of this project.
2. `T` is **not inferred**. The author writes the schema by hand. Zag chose the
   second declaration site deliberately, after having tried inference.
3. What that buys: [PROBE, `@zag-js/core@1.43.0`, TS 7.0.2]
   `on: { CLICK: { target: 'inactiveTYPO' } }` is a type error, with
   `Did you mean '"inactive"'?`. Zag is the only surveyed library where the
   target is both at a fixed position **and** statically checked.

**F15 — Zag has no per-state context either.** `BindableContext<T>` exposes
`get<K extends keyof T["context"]>(key)` — one flat record for the whole
machine, identical in every state. [READ, types] Zag's own docs say context
applies globally and is not reset by transitions. So the two most sophisticated
production machines in JS (XState, Zag) both refuse per-state data. That is
either strong evidence the need is not real, or strong evidence it is
technically expensive; F19 and F20 argue it is the latter.

Zag's compensations are worth noting: `computed` (derived values from
context/props/refs), `refs` (non-reactive per-machine storage), per-state
`effects` whose implementations return a `VoidFunction` cleanup — React
`useEffect` semantics for state-scoped effects, i.e. a structural answer to the
stale-timer problem that does not require a token. And `track(deps, fn)`, a
reactive watcher. Zag drifted from "reducer" toward "signals".

**F16 — Zag also names its actions, guards and effects as strings and resolves
them in an `implementations` object** — the exact indirection that forced
XState's typegen (F5). Zag pays for it with the hand-written schema instead of
with codegen. Two independent teams, same trade, two different currencies.

**F17 — Radix and Ariakit built the most-installed accessible widget sets in
React with essentially no state machines, and Radix's one exception is 20
lines.** `@radix-ui/react-dialog` alone records 69.2M weekly downloads;
`@ariakit/react` 1.21M; `@zag-js/core` 1.34M. Radix's introduction never
mentions state machines; its stated model is uncontrolled-by-default components
where "all of the behavior wiring is handled internally". [READ] Ariakit's
author describes component _stores_ and, in the piece announcing them, does not
mention state machines, reducers or XState at all. [READ]

The exception is precise and instructive. Radix ships exactly one machine, in
`Presence` (mount/unmount animation):

```tsx
type Machine<S> = { [k: string]: { [k: string]: S } }
export function useStateMachine<M>(
	initialState: MachineState<M>,
	machine: M & Machine<MachineState<M>>,
) {
	return React.useReducer(
		(state, event) => machine[state][event] ?? state,
		initialState,
	)
}
```

used as

```tsx
const [state, send] = useStateMachine(initialState, {
	mounted: { UNMOUNT: 'unmounted', ANIMATION_OUT: 'unmountSuspended' },
	unmountSuspended: { MOUNT: 'mounted', ANIMATION_END: 'unmounted' },
	unmounted: { MOUNT: 'mounted' },
})
```

[READ, radix-ui/primitives `main`] Three states, a nested lookup table where the
target _is_ the value (maximal arrow-test compliance), no context, no guards, no
actions, `UnionToIntersection` to compute the event union, and `useReducer` as
the engine. All the _data_ for the interaction — `stylesRef`,
`prevAnimationNameRef`, `mountAnimationNameRef` — lives in refs **outside** the
machine, and effects are `useEffect` keyed on `[state]`. This is the real
production baseline the project competes with at 3 states.

**F18 — The author of XState publicly argues you do not need a library at small
scale, and Stately shipped a non-machine store when users kept reaching for one
anyway.** David Khourshid's post is titled, and argues, "you don't need a
library for state machines", showing a nested lookup object plus a `transition`
function; the qualifier is that statechart _features_ (hierarchy, parallelism,
history) are what justify a library. [READ, opinion — but by the maintainer of
the largest library in the space]

Independently, `@xstate/store` first published 2024-04-07. The announcement says
the team saw users reach for XState for simple data updates too, cases
"where using full state machines may be overkill".
[READ] It now records 121,039 weekly downloads. The vendor of statecharts built
and maintains a deliberately non-finite-state alternative for its own users.

**F19 — There is real, named demand for per-state context typing, and it is
mostly unmet.** Concrete instances found:

- Martijn Arts built and blogged an unpublished library, `tstate`, whose stated
  motivation is that in XState "the type of the context is global for the entire
  machine", forcing defensive null checks in states that logically guarantee the
  data. His stated design goals are: no codegen, strict typing, pure TypeScript,
  composable. [READ, opinion; **not on npm** — verified 404 on the registry]
- `@doeixd/machine` (npm, first seen here at 1.6.0, 2026-07-14; 23 GitHub stars,
  37 downloads/week) advertises "Type-State Programming where states are types,
  not strings", with transitions as _methods returning the next state type_ —
  the Rust move from note 08's F2, in TypeScript. [READ, README]
- `@cassiozen/useStateMachine` derived per-state entry events and per-state legal
  events (F13) — and 2,406 stars suggest the approach was appreciated.

Against that: nothing with real adoption provides it. The demand is legible but
small and unconsolidated, and two of the three artifacts above are effectively
abandoned or negligible. Honest reading: this is a _latent_ need with taste-
maker interest, not a market.

**F20 — Nothing in the landscape provides state-specific _capabilities_ either,
including the libraries that get closest on data.** `useStateMachine` exposes
`nextEventsT` (the events legal in the current state, per state) but its `send`
signature is machine-wide — capabilities are _advertised_, never _enforced_.
XState v5 removed even the advertisement. Zag's `send` takes any
`T["event"]`. So the second half of typestate — "only the capabilities legal
from that state" — is untouched by every library surveyed. This is the sharpest
statement of the gap the project is aiming at.

**F21 — jssm is the landscape's purest arrow-test artifact and its purest
warning.** Machines are written as a template-literal DSL with literal arrows:

```js
const TrafficLight = sm`Red 'next' => Green 'next' => Yellow 'next' => Red;
                        [Red Yellow Green] ~> Off -> Red;`
```

[READ, jssm README] Every element of `(source, input, target)` is at a fixed
syntactic position; it renders to SVG; different arrow glyphs encode different
transition kinds. And the cost is total: states are strings inside a template
literal, so **no state or event name is known to TypeScript**, and the package
measures 53.2 KB gzipped (it bundles a Lezer-based parser and renderer) — 44×
robot3 — for 4,120 downloads/week. Perfect readability, zero types, huge
bundle. It is an existence proof that the arrow test alone is not the objective
function.

**F22 — `typescript-fsm` and `javascript-state-machine` show the flat-table
notation, and show exactly what it costs.**

```ts
const transitions = [
	/* fromState        event                 toState         callback */
	t(States.closed, Events.open, States.opening, onOpen),
	t(States.opening, Events.openComplete, States.opened, justLog),
	t(States.closed, Events.break, States.broken, justLog),
]
new StateMachine<States, Events>(States.closed, transitions)
```

[READ, typescript-fsm README + `dist/stateMachine.d.ts`] Source, input and
target sit in columns 1-3, all three checked against the `STATE`/`EVENT` type
parameters, in 1.2 KB gzipped, with a `toMermaid()` method that can only exist
because the topology is data. `javascript-state-machine` v3 does the same with
records: `{ name: 'melt', from: 'solid', to: 'liquid' }`.

The cost is severe and total: **there is no context at all**. `dispatch<E extends
EVENT>(event: E, ...args: unknown[])` — payloads are `unknown[]`, callbacks are
`(...args: unknown[]) => void | Promise<void>`, and the state machine holds no
data. The flat-table style buys perfect topology and pays with untyped
everything. `javascript-state-machine` (8,753 stars, 211K downloads/week) last
published 2018-07-12 and ships no types.

**F23 — `little-state-machine` is not a state machine.** 645,720 downloads/week
and the name is the only finite-state thing about it: `createStore(initialState,
{ middleWares })` plus a `useStateMachine({ actions, selector })` hook, with
session/local-storage persistence. It is a Redux-lite store used mainly for
multi-step forms alongside react-hook-form. [READ, README] Any download-based
ranking of "FSM libraries" that includes it is measuring the wrong thing.

**F24 — Kingly is the strongest _semantics_ story and the weakest _artifact_.**
Its position is that a machine is a pure function from input to a list of
**commands**, performing no effects itself: guards and action factories are pure,
and "no effects performed by the machine"; the stated payoff is testing without
mocks, and machines compiled to ~1-2 KB by an offline compiler. [READ, Kingly
docs — one short quote] That is exactly the returned-commands effect model of
note 08's F4 (Tinder) and of the propositions, argued from first principles and
with an explicit testing rationale.

But: 204 GitHub stars, last push 2021-10-29, last npm publish 0.29.2
(2021-03-27), **67 downloads/week**, no bundled types, and its runtime pulls in
`chess.js`, `fp-rosetree` and `react-state-driven` as _runtime dependencies_ —
`chess.js` in a state-machine library. Measured at 11.9 KB gzipped from the ESM
entry, an order of magnitude above the "~1-2 KB" figure, which refers to
compiled machines, not the runtime. Steal the ideas; do not cite the adoption.

**F25 — statecharts.dev is vocabulary and advocacy, not semantics.** It is a
community site (statecharts GitHub org) that defines ~30 terms, argues
statecharts fix state explosion, and points at SCXML's decade of committee
standardisation as the reason to use a conforming library rather than roll your
own — while listing learning curve, paradigm shift and code overhead as
drawbacks. [READ via summary] Useful as a glossary and as the canonical
statement of the "use a real library, entry/exit order matters" position. It
does not settle any semantic question by itself; note 02 is the load-bearing
source there.

**F26 — Competing architectures, sized honestly.** All [SECONDARY] except the
measurements.

- **The Elm Architecture** — `update : Msg -> Model -> (Model, Cmd Msg)`. The
  target is the returned `Model`; if `Model` is a custom union type, per-state
  data _is_ the language's default and the compiler's exhaustiveness check does
  the typestate work. Elm's problem is not typing, it is that there is no
  per-state capability restriction and no timer cancellation (see note 02, C2).
- **Redux** — `(state, action) => state`. The "reducers are Mealy machines"
  claim is true and useless: a Mealy machine's output depends on state _and_
  input, which a reducer's return does; but Redux imposes no finite control
  state, so nothing is checked, nothing is enumerable, and the topology is not
  recoverable. Redux 5.0.1 measures 1.4 KB gzipped (bundlephobia). The claim
  establishes a correspondence, not a benefit.
- **`useReducer`** — the same shape inside React, and demonstrably enough for
  Radix's Presence (F17). At 3 states with data in refs, this is the honest
  competitor.
- **Zustand / Jotai** — 49.6M and 5.6M downloads/week, 0.49 KB and 4.1 KB
  gzipped (bundlephobia, not the esbuild method above). Not machines; they are
  what "just store the data" looks like when it wins, and it wins by two orders
  of magnitude on adoption.
- **Effect** — 26.0M downloads/week. Not an FSM library; it is the
  type-maximalist competitor, tracking success/error/requirements in
  `Effect<A, E, R>`. Relevant as evidence that a large TS audience _will_ accept
  heavy type machinery when the payoff is legible; irrelevant as a source of FSM
  notation.
- **RxJS `scan`** — `scan((state, event) => next, seed)` is a Mealy machine over
  a stream, and is the idiomatic way interaction techniques get written in
  Rx-shaped codebases. Same properties as Redux: correct, unchecked,
  non-enumerable.
- **"Just use a switch and a discriminated union"** — the real competitor at
  2-9 states. TypeScript's exhaustiveness checking over a discriminated union
  gives per-state data _for free_ and per-state capabilities by construction
  (only handle the events you handle). What it does not give: enumerable
  topology, a diagram, protection against forgetting a transition (as opposed to
  forgetting a _state_), or any shared execution semantics for timers,
  queueing and re-entrancy.

## The comparison table

Weekly downloads: npm API, 2026-07-28 → 2026-08-03. Sizes: measured here (see
Method); whole public API, min+gzip; not the library's own marketing figure.

| Library                    | Definition style                                              | Where the target appears               | Target checked?                             | Per-state data                                                     | Effect model                                                        | gzip                    | dl/wk                | Last publish                    |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ----------------------- | -------------------- | ------------------------------- |
| XState v5                  | nested config object; `setup({types, actions, guards})`       | `target:` key (or bare string value)   | **no** (throws at `createMachine`)          | none (`matches` does not narrow)                                   | named actions + invoked/spawned actors                              | 12.7 KB                 | 5.25M                | 2026-07-14                      |
| XState v4                  | `createMachine(config, options)` + typegen file               | `target:` key                          | no                                          | typestates, removed in v5                                          | named actions + services                                            | 18.2 KB                 | —                    | 2023-10-23                      |
| `@xstate/fsm`              | flat XState config                                            | `target:` key                          | no                                          | none                                                               | entry/exit/transition actions                                       | 2.1 KB                  | 5.46M                | 2023-06-21 (deprecated by docs) |
| Zag v1                     | hand-written `MachineSchema` + `createMachine<T>` identity fn | `target:` key, source-relative         | **yes**, with "did you mean"                | none (flat `BindableContext`)                                      | named actions/effects with cleanup fns; `computed`, `refs`, `track` | 2.3 KB                  | 1.34M                | 2026-07-29                      |
| Robot3                     | `state(transition(event, target, ...ops))`                    | **argument 2** of `transition`         | **no** (bare `string`); `TypeError` at send | none; `ctx`/`ev` are `unknown`                                     | `reduce` / `action` / `guard` combinators; `invoke` for promises    | 1.2 KB                  | 1.34M                | 2025-09-20                      |
| `useStateMachine`          | one object literal, `D extends Definition<D>`                 | bare string value or `target:` key     | yes **≤ TS 5.3**, no ≥ 5.4                  | **derived** entry event + `nextEventsT` per state; context is flat | per-state `effect` returning cleanup                                | 1.1 KB                  | 15.6K                | 2022-01-15                      |
| `typescript-fsm`           | flat array of `t(from, event, to, cb)`                        | **argument 3**, column-aligned         | yes (against `STATE` param)                 | **none at all**; payloads `unknown[]`                              | one callback per row; promises                                      | 1.2 KB                  | 15.0K                | 2025-04-10                      |
| `javascript-state-machine` | `transitions: [{name, from, to}]`                             | **`to:` key**, column-aligned          | no (no types shipped)                       | none                                                               | `onX` lifecycle methods                                             | 3.0 KB                  | 211K                 | 2018-07-12                      |
| jssm                       | template-literal DSL, `sm\`A -> B;\``                         | **literal arrow**, both sides          | no (all strings)                            | none                                                               | hooks; renders SVG                                                  | 53.2 KB                 | 4.1K                 | 2026-07-25                      |
| Kingly                     | `{ states, transitions: [{from, event, to, guards}] }`        | **`to:` field** of a transition record | no (no types shipped)                       | none typed                                                         | pure fn returning **commands**; offline compiler                    | 11.9 KB                 | 67                   | 2021-03-27                      |
| `little-state-machine`     | `createStore` + actions                                       | n/a — not a state machine              | n/a                                         | n/a                                                                | store middleware                                                    | 1.2 KB                  | 646K                 | 2025-01-10                      |
| Radix `Presence`           | nested lookup `{state: {event: target}}`                      | **the value itself**                   | yes (`MachineState<M>`)                     | none; data in refs                                                 | `useEffect` keyed on state                                          | n/a (20 lines, inlined) | 69.2M (react-dialog) | current                         |
| `@doeixd/machine`          | methods on state types; `TypeState<Data, Caps>`               | **the method's return type**           | yes                                         | **yes**, both halves                                               | immutable snapshot chaining                                         | n/m                     | 37                   | 2026-07-14                      |

Top-three complaints per library. Sources are marked: **[V]** = defect verified
by probe in this pass, **[D]** = stated in the project's own documentation,
**[O]** = third-party opinion.

- **XState v5** — (1) no per-state context or capability typing at all [V];
  (2) steep learning curve, and v4/v5 syntax confusion that also poisons AI
  assistance [O — Maurício R. D., weak evidence: 403, extract only]; (3) target
  typos are runtime-only [V].
- **Zag v1** — (1) the schema must be written by hand and inference does nothing
  [V]; (2) context is machine-wide [D + V]; (3) actions/guards/effects are
  string names resolved elsewhere, so bodies are decoupled from their trigger.
- **Robot3** — (1) target unchecked, cryptic `TypeError` at send [V];
  (2) `ctx`/`ev` are `unknown` inside every reducer [V]; (3) `machine.current`'s
  type is polluted with `'enter' | 'final' | 'transitions' | 'immediates'` [V].
- **`useStateMachine`** — (1) types silently degrade from TypeScript 5.4 [V];
  (2) unmaintained since 2024-04 [V, GitHub API]; (3) React-only, and context is
  machine-wide.
- **`typescript-fsm`** — (1) no context; (2) payloads are `unknown[]`;
  (3) callbacks re-enter the machine by calling `dispatch` on a closed-over
  instance [D, from the README's own example].
- **jssm** — (1) 53 KB gzipped [V]; (2) no static knowledge of state or event
  names [V]; (3) tiny adoption relative to surface area.
- **Kingly** — (1) abandoned since 2021 [V]; (2) `chess.js` as a runtime
  dependency [V]; (3) no shipped types.

## Design moves worth stealing

1. **Derive per-state types from the transition table, never declare them.**
   `useStateMachine`'s `EntryEventForStateValue<D, S>` computes, for each state,
   the union of events whose transitions target it. Source: F13. Cost:
   type-level scanning of the whole definition, which is exactly the editor-
   latency risk note 06 flags — and, empirically, exactly the kind of type that
   rots across TS releases. Mitigate by keeping the derivation shallow.
2. **Errors as string-literal types placed at the offending position.**
   `A.CustomError<Message, Place>` turns a constraint violation into
   `Type 'x' is not assignable to type 'Error: no states defined'` **at that
   property**, not machine-wide. Source: F13. Cost: none at runtime; some
   type-level ugliness. This directly attacks the objection recorded in the
   project's "Attempt 1" (remote errors instead of local ones) and should be
   re-tested before that objection is inherited.
3. **A source-relative, statically checked target.** Zag's `Transition<T,
Source>` makes the legal target set depend on the source state, and TS emits
   a "Did you mean" suggestion. Source: F14. Cost: the state union must exist as
   a type before the transitions are written — i.e. it buys the check with the
   second declaration site.
4. **The target _is_ the value.** Radix: `{ mounted: { UNMOUNT: 'unmounted' } }`.
   Nothing is shorter, nothing is more scannable, and `useReducer` is the
   engine. Source: F17. Cost: no guards, no payload, no data — it is the
   zero-capability endpoint of the trade, and it is enough for three states.
5. **Per-state effects that return a cleanup function.** Zag and
   `useStateMachine` both do this; leaving the state runs the cleanup. Source:
   F13, F15. Cost: the library owns effect lifetimes. Payoff: it is the same
   structural answer as Erlang's `state_timeout` (note 08 F7) without adopting
   Erlang's timer taxonomy, and it dissolves the dwell-timer token in the
   Marking Menu case.
6. **`computed` and `refs` as escape valves from a flat context.** Zag's answer
   to "context is machine-wide" is derived values plus non-reactive refs.
   Source: F15. Cost: three storage kinds to explain instead of one. Worth
   knowing because it is what a serious team built _instead of_ per-state data.
7. **A machine that returns commands and performs no effects.** Kingly argues
   this from testability: pure guards, pure action factories, output is a list
   of commands. Source: F24. Cost: the command union must be declared. This
   independently corroborates note 08's F4.
8. **Ship a `toMermaid()` / topology export and let it be the forcing function.**
   `typescript-fsm` can only do this because the topology is data, not code.
   Source: F22. Cost: none — but it is _only_ possible if the arrow test passes,
   which makes it a cheap, testable proxy for the property the project wants.

## Traps, negative results, and things that failed

- **Self-referential single-object inference is not safe to build on.**
  F13 is the negative result of this pass: the one library that got
  one-declaration-site per-state typing working lost it to a TypeScript minor
  release, silently, under `skipLibCheck`, with no maintainer to notice.
  microsoft/TypeScript#51377 is open and unowned. A library that cannot survive
  a TS upgrade is worse than one with an extra declaration line.
- **Codegen was tried at scale and abandoned.** XState's typegen shipped with
  a VS Code extension and a CLI, ran for ~22 months (4.29.0 → 5.0.0), and was
  removed. The project's "no codegen" constraint is thereby validated by the
  largest experiment anyone ran.
- **Target-at-a-fixed-position does not imply target-is-checked.** Three of the
  four most-downloaded FSM libraries put the target at a fixed position and
  check nothing (XState v5, robot3, jssm). Passing the arrow test is a
  _readability_ result; it costs nothing and buys nothing type-wise on its own.
- **Deprecation notices in docs do not stop usage.** `@xstate/fsm` is
  deprecated only in prose, has no npm deprecation flag, and out-downloads
  XState. Deprecation is not a signal about fitness.
- **Perfect notation with no types loses.** jssm has the best syntax in the
  survey and 4.1K downloads at 53 KB. Readability is necessary, not sufficient.
- **Naming a library after state machines does not make it one.**
  `little-state-machine`, 646K/wk, is a store. Any download-based landscape
  ranking is contaminated.
- **Two of the three biggest headless UI libraries do not use machines.** Radix
  and Ariakit built the full accessible-widget set — dialogs, comboboxes, menus,
  drag interactions — with hooks, refs and controlled/uncontrolled props. The
  interaction-technique domain does not _require_ a machine; F17 is the falsifier
  for any premise that it does.
- **Kingly is a bibliography, not a dependency.** Right ideas, dead artifact,
  `chess.js` in `dependencies`.

## Disagreements and open questions in the literature

- **Does per-state context typing matter, or is it a connoisseur's want?** The
  two production machines (XState, Zag) say no by omission, and Zag says it
  explicitly in its docs. The wanters (F19) are one unpublished library, one
  37-downloads/week package, and one abandoned hook. Both readings of that
  evidence are defensible; the note's own position is in the implications
  below.
- **Is the second declaration site avoidable in current TypeScript?** Zag and
  XState both concluded no and shipped `setup<T>()`. `useStateMachine`
  concluded yes and was right for three years and wrong afterwards. `const` type
  parameters, `NoInfer` and `satisfies` all postdate that library's design and
  have not been tried on this problem in public. Genuinely open. This is the
  single highest-value experiment left for the project.
- **Is the "just use a switch" position correct at 2-9 states?** XState's own
  author says roughly yes (F18); Radix's production code says yes (F17);
  statecharts.dev says no because entry/exit ordering and state explosion are
  subtle (F25). Nobody has measured it.
- **Is a "state machine library" for the browser now really a "small store with
  finite states" library?** `@xstate/store`, Zustand's dominance, Zag's drift
  toward bindables/computed/track, and Ariakit's stores all point the same way.
  Whether this is convergent wisdom or fashion is not settled by anything found
  here.
- **What broke in TypeScript 5.4?** Established: the behaviour changed exactly
  at 5.4.5. Not established: which change. Anyone building on F-bounded
  self-constraints should pin this down first.

## Implications for a typestate FSM library for interaction techniques

1. **The unmet need is real and it is _both halves_, but the second half is the
   one nobody has.** Per-state data has been attempted (XState typestates,
   `useStateMachine`'s derived entry events, `@doeixd/machine`). Per-state
   _capabilities_ — a `send` or a handler set that only admits what is legal
   from the current state — appears in **no** library with adoption (F20).
   `useStateMachine` gets closest and only _advertises_ legality via
   `nextEventsT`. If the project ships one differentiator, that is it.
2. **Derive, do not declare — and now there is a worked example of how.**
   F13's `EntryEventForStateValue` is the sound form of what XState removed in
   F1. The project should copy the _technique_ (scan the transition table,
   compute per-state facts) even if it keeps a declaration site for the state
   names themselves.
3. **The propositions' arrow-test regression is worse than note 08 suggested,
   because the ecosystem's checked-target examples are thinner than believed.**
   Note 08 credited robot3 and XState with checked targets. Neither has one
   (F8, F9). The only surveyed library with a fixed-position, statically checked,
   source-relative target is Zag — and it pays for it with a hand-written
   schema. So the project's real choice is: hand-written state union → checked
   target; inferred states → unchecked target or clever fragile types. That is a
   much sharper framing of dissatisfaction 1 than "is the second declaration
   forced?".
4. **Stop treating the second declaration site as obviously wrong.** Three
   independent teams (XState `setup()`, Zag `setup<T>()`/`createMachine<T>`
   identity fn, this project's `defineMachine<Model>()(...)`) converged on a
   curried type boundary, and one of them arrived there _by removing_ an
   inference-based design (F14). The evidence that the second site is a defect
   is weak; the evidence that removing it is fragile (F13) is strong and
   measured. Re-falsify "Attempt 1" with `const` type parameters, `NoInfer`,
   `satisfies` and `A.CustomError`-style local errors — but budget for the
   answer being "keep it".
5. **The competitor at three states is not XState. It is
   `useReducer` + a nested lookup + refs.** Radix's `Presence` (F17) is 20 lines
   of library and ~15 lines of table, in the most-installed interaction code on
   npm. Any candidate API for this project must be compared against _that_, not
   against XState's ceremony. If a two-state toggle costs fourteen lines
   (dissatisfaction 1), it loses to Radix's three.
6. **Do not chase statechart coverage.** `@xstate/fsm` (flat, no hierarchy) is
   pulled more than XState (F12); robot3 (flat) matches Zag's core on downloads;
   Radix's machine has three flat states. The project's 2-20 flat-state target
   is exactly where the ecosystem's mass sits. Hierarchy, parallelism and
   history are not the missing feature.
7. **Per-state effects with cleanup are the cheapest large win available.**
   Zag and `useStateMachine` both ship them; both use them where the project
   currently uses a `timerToken`. Combined with note 08's F7 and note 02's
   corrections, this is the move that makes the Marking Menu acceptance case
   _shorter_, which is the objective function. It costs the library ownership of
   effect lifetimes — which Zag, Radix and React have all decided is worth it.
8. **Ship a topology export and treat it as an acceptance test of the notation.**
   `toMermaid()` is possible in `typescript-fsm` and impossible in the
   propositions, for exactly one reason (F22, and note 00's observation that
   hiding the target hides it from the reader _and_ the library). "Can the
   library print the diagram without executing handlers?" is a mechanical,
   CI-checkable proxy for the arrow test.
9. **Budget for type-system rot as a first-class risk.** F13 is the only
   longitudinal data point in this survey and it is a failure: three years of
   correct behaviour, then silent degradation on a TS minor. Whatever the
   project ships, it needs `tsd`/`expect-type` assertions for the _narrowing_
   behaviour, run against multiple TypeScript versions in CI — not just a
   compile check. Without that, this library's differentiator is one TS release
   from evaporating without anyone noticing.
