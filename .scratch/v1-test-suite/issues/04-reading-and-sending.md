# 04 — Reading and Sending behaviours

**What to build:** The two behaviour groups that describe what a host reports and what
happens when you send it an input — observable behaviours 4 through 16.

**Reading (4–7):**

- `current` is `{ state, data }`, with `data` `undefined` for a `void` state.
- A value read from `current` before a transition is unchanged after it. Asserted both
  against a deep clone captured beforehand **and** with an object-identity check, so an
  implementation that mutates in place fails even when the values happen to coincide.
- `available` lists the current state's inputs in table declaration order, without
  duplicates — one entry for an input carried by two rows.
- `available` is empty for a state with no outgoing rows.
- `available` lists an input whose every candidate row would decline. This is the
  clarification added by ticket 02: capability is a property of the table, not of a
  payload the host does not have.

**Sending (8–16):**

- A handled input commits and every listener whose pattern matches fires.
- An input matching no row changes nothing and notifies nobody.
- An input whose every candidate row declines is **externally indistinguishable** from
  one that matched no row — deliberately, so assert the same observable outcome.
- With several rows for one source/input pair, candidates are tried in declaration
  order and the first that does not decline wins.
- A self-transition commits and notifies like any other row, with the same state on
  both ends, the old data on the source end and the new data on the target end.
- A handler receives the source state's data and the input payload; a `void` input's
  payload is `undefined`, and a handler whose target is `void` returns nothing.
- `send` returns `undefined`, always.
- An input name outside the vocabulary changes nothing. The runtime half of this is
  ticket 06's plain-JavaScript file; this ticket covers what is reachable from typed
  code.

All assertions go through the public entry point. No test imports an internal module.

**Blocked by:**

- 03 — Test harness and the construction tracer (config and fixtures)
- 02 — Doc clarifications (the `available` skip-only behaviour must be specified before
  it is asserted)

**Status:** ready-for-agent

- [ ] Tests exist for observable behaviours 4–16, each titled with its number
- [ ] `available` ordering, deduplication, emptiness and skip-only inclusion are each
      asserted separately
- [ ] The all-decline case asserts the same observable outcome as the no-match case
- [ ] Declaration-order priority is asserted with at least two rows sharing one
      source/input pair and different targets
- [ ] `current` stability is asserted by both deep equality against a prior clone and
      object identity
- [ ] Every test fails only because the v1 entry point does not exist
