# Weekly update mechanism

AI-ChainGraph uses a reviewed weekly publication cycle rather than overwriting financial relationships directly from a crawler.

## Cadence

- Monday 09:00 Asia/Shanghai: compare SSE, SZSE, and BSE listing notices with the latest approved manifest under `data/listing-reconciliations/` before reviewing other disclosures.
- Record every new listing as `included` or `excluded` with an official exchange URL and a decision reason. A listing must never disappear merely because it is outside the current ontology.
- Add every included A-share as an issuer, security, L1 issuance relation, and at least one evidence-backed typed industry relationship.
- Inspect official disclosures published since the previous source cutoff.
- Prioritize companies that still have only broad segment mappings and segments with fewer than five issuer mappings.
- Add approved source documents, concise claims, and typed issuer relationships as a `*.batch.json` file under `data/weekly-candidates/`.
- Run `npm run update:weekly`, `npm run validate:snapshot`, `npm run audit:relationships`, and `npm run build`.
- Commit and push only when validation succeeds, then publish the same commit to the existing OpenAI Sites project.
- Monday 10:30 Asia/Shanghai: GitHub Actions checks that the weekly refresh is no more than eight days old and that at least 90% of issuers have a specific relationship.

## Evidence policy

L1 official filings and company disclosures are preferred. L2 industry sources are accepted only when the statement is attributable and the public URL is stable. Search snippets, unsourced summaries, and inferred customer or supplier relationships are not publishable evidence.

Every typed relationship must state what the issuer does: produces, develops, operates, integrates, provides, or distributes. A relationship remains `issuer_participates_in_segment` when the evidence does not support a specific action.

## Commands

```bash
npm run update:weekly
npm run validate:snapshot
npm run audit:relationships -- --min-specific-issuer-rate=0.9 --max-check-age-days=8 --max-a-share-listing-reconciliation-age-days=8
npm run build
```

`npm run update:weekly` derives the A-share reconciliation date from approved, continuous manifests; it cannot be advanced with a command-line flag. `public/snapshots/update-status.json` records the latest check, next scheduled check, reconciliation counts, source cutoff, imported batches, promotions, and current relationship-quality metrics. The A-share field is deliberately scoped: US-listed issuer reconciliation uses separate SEC and exchange-source review and is not implied by this date.
