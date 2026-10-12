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

An approved batch may also withdraw an unsupported issuer mapping. Each `withdrawn_relations` entry must copy the published relation exactly and include a review source belonging to that issuer plus a reason. Withdrawn edges leave the current graph but remain available in release history with the withdrawal reason; do not replace them with a guessed downstream product.

When correcting an existing relation, `replaces_relation_id` must be paired with a `replaced_relations` entry containing the exact original published relation, its original issuer source, and the reason for correction. This keeps baseline relations inspectable after replacement; a replacement event without an archived original blocks the history build.

A reviewed correction may keep an issuer at segment scope when the disclosure supports participation but not production of the typed element. Such an `issuer_participates_in_segment` relation needs L1/L2 issuer evidence, `attributes.review_reason`, and `attributes.promotion_locked: true` so heuristic promotion cannot undo the correction. Newly listed issuers still require a separate specific industry relation.

For physical elements, wording such as "used in" or "用于" a downstream device does not by itself establish the issuer's action on that device. The weekly updater leaves a new usage-based segment mapping broad until an approved batch verifies the issuer, action, and exact target; existing promoted mappings remain in the manual semantic-review queue.

New A-share listings must also appear in an approved complete manifest under [`data/listing-reconciliations/`](../listing-reconciliations/README.md), including listings intentionally excluded from the AI ontology. Run `npm run update:weekly` after the manifest and any included-company batches are ready. The command validates listing coverage, imports unapplied batches, adds reviewed issuers and securities, reclassifies evidence-backed fallback mappings, recomputes quality metrics, and updates the weekly check timestamp. The public validator rejects broad mappings that pretend to be typed relations.

Use `weekly-update.example.json` as the shape reference. Its placeholder records are not imported because only files ending in `.batch.json` are processed.
