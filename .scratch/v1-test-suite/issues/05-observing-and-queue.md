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

**Status:** done

- [x] Tests exist for observable behaviours 17–26, each titled with its number —
      `tests/observing.test.ts` (17–21) and `tests/queue.test.ts` (22–26), matching the
      file split in `plans/v1-tests.md`
- [x] Ordering claims are asserted as whole sequences via a shared trace array — every
      ordering test pushes onto a `log: string[]` and asserts one `toEqual` against the
      whole sequence; `vi.fn()` is not used anywhere in either file
- [x] The drain-flag test uses a send from **inside a listener** after an earlier throw,
      not a top-level send — `[rationale] the drain flag resets after a throw…` in
      `tests/queue.test.ts` unsubscribes the throwing listener, then has a *new* listener
      call `doc.send('toggle')` from inside itself and asserts the queued transition
      still drains
- [x] Listener non-re-entrancy, self-transition double-match, and considered-exactly-once
      each have their own test, marked as rationale-derived rather than spec-numbered —
      three tests titled `[rationale] …` (two in `queue.test.ts`, one — the self-transition
      one, since it is about pattern matching — in `observing.test.ts`)
- [x] The snapshot-before-dispatch behaviour is asserted in both directions:
      unsubscribed-during still runs, registered-during does not — `[21]` in
      `tests/observing.test.ts`, as two independent hosts in one test
- [x] Every test fails only because the v1 entry point does not exist — `pnpm test`
      reports the same single `TypeError: types is not a function` at
      `tests/fixtures.ts:16` for both new files that `tests/construction.test.ts`
      already reports; `pnpm typecheck` and `pnpm format:check` are both clean

Two additional design notes not called out by the ticket text:

- **FIFO (24) needed a machine with data**, not the `toggle` fixture. Two structurally
  identical queued `toggle` sends can't distinguish FIFO from LIFO — both drain orders
  produce the same state sequence, since each is evaluated fresh at drain time (25) with
  no memory of which call queued it. The test uses a small counter machine that appends a
  distinct payload per queued send, so the drain order is legible in the resulting array.
- **Recursive self-send tests all need a one-shot guard.** A listener that unconditionally
  calls `send` from inside itself queues another call to itself forever. Every test that
  sends from a listener (22, 23, 24, 25, 26, and two of the three rationale tests) uses a
  boolean flag so it queues exactly once.
