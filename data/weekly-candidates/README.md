# Weekly evidence batches

Weekly relationship additions enter the public graph through reviewed `*.batch.json` files in this directory.

Each batch must:

- use a unique `batch_id`;
- set `review_status` to `approved` and include `reviewer` plus `reviewed_at`;
- cite public HTTPS source documents;
- attach every relation to at least one reviewed claim;
- start at an existing issuer and end at a typed industry element;
- use a specific action: `issuer_produces`, `issuer_develops`, `issuer_operates`, `issuer_integrates`, `issuer_provides`, or `issuer_distributes`;
- use L1 or L2 evidence only.

Run `npm run update:weekly` to import unapplied batches, reclassify evidence-backed fallback mappings, recompute quality metrics, and update the weekly check timestamp. The public validator rejects broad mappings that pretend to be typed relations.

Use `weekly-update.example.json` as the shape reference. Its placeholder records are not imported because only files ending in `.batch.json` are processed.
