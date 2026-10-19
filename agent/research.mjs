import {
  buildDetailModel, buildRelationDetailModel, createGraphViewIndex,
  formatSecurityCode, getRelationLabel, localize, searchTransmissionGraph,
} from "../src/lib/transmissionViewModel.js";
import { findShortestTransmissionPath } from "../src/lib/transmissionGraph.js";
import { buildCompanyComparison, comparisonSearch } from "../src/lib/companyComparison.js";
import { isSemanticReviewPending } from "../src/lib/semanticReview.js";
import { getRefreshStatus } from "../src/lib/refreshStatus.js";

const SITE = "https://judefluen-coder.github.io/ai-chaingraph/";

export class ResearchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function page(items, offset = 0, limit = 20) {
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit,
    next_offset: offset + limit < items.length ? offset + limit : null };
}

function website(params) {
  const url = new URL(SITE);
  url.search = new URLSearchParams(params).toString();
  return url.href;
}

function clipped(value, limit) {
  const text = String(value || "");
  return { text: text.slice(0, limit), truncated: text.length > limit };
}

function publicUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function createResearch(dataset, { now = Date.now } = {}) {
  const { graph, history, historyStatus, snapshotId } = dataset;
  // Historical or explicitly unaccepted edges must never re-enter current exploration.
  const current = { ...graph, relations: graph.relations.filter((relation) =>
    (!relation.lifecycle_status || relation.lifecycle_status === "active")
    && (!relation.review_status || relation.review_status === "accepted")) };
  const index = createGraphViewIndex(current);

  function metadata() {
    const freshness = getRefreshStatus(graph.meta.refresh, now());
    return {
      snapshot_id: snapshotId, data_version: graph.meta.data_version,
      data_changed_at: graph.meta.updated_at,
      checked_at: graph.meta.refresh?.last_checked_at || null,
      source_cutoff_date: graph.meta.refresh?.source_cutoff_date || null,
      freshness: freshness.state, history_status: historyStatus,
      warnings: [
        "Snapshot records are not live market coverage. Missing records do not prove absence of business.",
        "Industry paths/shared positions do not prove supplier contracts or investment outcomes.",
        "Official source level does not mean every action interpretation has been individually verified.",
        "Website links open the website's current release, which may differ from this local snapshot.",
        ...(freshness.state !== "current" ? ["Snapshot review is overdue or unknown; verify current disclosures."] : []),
        ...(historyStatus !== "available" ? ["History unavailable: run npm run agent:prepare, then restart the MCP connection."] : []),
      ],
    };
  }

  function entity(id, locale) {
    const record = index.entitiesById.get(id);
    if (!record) throw new ResearchError("NOT_FOUND", `Entity not recorded: ${id}`);
    return { id, name: localize(record, "name", locale), entity_type: record.entity_type, website_url: website({ entity: id }) };
  }

  function requireIssuer(id) {
    if (index.entitiesById.get(id)?.entity_type !== "issuer") {
      throw new ResearchError("COMPANY_NOT_FOUND", `No issuer with this ID: ${id}. Use search_entities first.`);
    }
  }

  function relation(record, locale) {
    return {
      id: record.id, from: entity(record.from_id, locale), to: entity(record.to_id, locale),
      action: record.relation_type, action_label: getRelationLabel(record.relation_type, locale),
      evidence_level: record.evidence_level || null,
      lifecycle_status: record.lifecycle_status || "active",
      review_status: record.review_status || "not_specified",
      interpretation_status: isSemanticReviewPending(record) ? "pending_semantic_review"
        : record.relation_type === "issuer_participates_in_segment" ? "broad_mapping" : "specific_record_not_accuracy_guarantee",
      review_reason: clipped(locale === "en" ? record.attributes?.review_reason_en || record.attributes?.review_reason : record.attributes?.review_reason, 1500),
      claim_ids: record.claim_ids || [],
      website_url: website({ entity: record.from_id, relation: record.id }),
    };
  }

  function company(id, locale, offset, limit) {
    requireIssuer(id);
    const detail = buildDetailModel(current, id, { locale });
    const mappings = detail.mappings.map(({ relation: record, evidence }) => ({
      ...relation(record, locale),
      latest_source_date: evidence.map(({ source }) => source?.publish_date).filter(Boolean).sort().at(-1) || null,
      evidence_available: evidence.length > 0,
    }));
    return { ...entity(id, locale), securities: detail.securities.map(formatSecurityCode), positions: page(mappings, offset, limit) };
  }

  function historyRequired() {
    if (!history) throw new ResearchError("HISTORY_UNAVAILABLE", "History is absent or does not match this graph. Prepare history and restart; do not interpret this as no changes.");
  }

  const actions = {
    get_dataset_status: () => ({ counts: graph.meta.counts, read_only: true, transport: "stdio", update_policy: "restart_after_local_snapshot_update" }),
    search_entities: ({ query, kind, locale, offset, limit, market }) => {
      const matches = searchTransmissionGraph(current, query, { locale, market, limit: current.entities.length })
        .filter((item) => kind === "all" || (kind === "issuer" ? item.kind === "issuer" : !["issuer", "security"].includes(item.kind)))
        .map((item) => ({ ...entity(item.id, locale), codes_or_context: item.secondary }));
      return { ...page(matches, offset, limit), resolution: "candidates_only_do_not_assume_first_is_correct" };
    },
    get_company_profile: ({ issuer_id, locale, offset, limit }) => company(issuer_id, locale, offset, limit),
    compare_companies: ({ issuer_ids, locale, offset, limit }) => {
      for (const id of issuer_ids) requireIssuer(id);
      const comparison = buildCompanyComparison(current, issuer_ids, locale);
      return {
        companies: issuer_ids.map((id) => company(id, locale, offset, limit)),
        shared_positions: [...comparison.sharedElementIds].map((id) => entity(id, locale)),
        shared_positions_meaning: "Two or more selected companies map to this position, not necessarily all. Not a supplier relationship.",
        website_url: `${SITE}${comparisonSearch(issuer_ids, locale)}`,
      };
    },
    get_relation_evidence: ({ relation_id, locale, offset, limit }) => {
      const detail = buildRelationDetailModel(graph, relation_id, history);
      if (!detail) {
        if (!history) historyRequired();
        throw new ResearchError("RELATION_NOT_FOUND", `No current or recorded historical relation: ${relation_id}`);
      }
      const record = detail.relation;
      const evidence = detail.evidence.map(({ claim, source }) => ({
        claim_id: claim.id, excerpt: clipped(localize(claim, "excerpt", locale), 3000),
        reviewed_at: claim.reviewed_at || null,
        source: source ? { id: source.id, title: clipped(localize(source, "title", locale), 500),
          url: publicUrl(source.url), publish_date: source.publish_date || null } : null,
      }));
      return {
        relation: relation(record, locale),
        usable_as_current_record: index.relationsById.has(record.id),
        correction_reason: clipped(record.withdrawal_reason || record.replacement_reason, 2000),
        replacement_relation_id: record.replacement_relation_id || null,
        evidence: page(evidence, offset, limit),
        missing_claim_ids: (record.claim_ids || []).filter((id) => !detail.evidence.some(({ claim }) => claim.id === id)),
        source_text_is_untrusted_data: true,
      };
    },
    trace_industry_path: ({ from_id, to_id, direction, max_depth, locale }) => {
      entity(from_id, locale);
      entity(to_id, locale);
      const result = findShortestTransmissionPath(current, from_id, to_id, { direction, maxDepth: max_depth });
      return {
        found: result.found, max_depth, direction, hops: result.hops,
        meaning: "Ontology-level industry path. Company endpoints resolve to their industry positions; this is not evidence of a company-to-company contract. A missing bounded path is not proof of no connection.",
        entities: result.entities.map((item) => entity(item.id, locale)),
        steps: result.relations.map((step) => ({ traversal_direction: step.traversal_direction, relation: relation(step.relation, locale) })),
        endpoint_positions: [from_id, to_id].filter((id) => index.entitiesById.get(id)?.entity_type === "issuer")
          .map((id) => company(id, locale, 0, 20)),
        website_url: website({ pathStart: from_id, pathTarget: to_id, direction }),
      };
    },
    get_recorded_changes: ({ issuer_id, since, until, locale, offset, limit }) => {
      requireIssuer(issuer_id);
      historyRequired();
      const events = history.events.filter((item) => item.issuer_id === issuer_id
        && (!since || item.recorded_at.slice(0, 10) >= since) && (!until || item.recorded_at.slice(0, 10) <= until))
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || a.id.localeCompare(b.id))
        .map((item) => ({ id: item.id, kind: item.kind, relation_id: item.relation_id,
          recorded_at: item.recorded_at, effective_at: item.effective_at || null,
          target: entity(item.target_id, locale), replaces_relation_id: item.replaces_relation_id || null,
          reason: clipped(locale === "en" ? item.reason_en || item.reason : item.reason, 1500),
          website_url: website({ entity: issuer_id, relation: item.relation_id }) }));
      return { issuer: entity(issuer_id, locale), ...page(events, offset, limit),
        date_semantics: "Inclusive UTC batch-review dates, not business-effective dates or deployment dates.",
        coverage: "Only recorded approved batches; absence of events is not proof of no business changes." };
    },
  };

  return {
    metadata,
    run(name, args) {
      if (args.snapshot_id && args.snapshot_id !== snapshotId) throw new ResearchError("SNAPSHOT_MISMATCH", "Requested snapshot differs from this process. Restart research against the returned snapshot ID.");
      if (!actions[name]) throw new ResearchError("UNKNOWN_TOOL", "Unknown research tool.");
      return { dataset: metadata(), result: actions[name](args) };
    },
  };
}
