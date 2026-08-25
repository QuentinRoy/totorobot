# Evaluation brief for the research round

> Written before the synthesis pass. This records what the project is actually
> optimizing for, and the two concrete dissatisfactions that triggered the step
> back. Research notes 01-09 are the outside evidence; this file is the lens
> they are read through.

## The objective function

Ease of authoring, readability, and developer experience are the goal. They are
not one requirement among many, and they are not tie-breakers applied after a
feature list is satisfied.

Capabilities — typestate precision, effect integration, timing, queueing,
observation — are **constraints in tension with that goal**, not goals of their
own. Every capability must pay for the ceremony it adds to a small machine. A
capability that cannot be reached without making the two-state case worse has
failed, even if it is individually correct.

This inverts the usual reading of `requirements.md`. That document is a priority
stack of outcomes; it is not a mandate to maximize coverage. The target is not a
library that can express every machine. It is a library whose small machines are
obviously right at a glance.

## Dissatisfaction 1: the ceremony floor is library-shaped

All three propositions in `../design-record.md` require the state
and input vocabulary to be written twice — once as a model type, once as the
behavior map — plus a `defineMachine<Model>()(...)` double call whose only
purpose is to create a TypeScript inference boundary.

The two-state toggle costs roughly fourteen lines for behavior that is "flip".
The API is paying rent to the type checker rather than to the author.

Open question for the synthesis: is the second declaration site actually forced
by current TypeScript? The project's "Attempt 1" (see
`../design-record.md`) concluded that inferring states and data from one
object literal produced remote, machine-wide errors instead of local ones. That
conclusion predates `const` type parameters, `NoInfer`, and `satisfies`. It
should be re-falsified, not inherited.

## Dissatisfaction 2: transitions fail the arrow test

A transition is `(source, input, outcome kind, target)`. The propositions make
the first two scannable and the last two invisible.

Source state is an object key. Input is an object key. Both sit at fixed,
formatter-stable positions and can be read down a column. But the outcome kind
and the target state live inside an expression at arbitrary depth in a handler
body:

```ts
decide: ({ data, input, change }) =>
	input.verdict === 'approve'
		? change.published([data.text, data.revision])
		: change.draft({ text: input.text, revision: data.revision + 1 }),
```

Answering "where can `review` go?" requires reading every body, finding every
`change.*` call — including those nested in ternaries, early returns, and helper
calls — and taking their union mentally. That is the single question a state
machine exists to answer cheaply.

The same cause explains a listed weakness of Proposition 1: runtime topology
cannot be recovered from opaque function bodies. The information is hidden from
the reader and from the library for one reason, and fixing it for one reader
fixes it for the other.

### The arrow test

Can a reader recover source, input, outcome kind, and target from **fixed
syntactic positions**, without reading any body, after ordinary Prettier
formatting?

Prior art keeps the target at a position rather than at a depth:

- Boost.SML / Boost.MSM: `src + event<e> [guard] / action = dst` — target last
  in a table row.
- XState: `on: { EVENT: { target: 'x' } }` — target is a labeled key.
- SwingStates: the destination state is named in the transition constructor.
- Erlang `gen_statem`: `{next_state, NewState, Data, Actions}` — target at a
  fixed tuple position.
- Any statechart diagram: the arrow itself.

Candidates should be scored on this, and on what the test costs them: a fixed
target position tends to push conditional logic out of ordinary control flow and
into a guard/rule notation, which is exactly the trade Proposition 2 makes and
pays for with a mini-language. Whether that trade is worth it is an open
question the synthesis must answer with evidence, not taste.

## What the synthesis must produce

1. An evidence-backed account of what makes a state-machine library good to
   author and read, drawn from notes 01-09 rather than from preference.
2. A judgement on which requirements in `../requirements.md` are load-bearing
   for small interaction machines and which are inherited ceremony that the
   literature or practice does not support at this scale.
3. A direct verdict on the three propositions against the objective function
   above, including the two dissatisfactions named here.
4. Concrete alternative directions that pass the arrow test without adopting a
   transition mini-language, or an argued case that the trade is unavoidable.
