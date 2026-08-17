# 01 — Retire the legacy suites

**What to build:** The repository stops describing two contradictory APIs. The
previous-generation test file and the vendored robot3 tests are removed, so the only
suite in the repo is the v1 one being built.

Before deleting `tests/robot3/`, mine it for behavioural cases worth carrying into the
v1 suite, and record the mapping in the commit message so the deletion is auditable.
Known mapping from the design interview:

- guard fall-through → v1's `skip()` and declaration-order priority
- `immediate` → deferred in v1, no equivalent
- `invoke` → deferred in v1, no equivalent
- `debug` / `logging` → no v1 equivalent

The shared-trace-array style used by robot3's invoke tests is prior art for the v1
ordering tests and should be noted as carried over rather than reinvented.

`explorations/` and `examples/` are untouched — `explorations/` is evidence for the
rationale documents, still passes, and keeps its signal.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `tests/totorobot.test.ts` is deleted
- [ ] `tests/robot3/` is deleted in full
- [ ] No test file in the repo references `defineMachine`, `interpret`, or robot3
- [ ] The commit message records which behavioural cases carry over to v1 and which
      have no v1 equivalent
- [ ] `explorations/` and `examples/` are unchanged, and `pnpm typecheck` still passes
