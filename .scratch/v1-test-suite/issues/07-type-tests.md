# 07 — Type tests

**What to build:** The compile-time half of the suite — what the type checker must
accept and what it must reject. This is the half no coverage tool watches, so the list
is enumerated rather than discovered.

Four files, split by subject, because "what the types check" is its own spec section
with no numbered items and does not decompose along the runtime behaviour groups.

**Vocabulary and inference:**

- Narrowing the state narrows its data, with no nullable padding in states that
  logically guarantee a field.
- A handler's data is its **source** state's data and its input is that input's payload
  — asserted inside a handler with no type annotations anywhere, since "no handler needs
  a type annotation" is part of the claim.
- `start()` takes no argument when the initial state is `void`, and requires one
  otherwise. The same for `send` and `void` inputs.
- `available` is asserted as a readonly array of input names — **the weak claim**. The
  precise per-state literal union is deliberately not asserted: it is only reachable
  when the state is statically known, and the spec is explicit that per-state
  capabilities are advertised at runtime rather than enforced by the compiler. Asserting
  the weak claim leaves an implementation that cannot manage the strong one free to pass.
- The derived helpers over a machine type resolve correctly.

**Key grammar:**

- A handler returning the wrong shape for its target state is rejected.
- Reading source data the source state does not have is rejected.
- Unknown state or input names in a transition key are rejected.
- Every malformed spelling is rejected, one assertion per spelling — the whitespace rule
  is load-bearing, so the wrong-spacing variants are enumerated individually rather than
  sampled.
- A bare key naming a state is rejected in the transitions table.
- `skip()` returns an internal symbol, so a handler's return type is the target's data
  or that symbol. Because the symbol is internal, assert only that `skip()` is
  **returnable from a handler for every target shape including a `void` target**, plus
  the negative that a wrong-shaped return is still rejected on such a row — proving the
  union did not swallow target checking. Nothing asserts the symbol's identity.

**Patterns and the transition record:**

- Unknown names in a pattern are rejected.
- There is no `-*>` form: the wildcard appears only in state positions.
- A bare key is not a legal pattern, since a key with no arrow names a state and states
  mean residency.
- The record is discriminated by its input name, so checking it narrows the payload, and
  each end carries its own state and data.

**Scale:** inference holds at 20 states and 44 rows, using the twenty-state acceptance
case as a type fixture. Only its inference aspect is used here — declaration size, cold
check duration and editor latency belong to the measurement script, not to this suite.

Negative assertions use `@ts-expect-error` only, and the error-message carrier stays
internal. The known weakness — under an all-red file, `@ts-expect-error` cannot
distinguish an intended rejection from incidental breakage — is mitigated by the harness
executing these files as well as type-checking them, so a mistyped directive fails.

**Blocked by:** 03 — Test harness and the construction tracer.

**Status:** ready-for-agent

- [ ] Four type-test files exist, flat in the tests directory, using the type-test suffix
- [ ] Every claim listed above has an assertion; none is bundled into another
- [ ] Malformed key spellings are enumerated one per assertion
- [ ] `available` is asserted only as a readonly array of input names, not as a per-state
      literal union
- [ ] `skip()` is asserted as returnable for every target shape including `void`, with
      wrong-shaped returns still rejected on the same row
- [ ] No test imports or names the internal error-message carrier
- [ ] Every assertion fails as unused `@ts-expect-error` or on the missing entry point,
      and for no other reason
