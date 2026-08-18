# 02 — Correct and complete the merged suite

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** the test suite expresses every guarantee v1 actually claims,
so the implementation has a correct target to be driven from.

**Note on green:** the suite is already red — nothing implements the API — and
this ticket does not change that. It adds tests that will fail until 04. That is
expected and is not a regression.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] The pattern tests observe through a **host**, not a definition. They
      currently call the observation method on a definition, and one such call is
      not marked as an expected error, which would force a typed callable method
      onto the definition. The specification forbids this in two places and these
      files also execute as runtime tests, so the call would throw. The test is
      wrong; the specification stands.
- [x] The type-level degradation tripwires move out of `explorations/` and into
      the suite as a type test; the exploration file is deleted. Tripwires belong
      in tests.
- [x] `initial` gains the negative coverage the suite has none of: rejected when
      it names a state outside a declared vocabulary, and open to any string when
      no states are declared. This is the reverse-inference failure that silently
      destroys the untyped path.
- [x] No test asserts on internals — every assertion goes through the public
      surface, as the existing suite already does
