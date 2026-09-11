# Relationship history

The data-version control opens update records. Relation evidence and watched-company notes contain collapsed history sections. No additional primary navigation or unread notifications are shown.

`npm run build` generates `public/snapshots/release-history.json` from applied, approved weekly batches. Dates are batch review dates, not reconstructed deployment dates or inferred business-effective dates. Older relations without a recorded batch show an explicit empty state. A failed or mismatched history request is reported separately and does not prevent graph loading.

The history artifact contains `schema_version`, `data_updated_at`, `batches`, `events`, and `archived_relations`. Events use stable IDs, relation and issuer IDs, action types, `recorded_at`, and optional `effective_at`. Missing effective dates remain unknown. Replacements link to the original relation with `replaces_relation_id`. Original approved batches must remain immutable.

Archived records are separate from the current graph and preserve their original claim IDs. The detail renderer supports `superseded`, `withdrawn`, and `expired` lifecycle labels, plus an optional `replacement_relation_id`. This release derives replacement archives from approved batches; a reviewed withdrawal/expiry ingestion workflow is a subsequent data-pipeline change. No historical withdrawal or expiry is invented for existing data.

All graph navigation continues to use the current snapshot. History URLs can resolve archived relations without bringing them back into traversal. Source documents and claims referenced by archived relations must be retained.
