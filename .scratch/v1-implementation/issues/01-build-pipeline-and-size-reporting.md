# 01 — Build pipeline and size reporting

Source of truth: the v1 implementation spec under `plans/`.

**What to build:** a consumer can install the package and get a single
dependency-free ESM file with declarations beside it, and a maintainer can see
what that file costs before pushing.

This lands against the **current** source, which still compiles, so it is green
on its own. Doing it first means every later size decision has a real number
behind it instead of a guess.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `pnpm build` produces one minified ESM bundle, no CommonJS/UMD/IIFE output
- [x] Declarations are emitted beside the bundle by the vite declaration plugin
- [x] Minification is terser, tuned: multiple compress passes, `unsafe_arrows`,
      `unsafe_methods`, toplevel mangle, and **no** property mangling
- [x] `pnpm size` prints raw, gzip and brotli sizes for the bundle
- [x] Package `exports` points at the built output; `sideEffects: false` is set
- [x] The package stays private — no publish, no version bump
- [x] No linter is added
