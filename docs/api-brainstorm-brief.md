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

## Execution contract

One coordinating agent owns the complete pre-review run. In one invocation it
runs all three waves, validates and indexes their output, performs independent
curation, builds the atlas and breakthrough deck, and returns the human
handoff. It makes operational choices and retries failed workers without asking
the human for approval or clarification.

The coordinator contacts the human only when the review package is complete or
an essential tool or capability remains unavailable after reasonable retries.
It does not begin API evaluation or convergence during this run.

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
## <assigned-prefix>-001

**Name:** Short name

**Parents:** Stable seed identifiers, for mutations; otherwise omit.

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

The coordinating agent orchestrates and captures; it does not count as a blind
ideator because it already knows the requirements and prior exploration.

Launch four fresh agents with no inherited conversation history. Give each a
self-contained prompt containing the ideation guidance above, its assigned role
below, the 12-seed minimum, its output path and reserved prefix, and the
write-and-return rules below. Do not give it repository links or broader
context.

| Prefix | Role                         | Output file                                             |
| ------ | ---------------------------- | ------------------------------------------------------- |
| `W1-A` | Near-field breaker           | `docs/api-brainstorm/raw/wave-1-near-field.md`          |
| `W1-B` | Alien-mechanism miner        | `docs/api-brainstorm/raw/wave-1-alien-mechanisms.md`    |
| `W1-C` | Anti-machine, caller-first   | `docs/api-brainstorm/raw/wave-1-anti-machine.md`        |
| `W1-D` | Impossible-language inventor | `docs/api-brainstorm/raw/wave-1-impossible-language.md` |

- Each produces **at least 12 seeds**.
- Agents do not see one another's work.
- Agents do not read the requirements inventory.
- Agents do not read the repository README, current design, historical
  explorations, reference list, or raw output from other agents.
- No agent recommends a winner.
- Each agent writes its assigned file before returning only its path and seed
  count.

Use deliberately asymmetric starting roles rather than four variations on the
same programming-language prompt:

- **Near-field breaker:** remain plausible in ordinary TypeScript but change
  underlying models, not syntax.
- **Alien-mechanism miner:** transplant mechanisms from non-software domains.
- **Anti-machine, caller-first:** begin from ideal use sites and question state
  names, event vocabularies, and central definitions.
- **Impossible-language inventor:** sketch desirable models even when they need
  compiler features or ownership rules TypeScript lacks.

Roles are provocations, not lanes.

Target after Wave 1: **roughly 50 raw seeds**, not four polished proposals.

Before starting Wave 2, verify every assigned file exists, each contains at
least 12 seeds under its reserved prefix, all IDs are unique, and every ID
appears in the raw index. Resume or replace a failed worker without involving
the human.

### Wave 2 — Mutation and collision

Launch four fresh agents without inherited conversation history. Give three
different random, overlapping subsets of seed bodies, copied directly into
their prompts without ranking or commentary. Keep the fourth blind for another
independent spray. Use prefixes `W2-A` through `W2-D` and output paths
`docs/api-brainstorm/raw/wave-2-mutations-a.md` through
`docs/api-brainstorm/raw/wave-2-mutations-d.md`; `W2-D` is the blind
assignment. Do not expose the complete ledger, requirements, current design,
history, references, or other agents' work beyond the assigned packet.

Any pre-session human seeds join the ordinary sampling pool at Wave 2. They
receive no guaranteed packet placement, ranking, or special curation status.

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

Every packet-backed mutation records the stable identifiers of its parents.
Repeat the file, prefix, count, unique-ID, parent, and index checks before
continuing. Resume or replace failed workers autonomously.

### Wave 3 — Gap and weirdness hunt

Only now make a loose map of the explored space. Do not score ideas. Look for
empty combinations, repeated assumptions, and models that every agent avoided.

Launch four fresh agents against four different gaps, using prefixes `W3-A`
through `W3-D` and output paths
`docs/api-brainstorm/raw/wave-3-gaps-a.md` through
`docs/api-brainstorm/raw/wave-3-gaps-d.md`. Each adds at least five seeds,
including ideas that may require compiler help, code generation, unusual
ownership rules, or TypeScript capabilities that do not quite exist. These are
probes, not implementation commitments. Preserve useful fragments even when
the enclosing API is implausible.

Target after Wave 3: **100 or more seeds**, with a visible speculative fringe
rather than only safe variations.

Repeat the capture audit before declaring generation complete. Resume or
replace failed workers autonomously.

### Stop the generative phase

Stop when new seeds are mostly cosmetic mutations, not when a favorite appears.
Keep the unfiltered ledger as an artifact; clustering must never replace it.

## Disk capture

The brainstorm does not live only in agent messages. The durable source of
truth is the [`docs/api-brainstorm/`](api-brainstorm/) directory.

An agent's wave is incomplete until its seeds have been written to its own file
under [`docs/api-brainstorm/raw/`](api-brainstorm/raw/). Parallel agents never
edit the same result file. This prevents concurrent work from overwriting ideas
and ensures that an abbreviated agent response cannot become the only surviving
copy.

Raw agent files become immutable when accepted or declared abandoned. Agents
create seeds with stable, reserved identifiers; the coordinator does not rename
them later. After each wave, the coordinating agent adds every well-formed,
uniquely identified seed to the append-only
[raw-seed index](api-brainstorm/raw-seeds.md), linking to the original body.
Seeds are not silently deleted, rewritten into another idea, or replaced by a
cluster summary.

If an agent finishes without a valid file, resume it against the same path
before accepting it. If that is impossible, declare the partial file abandoned,
index any well-formed, uniquely identified seeds it contains as recovered, and
launch a replacement using
`<original-stem>-retry-N.md` and `<original-prefix>-R<N>`. Recovered seeds do
not reduce the replacement's minimum count. Abandoned malformed fragments
remain as provenance but are not seeds.

## Plural curation before human review

Do not let one coordinator decide what counts as the breakthrough set.

After the final capture audit, launch four fresh curators while the coordinator
builds the atlas. Each curator reads the raw index and linked seed bodies, sees
no other curator output or requirements inventory, and uses one lens:

- most alien or assumption-breaking;
- strongest single mechanisms and donor fragments;
- quiet foundations that could become exceptional after one transplant; and
- contradictions or unresolved tensions that deserve competing answers.

Each curator writes concise nominations with raw seed IDs to a separate
`docs/api-brainstorm/raw/curation-<lens>.md` file. Each curator nominates exactly
three raw seeds and may identify a specific donor fragment within each. Take
the distinct nominated seeds, then sample unnominated seeds until the pool has 12. Every pool entry becomes a deck card; the coordinator does not cut or rank
the pool. Report its resulting coverage across mechanisms, waves, source
agents, quiet foundations, donor fragments, and speculative ideas. The atlas
maps the whole space and does not veto the nomination pool.

## Human handoff

After the atlas and curation are complete, build the breakthrough deck. The
human handoff consists of:

- the [breakthrough deck](api-brainstorm/breakthrough-deck.md), a small,
  deliberately varied set of surprising or high-leverage sparks prepared for
  human review;
- the [idea atlas](api-brainstorm/idea-atlas.md), a browsable catalogue of the
  distinct mechanisms and territories, with links back to raw seed identifiers;
  and
- the complete [raw-seed index](api-brainstorm/raw-seeds.md).

The final task response gives only a short orientation and clickable links to
those files; it does not paste or replace them. Human reactions and later
decisions should also be written back to disk rather than existing only in the
conversation.

## After breadth has been achieved

Evaluation is a separate session. The coordinating agent stops after the human
handoff. It does not expand cards into coherent API families, run design or
feasibility trials, consult the detailed requirements inventory, test the
Marking Menu case, or select and synthesize a winner.
