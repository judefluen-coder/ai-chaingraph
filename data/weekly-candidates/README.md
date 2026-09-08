# Weekly evidence batches

Weekly relationship additions enter the public graph through reviewed `*.batch.json` files in this directory.

Each batch must:

- use a unique `batch_id`;
- set `review_status` to `approved` and include `reviewer` plus `reviewed_at`;
- add a newly listed company as an `issuer` plus `security`, backed by an L1 `security_issued_by` relation;
- cite public HTTPS source documents;
- attach every relation to at least one reviewed claim;
- start an industry mapping at an existing or newly added issuer and end at a typed industry element;
- use a specific action: `issuer_produces`, `issuer_develops`, `issuer_operates`, `issuer_integrates`, `issuer_provides`, or `issuer_distributes`;
- use L1 or L2 evidence only.

New A-share listings must also appear in an approved complete manifest under [`data/listing-reconciliations/`](../listing-reconciliations/README.md), including listings intentionally excluded from the AI ontology. Run `npm run update:weekly` after the manifest and any included-company batches are ready. The command validates listing coverage, imports unapplied batches, adds reviewed issuers and securities, reclassifies evidence-backed fallback mappings, recomputes quality metrics, and updates the weekly check timestamp. The public validator rejects broad mappings that pretend to be typed relations.

Use `weekly-update.example.json` as the shape reference. Its placeholder records are not imported because only files ending in `.batch.json` are processed.
