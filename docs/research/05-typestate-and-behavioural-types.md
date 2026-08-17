# Typestate and behavioural types: the PL theory behind state-dependent APIs

> Research note. Evidence levels: [READ] full text, [ABSTRACT] abstract only,
> [SECONDARY] cited elsewhere.
>
> Scope note: deep pass. Fifteen primary sources were retrieved and read in
> whole or in substantial part (PDF → `pdftotext`, or OCR for the 1986 scan).
> Bibliographic details were checked against dblp, ACM, Springer or the
> publisher page. Where a number differs from what an existing note in this
> directory reports, the primary source is quoted and the discrepancy is
> flagged.

## Scope and questions asked

Three questions, in order of how much they bear on the design:

1. **What is the minimum machinery for sound typestate in a language without
   linear or affine types?** TypeScript has no linearity, no uniqueness, no
   move semantics, no borrow checker. The literature has forty years of
   answers to "how do you keep a state claim true"; all of them cost
   something. Which costs can TypeScript pay?
2. **What unsoundness must simply be accepted?** Requirement P0.4 ("if
   TypeScript narrows a value to state `S`, later machine activity must not
   cause that value to represent another state while TypeScript still treats
   it as `S`") is a restatement of the central open problem of this
   literature. It is worth knowing exactly which part is impossible before
   designing around it.
3. **What does the evidence say about the usability tax of typestate APIs?**
   Note 09 found that 71% of protocol-task time goes to state search
   (Sunshine et al., ICPC 2015). That result has a controlled follow-up, a
   controlled language experiment, and two independent corpus studies that
   note 09 did not reach. They change the picture.

## Key sources

Peer-reviewed:

- Robert E. Strom and Shaula Yemini, "Typestate: A Programming Language
  Concept for Enhancing Software Reliability", _IEEE Transactions on Software
  Engineering_ 12(1), 1986, pp. 157–171. dblp `journals/tse/StromY86`.
  Retrieved as a page scan and OCR'd — [READ], with the caveat that OCR
  garbles some symbols; every claim below was read in at least two page
  images.
- Manuel Fähndrich and Robert DeLine, "Adoption and Focus: Practical Linear
  Types for Imperative Programming", _PLDI 2002_, doi:10.1145/543552.512532.
  <https://www.microsoft.com/en-us/research/wp-content/uploads/2002/05/pldi02.pdf>
  — [READ] abstract and §1–2.
- Robert DeLine and Manuel Fähndrich, "Typestates for Objects", _ECOOP 2004_,
  LNCS 3086, pp. 465–490, doi:10.1007/978-3-540-24851-4_21.
  <https://www.cs.cmu.edu/~aldrich/courses/819/deline-typestates.pdf> —
  [READ] §1–5.
- Kevin Bierhoff and Jonathan Aldrich, "Modular Typestate Checking of Aliased
  Objects", _OOPSLA 2007_, pp. 301–320, doi:10.1145/1297105.1297050.
  <https://www.cs.cmu.edu/~kbierhof/papers/typestate-verification.pdf> —
  [READ] §2.
- Jonathan Aldrich, Joshua Sunshine, Darpan Saini and Zachary Sparks,
  "Typestate-Oriented Programming", _OOPSLA '09 Companion (Onward!)_, pp.
  1015–1022, doi:10.1145/1639950.1640073.
  <https://www.cs.cmu.edu/~aldrich/papers/onward2009-state.pdf> — [READ]
  partial.
- Nels E. Beckman, Duri Kim and Jonathan Aldrich, "An Empirical Study of
  Object Protocols in the Wild", _ECOOP 2011_, LNCS 6813, pp. 2–26,
  doi:10.1007/978-3-642-22655-7_2.
  <http://www.cs.cmu.edu/~aldrich/papers/aldrich-empirical-ecoop11.pdf> —
  [READ].
- Ciera Jaspan and Jonathan Aldrich, "Are Object Protocols Burdensome? An
  Empirical Study of Developer Forums", _PLATEAU 2011_,
  doi:10.1145/2089155.2089168 — [READ] §1–3.
- Ronald Garcia, Éric Tanter, Roger Wolff and Jonathan Aldrich, "Foundations
  of Typestate-Oriented Programming", _ACM TOPLAS_ 36(4), 2014,
  doi:10.1145/2629609 — [READ] abstract and §2. Extends Wolff, Garcia,
  Tanter and Aldrich, "Gradual Typestate", _ECOOP 2011_ — [SECONDARY], via
  the TOPLAS version's own framing.
- Joshua Sunshine, James D. Herbsleb and Jonathan Aldrich, "Structuring
  Documentation to Support State Search: A Laboratory Experiment about
  Protocol Programming", _ECOOP 2014_, LNCS 8586, pp. 157–181,
  doi:10.1007/978-3-662-44202-9_7.
  <https://herbsleb.org/web-pubs/pdfs/sunshine-structuring-2014.pdf> —
  [READ].
- Jonathan Aldrich and Joshua Sunshine, "Usability Hypotheses in the Design of
  Plaid", _PLATEAU 2014_, doi:10.1145/2688204.2688219.
  <https://www.cs.cmu.edu/~jssunshi/assets/pdf/sunshine2014usability.pdf> —
  [READ] full (4 pages).
- Joshua Sunshine, James D. Herbsleb and Jonathan Aldrich, "Searching the
  State Space: A Qualitative Study of API Protocol Usability", _ICPC 2015_,
  pp. 82–93, doi:10.1109/ICPC.2015.17 — [READ]; re-read here to check note
  09's numbers.
- Davide Ancona et al., "Behavioral Types in Programming Languages",
  _Foundations and Trends in Programming Languages_ 3(2–3), 2016, pp. 95–230,
  doi:10.1561/2500000031 — [READ] §2.3 (typestate) and §3.2–3.3 (linearity
  and monadic session types).
- Edwin Brady, "Type-driven Development of Concurrent Communicating Systems",
  _Computer Science_ (AGH) 18(3), 2017, doi:10.7494/csci.2017.18.3.1413 —
  [READ] §1–3. This is the published relative of the 2016 draft "State
  Machines All The Way Down", which describes `Control.ST`; the draft PDF at
  `idris-lang.org/drafts/sms.pdf` is now 404 — [UNVERIFIED] as a citable
  artefact, so all Idris claims below are taken from the 2017 journal paper.
- Michael Coblenz, Jonathan Aldrich, Brad A. Myers and Joshua Sunshine, "Can
  Advanced Type Systems Be Usable? An Empirical Study of Ownership, Assets,
  and Typestate in Obsidian", _PACMPL_ 4(OOPSLA), article 132, 2020,
  doi:10.1145/3428200 — [READ].
- Simon Fowler, "Model-View-Update-Communicate: Session Types meet the Elm
  Architecture", _ECOOP 2020_, LIPIcs 166, 14:1–14:28,
  doi:10.4230/LIPIcs.ECOOP.2020.14. <https://arxiv.org/abs/1910.11108> —
  [READ] §1–3.
- José Duarte and António Ravara, "Taming stateful computations in Rust with
  typestates", _Journal of Computer Languages_ 72, 2022, article 101154,
  doi:10.1016/j.cola.2022.101154 — [READ]. Extended version of "Retrofitting
  Typestates into Rust", _SBLP 2021_, pp. 83–91, doi:10.1145/3475061.3475082
  — [ABSTRACT].
- Timothy Mou, Michael Coblenz and Jonathan Aldrich, "An Empirical Study of
  Protocols in Smart Contracts", arXiv:2110.08983, 2021 — [READ] §3.
- Conor McBride, "Kleisli arrows of outrageous fortune", functional pearl,
  2011, submitted to _JFP_.
  <https://personal.cis.strath.ac.uk/conor.mcbride/Kleisli.pdf> — [READ]
  abstract and §1; note this is an unpublished manuscript "under
  consideration", not a JFP article.
- Kohei Honda, Nobuko Yoshida and Marco Carbone, "Multiparty Asynchronous
  Session Types", _POPL 2008_, pp. 273–284; journal version _JACM_ 63(1),
  2016, article 9, doi:10.1145/2827695 — [SECONDARY], via Ancona et al. and
  the POPL Most Influential Paper 2018 citation.
- Dimitrios Kouzapas, Ornela Dardha, Roly Perera and Simon J. Gay,
  "Typechecking protocols with Mungo and StMungo: A session type toolchain
  for Java", _Science of Computer Programming_ 155, 2018, pp. 52–75 —
  [ABSTRACT].
- Songlin Jia, Craig Liu, Siyuan He, Haotian Deng, Yuyan Bao and Tiark Rompf,
  "Typestate via Revocable Capabilities", _PACMPL_ (OOPSLA 2025),
  doi:10.1145/3808323, arXiv:2510.08889 — [ABSTRACT].

Engineering documentation:

- The Embedded Rust Book, "Typestate Programming",
  <https://doc.rust-lang.org/stable/embedded-book/static-guarantees/typestate-programming.html>
  — [READ].
- `typestate-rs` book and repository, <https://rustype.github.io/typestate-rs/>
  and <https://github.com/rustype/typestate-rs> — [READ] introduction;
  issue #5 (lifetimes in states) — [ABSTRACT].
- `motor` package documentation, <https://hackage.haskell.org/package/motor>
  — [ABSTRACT].
- Apollo GraphQL, _Rust Best Practices_, ch. 7 "Type-state pattern" —
  [ABSTRACT], reached only via a generated wiki summary of the repository;
  the chapter file itself 404'd, so treat the specific wording as unverified
  and the gist ("verbose, duplicated fields across states, `PhantomData` is
  unintuitive, avoid when runtime flexibility is required") as low-confidence.

Opinion / practitioner writing:

- Cliff L. Biffle, "The Typestate Pattern in Rust",
  <https://cliffle.com/blog/rust-typestate/> — [READ].
- Andrew Hobden ("Hoverbear"), "Pretty State Machine Patterns in Rust",
  <https://hoverbear.org/blog/rust-state-machine-pattern/> — [READ].
- Oskar Wickström, "Motor: Finite-State Machines in Haskell" (2017-10-27) and
  "Finite-State Machines, Part 2: Explicit Typed State Transitions"
  (2017-11-19), <https://wickstrom.tech/> — [READ] the first; the second
  returned 403 and is [UNVERIFIED] here.

## Findings

**F1 — Typestate was born with an aliasing _prohibition_, not an aliasing
solution.** Strom and Yemini's checker is sound only because the language it
was embedded in, NIL, had no way to make an alias. Their own list of the
design decisions that made typestate tracking possible includes: data are
never shared between processes, and — verbatim — "There are no directly
manipulable pointers, nor any other ways to generate aliases". Object
ownership moves between processes only by message send, and send is
destructive. [READ, Strom and Yemini §III.C–D]

Non-obvious consequence: the founding paper does not offer a technique for
languages with aliasing. It offers a language design in which the problem does
not arise. Every subsequent paper in this note is an attempt to buy back some
aliasing, and each pays a different price.

**F2 — The original typestate order is a _resource-acquisition lattice_, not
an arbitrary state graph, and that assumption is load-bearing.** Typestates of
a type form a lower semilattice ordered by "degree of initialisation"; ⊥ is
the pre-any-operation / post-finalisation state; at a control-flow merge the
typestate of a name is the _greatest lower bound_ of its typestates on the
incoming paths; and for every pair `s1 > s2` there exists a **typestate
coercion** that lowers `s1` to `s2`, which the compiler may insert
automatically, which never raises an exception, and which never acquires
resources. [READ, Strom and Yemini §II.A, §II.C]

Non-obvious consequence: this machinery works because _forgetting_ is always
possible and always safe. An FSM for an interaction technique has cycles, no
natural partial order, and no meaningful "forget down to a lower state". The
1986 theory does not transfer to a cyclic control-state machine; only the
_name_ transferred. This is worth saying plainly because "typestate" is
routinely invoked as if it endorsed general FSMs, and it does not.

**F3 — Every soundness story after 1986 is a story about aliasing, and there
are exactly four families.** Reading them side by side:

| Family                                | Mechanism                                                                                                  | Cost                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| (a) Forbid aliases                    | NIL: no pointers; destructive send                                                                         | A whole language                                    |
| (b) Linear / unique / affine types    | Vault, Idris `UniqueType`, Rust `self`-by-value, Obsidian, session types                                   | Viral: any type containing a linear thing is linear |
| (c) Permissions, possibly fractional  | Fugue's `NotAliased`/`MayBeAliased`, Plural/Plaid's `unique`/`full`/`share`/`pure`/`immutable` + fractions | A second annotation language                        |
| (d) Freeze the typestate once aliased | Fugue's leak rule                                                                                          | Aliased objects can never change state              |

Nothing else appeared in forty years except (e) _give up statically and check
at run time_ (F16) and (f) revoke capabilities dynamically (F20).

**F4 — Family (d) is the cheapest sound rule, it is stated in one sentence,
and it is the only one TypeScript can implement.** Fugue tracks two modes.
An object starts `NotAliased` and may change state freely. It may _leak_ to
`MayBeAliased`, after which references may be copied arbitrarily but — as
DeLine and Fähndrich put it — "the moment an object leaks, its typestate is
essentially frozen". References to a `MayBeAliased` object are
typestate-invariant. [READ, DeLine and Fähndrich §5]

This is the exact statement of P0.4's constraint, and it resolves it. In
TypeScript _every_ value is `MayBeAliased` from birth: there is no way to
prove a reference unique. Therefore **any TypeScript value that carries a
state claim must be typestate-frozen — i.e. an immutable snapshot** — or the
claim is unsound. There is no third option, and note 06's F10 reached the same
conclusion by measuring the compiler. Two independent routes, one answer.

**F5 — `focus` is the scoped escape hatch, and it is the theory behind
"the handler receives its state as a parameter".** Fähndrich and DeLine's
`let x = focus e1 in e2` takes a may-aliased object, gives `x` a tracked
(linear) type for the duration of `e2`, and _guards_ the aliases so that,
in their words, no alias can witness effects on the focused object outside the
focus scope. Aliasing is restored when the scope ends. [READ, Fähndrich and
DeLine §1, §2 "Focus"] Fugue mentions focus as the way to change the typestate
of a maybe-aliased object and then deliberately omits it for simplicity
[READ, DeLine and Fähndrich §5].

Non-obvious consequence: a library that hands the current state's data and
capabilities to a callback, and guarantees no state change can be committed
while that callback runs, is implementing `focus`. It is a named, published,
sound construct — not a workaround. The unenforceable part is escape: nothing
stops a JavaScript closure from stashing the parameter.

**F6 — Full soundness _with_ free aliasing costs five permission kinds and
fractional arithmetic, for an `Iterator`.** Bierhoff and Aldrich's access
permissions are `unique`, `full`, `share`, `pure`, `immutable`, each carrying
a fraction `k` recording how often it was split, with splitting/joining rules
such as `unique(x,1) ⇔ full(x,1/2) ⊗ pure(x,1/2)` and
`immutable(x,k) ⇔ immutable(x,k/2) ⊗ immutable(x,k/2)`, tracked in a decidable
fragment of linear logic. The read-only `Iterator` specification needs a
type parameter for the collection _and_ one for the fraction:
`interface Iterator<c : Collection, k : Fract>`, and `finalize` exists purely
to give the captured collection permission somewhere to be returned from.
[READ, Bierhoff and Aldrich §2.3–2.5]

That is the price of "aliasing is free and typestate is still sound". It is
not a price a small library can charge its users.

**F7 — Dependent types alone are not enough; Idris needed a _second_,
orthogonal mechanism, and the failure mode is exactly TypeScript's.** Brady's
first attempt indexes a handle by its state — `DoorH : DoorState -> Type`,
`CloseDoor : DoorH Opened -> DoorCmd (DoorH Closed)`. It type-checks a program
that closes the same handle twice, because nothing stops the old binding
`hbad` being used again. Only after re-declaring the handle as a `UniqueType`
does the bad program fail, with the error "Unique name hbad is used more than
once". [READ, Brady §2.1–2.2]

Non-obvious consequence: **TypeScript is permanently at Brady's Attempt 1.**
A full-spectrum dependently typed language could not make state-indexed
handles sound without uniqueness types; TypeScript has neither uniqueness nor
a way to add it. Any design that hands users a state-indexed handle they can
re-use is not "slightly unsound" — it is the exact program Brady shows
failing.

**F8 — The one hard part TypeScript gets _for free_ is the
runtime-decided target.** Brady's third attempt handles an operation whose
resulting state depends on runtime success by returning a dependent pair,
`OpenDoor : DoorH Closed -> DoorCmd (Res Bool (\ok => if ok then DoorH Opened
else DoorH Closed))`, which the caller must destructure before continuing
[READ, Brady §2.3]. `typestate-rs` does the same with a Rust `enum`:
enumerations are treated as non-deterministic states, "effectively the sum of
several possible states", and the compiler forces the user to match before
proceeding [READ, Duarte and Ravara §2.2]. McBride's indexed-monad
formulation makes the same move at the type level; a computation's type
records precondition and postcondition, so that "their types are just
specifications in a Hoare logic" [READ, McBride, abstract].

Non-obvious consequence: a _discriminated union of target states_ is the
literature-sanctioned representation of a branching transition, in three
unrelated systems. TypeScript narrows discriminated unions natively and well.
The project should stop treating "the outcome is a union of possible
typestates" as an exotic requirement; it is the normal answer, and it is the
cheap half.

**F9 — The monadic / indexed-monad encoding is the recognised way to get
affine resource use _without_ linear types, and its cost is that the resource
stops being a value.** Ancona et al. describe the Haskell session-type
libraries: the monad hides the channel from the programmer and prevents
creation of aliases, making it possible to enforce affine channel use using
only ordinary Haskell features — the survey notes explicitly that this
approach does not require the host language to support linear types
[READ, Ancona et al. §3.3]. Pucella and Tov's `Session st st' a` threads the
state in the type with no channel argument at all. Motor
(`MonadFSM :: (Row *) -> (Row *) -> * -> *`) and Idris `Control.ST` are the
same idea with named resources.

Costs, from the implementations themselves: Motor needs the CTRex open-records
library for row kinds and `RebindableSyntax` for do-notation, and its author
concedes that row-polymorphic computations require listing actions in reverse
order [READ, Wickström 2017-10-27; ABSTRACT, motor docs]. In other words, the
whole program must move inside the DSL, and the type errors are about rows.

**F10 — Linearity and GUIs are _known_ to be incompatible, and someone has
written the paper.** Fowler states that safely implementing session types
requires linearity, that linear typing is difficult to integrate with GUIs,
and that consequently most session-typed programs are command-line
applications [READ, Fowler §1]. He gives two concrete failures for a login
form holding a linear channel `c`: (i) nothing stops the user pressing Submit
twice, sending the credentials twice along `c`; (ii) adding a second button
("forgot password") requires two references to `c` in the page, violating
linearity outright. His verdict: "directly embedding linear resources into a
GUI is a non-starter".

**F11 — And the fix Fowler proposes _is_ the architecture of a state-machine
library.** Spawn a separate process that owns the linear resource; the GUI
sends it plain, non-linear messages; the process performs the protocol step
and **ignores duplicate GUI messages** [READ, Fowler §1]. Machine owns state;
callers submit inputs; stale or impossible inputs are dropped.

Non-obvious consequence: the project's basic shape — a machine object with a
`submit(input)` method and no user-held state token — is not a compromise
forced by TypeScript's weakness. It is the peer-reviewed answer to exactly
this problem in a language that _does_ have linear types. The stale-dwell-token
discipline in the Marking Menu acceptance case is the same idea applied to
timers.

**F12 — Fowler's second result argues for per-state handler maps over one
reducer.** With the model encoded as a single sum type, the `update` function
must contain cases that cannot arise — Fowler highlights them in red and, for
the linear PingPong example, has to `cancel` a channel in a branch that the
session type says can never be reached, calling it an arbitrary choice to
satisfy a code path that must exist but should never be used. His fix is
_model transitions_: multiple model types, and a `transition` primitive that
supplies the new model together with its own view, update, extract functions
and a command. He reports that this eliminates the redundant code paths
arising from illegal states. [READ, Fowler §3.2–3.3]

Non-obvious consequence: this is independent support for the propositions'
strongest feature (state-keyed capability maps, note 09's question B) from a
completely different tradition. It does _not_ license hiding the target: the
`transition` primitive names the successor's functions explicitly at the call
site.

**F13 — Real-world object protocols are overwhelmingly two-state, monotonic
and one-shot. Two independent corpora agree.** Beckman, Kim and Aldrich
analysed ~2 MLOC of Java: 7.2% of types define protocols, 13.3% of classes are
clients, and — their own comparison — 2.5% of types in the Java library use
generic type parameters. Seven behavioural categories cover 98% of the 648
confirmed protocol reports [READ, Beckman et al. abstract, §3.1–3.2]:

| Category            | Share | Shape                                      |
| ------------------- | ----- | ------------------------------------------ |
| Initialization      | 28.1% | two states, monotonic                      |
| Deactivation        | 25.8% | two states, monotonic                      |
| Type Qualifier      | 16.4% | state fixed at construction, never changes |
| Dynamic Preparation | 8.0%  | two states, non-monotonic                  |
| Boundary            | 7.9%  | two abstract states (in/out of bounds)     |
| Redundant Operation | 7.3%  | call-once                                  |
| Domain Mode         | 4.8%  | genuinely multi-state                      |
| Others              | 1.9%  | alternation, lifecycles                    |

Mou, Coblenz and Aldrich repeated the exercise on Ethereum smart contracts:
of 69 protocols found in a random sample of 100 contracts, Toggle (21),
Activation (12), Redundant Operation (12) and Deactivation (10) — 55 of 69,
80% — are two-state, and only 3 of 69 (4.3%) are multi-state "Lifecycle"
[READ, Mou et al. §3.1, Table 2].

Non-obvious consequence, and the most important finding in this note for the
project: **the typestate literature's entire empirical base is protocols that
a boolean would model.** A four-state Marking Menu with cycles, a timer race
and per-state data sits in the 4%–5% tail of both corpora. Every ergonomic
trade-off the literature validates was validated on the other 95%. The project
should not inherit ceremony that was priced against `open`/`close`.

**F14 — Protocol mistakes are expensive to _diagnose_ but they do not reach
production — and the field's own leaders say so.** Jaspan and Aldrich coded
427 Spring and ASP.NET forum threads; 69 were protocol violations; the mean
time to a resolved answer was 62 hours; 45% of the faults manifested as
something other than an exception; and 54% were repeat violations of similar
protocols whose runtime manifestation differed each time [READ, Jaspan and
Aldrich abstract, §3]. But Aldrich and Sunshine, reflecting on case studies
with the Plural checker, record hypothesis H3 as: "Protocol errors do not
often make it into production", perhaps because testing catches them. They
draw the design conclusion themselves — tools supporting typestate should aim
at developer productivity rather than at correcting production defects
[READ, Aldrich and Sunshine §1.3].

Non-obvious consequence: the typestate research programme's own leadership
states that the payoff is _learnability and speed_, not bug prevention. That
is the objective function in `00-evaluation-brief.md`, endorsed from inside
the literature that the requirements document leans on for the opposite
reason.

**F15 — And the largest measured win in the whole literature is a
_documentation_ win, not a type-checking win.** Sunshine, Herbsleb and Aldrich
ran a 20-participant between-subjects experiment: Plaiddoc (methods organised
by state, with explicit state transitions, state-based type specifications and
state relationships) versus Javadoc, 21 questions over three Java APIs. Mean
total time on state-search tasks: **10.3 min with Plaiddoc versus 22.4 min
with Javadoc**, a 2.17× difference, independent two-tailed t-test p < 0.001,
95% CI of the difference 6.38–17.8 min. On non-state tasks: 5.77 versus
5.95 min, p = 0.802 — no cost. Errors: 2 incorrect answers across the ten
Plaiddoc participants versus 15 across the ten Javadoc participants.
Experience had no significant effect (F = 0.058, p = 0.813). [READ, Sunshine
et al. 2014, §6.1–6.2]

The internal breakdown matters more than the headline. State-first questions
(B "what can I do in state X" and D "how do I get from X to Y") improved
2.41×; _method-first_ questions (A and C) still improved 1.87×, and since
method-first search cannot benefit from state-based organisation, the authors
attribute that 1.87× to the other three features — chiefly **explicit state
transitions** [READ, §6.1].

Non-obvious consequence: the arrow test is not a stylistic preference and not
only a note-09 inference. Making transitions explicit measurably improved
even the questions that state-grouping cannot help with. That is the closest
thing this literature has to direct evidence for the evaluation brief's
central complaint.

**F16 — The one controlled experiment comparing a typestate language to a
mainstream one returns a split verdict: typestate pays on constrained tasks
and taxes open-ended ones.** Coblenz et al.: 20 participants, 10 Obsidian
(ownership + typestate + assets) versus 10 Solidity, four hours each, ~90 min
of tutorial (Obsidian median training was longer; ranges 39–138 min Solidity,
50–148 min Obsidian). Results [READ, §8–10]:

- Auction task (fill in missing code): 7/10 Obsidian versus 2/10 Solidity
  correct.
- Prescription task (fix a double-deposit vulnerability): 6/10 Obsidian used
  ownership successfully; 9/10 Obsidian versus 3/10 Solidity finished within
  the limit; no significant time difference among successes (22 versus
  18–20 min).
- Casino task (open-ended, design your own typestate interfaces): Obsidian
  participants took **64 min versus 37 min**, p ≈ 0.02 (Mann-Whitney U),
  d ≈ 1.9. Correct token management: 0/4 Obsidian versus 50% of 8 Solidity.
  The authors' own reading: the stronger type system likely had a significant
  cost in development time, and they hypothesise the cost grows with
  open-endedness.

Survey: Obsidian participants rated ownership far more useful (4.88 versus
3.0, p ≈ 0.002, d ≈ 2.5) but Solidity participants reported understanding
_states_ better (4.8 versus 4.1, p ≈ 0.04, d ≈ 1.3) — the authors suggest the
unfamiliar coupling of states to types cost confidence [READ, §11].

**F17 — Nobody used cross-object static typestate. Everyone reached for a
runtime check.** In the Casino task the provided `Game` contract had states
(`BeforePlay`, `Playing`, `FinishedPlaying`), and the intended elegant
solution was to give `Casino` states mirroring `Game`'s so the static types
would rule out illegal calls. Coblenz et al. report flatly: "All of the
participants added the dynamic checks." One participant tried a static
assertion, apparently not realising it was static. [READ, §10]

Non-obvious consequence, and a direct hit on this project: the moment one
thing's legal operations depend on _another_ thing's state — a dwell timer
whose validity depends on the machine's control state, a pointer capture whose
validity depends on the gesture phase — users will write the runtime check.
Designing an elaborate static coupling for that case is designing something
that the only relevant experiment says will not be used.

**F18 — Layering two annotation systems is measurably confusing, and Obsidian's
fix list is a design checklist.** Aldrich and Sunshine report unpublished
Plaid pilot studies in which participants confused access permissions with
typestate annotations — in one task _all three_ participants believed the
`pure` permission was an abstract state — and call this a worrying sign for
layering specialised verification systems on one another [READ, Aldrich and
Sunshine §4]. Obsidian's redesign after its own difficult first study did
three things: **fused typestate and ownership into one syntax** (a typestate
annotation _implies_ ownership: `Auction@Open` is necessarily an owning
reference), **made the transfer explicit in the signature**
(`Prescription@Owned >> Unowned p`), and **removed local-variable ownership
annotations** [READ, Coblenz et al. §2, §9].

**F19 — Obsidian also states the minimality principle explicitly: restrict
only what soundness needs.** In Obsidian, mutation is restricted only as much
as is required for sound typestate; `Unowned` references may read and mutate
fields but may not change _which named state_ the object is in, because a state
change through an unowned reference could invalidate the owner's typestate
claim. Coblenz et al. contrast this with Rust, where all field modification is
restricted, and note that 6 of 10 participants succeeded using linearity alone
— suggesting languages adopting linearity _without_ mutability restrictions
may be usable [READ, §2, §9.2].

Non-obvious consequence: the sound minimal rule is not "freeze everything".
It is "**only the owner may change the control state**". A library can enforce
that in JavaScript for free: only the machine object has `submit`; snapshots
have no mutators. What it cannot enforce is that a snapshot's _data_ is not
mutated by whoever put objects in it — which is exactly the carve-out P0.4
already makes.

**F20 — Rust is the largest deployment, and its honest costs are ownership
friction, generic churn, and — pointedly — _loss of topology_.** The pattern
is: each transition consumes `self` and returns the next state type; the old
binding is dead by move semantics; state may be a separate struct per state or
a `PhantomData<S>` parameter on one struct. Biffle notes only that the generic
variant is less boilerplate-heavy but harder to explain, and that loops need
manual reassignment [READ, Biffle]. Hoverbear catalogues the three variants
and their problems: the enum wrapper gives runtime-only errors and match
statements everywhere; separate structs repeat code and are hard to compose
without re-wrapping in an enum; shared data across states becomes unclear
[READ, Hoverbear]. Practitioner and vendor guidance converges on "avoid when
runtime flexibility is required, when signatures get complex, or for trivial
state" [ABSTRACT, Apollo _Rust Best Practices_ ch. 7 — low confidence, see
sources]. `typestate-rs` lists as open future work: support for generics and
lifetimes ("does not cover much more than basic cases"), syntax review, no
formal proof, and learning materials still "in its infancy" [READ, Duarte and
Ravara §6]; its issue #5 reports that a state holding a `&str` cannot be given
a lifetime parameter [ABSTRACT].

The sharpest item is topology. Because the branch that selects the successor
lives _inside_ the function body, `typestate-rs`'s generated state diagram
cannot label the outgoing edges of a decision node, so the DSL adds
`#[metadata(label="if x > 10")]` on each enum arm purely to put the condition
back on the arrow [READ, Duarte and Ravara §2.2, Figs. 1–2].

Non-obvious consequence: an independent project, in another language, hit the
evaluation brief's arrow-test failure and had to bolt on a manual annotation
to recover the information. A design that keeps source, input, outcome kind
and target at fixed syntactic positions gets that annotation for free.

**F21 — Gradual typestate is the literature's sanctioned answer to "the static
system cannot verify this here".** Garcia, Tanter, Wolff and Aldrich extend
Featherweight Typestate to Gradual Featherweight Typestate, in which the
compiler inserts dynamic permission and state checks where static verification
falls short, so that partially-verified code can still run safely. Their static
core takes a deliberately small permission set — `full`, `shared` and `pure` —
and they note that adding the other known permissions (`immutable`, `unique`,
`none`) "would simply add more complexity" without new insight [READ, Garcia
et al. abstract and §2]. Aldrich and Sunshine
independently state H10: a type system offering run-time checks (casts or
similar) can be _more_ usable than one without, because the latter forces
complex static constructions where the former uses a cast; their analogy is
pre-generics Java [READ, Aldrich and Sunshine §2]. Plaid's runtime reports
when a method absent in the current state is invoked (their H7).

**F22 — The problem is still open, and the current attack is dynamic
revocation.** "Typestate via Revocable Capabilities" (OOPSLA 2025) makes
capabilities flow-sensitive and decouples capability lifetimes from lexical
scopes, so functions can receive, revoke or return capabilities; it is
implemented as a Scala 3 compiler extension using path-dependent types
[ABSTRACT]. That a 2025 OOPSLA paper is still solving "how do I keep the state
claim true" is itself evidence about the difficulty level, and about the
wisdom of a small ESM library not attempting it.

## Design moves worth stealing

1. **Freeze-on-alias (Fugue, F4).** Anything the library hands out that can be
   narrowed to a state must be an immutable snapshot whose typestate is
   frozen at the moment of observation. _Cost:_ the snapshot goes stale
   silently; users must be told, in one sentence, that a snapshot is a
   photograph. _Gain:_ P0.4 becomes satisfiable as stated, because the value
   never "comes to represent another state" — it always represents the state
   it was taken in.
2. **Focus scope (Vault, F5).** Deliver state-specific capabilities as
   parameters of a callback, with a documented guarantee that no state change
   is committed while the callback is on the stack. _Cost:_ one level of
   indirection at the observation site, and it cannot stop the parameter
   escaping. _Gain:_ inside the scope the narrowing is genuinely sound, and
   this is a named published construct rather than an improvisation.
3. **Dependent-sum outcome (Idris `Res`, `typestate-rs` enums, F8).** A
   transition whose target depends on runtime data returns a discriminated
   union of target typestates that the caller must narrow. _Cost:_ callers
   must match even when they "know" the answer. _Gain:_ free in TypeScript,
   exhaustiveness-checkable, and it is the answer three unrelated systems
   converged on.
4. **Transition in the signature, at a fixed position (Obsidian
   `Owned >> Unowned`, `typestate-rs` `fn(self,…) -> State`, F18/F20).** The
   arrow lives in the type, not in the body. _Cost:_ branching transitions
   must widen the return type to a union, or split into several entries.
   _Gain:_ the arrow test passes, `go-to-definition` works, and the machine's
   topology is recoverable by a tool without parsing bodies.
5. **State-organised presentation with explicit transitions (Plaiddoc, F15).**
   Generate — or at least shape the source so an editor can show — a per-state
   view listing that state's capabilities and its outgoing arrows. _Cost:_ a
   docs deliverable. _Gain:_ the only 2.17×, p < 0.001 result in this
   literature.
6. **Owner-only state change (Obsidian, F19).** Only the machine handle can
   commit a transition; observations carry no capability to change state.
   _Cost:_ none in JavaScript. _Gain:_ the minimal sound rule, and it is the
   rule Obsidian's designers arrived at after two user studies.
7. **Resource-owning process + non-linear messages + drop duplicates (Fowler,
   F11).** Validates `submit()` plus token-based staleness rejection as the
   correct architecture, not a fallback.
8. **Multiple model types with an explicit `transition` (Fowler, F12).**
   Per-state handler maps beat one reducer _because_ they delete impossible
   cases — an argument for the propositions' B-axis strength that does not
   also require hiding the target.
9. **Fuse the concepts (Obsidian, F18).** Do not ship "typestate" and
   "ownership/lifetime/aliasing" as two user-facing annotation vocabularies;
   Plaid's pilot shows users will merge them anyway, incorrectly.
10. **Gradual fallback (GFT, H10, F21).** A development-mode runtime assertion
    that a snapshot is still current, or that a submitted input is legal in the
    current state, is the literature-endorsed way to cover what the static
    system cannot. _Cost:_ a few bytes and a dev/prod split.
11. **Merge by greatest lower bound (Strom and Yemini, F2).** Where two
    branches yield different states, the honest static answer is their join —
    which TypeScript computes natively as a union. Do not invent a "merged
    state" concept; the 1986 paper's coercion machinery exists only because
    its lattice made ⊔ unavailable.

## Traps, negative results, and things that failed

- **NIL/Hermes, Vault, Fugue, Plural, Plaid, Obsidian: none is in production
  use.** The one design that was fully sound (NIL) achieved it by removing
  pointers from the language. The chain of research vehicles that followed has
  not produced an adopted tool in forty years. Whatever this project builds,
  the base rate for "typestate system people actually use" is low, and the two
  exceptions — Rust's typestate _pattern_ and TypeScript's discriminated
  unions — are both cases where the language already had the mechanism and
  users discovered the idiom.
- **Brady's Attempt 1 is TypeScript's ceiling (F7).** A state-indexed handle
  without linearity type-checks a double-close. Any API that hands users a
  narrowed live handle is shipping that bug as a feature.
- **"Directly embedding linear resources into a GUI is a non-starter"
  (Fowler, F10).** Two independent failures: double-clicking a button, and
  needing the same handle on two buttons.
- **Typestate + permissions as two vocabularies (F18).** All three pilot
  participants read `pure` as an abstract state.
- **Cross-object typestate coupling (F17).** 0 of 5 Casino participants used
  it; all inserted dynamic checks.
- **Giving an escape hatch guarantees its abuse (Coblenz et al.).** Obsidian's
  `disown` was used unsafely by every participant who used it (0 of 4 used
  `disown` safely), and this — not the type system — caused Obsidian to lose
  the asset-management comparison to Solidity on the Casino task.
- **Fractional permissions for an `Iterator` (F6).** If the specification of
  `Iterator` needs `<c : Collection, k : Fract>` and a `finalize` clause whose
  only job is to give a permission back, the vocabulary has outgrown the
  problem.
- **Row-typed indexed monads (F9).** Motor needs `RebindableSyntax`, an
  external open-records library, and actions written in reverse order; its
  author calls the last "quite clumsy" and the library has one example.
- **Rust ownership versus event-driven code.** The typestate pattern requires
  moving `self` out of the value; a machine stored in a struct field or
  captured by a callback cannot be moved out of a borrow. The workarounds are
  `Option::take()` churn or falling back to the enum-wrapper pattern, which
  restores runtime-only errors — the exact thing typestate was for [READ,
  Hoverbear; ABSTRACT, Rust forum threads].
- **`typestate-rs` cannot express a state holding a borrowed `&str`**
  (issue #5), and generics/lifetime support is listed as future work.
- **Losing the arrow loses the diagram (F20).** `#[metadata(label=…)]` exists
  because the target moved into the body.

## Disagreements and open questions in the literature

- **Is typestate for correctness or for documentation?** Aldrich and Sunshine
  say documentation and productivity (H3, H8), because Plural found few
  defects in real repositories and because the measured win was Plaiddoc's
  2.17×. Coblenz et al. cut the other way on the Prescription task: only 2 of
  3 Solidity participants who finished a dynamic solution were correct, and
  they call that an argument for static enforcement. Unresolved, and the two
  positions come from overlapping author sets.
- **Which permission set?** Three (Garcia et al.: `full`, `shared`, `pure`),
  five (Bierhoff and Aldrich), three-plus-typestate-implies-ownership
  (Obsidian), two (Fugue).
  Forty years and no convergence; that is itself a warning about exposing a
  permission vocabulary to users.
- **Does the two-state empirical corpus generalise?** Both corpus studies
  (F13) sample library and contract code, not interactive front-ends. Whether
  interaction techniques are the 4% tail or a genuinely different population
  with different needs is _not answered anywhere in this literature_. Note 03's
  SwingStates benchmark (2–9 states, 8–32 transitions) is the closest
  evidence and it is from a different community.
- **Is "capabilities of a state" better delivered by a type system or by an
  editor?** Sunshine et al. improved state search with documentation alone,
  in a language whose types the participants never wrote. Note 09's F4
  observes TypeScript answers question A continuously via hover. Nobody has
  compared "typed but undocumented" against "documented but untyped" for
  protocol APIs.
- **Gradual typestate: honest engineering or a cop-out?** GFT and H10 argue
  runtime checks _increase_ usability; the linearity tradition treats a
  runtime check as an admission of failure. No experiment separates them.

### Corrections to earlier notes in this directory

- **Note 09, F1 overstates its source.** It reports, via Sunshine et al., that
  "more than three times as many types in the Java Standard Library define
  protocols as define type parameters". The primary source is Beckman, Kim and
  Aldrich, whose abstract gives 7.2% of types defining protocols against 2.5%
  using generics — a ratio of 2.9×, and measured over a 16-program corpus
  rather than the JSL alone (the JSL row of their Table 2 gives 8.2%). The
  same claim appears in Aldrich and Sunshine's PLATEAU 2014 paper as "more
  than twice as many". The defensible statement is **"roughly three times"**,
  and the number to quote is 7.2% versus 2.5%. The finding survives; the
  multiplier should be softened.
- **Note 09's A/B/C/D taxonomy has a controlled follow-up that note 09 does
  not cite.** Sunshine et al. 2014 (F15) is the experiment; ICPC 2015 is the
  observational study that generated the categories. The 2014 paper is the
  stronger citation for "making transitions explicit helps", because it is a
  controlled comparison with an effect size, and it should be added wherever
  note 09 or note 10 leans on the 71%.
- **Note 06's F10 and this note's F4 are the same result reached
  independently.** Note 06 measured that TypeScript keeps narrowing across
  arbitrary calls and loses it in closures; Fugue's leak rule says the same
  thing normatively, twenty years earlier. Neither is evidence for the other,
  which makes the agreement worth something.

## Implications for a typestate FSM library for interaction techniques

Sharp version, including where this contradicts the project's current
direction.

**1. P0.4 is not satisfiable for live handles, and the literature says so
before TypeScript does.** Fugue's leak rule (F4) is the general statement:
once a reference may be aliased, its typestate must be frozen. TypeScript
cannot prove any reference unaliased, so every TypeScript value is leaked at
birth. P0.4 should be _rewritten_ as Fugue's rule rather than left as an
aspiration: **state claims attach only to frozen snapshots and to
focus-scoped handler parameters; the live machine object carries no state
claim in its type.** That is a smaller promise, it is sound, it has a
forty-year-old name, and note 06 arrived at it independently by measuring the
compiler. Two routes, one answer, is as close to settled as this gets.

**2. Stop trying to buy the expensive half; you already own the cheap half.**
The two halves of typestate are (a) "the state determines the legal
operations", which is a discriminated union and a keyed handler map — free in
TypeScript — and (b) "no stale reference can lie about the state", which
requires linearity — unavailable, at any price. The propositions and the
requirements spend their ceremony budget as if (b) were purchasable. It is
not. Every line of `defineMachine<Model>()(…)` spent trying to make a
narrowed live handle trustworthy is spent on Brady's Attempt 1 (F7).

**3. The arrow test now has measured support from two directions.** Sunshine
et al. 2014 found that _explicit state transitions_ improved even the
method-first questions that state grouping cannot help (1.87×), and
`typestate-rs` had to invent `#[metadata(label=…)]` precisely because its
targets hid inside bodies (F20). Note 10's "the propositions score badly on D"
is confirmed by a controlled experiment and by an independent project's bug
report. Keep the target at a fixed syntactic position.

**4. The project's use case is in the tail of the empirical base — so refuse
inherited ceremony.** 80% of contract protocols and ~78% of Java protocols are
two-state one-shot affairs (F13). The permission vocabularies, fraction
arithmetic and second declaration sites were all priced against `open`/`close`
and against library authors, not against a four-state gesture recogniser
written by the person who will read it next week. When a requirement's only
justification is "the typestate literature does it", that justification is
weaker than it looks.

**5. Where the current direction looks wrong: P0.3's "exact target typestate
in the exposed outcome".** F17 is the relevant experiment, and it says that
when the correctness of an operation depends on _another_ object's state, 100%
of participants wrote a runtime check instead of the static coupling — in a
language purpose-built for the static coupling, with the states already
declared for them. The Marking Menu's dwell timer is exactly that shape. The
recommendation is not to drop precise outcome types, which are cheap when they
are just discriminated unions (F8), but to **stop treating cross-boundary
static precision as a P0** and to provide a first-class runtime-checked path
for it (F21), which is what users will reach for regardless.

**6. `submit()` + stale-token rejection is vindicated, not a compromise.**
Fowler's linear-resource-owning process that ignores duplicate GUI messages
(F11) is the same design, arrived at in a language with real linear types.
Note 08's F7 wondered whether the dwell-token bookkeeping in the acceptance
case is a workaround rather than a requirement. F11 says the _pattern_ is
principled; whether the token is user-visible or library-managed remains the
open question, and `gen_statem`'s automatic state-timeout cancellation
suggests the library should own it.

**7. Per-state handler maps are right for a reason nobody in this repo has
written down.** Fowler's model-transitions result (F12) says a single sum-typed
model forces you to write branches that cannot happen. That is a stronger
argument for the propositions' shape than "it reads nicely", and it is
orthogonal to where the target goes — so the false dilemma note 10 identified
is now supported from a second literature.

**8. Fuse the vocabularies, and do not ship an aliasing model as a user
concept.** F18's three fixes translate directly: one construct, transitions
visible in signatures, no annotations on locals. The requirement that a
candidate "must document the lifetime and aliasing rules of state
observations" should be satisfied by _one sentence_ — "an observed state is a
snapshot; the machine may have moved on" — not by a permission vocabulary.
Plaid's pilot (all three participants misreading `pure` as a state) is what
happens otherwise.

**9. The most uncomfortable finding, stated plainly.** Aldrich and Sunshine —
who spent a decade building Plural and Plaid — concluded that protocol errors
rarely reach production and that typestate's payoff is helping developers work
faster and learn the protocol (F14). If that is right, then the project's
objective function is _correct_ and the requirements document's emphasis on
exhaustive static precision is the part that needs justification. The
literature that the typestate requirements were presumably drawn from does not
support them as strongly as their prominence implies; what it supports, with
its single best number, is making states and transitions _legible_.
