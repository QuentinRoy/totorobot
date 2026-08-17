# Automata and statechart theory: what the formal models actually give you

> Research note. Evidence levels: [READ] full text or substantial part,
> [ABSTRACT] abstract/summary/snippet only, [SECONDARY] cited elsewhere or
> standard textbook material.
>
> Scope note: reduced inline pass after a larger sweep failed on a session
> limit. Bibliographic details were verified; several full texts were not
> retrieved and are tagged accordingly.

## Scope and questions asked

Which parts of the formal theory are load-bearing for a library targeting 2-20
control states, and which exist only to manage large models? Where does the
theory constrain an API, and where is it silent?

## Key sources

- David Harel, "Statecharts: A Visual Formalism for Complex Systems", _Science
  of Computer Programming_ 8(3), 1987, pp. 231-274 — [SECONDARY], canonical.
- David Harel and Amir Naamad, "The STATEMATE Semantics of Statecharts", _ACM
  TOSEM_ 5(4), 1996 — [SECONDARY].
- Michael von der Beeck, "A Comparison of Statecharts Variants", _FTRTFT 1994_,
  LNCS 863, pp. 128-148, doi:10.1007/3-540-58468-4_163 — [ABSTRACT];
  bibliographic details confirmed via dblp and Springer.
- Michelle Crane and Juergen Dingel, "UML vs. classical vs. Rhapsody
  statecharts: not all models are created equal", _MoDELS 2005_ (LNCS 3713) and
  _Software and Systems Modeling_ 6(4), 2007, doi:10.1007/s10270-006-0042-8 —
  [ABSTRACT].
- G. H. Mealy, "A Method for Synthesizing Sequential Circuits", _Bell System
  Technical Journal_ 34(5), 1955; E. F. Moore, "Gedanken-Experiments on
  Sequential Machines", _Automata Studies_, 1956 — [SECONDARY], canonical.
- Alur and Dill, "A Theory of Timed Automata", _Theoretical Computer Science_
  126(2), 1994 — [SECONDARY].

## Findings

**F1 — The Mealy/Moore distinction is the oldest version of this project's
"where do effects attach" question, and it is a genuine either/or.** In a Moore
machine the output is a function of the state alone; in a Mealy machine it is a
function of the state and the input. Every FSM library re-lives this as
"entry/exit actions" (Moore) versus "transition actions" (Mealy). They are
inter-convertible, but not at equal cost: converting Mealy to Moore can require
splitting states, because a state reached by two differently-outputting
transitions must become two states. [SECONDARY]

Consequence for this project: a library that offers _only_ transition-attached
effects is expressively fine but forces state splitting for
residency-shaped concerns (a timer that should live exactly as long as
`startup`). A library that offers _only_ state-attached effects cannot express
input-dependent one-shot effects without a data flag. The propositions'
"effects belong to state residency" finding is the Moore side; returned
commands are the Mealy side. Both are needed, and the theory says so.

**F2 — Adding data to states takes you out of finite-state theory entirely.**
The model this project is actually building — per-state data with guards over it
— is an Extended Finite State Machine, not an FSM. Once variables enter, the
reachable state space is no longer finite and the decidable properties of finite
automata (equivalence, minimization, reachability, exhaustive model checking)
are lost in general. [SECONDARY]

This matters for scope discipline: the project cannot promise reachability
analysis, minimization, or "this guard can never be true" diagnostics, and
should not accidentally imply it. Proposition 1's honest disclaimer — that it
promises static authorization, not reachability — is the theoretically correct
position, and it applies to _every_ candidate, not just that one.

**F3 — Hierarchy was invented for a specific quantitative problem: blow-up in
the number of transitions, not states.** Harel's motivating argument for XOR
states is that a common event handled identically from many states requires one
arrow per state in a flat diagram, and one arrow from an enclosing state in a
hierarchical one. Orthogonal (AND) states address the dual problem: modelling
_n_ independent binary aspects flat requires 2^n states. [SECONDARY, Harel
1987]

Applied to the acceptance case: the Marking Menu has `up` and `cancel` handled
identically from all three active states. That is exactly Harel's motivating
pattern — and at three states it costs six handler entries, not a diagram
anyone would refuse to read. The project's P2.9 ("reuse behavior shared by
several states", explicitly low priority) is the correct triage.

**F4 — The statechart semantic-variant problem is real, large, and almost
entirely a consequence of hierarchy.** Von der Beeck's 1994 survey compares
around 20 distinct Statecharts variants and elaborates a feature set to
distinguish them. [ABSTRACT] Crane and Dingel later compared the three most used
formalisms — Classical, UML, and Rhapsody — and found that a model well-formed
in one may be _silently interpreted differently_ in another. [ABSTRACT]

Their canonical example is transition priority: in classical statecharts the
transition with the **highest** scope wins; in UML and Rhapsody the transition
in the **innermost** substate wins. Same picture, opposite behavior.

**F5 — Every one of those disagreements presupposes nesting.** Priority by
scope, inter-level transitions, entry/exit ordering along a path, history
restoration depth, and the meaning of a self-transition on a composite state are
all undefined questions in a flat machine with 2-9 states. A flat library does
not "lack" a hierarchy feature so much as it _dodges the entire literature of
incompatible semantics_. This is a substantive argument for the project's
existing P4/probe boundary, stronger than the simplicity argument usually given
for it.

> **Overstated — corrected by note 02, C1.** "Every one" is false. Flatness
> dodges the _hierarchy_ variants; it does not dodge the _timing_ variants.
> Esmaeilsabzali, Day, Atlee and Niu (Requirements Engineering 15(2), 2010)
> decompose big-step languages into eight semantic aspects, and at least five —
> Big-Step Maximality, Event Lifeline, Enabledness Memory Protocol, Assignment
> Memory Protocol, Combo-Step Maximality — remain live decisions in a flat 2-9
> state machine. The claim should be narrowed to: flatness removes the
> hierarchy-dependent disagreements, which are the majority of the _notational_
> ones, while the execution-timing disagreements survive and must be chosen
> explicitly. See note 02.

**F6 — The features that remain load-bearing for small flat machines are a short
list.** Filtering the statechart/UML feature set by "is this meaningful without
nesting":

| Feature                                    | Meaningful when flat? | Notes                                      |
| ------------------------------------------ | --------------------- | ------------------------------------------ |
| States, transitions, guards                | yes                   | the core                                   |
| Per-state data (EFSM)                      | yes                   | the project's actual model                 |
| Entry/exit actions                         | yes                   | Moore-side effects, F1                     |
| Internal vs external self-transition       | yes                   | = same-state update vs re-entry            |
| Run-to-completion, event queue             | yes                   | only if the library owns a runtime         |
| Timers/timeouts                            | yes                   | see `gen_statem` in note 08                |
| Final states                               | marginal              | a state with no capabilities already works |
| Hierarchy (XOR), orthogonality (AND)       | no                    | dodges F4 entirely                         |
| History states                             | no                    | requires nesting to be useful              |
| Inter-level transitions, priority by scope | no                    | undefined without nesting                  |
| Broadcast between orthogonal regions       | no                    | requires AND states                        |
| Deferred events                            | yes                   | `gen_statem`'s `postpone`, note 08 F6      |

**F7 — The internal/external transition distinction is the one hierarchy-adjacent
feature that survives flattening, and it is exactly P2.2.** UML distinguishes a
transition that leaves and re-enters a state (running exit and entry actions)
from an internal transition that does not. With no nesting this reduces cleanly
to "same-state update" versus "explicit re-entry" — the two return values Erlang
spells `keep_state` and `repeat_state`. The theory says this distinction is
primitive, not a convenience. [SECONDARY]

**F8 — Timed automata do not transfer.** Alur and Dill's model adds real-valued
clocks with reset and invariant constraints, and buys decidable verification of
timing properties via region/zone abstraction. [SECONDARY] The value is
_verification_, which this project explicitly rules out (P4.5). No interaction
toolkit in the material reviewed adopts it. Treat "time as first-class" as a
scheduling and staleness concern, not as a formal-model concern.

**F9 — The syntax/semantics separation is the theory's most useful practical
advice.** A transition system is the semantics; a notation is syntax over it.
Many notations can denote the same transition system, and the choice among them
is an ergonomics question that the formal literature deliberately does not
answer. This licenses the project to treat the notation question — the arrow
test, the ceremony floor — as _the_ open question, without fear that it is
picking a weaker formalism.

**F10 — Determinism is a property the API can enforce syntactically, and most
notations do not.** A guarded transition set is deterministic only if guards are
mutually exclusive or ordered. Ordered-first-match (Proposition 2, Robot3,
statecharts' priority rules) makes determinism syntactic and total. Arbitrary
handler bodies (Proposition 1) make it trivially true in a different way: one
function, one return, no conflict possible. Both are fine; the trap is a design
with an unordered _set_ of guarded edges, which requires a documented tie-break
rule and reintroduces the F4 class of ambiguity at small scale.

## Design moves worth stealing

1. **Name the internal/external distinction explicitly** (F7), as two outcomes
   rather than a flag.
2. **Keep both Moore-side and Mealy-side effect attachment** (F1), because the
   conversion cost is state splitting.
3. **Refuse hierarchy on semantic grounds, not just simplicity grounds** (F5).
   This is a defensible public position rather than an apology.
4. **One decision per (source, input)** (F10) so determinism is structural.

## Traps, negative results, and things that failed

- **Twenty incompatible statechart semantics** (F4) is the field's largest
  cautionary tale about adding structure faster than you can define it.
- **EFSM analysis promises** (F2). Any hint of reachability or exhaustiveness
  beyond "declared states are implemented" over-promises.
- **Timed automata in UI toolkits** (F8): a formalism with no adoption in this
  domain despite forty years of availability.

## Disagreements and open questions

- Whether entry/exit actions are worth their cost in a flat, effect-as-data
  design, or whether residency-scoped resources (the propositions' current
  answer) subsume them.
- Whether ordered first-match guards or one arbitrary handler body per pair is
  the better determinism story for _readers_, as opposed to for the compiler.
  The theory is indifferent; F9 says this is exactly where the design work is.

## Implications for a typestate FSM library for interaction techniques

1. **The project is building an EFSM, and should say so.** Per-state data is the
   defining feature, and it forfeits the classical decidable properties. Scope
   the promises accordingly.
2. **Flatness is a semantic asset.** The 2-9-state reality (note 03, F5) plus
   the variant swamp (F4/F5) means hierarchy is not a deferred feature the
   design should reserve room for — reserving room for it is how a small library
   acquires the ambiguity it was avoiding.
3. **The feature table in F6 is a defensible scope boundary** and is
   considerably shorter than the current requirements document. Most of what
   `requirements.md` spends complexity on is in the "yes" column, but the
   burden of proof for anything outside it should be high.
4. **The notation question is not a lesser question.** F9 is the theory's own
   verdict: it has nothing to say about which syntax denotes the transition
   system best. That is the project's actual problem, and the evidence for it
   is in notes 03, 08 and 09 rather than here.
