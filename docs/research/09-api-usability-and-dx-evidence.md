# What makes a library great: API usability and DX evidence

> Research note. Evidence levels: [READ] full text or substantial part,
> [ABSTRACT] abstract/summary only, [SECONDARY] cited elsewhere or standard.
>
> Scope note: reduced inline pass. The centrepiece source (Sunshine et al.) was
> read in full because it studies _exactly_ this project's problem: the
> usability of APIs whose legal operations depend on state.

## Scope and questions asked

Is there evidence — not taste — about what makes an API good to author and
read? And is there evidence specific to _protocol_ APIs, where legality depends
on state?

## Key sources

- Joshua Sunshine, James D. Herbsleb and Jonathan Aldrich, "Searching the State
  Space: A Qualitative Study of API Protocol Usability", _ICPC 2015_, Carnegie
  Mellon University.
  <https://www.cs.cmu.edu/~aldrich/papers/icpc15-searching.pdf> — [READ].
- Martin P. Robillard, "What Makes APIs Hard to Learn? Answers from
  Developers", _IEEE Software_ 26(6), 2009, pp. 27-34, doi:10.1109/MS.2009.193.
  <https://www.cs.mcgill.ca/~martin/papers/software2009a.pdf> — [READ].
- Brian Ellis, Jeffrey Stylos and Brad Myers, "The Factory Pattern in API
  Design: A Usability Evaluation", _ICSE 2007_, pp. 302-312,
  doi:10.1109/ICSE.2007.85 — [ABSTRACT].
- Thomas Green and Marian Petre, "Usability analysis of visual programming
  environments: a 'cognitive dimensions' framework", _Journal of Visual
  Languages and Computing_ 7(2), 1996 — [SECONDARY].
- Nels Beckman, Duri Kim and Jonathan Aldrich, "An Empirical Study of Object
  Protocols in the Wild", _ECOOP 2011_ — [SECONDARY], via Sunshine et al.
- John Ousterhout, _A Philosophy of Software Design_, 2018 — [SECONDARY].

## Findings

**F1 — State-dependent APIs are roughly three times more common than generic
ones.** Beckman, Kim and Aldrich's primary numbers are **7.2% of types define a
protocol versus 2.5% that define type parameters — a factor of 2.9** — measured
over a 16-program corpus. Protocol APIs are not a niche; they are ordinary and
under-served. [SECONDARY via Sunshine et al. §I; primary numbers from Beckman et
al., ECOOP 2011]

> **Corrected by note 05, C1.** This finding originally read "more than three
> times as many types **in the Java Standard Library**". Both the multiplier and
> the corpus were wrong: it is 2.9x, not "more than three", and the corpus is 16
> programs rather than the JSL alone. Aldrich and Sunshine's own PLATEAU 2014
> paper says "more than twice". Quote 7.2% vs 2.5% and say "roughly three
> times".

**F2 — Developers using protocol APIs spend most of their time on state
search.** In the think-aloud study with professional developers, 82% of assigned
time — 71% of total task time — went to four categories of question. This is the
single most useful empirical result found in this research round. [READ,
Sunshine et al. §V]

|       | The question developers actually ask               |
| ----- | -------------------------------------------------- |
| **A** | What abstract state is an object in?               |
| **B** | What are the capabilities of an object in state X? |
| **C** | In what state(s) can I do operation Z?             |
| **D** | How do I transition from state X to state Y?       |

The only observed combinations were A+B and C+D.

**F3 — The paper's own design guidance names two mechanisms, and this project
has one of them.** The conclusion states that languages supporting separation of
members by abstract state will likely make B and C easier, and that a
first-class state-change operation makes D easier. [READ, Sunshine et al. §VII]

A state-keyed map of capabilities _is_ separation of members by abstract state.
A visible, named transition target _is_ a first-class state-change operation.
The literature is describing this project's design space and telling it which
two levers matter.

**F4 — Existing tools answer A only, and only on failure.** Sunshine et al. note
that protocol tools typically report the abstract state only in an error
message, and they are unaware of any tool that gives the developer this
information when there is _not_ an error. [READ, Sunshine et al. §VII]

TypeScript inverts this: hovering a narrowed typestate answers A continuously,
in the editor, with no error required. That is a real and under-claimed
advantage of doing typestate in a structurally typed language with a language
server, and it is worth designing _for_ rather than treating as a side effect.

**F5 — Question D is the arrow test, and it is roughly a quarter of protocol
task time.** "How do I transition from state X to state Y?" is answered by
reading targets. In a notation where targets sit inside handler bodies, this
question requires reading every body in the machine. The dissatisfaction
recorded in `00-evaluation-brief.md` now has a measured cost attached to it.

**F6 — Documentation, not design, is the top obstacle to learning an API — but
design is second and much closer than folklore suggests.** Robillard surveyed 83
Microsoft developers (80 usable, 8% response rate) with open-ended questions.
Obstacle counts by category: [READ, Robillard Table 1]

| Category                            | Count |
| ----------------------------------- | ----- |
| Resources (documentation, examples) | 50    |
| Structure (design of the API)       | 36    |
| Background / prior experience       | 17    |
| Technical environment               | 15    |
| Process (time, interruptions)       | 13    |

For a library whose entire value proposition is notation, the "Structure" number
is the one to take personally. But F6 also carries a warning: a beautifully
designed API with poor documentation loses to a mediocre one with good docs.

**F7 — Factories measurably slow developers down compared with constructors.**
Ellis, Stylos and Myers found participants required significantly more time to
construct an object via a factory than via a constructor (p = 0.005), in both
context-sensitive and context-free tasks, regardless of experience. In one task,
5 of 12 participants failed to finish at all. [ABSTRACT]

This lands directly on `defineMachine<Model>()({...})`: a factory that returns a
factory. The propositions defend the double call as "one interface cost, not
aesthetic currying". The evidence says indirection at the construction site has
a measured cost, and this design has two levels of it.

**F8 — Cognitive Dimensions give the vocabulary for the rest.** Green and Petre's
framework is descriptive, not prescriptive: it names trade-offs rather than
ranking notations. The dimensions that bite hardest for a machine-definition
notation: [SECONDARY]

| Dimension              | The FSM-API question it names                                   |
| ---------------------- | --------------------------------------------------------------- |
| Viscosity              | How many edits does "add a state" / "add a transition" cost?    |
| Role-expressiveness    | Can you tell what a fragment _is_ by looking? (the arrow test)  |
| Hidden dependencies    | Can you see what else changes when you change this?             |
| Premature commitment   | Must you declare the model before writing behavior?             |
| Diffuseness            | How many lines does the toggle machine cost?                    |
| Hard mental operations | Must you simulate the type checker in your head?                |
| Secondary notation     | Can formatting/comments carry meaning, or does Prettier eat it? |
| Progressive evaluation | Can you run a half-finished machine?                            |

Two of these are already the project's live complaints: premature commitment
(the model type must be declared before behavior) and role-expressiveness (the
target is not identifiable by looking).

**F9 — Ousterhout's deep-module criterion cuts against "one more notation".** A
deep module has a small interface over substantial functionality; complexity
manifests as change amplification, cognitive load, and unknown unknowns.
[SECONDARY] The propositions' own recommendation section reaches the same
conclusion independently ("A behavior-first interface plus optional rule and
graph notations would create several sources of truth and make the module
shallower"), which is a point in its favour.

## A scoring rubric for "is this FSM API great?"

Applicable to a one-page sketch, no implementation required. Score each item on
a small representative machine (use the toggle for floor, the Marking Menu for
substance) after Prettier formatting.

### Tier 1 — the state-search questions (weight highest; F2/F3)

1. **A: current state.** Can the reader/editor determine the state of a value at
   any program point? Measure: does hover show the state name and its data?
2. **B: capabilities of a state.** From a state name, how many source locations
   must be visited to list everything it accepts? _Target: one._
3. **C: sources of an operation.** From an input name, how many locations to
   list every state that accepts it? _Target: one search, results scannable._
4. **D: how to get from X to Y.** Can targets be enumerated without reading any
   body? _This is the arrow test. Target: yes._

### Tier 2 — authoring cost (F7, F8)

5. **Ceremony floor.** Lines and distinct concepts for the two-state toggle.
   _Reference points: SwingStates ≈ 4 lines/state; propositions ≈ 14 lines
   total._
6. **Construction indirection.** Number of call/type-parameter hops before the
   first behavior is written. _Evidence says fewer is measurably better._
7. **Declaration duplication.** How many places name a state? An input?
8. **Edit locality.** For each of: add a state, add a transition, add a field to
   one state's data, retarget a transition, rename an input — count changed
   locations and repeated facts. (Already in `acceptance-cases.md`; it is the
   best task set there and should be weighted above the others.)

### Tier 3 — failure behavior (F6)

9. **Diagnostic locality.** For each of the five standard mistakes, does the
   error land on the offending token?
10. **Degradation.** What happens with partial types, a JS consumer, or a
    hoisted handler?
11. **Documentability.** Can the whole model be taught in one page? F6 says this
    outranks elegance.

### Tier 4 — the constraints, scored as costs not features

12. Typestate precision retained through `.d.ts` and downstream consumption.
13. Effect, timing, and queueing integration _measured by the ceremony they add
    to items 5-8 when unused_.

The ordering is the point: a candidate that wins Tier 4 and loses Tier 1 is the
wrong candidate for this project's stated objective.

## Traps, negative results, and things that failed

- **Optimizing for the expert reader.** F2's questions are asked by people who
  did not write the machine, including the author six months later.
- **Believing that type safety substitutes for legibility.** F4: existing
  protocol tools answer question A, only on failure, and the field still rates
  these APIs hard to use.
- **Under-investing in documentation** (F6): 50 versus 36.
- **Defending indirection on inference grounds** (F7). If the double call is
  genuinely forced by TypeScript, that is a reason to look for another encoding,
  not a reason to accept the cost.

## Disagreements and open questions

- Cognitive Dimensions is a discussion framework with weak predictive validity;
  it names trade-offs but will not rank two candidates for you. Use it to
  generate the questions, use tasks (item 8) to get the answers.
- Whether editor affordances (hover, completion, go-to-definition) can
  substitute for source-visible topology. F4 suggests they help with A and B;
  nothing found here suggests they help with D.

## Implications for a typestate FSM library for interaction techniques

1. **Adopt A/B/C/D as the primary evaluation instrument.** It is empirical, it
   is specific to protocol APIs, and it discriminates between the propositions
   in a way the current requirements document does not.
2. **The propositions score well on B, adequately on A and C, and badly on D.**
   That is a precise statement of the user's intuition, and D is not a minor
   axis: it is one of the four questions that consume 71% of protocol task time.
3. **Treat the ceremony floor as a measured usability property** (F7), not as an
   aesthetic complaint.
4. **Budget for documentation as a first-class deliverable** (F6), not as
   something written after the API settles.
