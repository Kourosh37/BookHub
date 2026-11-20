# Dependency review

The application upgrades Next.js 14.2.5 to 16.2.9, React to a matching 19.2.7 pair, and jsPDF to 4.2.1. Testing uses pinned matching Playwright 1.61.0 and Vitest/coverage 4.1.9 versions.

The registry available during implementation advertises some newer releases without publishing their required packages. In particular, Next 16.4.6 cannot install because @next/env and native SWC packages at that version are missing. The fixes referenced by the audit for sharp 0.35.5, Zod 4.6.6, DOMPurify 3.4.17, deepmerge-ts 8 and source-map-js 1.2.2 were also unavailable. No fabricated versions, mismatched native SWC overrides or audit suppression are used.

Application mitigations:

- Next image optimization is disabled globally; avatars use a raster-only, size/pixel-bounded re-encoding path. Raw SVG/HEIF input is rejected before passing it to sharp.
- This application has no Server Actions, experimental use-cache functions, custom rewrites or Edge-runtime API routes.
- jsPDF is used only for text/embedded-font generation. Its HTML/DOMPurify path is not invoked.
- HTTP JSON bodies and input arrays/strings are bounded before schema validation.
- Prisma's configuration merging and CSS/source-map parsing consume trusted repository configuration, not HTTP-supplied configuration.

These limits reduce exposure; they are not a substitute for upstream patches or a claim that npm audit is clean. Run npm audit after registry availability changes, install matching patched releases, and rerun the complete check. Review new advisories against actual application usage.
