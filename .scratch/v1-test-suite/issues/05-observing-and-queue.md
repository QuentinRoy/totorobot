# 05 — Observing and the queue

**What to build:** The listener contract and the execution model — observable behaviours
17 through 26, plus four guarantees that `docs/api-rationale.md` states but the numbered
list does not fully capture.

**Observing (17–21):**

- `on` returns an unsubscribe function, and calling it more than once is harmless.
- Listeners fire after the commit, in registration order.
- Inside a listener, the record's target end deep-equals `current`. The spec says
  _deep_-equals, so this uses deep equality deliberately, not object identity, which is
  left unasserted rather than over-specified.
- `*` matches any state; an unlabelled arrow matches any input; a labelled one matches
  only that input.
- The listener list is snapshotted before dispatch: a listener unsubscribed by an
  earlier listener still runs for the current transition, and one registered during a
  dispatch does not.

**The queue (22–26):**

- A send from inside a listener does not take effect before the remaining listeners for
  the current transition have run.
- The queue drains before the outermost send returns — synchronously, not on a
  microtask.
- Several queued sends drain first-in-first-out.
- A queued send is evaluated against the state at drain time, so it may correctly find
  no row and do nothing.
- A listener that throws propagates out of send; the listeners after it do not run and
  that dispatch's queue is abandoned, but the transition stays committed and the host
  works afterwards.

**Beyond the numbered list, from the rationale:**

- **The drain flag must be reset on the way out.** The rationale names the failure it
  prevents: a single throw otherwise wedges the host into answering "queued" forever and
  never draining. Observable behaviour 26 only requires that "a later `send` transitions
  and notifies normally", which a **top-level** send satisfies even with a wedged flag.
  So assert that a send **from inside a listener** still queues and drains after an
  earlier dispatch threw. This is the single most likely defect in golfed code.
- **A listener is never re-entered** while an earlier call is still running — a contract
  in its own right, distinct from queue ordering.
- **A self-transition matches both** the exit pattern and the entry pattern. This is what
  makes restart-on-re-entry fall out of the pattern language.
- **Every submitted input is considered exactly once** — the drain guarantee is
  unconditional now that there is no disposal.

**How ordering is asserted.** Every ordering claim uses a shared trace array: listeners
push a string, and the test asserts one comparison against the whole sequence. One
assertion carries the entire claim, the expected array reads like the spec's own trace
prose, and interleaving — the queue draining _after_ the remaining listeners — is
visible rather than inferred. Pairwise call-order comparisons were rejected as
indirect and unreadable past four events. Spies are used only where the assertion
concerns the transition record's contents rather than sequence, and a single test uses
one style or the other, never both. Prior art: the shared-trace style in the robot3
invoke tests retired by ticket 01.

**Blocked by:** 03 — Test harness and the construction tracer.

**Status:** ready-for-agent

- [ ] Tests exist for observable behaviours 17–26, each titled with its number
- [ ] Ordering claims are asserted as whole sequences via a shared trace array
- [ ] The drain-flag test uses a send from **inside a listener** after an earlier throw,
      not a top-level send
- [ ] Listener non-re-entrancy, self-transition double-match, and considered-exactly-once
      each have their own test, marked as rationale-derived rather than spec-numbered
- [ ] The snapshot-before-dispatch behaviour is asserted in both directions:
      unsubscribed-during still runs, registered-during does not
- [ ] Every test fails only because the v1 entry point does not exist
