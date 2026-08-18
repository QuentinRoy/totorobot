# 01 — Build pipeline and size reporting

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** a consumer can install the package and get a single
dependency-free ESM file with declarations beside it, and a maintainer can see
what that file costs before pushing.

This lands against the **current** source, which still compiles, so it is green
on its own. Doing it first means every later size decision has a real number
behind it instead of a guess.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `pnpm build` produces one minified ESM bundle, no CommonJS/UMD/IIFE output
- [ ] Declarations are emitted beside the bundle by the vite declaration plugin
- [ ] Minification is terser, tuned: multiple compress passes, `unsafe_arrows`,
      `unsafe_methods`, toplevel mangle, and **no** property mangling
- [ ] `pnpm size` prints raw, gzip and brotli sizes for the bundle
- [ ] Package `exports` points at the built output; `sideEffects: false` is set
- [ ] The package stays private — no publish, no version bump
- [ ] No linter is added
