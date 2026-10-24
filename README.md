# pogi-code-delivery

Public, manually approved **Order 66 / Adventure Land V3** JavaScript delivery artifacts.

## October 24, 2026 — approved inert V3 staging release

The owner explicitly approved publication of the four readable V3 browser bundles. They are visible to everyone, but **are not authorized for gameplay activation**.

- **Source of truth:** the private `gbertz1/PogiBrain` V3 source, pinned to `3619b7cd5a5671d426eb53784e3cee02941849fa`.
- **Files:** `order66-v3-Rentaro.js`, `order66-v3-Hibari.js`, `order66-v3-Harutora.js`, and `order66-v3-Souji.js`; see `release-manifest.json` for exact SHA-256 hashes and sizes.
- **Validated:** 206 source-file Git blob hashes; 13/13 delivery tests; 489/489 V3 regression tests; V2/V3 isolation and runtime boundary checks. All four bundles load inertly and include 94 CommonJS modules each.
- **Not enabled:** character auto-start, Skeleton Central/First State startup, V3 production selection, Recovery, and automatic code replacement.
- **Delivery:** use full 40-character **public Git commit SHA** in all future raw URLs. Never use `main`, `latest`, or a moving tag in a character CODE loader.
- **Operations:** no GitHub Actions, paid build service, auto upload, unattended update, retry loop, or browser restart.

Publishing files here is not permission to load them in a live game. Any browser/in-game smoke test must be separate and user-present. Stable V2 remains unchanged.

These release bundles include readable portions of the implementation from the private development repository. Do not publish credentials, tokens, or unreviewed private material in future releases.
