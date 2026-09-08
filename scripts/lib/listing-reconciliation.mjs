import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { SPECIFIC_RELATION_TYPES } from "./relationship-quality.mjs";

const REQUIRED_MARKETS = ["SH", "SZ", "BJ"];
const DECISIONS = new Set(["included", "excluded"]);
const OFFICIAL_EXCHANGE_DOMAINS = ["sse.com.cn", "szse.cn", "bse.cn"];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function isOfficialExchangeUrl(value) {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && OFFICIAL_EXCHANGE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export async function readAshareReconciliations(projectRoot) {
  const directory = resolve(projectRoot, "data/listing-reconciliations");
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".reconciliation.json"))
    .sort();
  invariant(filenames.length > 0, "At least one approved A-share listing reconciliation is required.");

  const manifests = [];
  for (const filename of filenames) {
    const manifest = JSON.parse(await readFile(resolve(directory, filename), "utf8"));
    invariant(manifest.review_status === "approved", `${filename} has not been approved.`);
    manifests.push({ ...manifest, filename });
  }
  return manifests;
}

export function validateAshareReconciliations(manifests, graph) {
  const entityById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const appliedBatchIds = new Set(graph.meta.refresh?.applied_batch_ids || []);
  const seenManifestIds = new Set();
  const seenSecurities = new Set();
  let previousReconciledThrough = null;
  let reviewedListings = 0;
  let includedListings = 0;
  let excludedListings = 0;

  const ordered = [...manifests].sort((left, right) => left.period_start.localeCompare(right.period_start));
  for (const manifest of ordered) {
    const label = manifest.filename || manifest.manifest_id;
    invariant(manifest.manifest_id && manifest.reviewer && manifest.reviewed_at, `${label} needs manifest_id, reviewer, and reviewed_at.`);
    invariant(!seenManifestIds.has(manifest.manifest_id), `${label} repeats manifest_id ${manifest.manifest_id}.`);
    seenManifestIds.add(manifest.manifest_id);
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(manifest.period_start || ""), `${label} has an invalid period_start.`);
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(manifest.reconciled_through || ""), `${label} has an invalid reconciled_through.`);
    invariant(manifest.period_start <= manifest.reconciled_through, `${label} has an inverted reconciliation period.`);
    invariant(!Number.isNaN(Date.parse(manifest.reviewed_at)), `${label} has an invalid reviewed_at timestamp.`);
    invariant(manifest.reconciled_through <= manifest.reviewed_at.slice(0, 10), `${label} cannot reconcile beyond its review date.`);
    invariant(JSON.stringify(manifest.markets) === JSON.stringify(REQUIRED_MARKETS), `${label} must reconcile SH, SZ, and BJ in that order.`);
    invariant(Array.isArray(manifest.listings), `${label} must include a listings array.`);
    if (previousReconciledThrough) {
      invariant(manifest.period_start === nextDate(previousReconciledThrough), `${label} must start the day after the previous reconciliation.`);
    }

    for (const listing of manifest.listings) {
      const key = `${listing.exchange}:${listing.symbol}`;
      invariant(REQUIRED_MARKETS.includes(listing.exchange), `${label}: ${key} uses an unsupported exchange.`);
      invariant(/^\d{6}$/.test(listing.symbol || ""), `${label}: ${key} has an invalid symbol.`);
      invariant(listing.name && /^\d{4}-\d{2}-\d{2}$/.test(listing.listing_date || ""), `${label}: ${key} needs a name and listing_date.`);
      invariant(listing.listing_date >= manifest.period_start && listing.listing_date <= manifest.reconciled_through, `${label}: ${key} falls outside the reconciliation period.`);
      invariant(isOfficialExchangeUrl(listing.source_url), `${label}: ${key} needs an official SSE, SZSE, or BSE listing source.`);
      invariant(DECISIONS.has(listing.decision) && listing.decision_reason, `${label}: ${key} needs an inclusion decision and reason.`);
      invariant(!seenSecurities.has(key), `${label}: ${key} was reviewed more than once.`);
      seenSecurities.add(key);
      reviewedListings += 1;

      if (listing.decision === "excluded") {
        excludedListings += 1;
        continue;
      }

      includedListings += 1;
      invariant(listing.batch_id && listing.issuer_id && listing.security_id, `${label}: included ${key} needs batch, issuer, and security IDs.`);
      invariant(appliedBatchIds.has(listing.batch_id), `${label}: included ${key} references an unapplied batch.`);
      const issuer = entityById.get(listing.issuer_id);
      const security = entityById.get(listing.security_id);
      invariant(issuer?.entity_type === "issuer", `${label}: included ${key} is missing issuer ${listing.issuer_id}.`);
      invariant(security?.entity_type === "security" && security.exchange === listing.exchange && security.symbol === listing.symbol, `${label}: included ${key} is missing its normalized security.`);
      invariant(graph.relations.some((relation) => relation.relation_type === "security_issued_by" && relation.from_id === listing.security_id && relation.to_id === listing.issuer_id), `${label}: included ${key} is missing its issuance relation.`);
      invariant(graph.relations.some((relation) => relation.from_id === listing.issuer_id && SPECIFIC_RELATION_TYPES.has(relation.relation_type)), `${label}: included ${key} is missing a specific industry relation.`);
    }
    previousReconciledThrough = manifest.reconciled_through;
  }

  return {
    reconciled_through: previousReconciledThrough,
    reviewed_listings: reviewedListings,
    included_listings: includedListings,
    excluded_listings: excludedListings,
    manifest_ids: ordered.map((manifest) => manifest.manifest_id),
  };
}
