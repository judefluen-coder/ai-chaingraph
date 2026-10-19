# Weekly update mechanism

AI-ChainGraph uses a reviewed weekly publication cycle rather than overwriting financial relationships directly from a crawler.

## Cadence

- Monday 09:00 Asia/Shanghai: compare SSE, SZSE, and BSE listing notices with the latest approved manifest under `data/listing-reconciliations/` before reviewing other disclosures.
- Record every new listing as `included` or `excluded` with an official exchange URL and a decision reason. A listing must never disappear merely because it is outside the current ontology.
- Approve a current-period reconciliation only after recording all three exchange check times; future-dated checks or approval before those checks fail validation.
- Add every included A-share as an issuer, security, L1 issuance relation, and at least one evidence-backed typed industry relationship.
- Inspect official disclosures published since the previous source cutoff.
- Prioritize companies that still have only broad segment mappings and segments with fewer than five issuer mappings.
- Add approved source documents, concise claims, and typed issuer relationships as a `*.batch.json` file under `data/weekly-candidates/`.
- Run `npm run update:weekly` and `npm run build:sites`; the release build includes tests, snapshot and relationship audits, semantic and search-performance checks, browser regression tests, and Sites package validation.
- Review usage-only `issuer_integrates` relations to physical products or materials; the semantic audit blocks new unreviewed candidates and keeps the existing backlog visible rather than treating it as approved evidence.
- Preserve local changes and unpublished commits. Start a `codex/weekly-YYYY-MM-DD` branch from current `origin/main` in a clean workspace; reuse an existing weekly PR when retrying.
- Commit and push the work branch only when validation succeeds. Open a PR, wait for required CI, and merge under the existing branch rules. Never push directly to protected `main`, force-push, or bypass checks.
- After merging, build from that clean main commit and wait for its Pages deployment before publishing the existing OpenAI Sites project. Do not deploy artifacts built from the pre-merge work branch.
- After Pages deploys, rebuild from a clean `main` and run `npm run check:sites-release-ready`; after Sites deploys, run `npm run verify:sites-deployed`. Both commands compare the public commit fingerprint and exact graph/status hashes, not just update dates.
- Monday 10:30 Asia/Shanghai: GitHub Actions checks that the weekly refresh is no more than eight days old and that at least 90% of issuers have a specific relationship.

The local Monday heartbeat is configured separately from GitHub Actions. Actions validates freshness; it does not independently collect evidence or publish Sites. The heartbeat requires an available executor and working credentials. On a temporary network error, retry at most twice, retaining the failed stage and commit SHA. On a quality failure, stop publication and report it; never change review dates merely to make a gate pass. Resume from the actual PR/deployment state to avoid duplicate batches or releases.

## Evidence policy

L1 official filings and company disclosures are preferred. L2 industry sources are accepted only when the statement is attributable and the public URL is stable. Search snippets, unsourced summaries, and inferred customer or supplier relationships are not publishable evidence.

Every typed relationship must state what the issuer does: produces, develops, operates, integrates, provides, or distributes. A relationship remains `issuer_participates_in_segment` when the evidence does not support a specific action.

If a prior typed mapping overstates an official disclosure, withdraw it in an approved batch with the original relation, review source, and reason. The current graph drops that edge while release history preserves the correction; a lower specific-relation count is preferable to a false claim.

## Commands

```bash
npm run update:weekly
npm run validate:snapshot
npm run audit:relationships -- --min-specific-issuer-rate=0.9 --max-check-age-days=8 --max-a-share-listing-reconciliation-age-days=8
npm run audit:semantic-precision
npm run check:performance
npm run build:sites
```

`npm run update:weekly` derives the A-share reconciliation date from approved, continuous manifests; it cannot be advanced with a command-line flag. `public/snapshots/update-status.json` records the latest check, next scheduled check, reconciliation counts, source cutoff, imported batches, promotions, and current relationship-quality metrics. The A-share field is deliberately scoped: US-listed issuer reconciliation uses separate SEC and exchange-source review and is not implied by this date.

`next_scheduled_at` is the next Monday at 09:00 Asia/Shanghai, not seven days after an ad hoc review. Replaying the same `checked_at` without new batches preserves that check's original change and import summary.

The same command refreshes the marked snapshot summaries in `README.md` and `README.en.md`; `npm run validate:snapshot` rejects either summary if its counts or dates drift from the public snapshot. Text outside those markers remains hand-edited.

`npm run check:performance` caps the compressed graph snapshot and the main parse, index, layout, and traversal phases; browser regression tests also require the desktop and mobile research directories to become usable promptly after the snapshot response. These are release budgets, not claims about network latency on every connection.

`scripts/semantic-review-backlog.json` records unresolved candidate relation IDs captured on 2026-10-10. They are not endorsed facts or an exception to evidence review. `npm run audit:semantic-precision` fails when a new usage-only physical integration mapping appears and reports how many captured candidates have been resolved.
