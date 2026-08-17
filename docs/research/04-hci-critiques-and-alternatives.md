# HCI: critiques of FSMs for interaction, and the alternatives that were proposed

> Research note. Evidence levels: [READ] full text, [ABSTRACT] abstract only,
> [SECONDARY] cited elsewhere.
>
> Tagging convention used here: [READ] means the PDF or source file was
> retrieved, converted, and read directly. [ABSTRACT] covers abstracts,
> publisher summaries, and pages read only through a fetch-and-summarise pass.
> [SECONDARY] means seen only cited elsewhere or standard material.
>
> This is the adversarial counterpart to note 03. Note 03 read the pro-FSM
> literature; this note attacks it, and where the attack fails, says so.

## Scope and questions asked

Note 03 established that HCI's best-evaluated FSM toolkit (SwingStates) and its
strongest quantitative result (InterState) both favour state-based notations.
This note asks the opposite questions:

1. Is "flat FSMs do not scale" true for interaction code, and what actually
   drives the growth when it happens?
2. Do discrete automata fit pointer input badly — dwell, velocity thresholds,
   hysteresis — and what did the people who said so build instead?
3. What do Petri nets (ICO/PetShop) model that FSMs cannot, and what does that
   cost to author?
4. Do dataflow, constraints, and FRP beat FSMs on their own terms?
5. Is there evidence that callbacks are actually fine, or actually bad?
6. Are event-stream grammars (Proton, Proton++) a better notation than
   machines, and are there numbers?
7. What is the substantive practitioner case against statechart libraries?

The final question the note has to answer: for a 2-20-state, single-pointer
interaction machine, which criticisms are **fatal**, which are **fixable by API
design**, and which alternatives **actually win**.

## Key sources

Peer-reviewed, read directly:

- Robert J. K. Jacob, Leonidas Deligiannidis and Stephen Morrison, "A software
  model and specification language for non-WIMP user interfaces", _ACM TOCHI_
  6(1), 1999, pp. 1-46, doi:10.1145/310641.310642.
  <https://www.cs.tufts.edu/~jacob/papers/tochi.pmiw.pdf> — [READ] full text.
- Kenrick Kin, Björn Hartmann, Tony DeRose and Maneesh Agrawala, "Proton:
  Multitouch Gestures as Regular Expressions", _CHI 2012_, pp. 2885-2894.
  <https://people.eecs.berkeley.edu/~bjoern/papers/kin-proton-chi2012.pdf> —
  [READ] full text.
- Kenrick Kin, Björn Hartmann, Tony DeRose and Maneesh Agrawala, "Proton++: A
  Customizable Declarative Multitouch Framework", _UIST 2012_,
  doi:10.1145/2380116.2380176.
  <https://people.eecs.berkeley.edu/~bjoern/papers/kin-protonplusplus-uist2012.pdf>
  — [READ] full text, including the user study.
- Hao Lü and Yang Li, "Gesture Coder: A Tool for Programming Multi-Touch
  Gestures by Demonstration", _CHI 2012_, pp. 2875-2884,
  doi:10.1145/2207676.2208693.
  <https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/38088.pdf>
  — [READ] full text.
- Christophe Scholliers, Lode Hoste, Beat Signer and Wolfgang De Meuter,
  "Midas: a declarative multi-touch interaction framework", _TEI 2011_.
  <https://beatsigner.com/publications/midas-a-declarative-multi-touch-interaction-framework.pdf>
  — [READ] full text; bibliographic details confirmed on dblp.
- Pierre Dragicevic and Jean-Daniel Fekete, "Input Device Selection and
  Interaction Configuration with ICON", _IHM-HCI 2001_, Lille.
  <https://inria.hal.science/hal-00877336/document> — [READ] full text.
- Brad A. Myers, "A New Model for Handling Input", _ACM TOIS_ 8(3), 1990,
  pp. 289-320.
  <https://www.cs.cmu.edu/~amulet/papers/p289-myers-TOIS-new-model.pdf> —
  [READ] full text.
- Stephen Oney, Brad Myers and Joel Brandt, "ConstraintJS: Programming
  Interactive Behaviors for the Web by Integrating Constraints and States",
  _UIST 2012_, pp. 229-238, doi:10.1145/2380116.2380146.
  <https://www.cs.cmu.edu/~NatProg/papers/UIST2012-oney-constraintJS-p229.pdf>
  — [READ] full text.
- Caroline Appert and Michel Beaudouin-Lafon, "SwingStates: Adding state
  machines to Java and the Swing toolkit", _Software: Practice and Experience_
  38(11), 2008. <https://www.lri.fr/~appert/website/papers/SwingStates-spe.pdf>
  — [READ]; **section 7 (composition and state explosion) was not covered by
  note 03** and is the source of several findings here.
- Ingo Maier, Tiark Rompf and Martin Odersky, "Deprecating the Observer
  Pattern", EPFL technical report EPFL-REPORT-148043, 2010.
  <https://infoscience.epfl.ch/> — [READ] full text. (Later version: Maier and
  Odersky, "Deprecating the Observer Pattern with Scala.React",
  EPFL-REPORT-176887.)
- Frolin S. Ocariza Jr., Kartik Bajaj, Karthik Pattabiraman and Ali Mesbah, "An
  Empirical Study of Client-Side JavaScript Bugs", _ESEM 2013_.
  <https://people.ece.ubc.ca/~frolino/docs/js_bugs_study_paper.pdf> — [READ]
  full text.

Peer-reviewed, abstract or summary only:

- Hao Lü and Yang Li, "Gesture Studio: Authoring Multi-Touch Interactions
  through Demonstration and Declaration", _CHI 2013_, pp. 257-266,
  doi:10.1145/2470654.2470690 — [ABSTRACT].
- David Navarre, Philippe Palanque, Jean-François Ladry and Eric Barboni,
  "ICOs: A model-based user interface description technique dedicated to
  interactive systems addressing usability, reliability and scalability", _ACM
  TOCHI_ 16(4), 2009, article 18, doi:10.1145/1614390.1614393 — [ABSTRACT].
- IRIT ICS team, PetShop / ICO formalism documentation,
  <https://www.irit.fr/recherches/ICS/softwares/petshop/ico.html> —
  [ABSTRACT], engineering documentation.
- Célia Martinie et al., "Engineering Annotations: A Generic Framework For
  Gluing Design Artefacts in Models of Interactive Systems", arXiv:2205.01333 —
  [READ]; used only for its worked description of an ICO/PetShop model.
- Werner A. König, Roman Rädle and Harald Reiterer, "Squidy: A Zoomable Design
  Environment for Natural User Interfaces", _CHI EA 2009_,
  doi:10.1145/1520340.1520700 — [ABSTRACT].
- Evan Czaplicki and Stephen Chong, "Asynchronous Functional Reactive
  Programming for GUIs", _PLDI 2013_, doi:10.1145/2491956.2462161 —
  [ABSTRACT].
- Julia Schwarz, Scott Hudson, Jennifer Mankoff and Andrew D. Wilson, "A
  framework for robust and flexible handling of inputs with uncertainty", _UIST
  2010_ — [ABSTRACT]; and Schwarz, Hudson, Mankoff and Wilson, "Optimistic
  Programming of Touch Interaction", _ACM TOCHI_ 21(4), 2014,
  doi:10.1145/2631914 — [ABSTRACT].
- William Buxton, "A three-state model of graphical input", _INTERACT 1990_ —
  [ABSTRACT], read through a fetch-and-summarise pass of
  <https://www.dgp.toronto.edu/OTP/papers/bill.buxton/3state.html>.
- Frédéric Bevilacqua, Bruno Zamborlin, Anthony Sypniewski, Norbert Schnell and
  Fabrice Guédy, "Continuous Realtime Gesture Following and Recognition", LNCS
  5934, 2010, pp. 73-84 — [ABSTRACT]. Extended as Bevilacqua et al., "Fluid
  gesture interaction design", _ACM TiiS_ 3(4), 2013, doi:10.1145/2543921 —
  [ABSTRACT].
- Conal Elliott and Paul Hudak, "Functional Reactive Animation", _ICFP 1997_ —
  [SECONDARY], canonical.
- Henrik Nilsson, Antony Courtney and John Peterson, "Functional reactive
  programming, continued", _Haskell Workshop 2002_, pp. 51-64,
  doi:10.1145/581690.581695 — [SECONDARY].
- Dan R. Olsen Jr., "Larger issues in user interface management", _Computer
  Graphics_ 22(2), 1987, pp. 134-137 — [SECONDARY], cited by Myers 1990 as the
  source of the claim that transition networks were unpopular with designers.
- Sean Parent, "A possible future of software development", Google Tech Talk,
  2008 — [SECONDARY], cited by Maier et al. as the origin of the "1/3 of the
  code, 1/2 of the bugs" figures. **Not a study.**

Opinion and engineering documentation (labelled as such throughout):

- Evan Czaplicki, "A Farewell to FRP", elm-lang.org, 10 May 2016.
  <https://elm-lang.org/news/farewell-to-frp> — [READ] (source markdown).
- David Khourshid, "You don't need a library for state machines",
  stately.ai / dev.to, 20 January 2021 — [ABSTRACT].
- statecharts.dev, "If statecharts are so great, why aren't they used more
  widely?" — [ABSTRACT].
- Hacker News thread on XState, item 35328995 (2023) — [ABSTRACT], individual
  practitioner comments.
- RxJS drag-and-drop idiom, multiple tutorials — [ABSTRACT], engineering
  practice.

## Findings

**F1 — The most authoritative critique of FSMs for interaction is a
self-critique by the person who gave HCI its FSM specification language.**
Robert Jacob wrote the 1986 _ACM TOG_ state-transition specification language
for direct-manipulation interfaces (note 03 lists it as unretrieved). Thirteen
years later, Jacob, Deligiannidis and Morrison argue that discrete,
token-stream models — including his own — do not fit continuous interaction,
and propose PMIW: a **hybrid** of a dataflow/constraint component for
continuous relationships and an event component for discrete ones. Their thesis
is that "the essence of a non-WIMP dialogue is a set of continuous
relationships", most of them temporary. [READ, PMIW §1.3]

Non-obvious because the pro-FSM canon and the anti-FSM canon share an author.
The critique is not that machines are wrong; it is that machines alone quantise
something the user experiences as continuous.

**F2 — PMIW's integration mechanism is exactly "effects scoped to state
residency", published in 1999.** Each state of the discrete component may own an
entire dataflow graph; entering the state begins executing that graph, and it
runs until the machine leaves. The paper calls the resulting picture a set of
transitions between whole dataflow graphs. [READ, PMIW §3 and §4]

This is a peer-reviewed precedent for the project's "effects belong to state
residency" position, and for automatic teardown on exit. The paper is explicit
that this is shorthand for enable/disable actions — that is, it is _sugar_, and
the honest framing of residency-scoped effects is sugar over enter/exit, not a
new primitive.

**F3 — Jacob's mismatch list is five specific items, and a single-pointer
technique violates at most two of them.** The paper contrasts current with
non-WIMP interfaces on: single-thread vs parallel dialogues; discrete tokens vs
continuous input; precise vs probabilistic tokens; sequence-is-meaningful vs
real-time deadlines; explicit commands vs passive monitoring. [READ, PMIW §1.2]

For a mouse/pen Marking Menu: input is single-threaded, tokens are precise,
interaction is command-driven. Only "continuous input" and (weakly) "real-time
deadlines" apply. **The classic HCI case against FSMs is scoped to
multi-stream, recognition-based, and VR interaction, and the project's scope
sits outside most of it.** This is the single most important scoping result in
the note.

**F4 — PMIW's criterion for choosing a model is perspicuity, not
expressiveness, and it says so twice.** The paper states that describing the
whole interface in purely continuous or purely discrete terms would be entirely
possible but inappropriate: a key press _could_ be modelled continuously, but
the user's model of it is discrete; a drag _could_ be modelled as discrete
motion events, but the user's model of it is a continuous gesture. It also says
the real problem is not to find _some_ way to describe the interface — nearly
any programming language could — but to find one that captures the user's view.
[READ, PMIW §1.2 and §3.1]

This is direct literature support for the project's objective function. The
field's own answer to "why not just write it in the host language" is
readability, not power.

**F5 — The SwingStates authors state flatly that state explosion is not a
problem for a single interaction technique.** Verbatim: "state explosion is not
an issue when the state machine describes a single interaction". They locate the
problem elsewhere — combining machines for _several_ techniques into one, or
adding visual feedback across techniques. [READ, SwingStates §7 preamble]

This is stronger evidence for note 01's flatness position than note 01 has, and
it comes from the same paper note 03 relied on. It also **refines** the claim:
the driver is composition, not machine size. Note 01, F3 attributes explosion to
Harel's shared-event and orthogonality patterns; SwingStates' field experience
says the orthogonality half is the one that bites.

**F6 — SwingStates can nest a machine inside a state and reports finding no
compelling user-interface example of doing so.** The paper notes the capability
exists, reproducing StateCharts' basic hierarchical construct, and then declines
to describe the pattern for want of examples. [READ, SwingStates §7.1]

A negative result on hierarchy from a toolkit that shipped, was taught, and was
used to reimplement eight published interaction techniques.

**F7 — SwingStates' answer to composition is three named patterns, none of them
hierarchy, and the worked example is a Marking Menu.** [READ, SwingStates
§7.1-7.4]

| Pattern            | Mechanism                                                                                                                           | What it replaces       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Stacking           | machine per abstraction level: device events → input events → command events; each machine emits events the next consumes           | ad-hoc event synthesis |
| Shared transitions | `State` is a Java class; a `ControlState` subclass carries the common transition, and several states are declared as `ControlState` | Harel super-states     |
| Parallel machines  | any number of machines attached to the same component, dispatched sequentially by one thread, communicating by events               | AND/orthogonal states  |

Their Figure 20 runs **three** machines in parallel for a menu system: one for a
linear menu, one for a Marking Menu, one that highlights whatever item the
cursor is over. They observe the explosion here would be manageable anyway
because the machines are small, and argue for the split on modularity grounds:
adding a menu type, changing the highlight to an animation, or adding tooltips
each touch one machine. [READ, SwingStates §7.4]

**The project's acceptance case folds recognition and feedback into one
machine. The field's reference implementation of the same technique does not.**

**F8 — ConstraintJS supplies the missing number for the orthogonality
argument, from a plain widget.** A radio button's appearance depends on three
independent aspects: keyboard focus (2), checked (2), and mouse phase (idle /
hover / down / down-and-outside = 4). Combined into one diagram that is
2 × 2 × 4 = 16 states, many of them semantically meaningless (mouse pressed and
outside, with keyboard focus, and checked). Their answer, like SwingStates', is
several independent FSMs enabling and disabling constraints — not nesting.
[READ, ConstraintJS, Contributions]

Two independent labs, six years apart, converge on parallel small machines. That
is as close to consensus as this literature gets.

**F9 — ConstraintJS's FSM notation puts the target at the last positional
argument of `add_transition`, as a string, in JavaScript.**

```js
cjs
	.fsm()
	.add_state('idle')
	.add_transition(cjs.on('mouseover', block_a), 'myhover')
	.add_state('myhover')
	.add_transition(cjs.on('mouseout', block_a), 'idle')
	.starts_at('idle')
```

Source state is positional-by-chaining ("creates a transition from the last
state added"), input is argument 1, target is argument 2. It also binds
per-state _values_ through a state-keyed literal:
`block_a.css("background-color", fsm, { idle: "black", myhover: hex })`.
[READ, ConstraintJS, FSM section]

Two transferable points: the arrow test survives a real JS library from Myers'
lab; and a **state-keyed map of values** is a second use of the state name as a
key, distinct from the behaviour map. Note 03's F14 (InterState's row/column
scanning) is the two-dimensional version of the same idea.

**F10 — Proton's argument is not that regular expressions beat state machines.
It is that hand-managed state spread across callbacks loses to any declarative
formalism, plus one thing FSM libraries do not offer: static conflict
detection.** Proton's own related work notes that regular expressions describe
regular languages and finite state machines accept them, and cites Gesture Coder
as recognising gestures with state machines "equivalent to regular expressions".
The stated benefits are (a) the framework manages gesture state so the developer
writes one callback instead of one per touch event, and (b) the gesture set can
be statically analysed for conflicts by intersecting expressions. [READ, Proton,
Related Work and Conclusion]

Non-obvious: the second benefit has no analogue in any FSM library surveyed by
this project, and it is _cheap_ for a deterministic machine set — Proton
computes longest common prefixes and regex intersections over the gesture set.

**F11 — Proton++ is the field's cleanest comprehension comparison of a
declarative notation against callbacks, and the numbers are large.** 12
experienced programmers (10 male, 2 female, 20-51), within-subject, six
orderings counterbalanced across participants, three representations: graphical
gesture tablature, textual gesture regular expression, iOS-style event-handling
pseudocode. Task: read a gesture description and identify which of nine videos
(part 1) or four trajectory images (part 2) it matches. Video-playing time was
subtracted. [READ, Proton++, User Study]

| Task                    | Tablature | Expression | iOS callbacks | Test                      |
| ----------------------- | --------- | ---------- | ------------- | ------------------------- |
| Part 1, event sequences | 23.50 s   | 49.25 s    | 110.99 s      | F(2,22) = 55.37, p < .001 |
| Part 2, trajectories    | 17.82 s   | 35.49 s    | 75.29 s       | F(2,22) = 21.30, p < .001 |

All pairwise comparisons significant (Bonferroni-corrected in part 1). Accuracy
100 / 93.3 / 95 % in part 1 (n.s.), 100 % everywhere in part 2. Post-study
comprehension Likert (1 easiest, 5 hardest): 1.33 / 2.92 / 4.13, Kruskal-Wallis
H = 26.4, 2 df, p < .001, all pairwise Mann-Whitney significant. 11 of 12
preferred tablature; the twelfth preferred expressions.

**F12 — F11 contradicts note 03's F8 in the way that matters, and confirms it in
the way that does not.** SwingStates conceded that event handlers are _more
compact_ for interfaces with few states. Proton++ measured _comprehension_ on
gestures of one to three touches — the small-machine regime — and callbacks were
2.3 times slower than a one-line regex and 4.7 times slower than the graphical
notation. **Compactness and comprehensibility came apart.** A structured
notation may cost lines and still be read twice as fast.

That is a licence to spend lines on structure. It is not a licence to spend
lines on ceremony: the thing being read faster was the _description of the
gesture_, not a type declaration.

**F13 — The same study's qualitative results are a warning about textual
declarative notations specifically.** Participants liked tablature because
temporal order was obvious and they could mime the touches while reading. They
saw the same benefit in the regular expressions but worried that "complexity of
the expressions could easily explode". About callbacks they complained of
"too much jumping around the code" and "mental book-keeping", but noted direct
event access made callbacks more flexible. [READ, Proton++, Qualitative
Results]

Half the measured win belonged to the _graphical_ representation, which a
source-only library cannot have. The honest expectation for a text notation is
the expression-vs-callbacks gap, roughly 2x, not the tablature gap.

**F14 — Proton++ encodes a 1/3-second dwell as ten literal move symbols, and
uses it to build a Marking Menu.** To get timing into a regular language,
Proton++ constrains the stream generator to emit touch events at a fixed 1/30 s
interval, so each move symbol _is_ a time unit and a run of k symbols is k/30
seconds. A shorthand `(M...)^{t1 t2}` expands to t1 consecutive symbols, or to a
disjunction of t1..t2 consecutive symbols. Their novice Marking Menu displays
the items when the user holds for 1/3 s, expressed as a sequence of ten
touch-move symbols with the menu-drawing callback attached to the tenth. [READ,
Proton++, Timing]

**This is the strongest single piece of evidence in the note for the project's
current direction.** The grammar alternative to a timer is a literal run of ten
symbols, a rate coupling between the input pipeline and the notation, and a
`(M)^{1 5}` disjunction to tolerate a 1/6 s slop window on an L-shaped turn. A
named timer owned by a state, cancelled by leaving the state, is dramatically
cheaper for exactly the acceptance case the project chose.

**F15 — Regular-expression notations do not remove thresholds and hysteresis;
they freeze them into the alphabet.** Proton++'s direction attribute takes the
last two touch positions and bins the vector into four cardinal directions; a
separate `O` symbol is generated when the touch has not moved beyond a distance
threshold (their implementation: 5 pixels). Only after that quantisation can the
gesture be a regular expression. [READ, Proton++, Attributes]

Non-obvious consequence: **the choice is not "guards or no guards" but "guards
where the reader can see them or thresholds compiled into the token stream".**
An FSM library that keeps `dist > 20` as an ordinary TypeScript expression in a
guard keeps the tuning parameter local, inspectable, and per-transition. Proton
pays for static analysis with a global, fixed quantisation.

**F16 — Gesture Coder is the strongest empirical threat to any hand-authored
FSM library, and it comes with two large caveats.** 8 professional programmers
(all male, 20-50, mean 30), familiar with Java, Eclipse and Android;
within-subject, counterbalanced; 45 minutes per condition; task was a realistic
5-gesture drawing or map application. **All finished with Gesture Coder in a
mean of 20 minutes (sd 6). None finished within 45 minutes without it.** The
authors state that implementing such a model manually is "time-consuming and
error-prone", an assertion they say the study confirmed. [READ, Gesture Coder,
Evaluation]

Caveats: the baseline is raw Android touch callbacks, not an FSM library — the
same confound note 03's F13 identifies in InterState; and the task is five
_concurrent multi-touch_ gestures, the regime F5 and F8 identify as the one that
actually explodes. The result does not transfer to one single-pointer technique.

Their position is worth stating precisely: **the state machine is the right
target representation and the wrong authoring artifact.** Gesture Coder learns
the machine from demonstrations and emits Java. Gesture Studio (CHI 2013) later
combined demonstration with declaration for composite behaviours. [ABSTRACT]

**F17 — Gesture Coder's states are finger-configuration sets, which is where
interaction state explosion actually comes from.** A state is a set of touch
indices ({}, {1}, {1,2}, ...), transitions are +i and -i (finger lands, finger
lifts) plus `move` and `timeout`, and each state additionally carries the **set
of gestures still possible** at that point. Two-finger pan and pinch share an
identical event sequence, so they are separated by a decision tree over motion
features evaluated at the two-finger state. [READ, Gesture Coder, Model]

Two transferable observations. First, the combinatorics come from _concurrent
independent streams_, and single-pointer interaction has none — the project's
scope dodges the real driver. Second, "state = the set of live hypotheses" is a
genuinely different design, and it is what conflict/ambiguity handling looks
like when it is done properly.

**F18 — Midas is the "no state at all" extreme, and it has nothing to offer a
typestate design.** Gestures are logical rules over a fact base of timestamped
cursor facts, matched by a Rete engine (Jess), with temporal, spatial and motion
operators, a `ListOf` construct for windowing, numeric priorities for conflict
resolution, and shadow facts that reify GUI objects into the rule base. A flick
is one rule: at least 5 same-id cursor events within 500 ms, moving left.
[READ, Midas, Listings 6-7]

There is no current state, so there is nothing to attach capabilities or
state-specific data to. Proton's criticism of this family is that without an
underlying formalism, conflicts can only be found by runtime testing. Midas'
own diagnosis of callbacks matches everyone else's: control flow driven by
events rather than by lexical scope. [READ, Midas, Discussion]

**F19 — Petri nets buy true concurrency, typed tokens, and resource arcs — and
they destroy the typestate premise while doing it.** In ICO, places are state
variables holding tokens, transitions carry code, arc weights consume specified
token quantities, and the locality of enabling and firing gives genuinely
concurrent behaviour rather than interleaved transitions. [ABSTRACT, PetShop/ICO
documentation]

The deep point: **the state of a Petri net is a marking — a distribution of
tokens over places — not a place.** Typestate as this project defines it
("knowing the current control state statically gives you that state's data and
capabilities") is only well-posed when the marking is a single token in a single
place. That is exactly the single-pointer case. It is exactly not the
multi-touch case.

**F20 — Concrete ICO authoring cost, from a worked cockpit example.** The WXR
weather-radar panel — five radio buttons, four buttons and a text field —
requires _two_ Petri nets: one where the current selection is an integer carried
in a token, modified by transitions through variables on the incoming and
outgoing arcs (e.g. `new_ms = 3`); one for the tilt angle with
`switchManual_T1` / `switchStabOff_T1` transitions and three guard transitions
`angleIsLow` / `angleIsCorrect` / `angleIsHigh`. [READ, arXiv:2205.01333, §5]

That is a fully formal, executable, verifiable model of a widget group, in a
graphical notation, with data threaded through arc variables. It is also
obviously more machinery than a TypeScript library should aspire to for a
three-state pointer machine.

**F21 — The SwingStates authors reject both statecharts and Petri nets on
learnability grounds, from experience.** They write that statecharts are
significantly more complicated and harder to learn than plain state machines and
that in their experience designers and developers have difficulty exploiting
their power; and that Petri nets, as used in PetShop, have a steep learning
curve that makes developer adoption difficult. [READ, SwingStates §7 preamble]

Toolkit-builder judgement rather than measurement, but from people who read
both literatures and taught the result to students.

**F22 — Dataflow has no comprehension evidence at all, and its own authors say
so.** ICON is a dataflow editor whose semantics are borrowed from the
synchronous reactive languages Lustre and Esterel: modules are like digital
circuits, connections like wires, values propagate on clock ticks. It gives up
run-time-created modules and recursion on purpose. Its interpreter is 4000
lines. On readability the authors say plainly that they "haven't conducted
experiments",
that configurations _seem_ readable at the sizes they tried, and that for larger
configurations a textual form might be better for some users. [READ, ICON,
Expressive Power / Practicality]

Squidy, the later zoomable dataflow environment, targets designers "with less or
no programming experience" through a pipe-and-filter metaphor and semantic
zooming. [ABSTRACT] Neither line produced a controlled comparison. Against
Proton++ (F11) and InterState (note 03, F12), the dataflow branch is
evidence-free.

**F23 — Jacob, ICON, ConstraintJS and PMIW all converge on the same division of
labour, and it is not "dataflow instead of machines".** PMIW: dataflow for
continuous relationships, events to enable and disable them. ICON: dataflow for
input plumbing, application semantics elsewhere. ConstraintJS: constraints for
values, FSMs to decide which constraints hold. Navarre, Palanque, Dragicevic and
Bastide even built a combined toolchain wiring ICON's dataflow into ICO's Petri
nets. [READ / ABSTRACT across those sources]

**Nobody in this literature proposes replacing the machine.** They propose
pairing it with something that handles values. The recurring shape is: _the
machine selects which continuous relationships are live_.

**F24 — The strongest non-HCI charge sheet against callbacks is also a strong
argument for state machines — and its authors still do not build one.** Maier,
Rompf and Odersky list eight software-engineering principles the observer
pattern violates, and their first is exactly the FSM argument: because
"observers are stateless, we often need several of them to simulate a state
machine", forcing the state (`var path`) into a scope shared by all of them,
which then breaks encapsulation. Their other named violations: composability,
separation of concerns, scalability (glitches from inconsistent update order),
uniformity, abstraction, resource management (install/uninstall the move
observer by hand), and semantic distance from inverted control flow. [READ,
Deprecating the Observer Pattern §1]

Their fix is **not** an FSM. It is un-inverting the control flow with a
continuation-based reactor:

```scala
Reactor.once { self =>
  val path = new Path((self next mouseDown).position)
  self loopUntil mouseUp {
    val m = self next mouseMove
    path.lineTo(m.position)
  }
  ...
}
```

They say explicitly that the ideal is to directly encode a state machine
described informally in three sequential steps. **The competitor here is not
another notation for machines; it is sequential code that has states as program
points.** In today's JavaScript this is `async`/`await`, async generators, and
`AbortController`, and it is the same shape as the RxJS drag idiom
`mouseDown.switchMap(() => mouseMove.takeUntil(mouseUp))` that every RxJS
tutorial teaches. [ABSTRACT, engineering practice]

**F25 — The industry numbers everyone quotes for event-handling cost are a
slide, not a study.** The "1/3 of the code in Adobe's desktop applications is
devoted to event handling, 1/2 of the bugs reported in a product cycle are in
that code" figures come from Sean Parent's 2008 Google talk, quoted by Maier et
al. [READ, Deprecating the Observer Pattern §1; SECONDARY for Parent]

Cite it as industrial testimony or not at all.

**F26 — The best empirical study of real client-side JavaScript bugs does not
support the "callbacks cause state bugs" story.** 317 bug reports from 12
repositories, manually classified by cause and consequence: 65% of JavaScript
faults are DOM-related; about 74% fall into the "Incorrect Method Parameter"
category (an unexpected or invalid value passed to a native method), of which
88% are DOM-related; 56% are code-terminating. [READ, Ocariza et al., Results]

The taxonomy has **no category** for state-management or event-sequencing
faults. That is not proof they do not exist — the classification was built
bottom-up from what the reports said — but it means the defect-rate argument for
state machines has no measurement behind it in the JS ecosystem. Comprehension
and edit locality do (Proton++, InterState, Sunshine et al. in note 09). Defect
rate does not.

**F27 — Elm removed FRP signals from the language, for learnability, three
years after publishing them at PLDI.** Czaplicki and Chong's PLDI 2013 paper
made `Signal τ` the central abstraction. Elm 0.17 (10 May 2016) replaced
signals,
addresses and ports with subscriptions and commands. Czaplicki's stated reason
is not performance or expressiveness: signals "are one of the few stumbling
blocks left", they made Elm easier than its peers but did not make it easy, and
the `start-app` experiment of pushing signals later in the learning path made
people get started quicker and get further. He estimates about 95% of user code
was unchanged by the removal. [READ, "A Farewell to FRP"; ABSTRACT, PLDI 2013]

A language whose explicit design objective is ease of use deleted its signature
reactive abstraction because it was the hardest thing left to teach. That is the
project's objective function, applied by someone who paid the cost.

**F28 — Even Elm's signals were discrete.** A signal in Elm changes only when a
discrete event occurs. [ABSTRACT, PLDI 2013] Continuous-time FRP in the Elliott
and Hudak sense did not survive contact with GUI programming; the arrowized
successor line (Nilsson, Courtney and Peterson) exists in large part to control
the space and time leaks of the original formulation. [SECONDARY]

**F29 — HCI's most-cited state machine was never meant to be executed.**
Buxton's three-state model — 0 out of range, 1 tracking, 2 dragging — is
offered as a vocabulary for matching input devices to the interaction techniques
they afford, not as an implementation notation, and Buxton notes it does not
cope with pressure-sensing transducers. [ABSTRACT]

Worth knowing because "HCI has always modelled input as a state machine" is
usually supported by citing Buxton, and Buxton was doing device taxonomy.

**F30 — Garnet's answer to input was to delete the machine from the API
entirely, and it worked for widgets and stopped at gestures.** All Garnet
Interactors run _the same_ fixed machine handling start, stop, abort, and
suspend-while-outside; the parameters decide which events cause the transitions,
and Myers states that unlike transition-network UIMSs the designer does not deal
with this machine at all. Different Interactors run their machines in parallel,
which is how Garnet gets concurrency. Myers dismisses transition networks, event
languages and multiple-process models in one sentence: "these have proven
difficult to use and unpopular with user interface designers", citing Olsen 1987. [READ, Myers 1990 §2 and §6.6]

His own honest classification of technique difficulty in Garnet is the payoff.
Techniques needing only slot values: menus, radio buttons, check boxes, moving
and growing objects, scrollbars. Techniques needing custom action procedures:
pull-down submenus, gridding, gravity. Techniques needing **a new Interactor
type**: gesture recognition, character recognition, new hardware. Outside
Garnet's range: sophisticated text editing. [READ, Myers 1990 §7]

**A fixed library of pre-built machines covers the widget 80% and fails exactly
at the Marking Menu end of the spectrum.** That is the design space this project
sits in, and it is the reason a general machine abstraction has to exist at all.

**F31 — The uncertainty line argues that a single deterministic current state
is the wrong model for recognition-based input.** Schwarz, Hudson, Mankoff and
Wilson's framework keeps multiple interpretations of input alive, with
interactors receiving probabilistic events and a mediator resolving them; the
later Monte Carlo and "Optimistic Programming of Touch Interaction" work
maintains a probabilistically accurate description of the interface state, with
speculative execution and rollback. [ABSTRACT] Proton borrows the scoring idea:
its gesture picker defers callbacks and applies the highest-confidence
interpretation, and it warns developers that trigger callbacks fired on
prefix matches may need to be undone. [READ, Proton, Conflict Resolution]

Relevant to touch and pen. For mouse and pen-with-button on a Marking Menu, the
events are certain and this criticism does not bite. It does explain why every
multitouch system in this note has an explicit conflict-resolution story and no
JS FSM library does.

**F32 — Bevilacqua et al. attack discreteness one level lower: gesture
recognition itself should be continuous.** Their argument is that gestures are
normally treated as units recognised once completed, with output at discrete
time events, and they instead output — continuously, on a fine temporal grain —
parameters characterising the gesture in progress, including likelihood and time
progression, enabling feedback synchronised to a partially performed gesture.
[ABSTRACT, GW 2009 / LNCS 5934 and TiiS 2013]

Relevant to the Marking Menu: the novice/expert transition is exactly a
"how far into the gesture are you" question. A machine answers it with a state
plus accumulated data; continuous following answers it with a scalar.

**F33 — The substantive practitioner case is not about verbosity, and XState's
own author made the strongest version of it.** David Khourshid's January 2021
post shows a finite state machine as an object literal plus a ~10-line
`transition(state, event)` function, and draws the line at _statecharts_ —
hierarchy, parallel states, history, guards, extended context, entry/exit
actions — as the point where a library earns its place. [ABSTRACT]

Independent practitioner complaints in the 2023 HN thread cluster on TypeScript
friction ("hoops to jump through for good typescript support"; codegen
"sometimes pretty bad for TS"), on composition (commenter _brigadier132_: the
story for composing multiple machines "is not good"), and on cost/benefit
(commenter _sanitycheck_ rebuilt a video-player FSM "in about 80 lines of
typescript" in less time than finishing the docs). [ABSTRACT, opinion]

Note the overlap with F7/F8: composition of multiple machines is both what the
research says is the real problem and what practitioners say the leading library
does worst.

**F34 — statecharts.dev's own explanation of non-adoption names the real
competitor, and it is not another library.** Its FAQ attributes low adoption to
the instinct to build "the simplest thing that could possibly work", to YAGNI
letting complexity creep in one boolean at a time, and to a perception that UI
construction is easy. [ABSTRACT, advocacy site]

The competitor at 2-3 states is `useState` plus a boolean. A library that only
wins at 10 states will never be adopted, because nobody starts at 10 states.

## Design moves worth stealing

1. **State owns a set of continuous relationships, enabled on entry and
   disabled on exit** (PMIW, F2). Precedent for residency-scoped effects, in
   1999, in a peer-reviewed venue. Cost: it is sugar over enter/exit, and the
   paper says so; do not sell it as a new primitive.
2. **Parallel machines as the composition primitive, with event
   communication and a strictly sequential execution model** (SwingStates §7.4,
   F7; ConstraintJS, F8). Cost: two machines can act on the same object;
   SwingStates' response was a runtime visualiser rather than a constraint,
   which is an admission that the API cannot prevent it.
3. **Stacked machines as transducers**: device events → input events → command
   events, each level a machine that emits what the next consumes (SwingStates
   §7.2, F7). Cost: an event vocabulary per level, and a decision about whether
   a machine's outputs are typed.
4. **Shared transitions by declaring several states to be instances of a
   common shape** (SwingStates §7.3, F7). In TypeScript this is spreading a
   shared handler object into several state entries, or a `shared:` block, and
   it is strictly cheaper than a super-state. Cost: it must not break the
   per-state data types, which is the whole difficulty.
5. **State-keyed value maps as a second use of the state name** (ConstraintJS,
   F9): `css("color", fsm, { idle: "black", hover: hex })`. Rendering and
   feedback keyed by state, outside the transition table. Cost: it duplicates
   the state vocabulary at a third site unless the map is inferred from the
   machine's type.
6. **Static conflict detection over the machine set** (Proton, F10). For
   deterministic machines this is cheap, and no JS FSM library offers it. The
   interesting version for this project is not intra-machine (determinism is
   already structural, note 01 F10) but _inter-machine_: two parallel machines
   both consuming `pointerdown`. Cost: needs the topology to be data, which is
   the same requirement the arrow test imposes.
7. **State carries the set of still-possible outcomes** (Gesture Coder, F17).
   Useful even single-pointer: `startup` in the Marking Menu is exactly "novice
   and expert are both still live".
8. **Un-inverted control flow as the readability benchmark** (Maier et al.,
   F24). Even if the project does not adopt coroutines, the three-line informal
   description of drag is the standard any notation should be measured against.

## Traps, negative results, and things that failed

- **Hierarchy in interaction toolkits.** SwingStates implemented it and found no
  compelling UI example (F6). ConstraintJS reached for parallel machines instead
  (F8). SwingStates' stated reason for avoiding statecharts is learnability, not
  purity (F21). Note 01's F4/F5 supplies the semantic reason. Three independent
  arguments, one conclusion.
- **Time in a grammar.** Proton++ needed a 30 Hz stream and ten literal symbols
  for a 1/3-second hold (F14). Any notation that tries to absorb duration into
  the transition syntax will re-derive this.
- **Continuous-time FRP for GUIs.** Elm's signals were discrete from the start
  (F28) and were removed for learnability in 2016 (F27). Classic FRP's leaks
  drove the arrowized reformulation (F28). This is a forty-year-old idea with a
  documented retreat.
- **Dataflow readability.** ICON's authors declined to claim it and suggested a
  textual form might read better at size (F22). Squidy targeted non-programmers.
  No controlled evidence exists in this branch.
- **A fixed library of built-in machines.** Garnet's Interactors covered widgets
  with parameter values and required a new Interactor type for gesture
  recognition (F30). Predefined recognisers are also what Proton, Midas and
  Gesture Coder each cite as the state of the art they are escaping.
- **Hand-authored machines for concurrent multitouch.** Eight professionals,
  none finished in 45 minutes (F16). If the project ever extends to multi-touch,
  this is the result to beat and there is no reason to think it can.
- **The defect-rate argument.** Not supported by the best empirical study of
  client-side JS bugs (F26), and the industry figure everyone quotes is a slide
  (F25). Do not build the pitch on it.
- **Assuming a text notation inherits a graphical notation's win.** Half of
  Proton++'s measured advantage was tablature over expressions (F11, F13); both
  SwingStates and InterState bundle a live visualiser (note 03).

## Disagreements and open questions in the literature

- **Is the state machine an authoring artifact or a compilation target?**
  SwingStates, InterState and ConstraintJS say authoring. Gesture Coder and
  Gesture Studio say target, and have the only study where hand-authoring failed
  outright (F16). The two camps never tested the same task.
- **Where does explosion come from?** Harel says shared events and orthogonal
  aspects (note 01, F3). SwingStates' field experience says composition of
  techniques and cross-technique feedback (F5). ConstraintJS says independent
  visual aspects of a single widget (F8). These are compatible but weight the
  problem very differently, and only the SwingStates version is about machines
  a person actually wrote.
- **Discrete or continuous first?** PMIW says model both explicitly and connect
  them (F1-F4). Proton says quantise everything into an alphabet and get static
  analysis (F15). Bevilacqua says do not discretise the recognition at all
  (F32). No one has compared them on the same technique.
- **Does typestate even make sense for interaction?** It is well-posed for a
  single pointer and ill-posed for a Petri-net marking (F19) or a probability
  distribution over interpretations (F31). Nobody in HCI has framed the question
  this way, which is either an opportunity or a warning.
- **Is un-inverted sequential code better than any machine notation?** Maier et
  al. assert it (F24) and demonstrate it on drag; nobody has measured it against
  a state machine on a technique with cancellation, a timer race, and three
  outcomes.

## Implications for a typestate FSM library for interaction techniques

**1. No criticism in this literature is fatal at the project's declared scope,
and the reason is precise enough to publish.** The three genuinely fatal
objections are: true concurrency, which makes "the current state" a marking
rather than a place (F19); probabilistic input, which makes it a distribution
(F31); and continuous-first dynamics, which makes discretisation the wrong first
move (F1, F32). All three bite at multi-touch, recognition, and VR. None bites
at
a single pointer with certain events and a dwell timer. **The library should
state this boundary as a design position rather than discover it later**: one
input stream, certain events, one current state. That is what makes typestate
well-posed, and it is exactly the Marking Menu.

**2. The one criticism that is fatal if ignored is composition, and the field is
unanimous about the answer.** SwingStates (F5, F7), ConstraintJS (F8) and
Proton++ (stream splitting for simultaneous gestures) independently concluded
that the way to handle multiple concurrent behaviours is **several small
machines running in parallel with light communication**, never hierarchy. The
2023 practitioner complaints converge on the same gap in XState (F33).

`requirements.md`'s P2.9, "reuse behaviour shared by several states", is the
wrong axis. The missing axis is machine composition, and it has three concrete
shapes with prior art: stacking (a machine consumes device events and emits
input events for the next machine), shared transition blocks, and parallel
attachment to the same event source. **If the design makes it awkward to run two
machines side by side and feed one's output into the other, it has failed at the
one thing three independent systems agree matters.**

**3. The acceptance case may be specified wrong, and SwingStates says how.**
Their Marking Menu is three parallel machines: linear menu, marking menu, and
item highlighting (F7). The project's reduced Marking Menu folds recognition,
timing and feedback into one machine. Re-specify it as at least _recognition
machine + feedback machine_ and check whether the API supports that split at
all. If it does not, that is a finding about the API, not about the case.

**4. Keep timers as state-owned resources. Do not let them into the transition
notation.** F14 is decisive: the declarative alternative to a cancellable state
timer is ten literal symbols at a fixed sample rate. This is direct evidence for
the `gen_statem`-style position already reached in note 08/note 10 — a state
timeout cancelled automatically by leaving the state — and direct evidence
against any guard mini-language that tries to express duration syntactically.

**5. Keep thresholds as ordinary TypeScript expressions in guards.** F15: the
alternative is not "no thresholds", it is thresholds compiled into a global
quantisation you can no longer see or tune per transition. This argues against
Proposition 2's restricted `match` notation and for guards being plain
predicates — while still keeping the _target_ at a fixed position, which
encodings (a), (c) and (d) in note 06 all do. **The arrow test does not require
a transition mini-language; conflating the two is the false dilemma note 10
already identified, and this note supplies the domain reason to resolve it in
favour of ordinary predicates.**

**6. Note 03's F8 concession is weaker than it looks, and F11 says why.**
SwingStates conceded that callbacks are more _compact_ below a few states.
Proton++ measured _comprehension_ at one to three touches and callbacks lost by
2.3x to a one-line declarative form and 4.7x to a graphical one, with a large
preference effect (11 of 12). Compactness is not the target; scannability is. A
notation may cost lines and win — **as long as the lines it costs are describing
the interaction, not declaring types twice.** That distinction is the whole
ceremony argument from note 10, now with a measured basis.

**7. Calibrate the expected win honestly.** Half of Proton++'s advantage
belonged to the graphical notation, which a source-only library cannot have
(F13). InterState's win is confounded by a live environment (note 03, F13).
The defensible claim for a text library is the expression-versus-callbacks
gap — roughly 2x on comprehension of a small interaction — and nothing about
defect rates (F26).

**8. The competitor is `useState` plus two booleans, confirmed by both sides.**
statecharts.dev blames non-adoption on "the simplest thing that could possibly
work" (F34); XState's author published the ten-line transition function that
makes a library unnecessary for plain machines (F33); a practitioner rebuilt a
video-player FSM in about 80 lines of TypeScript rather than finish the docs
(F33). The library must be obviously better than a `switch` **at three states**,
or it does not get used at ten.

**9. The one thing this literature says an FSM library uniquely provides is the
thing the project is building.** Proton has no states — position in an
expression is the state. Midas has no states at all. Dataflow has no states.
Coroutines have states only as program counters, invisible to the type system
and to any observer. **A named current state is the only place to hang
state-specific data and state-specific capabilities**, and every alternative in
this note gives that up. Typestate is a real differentiator; it is just narrower
than the requirements document implies.

**10. The direction that could still overturn the project is coroutines, and it
has not been tested.** Maier, Rompf and Odersky's argument (F24) is that the
right fix for callback soup is un-inverting control flow so the interaction
reads as three sequential steps, and modern JavaScript has everything needed:
async generators, `for await`, `AbortController`, `Promise.race`. The RxJS drag
idiom is the same idea, already deployed at scale.

Recommendation: **build the reduced Marking Menu twice — once as a machine, once
as an async generator — and score both on the arrow test and the note-09 A/B/C/D
instrument before freezing the API.** The predicted result is that the coroutine
version wins on authoring and loses on every static question (what can I do
here, where can I go from here, what is the topology), because its states are
program points. If that prediction fails, the honest conclusion is that this
should not be a state machine library. Nothing in the current propositions
document tests it.

**11. Do not add hierarchy, and now there are four independent reasons.**
Semantic variants (note 01, F4/F5); SwingStates implemented it and found no UI
use for it (F6); the systems that needed orthogonality used parallel machines
instead (F7, F8); and the toolkit authors closest to real interaction code say
statecharts are much harder to learn than plain machines (F21). Refusing
hierarchy is not a limitation to apologise for; it is the position the evidence
supports.
