# 04 — v1 type layer

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** a TypeScript consumer declares a vocabulary once and gets it
enforced everywhere — narrowing the state narrows its data, a wrong handler
return or an unknown name is rejected on the offending row, and a caller who
declares nothing still gets a usable widened surface with the key grammar intact.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] Spacing is load-bearing: exactly one spelling, no trimming or
      normalisation in either the types or the runtime. Every loose spelling is a
      compile error. **This is the highest-risk item in the whole plan** — no
      prior art exists anywhere in the repository, since every earlier notation
      candidate deliberately tolerated spacing.
- [ ] A malformed key poisons its own value type so the error lands on the row,
      not on the table — an intersected missing property reports at the object
      level and is not acceptable
- [ ] The vocabulary uses constrained defaults, so widening falls out of the
      constraint with no conditional expressing "nothing declared"
- [ ] `NoInfer` on `initial`, in a plain position and **not** wrapped in a
      conditional, so the states map stays the only inference site. Without this
      `initial` reverse-infers the vocabulary and throws every real row off its
      line.
- [ ] Narrowing the current state narrows its data, with no nullable padding
- [ ] `start` and `send` arity follow the initial state's data and the input's
      payload respectively
- [ ] Declining is returnable for every target shape including a data-free one,
      without excusing a wrong-shaped return on the same row
- [ ] The derived vocabulary and reverse-index types resolve over a machine type
- [ ] Unknown names in an observation pattern are rejected; there is no wildcard
      in the label position and a bare key is not a legal pattern
- [ ] Declaring one vocabulary map and omitting the other checks that half and
      widens the other
- [ ] `pnpm test` and `pnpm typecheck` are both green
