# pogi-code-delivery

Public **manual-only** distribution point for Order 66 / Adventure Land V3 release artifacts.

**Status: NO APPROVED V3 RELEASE. No character should load code from this repository yet.**

- Development source of truth: private `gbertz1/PogiBrain`, `adventureland/v3/`.
- Public contents: only **reviewed, generated, non-secret browser bundles** and matching manifests after explicit approval.
- Every release must pass full-source offline tests, a four-role inert-load test, secret review, SHA-256 verification, and a manually checked immutable GitHub commit pin.
- Loading a staged file must **not** launch characters. Activation and any in-game tests need a separate user-present step.
- **No GitHub Actions, no paid build services, no automatic uploads, auto-updates, reloads, retries, or fallbacks to moving branches.**
- Stable V2 is unchanged; V3 Recovery remains postponed.

Public repository files are visible to everyone. Never publish credentials, tokens, unreviewed private PogiBrain source, or character/account secrets.

Current release: **none**.
