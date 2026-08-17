# HCI: state machines as the model for input and interaction techniques

> Research note. Evidence levels: [READ] full text or substantial part,
> [ABSTRACT] abstract only, [SECONDARY] cited elsewhere.
>
> Scope note: this note was produced by a reduced inline research pass after a
> larger parallel sweep failed on a session limit. It is deep on two primary
> sources that were read in full and thin on the rest. Sources marked
> [NOT YET RETRIEVED] are known-relevant and still outstanding.

## Scope and questions asked

What does the HCI literature actually claim state machines buy an interaction
developer, what pain does it document, and what notation did the systems that
were built and evaluated converge on? Specifically: where does a transition's
**target state** appear in each notation, and is there evidence about reading
and editing cost?

## Key sources

- Caroline Appert and Michel Beaudouin-Lafon, "SwingStates: adding state
  machines to Java and the Swing toolkit", _Software: Practice and Experience_
  38(11), 2008, pp. 1149-1182 (extended version of the UIST 2006 paper).
  <https://perso.lisn.upsaclay.fr/appert/website/papers/SwingStates-spe.pdf>
  — [READ] full text.
- Stephen Oney, Brad Myers and Joel Brandt, "InterState: A Language and
  Environment for Expressing Interface Behavior", _UIST 2014_.
  <https://joelbrandt.com/publications/oney_uist2014_interstate.pdf> — [READ]
  full text.
- Bill Buxton, "A three-state model of graphical input", _INTERACT 1990_ —
  [NOT YET RETRIEVED].
- Robert J.K. Jacob, "A specification language for direct-manipulation user
  interfaces", _ACM TOG_ 5(4), 1986 — [NOT YET RETRIEVED].
- Mark Green, "A survey of three dialogue models", _ACM TOG_ 5(3), 1986 —
  [NOT YET RETRIEVED].
- Brad Myers, "A new model for handling input", _ACM TOIS_ 8(3), 1990 —
  [NOT YET RETRIEVED].
- Kin et al., "Proton: multitouch gestures as regular expressions", _CHI 2012_;
  "Proton++", _UIST 2012_ — [NOT YET RETRIEVED].
- Oney, Myers and Brandt, "ConstraintJS", _UIST 2012_ — [SECONDARY], cited from
  the InterState paper.

## Findings

**F1 — The closest prior art to this project puts the target state at a fixed
syntactic position, and says so explicitly.** SwingStates' transition schema is
literally documented as:

```
Transition <trans> = new <event>(<params...>, <ostate>) { ... }
```

The output state is always the **last constructor argument**. In every example
in the paper it is written as `">> stateName"`. [READ, SwingStates §3]

**F2 — The `>>` is deliberate secondary notation whose stated purpose is
scannability.** The paper explains that leading non-alphabetic characters in the
target string are ignored by the resolver, and that this exists so that
"developers [can] make output states stand out in their code". The arrow is not
decoration; it was designed in so the reader's eye can find the target.
[READ, SwingStates §3]

**F3 — Omitting the target means "same state".** From the same schema: if
`<ostate>` is omitted, "the output state is the same as the input state, i.e.
the state in which the transition is declared". A one-argument-shorter call is
the same-state outcome. This is a zero-ceremony encoding of the distinction
this project spends a whole requirement on (P0.6, no-transition vs same-state
update vs change). [READ, SwingStates §3]

**F4 — SwingStates used an unchecked string for the target only because Java
forced it, and the authors call it their design's one drawback.** When the inner
`Transition` object is constructed, the enclosing machine's `State` fields are
still `null`, so a direct reference is impossible; targets are strings resolved
by reflection once, on first use. The paper states that the sole drawback of the
inner-class syntax is that the output state must be given as a text string
rather than as the state itself, and judges the other advantages to outweigh it.
[READ, SwingStates §3 and §8.1]

This is the single most actionable finding in the note. **TypeScript does not
have Java's constraint.** A string-literal target can be checked against a union
of state names, and can drive completion and rename. The notation that HCI's
best-evaluated FSM toolkit adopted _despite_ losing static checking is available
to this project _without_ losing it.

**F5 — Empirically, interaction machines are small: 2 to 9 states and 8 to 32
transitions.** In the SwingStates teaching benchmark, students implemented
published interaction techniques; the resulting machines had "between 2 and 9
states and 8 to 32 transitions", mean program length 750 lines with about 250
lines per machine. [READ, SwingStates §8.2]

This tightens the project's own P0.2 target (2-20 states). The real distribution
is at the bottom of that range. Ceremony that is invisible at 20 states is still
paid in full at 3.

**F6 — Marking Menu is in that benchmark set.** Table I of the SwingStates
evaluation lists the eight techniques offered to students; Marking Menu was one,
chosen by 2 groups. The project's primary acceptance case is a technique already
used by the field to benchmark toolkits. [READ, SwingStates §8.2]

**F7 — The state-machine advantage the authors claim is edit locality, not
expressive power.** Their worked comparison (Figure 3, press-drag-release that
either moves a shape or pans the background) shows callbacks and machine at
similar length. The claimed win is what happens on change: adding a
constrained-move mode "translates into adding a state to the state machine while
it requires changing all three handlers and adding a global variable" in the
callback version. [READ, SwingStates §2]

**F8 — The authors concede the small-machine case to callbacks.** Directly:
"event handlers are more compact for interfaces that have only a few states or
for interfaces whose behavior is very similar among states". A state-machine
library that adds ceremony at the low end is competing against plain callbacks
and, by the toolkit authors' own admission, losing. [READ, SwingStates §2]

> **Qualified by note 04, C1.** The concession is about _compactness_, and
> compactness and comprehensibility come apart. Proton++ measured gesture
> comprehension at one to three touches: 110.99 s with iOS callbacks versus
> 49.25 s with a one-line textual regular expression — callbacks lost by 2.3x
> while being no longer to write. Spending lines on visible structure is
> therefore licensed by the evidence; spending them on _indirection_ is not.
> The ceremony objection is about the second declaration site and the double
> call, not about line count as such.

**F9 — The authoring mental model is state-centered and target-directed.** The
paper frames the developer's question when using machines as: for each state,
which events are relevant, and which states do they lead to. The notation should
answer the question the author is already asking, which is a question about
_targets_. [READ, SwingStates §2]

**F10 — State-specific data came free from lexical scoping, not from a type
mechanism.** Because states are anonymous inner classes, "a method or variable
declared within a state can only be accessed from inside that state, including
from its transitions". SwingStates got per-state data with zero declarations —
though only as instance-local mutable variables, with no typestate guarantee and
no per-state data in an observed value. [READ, SwingStates §3]

**F11 — SwingStates' learnability evidence is real but weak in design.** All
student groups completed their projects after a one-hour lecture and no hands-on
training, in contrast to previous years with other toolkits. The authors are
candid that the later comparison was "not a fully controlled experiment". Treat
this as evidence of a gentle learning curve, not as a controlled comparison.
[READ, SwingStates §8.2]

**F12 — InterState provides the field's strongest quantitative evidence on
interface-behavior notation, and it is a large effect.** 20 experienced
programmers (ages 19-41), two tasks, two systems, counterbalanced:

| Task           | JavaScript callbacks | InterState     | Significance |
| -------------- | -------------------- | -------------- | ------------ |
| Drag-lock      | 19.5 ± 13.6 min      | 8.0 ± 6.8 min  | p < 0.05     |
| Image carousel | 28.3 ± 7.6 min       | 14.7 ± 5.5 min | p < 0.01     |

Both about half the time. [READ, InterState, Evaluation]

**F13 — But the InterState baseline is raw JavaScript, not a state-machine
library.** The control condition was third-party JS simplified for fairness,
edited in a live editor (JSBin). The study shows a state-based _live visual_
environment beats callbacks. It does **not** show that a textual FSM library
beats callbacks, and it does not compare two FSM notations. Anyone citing this
as "FSMs are twice as fast" is overreading it. [READ, InterState, Method]

**F14 — InterState's readability claim is explicitly about scanning a
two-dimensional table.** Its notation lets programmers "see which events affect a
property by scanning the property's row and which properties an event affects by
looking at that event's column". The claimed comprehension benefit comes from
values living at the intersection of a row and a column — position, not depth.
[READ, InterState, Introduction]

**F15 — InterState's diagnosis of callback code is about execution order being
unpredictable.** For a 20-line expert-written drag-lock implementation, they note
it is compact but hard to follow, and that initiating a drag lock runs five
snippets in an order that is difficult to predict. The complaint is not verbosity
but that the _control flow is not visible in the source_. [READ, InterState,
Motivating Example]

**F16 — Their edit-locality claim is concrete and matches SwingStates' F7.**
Adding keyboard cancellation to drag-lock costs at least eight more lines plus
modifications to existing code in JavaScript, versus adding two transitions and
modifying nothing in InterState. Adding a per-state color costs five carefully
placed lines in JS versus filling three cells in InterState. [READ, InterState,
Motivating Example]

**F17 — InterState found a _debugging_ benefit that came from live value
display, not from the notation.** In the carousel task most JavaScript
participants missed an existing millisecond-countdown variable while most
InterState participants found it, "apparently by observing how its value changed
over time". [READ, InterState, Results]

## Design moves worth stealing

1. **Target as the last positional element of a transition, with an arrow-like
   marker** (SwingStates, F1/F2). Cost: pushes conditional target selection out
   of ordinary control flow, since a position can hold only one target.
2. **Omitted target means same-state** (SwingStates, F3). Cost: makes the
   same-state case syntactically _quieter_ than the change case, which is
   backwards if same-state updates are the common case in pointer machines
   (they are — see the Marking Menu case's three `move` handlers).
3. **A checked string-literal target** — the SwingStates notation without the
   SwingStates compromise (F4). Cost: string targets weaken go-to-definition
   compared with an identifier, though TS rename and completion do work on
   literal union members.
4. **Per-state data by scope rather than by declaration** (SwingStates, F10).
   Cost: gives up typestate in observed values, which is this project's core
   guarantee. Worth knowing as the cheap-authoring extreme of the spectrum.
5. **Two-dimensional layout where one axis is states** (InterState, F14). Cost:
   a table is only scannable while it fits; it degrades with wide payloads and
   long expressions, and Prettier will not maintain column alignment in
   TypeScript source.
6. **Judge candidates by edit locality on a named change, not by initial
   authoring** (both, F7/F16). This is directly usable as an evaluation task and
   already partly present in the repository's shared evaluation tasks.

## Traps, negative results, and things that failed

- **The small-machine regime is where FSM libraries lose.** F8 is a concession
  from the strongest FSM-toolkit advocates in the field. A library targeting 2-9
  state machines must beat callbacks on ceremony, not on capability.
- **A visual/live environment is a confound in every positive result.** Both
  SwingStates (runtime machine display) and InterState (live editor, animated
  transitions, highlighted active state) bundle tooling with notation. The
  measured wins may belong to the tooling. A pure-source library cannot assume
  it inherits them.
- **Unchecked target strings were accepted by practitioners.** SwingStates
  shipped and taught successfully with targets that Java could not verify. This
  is evidence that _reader-visible_ targets matter at least as much as
  _compiler-checked_ targets — an uncomfortable result for a project whose
  propositions optimize the second at the cost of the first.

## Disagreements and open questions in the literature

- Whether the benefit of state machines is expressiveness or edit locality.
  SwingStates argues locality explicitly (F7) and concedes compactness (F8).
- Whether measured wins transfer to a plain library with no dedicated editor.
  Unresolved by anything read here.
- Whether table-shaped notations survive real payload and guard complexity.
  InterState's cells are constraint expressions in a GUI, not TypeScript source
  under a formatter.

## Implications for a typestate FSM library for interaction techniques

1. **The arrow test has direct empirical backing.** The one FSM toolkit in this
   literature that was designed, shipped, and taught chose a fixed-position,
   visually marked target and documented that choice as intentional (F1/F2).
   The project's propositions do the opposite. This is now a supported
   criticism, not a preference.
2. **TypeScript can have what SwingStates gave up.** F4 is the note's key
   result: the string target was a Java workaround, not a design goal. A
   `'>> expert'`-style or plain `'expert'` literal target checked against the
   state-name union gets scannability _and_ static checking.
3. **Size the ceremony budget from F5, not from P0.2.** Real interaction
   machines in this literature are 2-9 states. The toggle case is not a
   pathological small case; it is near the middle of the real distribution.
4. **Same-state updates deserve first-class, cheap syntax.** F3 shows a notation
   where staying put costs nothing to write. In the Marking Menu case three of
   the seven behaviors are same-state stroke updates. Any design that makes
   `update` heavier than `change` is mis-weighted for this domain.
5. **Do not cite InterState as proof that FSMs beat callbacks** (F13). Its
   honest use here is narrower and still valuable: making control flow and
   per-state values _visible in one place_ halved task time against code where
   they were not.
