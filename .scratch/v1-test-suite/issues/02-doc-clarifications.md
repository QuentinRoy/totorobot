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

**Status:** done

- [x] `docs/api.md` states that `available` includes an input whose every row declines —
      the `available` bullet under **Reading** carries the derivation and its reason: it
      comes from the table, not from running handlers, which would need a payload
      `available` does not have, and would run them for their answer without committing
      it. It says which inputs the state has rows for, not which will commit.
- [x] `docs/api.md` states that `types<T>()` returns `null` — in the surface table row,
      previously "no runtime value", and in the `inputs`/`states` section, which now
      rules out `undefined` and a marker object
- [x] Both are phrased as normative behaviour, consistent with the document's existing
      voice, and reachable from the numbered observable-behaviour list where one applies
      — observable behaviour **6** carries the `available` statement, and **10** now
      names the one external difference from 9 (the input is in `available`, 9's is
      not), where it previously said only "indistinguishable". No numbered item was
      added for `types<T>()`: none of the six groups covers construction-time
      declarations, and inserting one anywhere but the end would renumber 8–29, which
      the `inputs`/`states` section cross-references as "items 27–29". The ticket
      located that clarification in two unnumbered places, so nothing is lost.
- [x] `pnpm format:check` passes

One edit beyond the two clarifications: **What is claimed** said `available` tells you
which inputs "will be ignored", which the first clarification contradicts. It now reads
"which inputs the current state has no row for at all — not which ones will commit,
since a row may still decline."
