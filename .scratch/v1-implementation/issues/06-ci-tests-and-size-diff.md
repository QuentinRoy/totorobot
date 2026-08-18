# 06 — CI: tests and per-PR size diff

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** a pull request cannot merge red, and the cost of a change is
visible in review rather than discovered later.

There is no CI in the repository today; this creates it.

**Blocked by:** 05.

**Status:** done

- [x] Pull requests run the suite, including the dist run
- [x] Pull requests get a brotli size diff comment from the compressed-size
      action, configured over the built output
- [x] The local `pnpm size` number is **verified** to match the action's by
      running both on one commit and comparing — not assumed to match
- [x] No committed size baseline and no hard size gate: the diff reports, it does
      not block. A budget is deliberately not a scoring threshold.
- [x] Known limitation noted: the action cannot comment on pull requests from
      forks and prints to its log instead
