# 08 — Acceptance traces

**What to build:** End-to-end traces proving the individually-specified behaviours
compose into working machines. Three of the four acceptance cases, as recorded in the
spec's fixture strategy.

**Two-state ceremony floor, plus live-runtime trace 1.** Two data-free states, each
exposing one input that enters the other. Checks that states without data need no
placeholder object and that the smallest useful machine is not dominated by
declarations. Trace 1 belongs here rather than with the queue tests because it is the
composed version of the same guarantee: an observer submits a second input while
observing the first transition; the first commit-and-observation cycle finishes before
the queued input is applied, and the outermost call returns only after the queue drains.

**Asynchronous request race.** Idle, loading, success and failure states carrying a
request identity, with progress, success, failure, cancel and reset inputs. The required
race is: start request 0; cancel it; start request 1; receive success for request 0 and
observe no transition; receive success for request 1 and enter success with its result.
This is the composed form of "stale results are free" — a result arriving after the
machine has moved on matches no row and does nothing. Settlement is an ordinary send, so
there are no timers and no wall-clock dependence.

**Reduced Marking Menu.** The primary acceptance case: idle, startup, expert and novice
states over down, move, dwell-elapsed, up and cancel inputs, with its five required
traces including the stale dwell timer that must not enter novice.

The case is specified in terms of effects — "reports start", "schedules dwell", "cancels
token" — and v1 owns no effects, since `actions` is deferred. **Effects are therefore
re-expressed as caller-side listeners**, which is v1's documented answer ("the caller
writes a function"). The test file should note this, so a reader does not mistake the
shape for a limitation discovered here rather than a deferral decided in the design.

**Deliberately excluded**, so the gaps read as decisions:

- Live-runtime trace 2, which assumes disposal — v1 has no `stop()`.
- The twenty-state case's measurement half — declaration size, cold check duration,
  completion latency — which belongs to the measurement script. Its inference aspect is
  covered by ticket 07.
- The residency recipe and its policy wrappers.

**Blocked by:**

- 04 — Reading and Sending behaviours
- 05 — Observing and the queue

Both, because these traces compose what those tickets specify individually; writing them
first would mean guessing at behaviour those tickets pin down.

**Status:** done

- [x] The two-state case and live-runtime trace 1 are asserted
- [x] The asynchronous race is asserted as its five-step trace, with no timers and no
      wall-clock dependence
- [x] The Marking Menu case is asserted across all five required traces, including the
      stale dwell timer producing no transition
- [x] The Marking Menu file notes that effects are re-expressed as caller-side listeners
      because `actions` is deferred
- [x] Live-runtime trace 2 is not implemented, and its absence is noted with the reason
- [x] Every test fails only because the v1 entry point does not exist
