# Breadth-first API brainstorm brief

## Aim

The goal of this session is not to design the API. It is to create enough
different possibilities that a breakthrough has a chance to appear.

Optimize the first rounds for:

1. **breadth;**
2. **quantity;**
3. **difference in underlying models;** and only later
4. **coherence and feasibility.**

An incomplete idea with one surprising property is useful. A polished API that
mostly resembles an existing library is less useful at this stage.

Do not converge, rank, reject, or merge ideas during the generative rounds.
Preserve every seed, including awkward and contradictory ones.

## Breakthrough mandate

Wild ideas are actively encouraged. Early seeds must not be rejected because
they appear difficult to implement in TypeScript, conflict with the current
requirements inventory, use an unfamiliar mental model, or leave important
questions unanswered. Mark an idea **speculative** when necessary and keep
going.

Across the whole first-round pool, aim for a loose mix:

- roughly one third adjacent but genuinely distinct ideas;
- roughly one third transplants from fields outside JavaScript FSM libraries;
  and
- roughly one third wild reversals of familiar assumptions.

Include several APIs the agents want but do not yet know how to implement, and
several that question whether a “machine definition” needs to exist at all.
Distribute different reversals among agents rather than making each agent fill
the same quota.

If every result can be summarized as configuration object versus builder versus
generated methods, the session has failed. The desired reaction to several
seeds is: “I had not considered that an FSM API could work that way.”

Wild does not mean random. A seed still needs an intelligible mechanism and a
reason it might unlock something valuable; it does not need a complete design.

## Minimal design compass

These are sources of gravity, not gates:

1. Small interaction machines should become unusually pleasant to read and
   write.
2. Typestates should provide useful, truthful state-specific knowledge in
   TypeScript.
3. Effects, cleanup, and time need a plausible home somewhere in the complete
   story.
4. The result should ultimately suit high-frequency interaction code in modern
   TypeScript and browsers.

A seed may temporarily ignore or violate any of these to expose a useful new
direction.

The detailed [requirements inventory](requirements.md) must not be given to
first-round agents. It is for much later stress-testing, not ideation.

## Grounding case—later, not now

[Marking Menu](https://github.com/QuentinRoy/Marking-Menu) is the eventual
grounding case because it combines state-specific interaction data, dense
pointer input, conditional evolution, timers, cleanup, and stale-result
protection.

Do not reproduce it during the first rounds. Early examples should be just
large enough to reveal an idea. Promising families can later be tested against
a small slice of the real
[machine](https://github.com/QuentinRoy/Marking-Menu/blob/main/src/engine/machine.ts)
and
[runtime](https://github.com/QuentinRoy/Marking-Menu/blob/main/src/engine/runtime.ts).

## What counts as a new seed

A seed is new when it changes at least one underlying design choice, such as:

- the source of truth for states or transitions;
- what owns evolving state;
- how callers request a transition;
- where state-specific knowledge exists;
- how possible targets become known;
- where effects meet pure state evolution; or
- what the machine even is: graph, value, function, protocol, service,
  language, or something else.

Renaming `send` to `dispatch`, changing tuple syntax to object syntax, or
reordering the same builder calls does not make a new seed.

A seed does not need to describe a whole library. One compelling fragment can
be enough.

## Seed format

Keep each seed small so agents can generate many of them. Its representation
may be code, pseudocode, a type signature, a call-site fragment, a grammar, a
small diagram, or a precise verbal mechanism. Do not force an idea into
TypeScript syntax before it is ready.

Use this loose shape:

```md
### Short name

**Sketch:** The smallest representation that reveals the idea. Omit this when
the mechanism is clearer in words.

**Mechanism:** One sentence explaining the underlying model.

**Unlocks:** One sentence explaining what becomes newly simple or possible.

**Unknown:** Optional; the biggest unresolved question, without trying to solve
it.
```

Do not add a feature matrix, complete tutorial, implementation plan, or full
trade-off analysis during generation.

## Provocation deck

These are ingredients to combine, invert, or discard—not a taxonomy of allowed
answers. When an agent starts repeating itself, pick unfamiliar entries from
two or three rows and force a new combination.

| Axis                     | Provocations                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth          | state declarations, edges, handlers, TypeScript types, return types, constructors, consumer usage, external DSL                        |
| Transition request       | event, state-specific method, free function, command value, pattern match, property access, callback, conversion                       |
| Owner of evolving state  | live service, caller, immutable value, external store, scoped callback, iterator, continuation, no persistent owner                    |
| Topology location        | state-local, edge list, inferred from functions, separate graph, encoded in types, recoverable only through tooling, absent            |
| State-specific knowledge | narrowed observation, typed handle, callback parameter, capability token, method set, match branch, constructor type                   |
| Transition result        | next value, precise union, result algebra, command list, continuation, iterator step, transaction, replacement handle                  |
| Effects                  | external observer, returned command data, state reaction, resource scope, runtime-owned lifecycle, caller-owned lifecycle              |
| Type source              | inferred from values, declared first, hybrid declaration/implementation, generated, branded, checked structurally, progressively typed |
| Definition medium        | object, functions, classes, tagged template, fluent chain, tuple table, JSX-like tree, pattern matcher, no central definition          |

Agents should also borrow from outside FSM libraries: parser combinators,
routers, reducers, lenses, session types, linear APIs, algebraic effects,
database builders, reactive signals, generators, and protocol objects.

Programming abstractions are not the boundary. Look for mechanisms in
contracts, choreography, board and role-playing games, control panels, musical
scores, traffic systems, legal procedures, biological signaling, physical
locks and keys, manufacturing lines, maps, and notation systems. A transplant
does not need to preserve the source metaphor if its mechanism is useful.

## Breakthrough prompts

Use these when the obvious space is exhausted:

- What if there is no machine object?
- What if there is no event union?
- What if there is no central definition?
- What if states are constructors, functions, modules, or protocols rather
  than names?
- What if topology is inferred from return types?
- What if topology is written separately from behavior?
- What if state-specific knowledge exists only inside a scoped callback?
- What if a transition replaces the handle through which future work occurs?
- What if transitions are conversions between state values?
- What if the caller, not the library, owns the current state?
- What if a live runtime exists but observations are immutable?
- What if effects are plain outputs rather than callbacks?
- What if effects attach to states without appearing on transitions?
- What if the graph is a tiny language rather than TypeScript objects?
- What if readable topology and typed behavior are intentionally two views of
  the same model?
- What would this look like if invented by an Elm, Rust, Haskell, or database
  library author rather than an XState user?
- Which accepted assumption, if reversed, creates the most interesting API?

## Session protocol

### Wave 1 — Independent spray

Run three ideation agents plus the coordinating agent independently.

- Each produces **at least 12 seeds**.
- Agents do not see one another's work.
- Agents do not read the requirements inventory.
- Agents do not research every reference library before starting.
- No agent recommends a winner.

Give each participant a different initial provocation, but do not confine it to
one lane:

- **Topology/language:** graphs, edge tables, small DSLs, declarative views.
- **Typestate/interaction:** typed values, methods, capabilities, protocols.
- **Functions/algebras:** reducers, matchers, transitions as data or results.
- **Ownership/lifetime:** services, handles, scopes, transactions, iterators.

Target after Wave 1: **roughly 50 raw seeds**, not four polished proposals.

### Wave 2 — Mutation and collision

Do not give every agent the complete ledger; that would make the existing pool
an anchor. Give different agents different random, overlapping subsets of
seeds without commentary or ranking. Keep at least one agent blind for another
independent spray.

Each agent adds at least eight more seeds by applying moves such as:

- combine two apparently incompatible seeds;
- invert which side owns state or behavior;
- remove the central abstraction;
- move information from runtime to types, or types to runtime;
- turn an implicit relationship into a visible value;
- split one API into definition and consumption views;
- make a familiar convenience impossible and see what clarity appears;
- transplant the strongest property of one seed into an unrelated model; or
- deliberately solve only one hard problem exceptionally well.

Target after Wave 2: **80 or more seeds**.

### Wave 3 — Gap and weirdness hunt

Only now make a loose map of the explored space. Do not score ideas. Look for
empty combinations, repeated assumptions, and models that every agent avoided.

Run a final short wave aimed specifically at those gaps. Each participant adds
at least five more seeds, including ideas that may require compiler help,
code generation, unusual ownership rules, or TypeScript capabilities that do
not quite exist. These are probes, not implementation commitments. Preserve
useful fragments even when the enclosing API is implausible.

Target after Wave 3: **100 or more seeds**, with a visible speculative fringe
rather than only safe variations.

### Stop the generative phase

Stop when new seeds are mostly cosmetic mutations, not when a favorite appears.
Keep the unfiltered ledger as an artifact; clustering must never replace it.

## Disk capture and human handoff

The brainstorm does not live only in agent messages. The durable source of
truth is the [`docs/api-brainstorm/`](api-brainstorm/) directory.

An agent's wave is incomplete until its seeds have been written to its own file
under [`docs/api-brainstorm/raw/`](api-brainstorm/raw/). Parallel agents never
edit the same result file. This prevents concurrent work from overwriting ideas
and ensures that an abbreviated agent response cannot become the only surviving
copy.

After each wave, the coordinating agent incorporates every seed into the
append-only [raw seed ledger](api-brainstorm/raw-seeds.md). Seeds receive stable
identifiers and are not silently deleted, rewritten into another idea, or
replaced by a cluster summary.

After the generative phase, produce two additional disk artifacts:

- the [idea atlas](api-brainstorm/idea-atlas.md), a browsable catalogue of the
  distinct mechanisms and territories, with links back to raw seed identifiers;
  and
- the [breakthrough deck](api-brainstorm/breakthrough-deck.md), a small,
  deliberately varied set of surprising or high-leverage sparks prepared for
  human review.

The final task response gives only a short orientation and clickable links to
those files; it does not paste or replace them. Human reactions and later
decisions should also be written back to disk rather than existing only in the
conversation.

## After breadth has been achieved

Evaluation is a separate session.

1. Cluster seeds by underlying model, allowing one seed to belong to several
   clusters.
2. Mark surprising mechanisms or fragments before considering whole APIs.
3. Select a varied set of seeds for slightly larger sketches; do not choose
   only the most immediately practical ones.
4. Probe those sketches with state-specific data, conditional or unavailable
   inputs, multiple possible targets, effects, and time.
5. Test survivors against a small Marking Menu slice.
6. Only then consult the detailed requirements inventory and TypeScript
   feasibility constraints.
7. Present several coherent families and several orphaned breakthrough
   fragments for human discussion. Do not silently synthesize one winner.

## References for later mutation rounds

Do not make every agent read all of these up front. They are mutation material
after independent ideas exist:

- [Totorobot design notes](design-notes.md)
- [Totorobot design explorations](design-explorations.md)
- [Robot3](https://thisrobot.life/)
- [XState](https://stately.ai/docs/xstate)
- [yay-machine](https://github.com/maurice/yay-machine)
- [JavaScript State Machine](https://github.com/jakesgordon/javascript-state-machine)
- [Machinist](https://github.com/VincentQuillien/machinist)
- [`@doeixd/machine`](https://github.com/doeixd/machine)
- [JSSM](https://github.com/StoneCypher/jssm)

Machinist and `@doeixd/machine` are useful nearby points; JSSM is a useful
provocation about definition medium. None should become the default base.

The current Totorobot API is evidence from one explored branch of the design
space, not the center of the next search.
