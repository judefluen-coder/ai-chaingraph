import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildRelationshipQuality, maxSourceDate } from "./lib/relationship-quality.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const snapshotPath = resolve(projectRoot, process.argv.find((argument) => argument.endsWith(".json")) || "public/snapshots/transmission-v1.1.json");
const minimumRateArgument = process.argv.find((argument) => argument.startsWith("--min-specific-issuer-rate="));
const maximumAgeArgument = process.argv.find((argument) => argument.startsWith("--max-check-age-days="));
const maximumListingAgeArgument = process.argv.find((argument) => argument.startsWith("--max-a-share-listing-reconciliation-age-days="));
const minimumRate = Number(minimumRateArgument?.split("=")[1] || 0);
const maximumAgeDays = Number(maximumAgeArgument?.split("=")[1] || 0);
const maximumListingAgeDays = Number(maximumListingAgeArgument?.split("=")[1] || 0);
const graph = JSON.parse(await readFile(snapshotPath, "utf8"));
const quality = buildRelationshipQuality(graph);
const checkedAt = graph.meta.refresh?.last_checked_at || graph.meta.updated_at;

if (minimumRate && quality.specific_issuer_rate < minimumRate) {
  throw new Error(`Specific issuer rate ${quality.specific_issuer_rate} is below ${minimumRate}.`);
}

if (maximumAgeDays) {
  const ageDays = (Date.now() - new Date(checkedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays > maximumAgeDays) {
    throw new Error(`The weekly refresh is ${ageDays.toFixed(1)} days old; maximum is ${maximumAgeDays}.`);
  }
}

if (maximumListingAgeDays) {
  const listingReconciledThrough = graph.meta.refresh?.a_share_listing_reconciled_through;
  const ageDays = (Date.now() - new Date(`${listingReconciledThrough}T23:59:59.999Z`).getTime()) / 86_400_000;
  if (!listingReconciledThrough || !Number.isFinite(ageDays) || ageDays > maximumListingAgeDays) {
    throw new Error(`The A-share listing reconciliation is ${Number.isFinite(ageDays) ? `${ageDays.toFixed(1)} days old` : "missing"}; maximum is ${maximumListingAgeDays}.`);
  }
}

console.log(JSON.stringify({
  data_version: graph.meta.data_version,
  checked_at: checkedAt,
  a_share_listing_reconciled_through: graph.meta.refresh?.a_share_listing_reconciled_through || null,
  source_cutoff_date: maxSourceDate(graph),
  ...quality,
}, null, 2));
