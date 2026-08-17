# 06 — The untyped path

**What to build:** Both halves of the guarantee that omitting the vocabulary widens
rather than breaks — the runtime half and the type half, landing together because they
are one spec group.

**The runtime half** lives in a real plain-JavaScript test file with no `@ts-check`.
The spec's own wording for observable behaviour 16 is "reachable from untyped code", so
a JavaScript file is the literal fixture, and it is the only option where the runtime
claim and the type claim are not entangled. It asserts that an input name outside the
vocabulary changes nothing — it does not throw, corrupt, or half-apply — and the same
for a bad state name reaching a listener pattern.

Two alternatives were rejected: a TypeScript file with `@ts-expect-error` above a
runtime assertion, because `.test.ts` files are not type-checked and the directive's
correctness would go unverified; and casting through a widened signature, which asserts
nothing about rejection and reads as a workaround.

Type-checking of JavaScript stays off, so this file is executed but never type-checked.

**The type half** covers observable behaviours 27–29:

- With both vocabulary maps omitted, a well-formed table compiles: state and input names
  are any string, handler data and input are `unknown`, and the initial state accepts any
  string.
- A malformed key is still rejected with no vocabulary declared, and the error still
  lands on the offending row rather than on the whole transitions block.
- Declaring one map and omitting the other checks that half and widens the other.

Negative assertions use `@ts-expect-error` only. The error-message carrier stays
internal and no test asserts the message text.

**Blocked by:** 03 — Test harness and the construction tracer.

**Status:** ready-for-agent

- [ ] A plain-JavaScript runtime test file exists, with no `@ts-check`, and is executed
      by the runtime pass but not type-checked
- [ ] An input name outside the vocabulary is asserted to change nothing
- [ ] Type tests cover all three untyped-path behaviours (27–29)
- [ ] The malformed-key rejection is asserted with no vocabulary declared, separately
      from the vocabulary-declared case in ticket 07
- [ ] Type assertions fail as unused `@ts-expect-error` or on the missing entry point,
      and for no other reason
