# 02 — Write the two clarifications into `docs/api.md`

**What to build:** Two behaviours settled during the design interview are currently
unrecorded, so the spec and the coming test suite would disagree. `docs/api.md` gains
both, stated where the surrounding prose already discusses them.

1. **`available` lists an input whose every candidate row would decline.** `available`
   is derived from the transition table, not from evaluating handlers — computing it
   otherwise would require a payload it does not have. This belongs beside the existing
   description of `available` as "the input names the current state handles, in the
   table's declaration order, without duplicates", and alongside numbered observable
   behaviours 6 and 7.

2. **`types<T>()` returns `null` at runtime.** Currently specified only as "carries no
   runtime value", which does not say what a caller observes. This belongs in the
   surface table's description of `types<T>()` and in the `inputs`/`states` section.

Both are asserted by later tickets, so the spec must state them before the tests do.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `docs/api.md` states that `available` includes an input whose every row declines
- [ ] `docs/api.md` states that `types<T>()` returns `null`
- [ ] Both are phrased as normative behaviour, consistent with the document's existing
      voice, and reachable from the numbered observable-behaviour list where one applies
- [ ] `pnpm format:check` passes
