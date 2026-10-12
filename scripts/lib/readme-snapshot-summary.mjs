const START = "<!-- snapshot-summary:start -->";
const END = "<!-- snapshot-summary:end -->";

function formatCount(value) {
  return Number(value).toLocaleString("en-US");
}

export function renderSnapshotSummary(graph, locale) {
  const { counts, quality, refresh, data_version: version } = graph.meta;
  const specificShare = locale === "zh"
    ? `（${(quality.specific_issuer_rate * 100).toFixed(1)}% 公司）`
    : ` (${(quality.specific_issuer_rate * 100).toFixed(1)}% of issuers)`;
  const figures = `| **${formatCount(counts.issuers)}** | **${formatCount(counts.chains)} / ${formatCount(counts.segments)}** | **${formatCount(counts.issuer_mappings)}** | **${formatCount(quality.specific_relations)}${specificShare}** | **${formatCount(counts.source_documents)}** |`;

  if (locale === "zh") {
    return [
      "| 上市发行人 | 产业链 / 环节 | 公司产业映射 | 具体动作关系 | 公开证据来源 |",
      "| ---: | ---: | ---: | ---: | ---: |",
      figures,
      "",
      `- 数据版本：**v${version}**`,
      `- 最近核验：**${refresh.last_checked_at.slice(0, 10)}**`,
      `- 数据最近变化：**${refresh.last_changed_at.slice(0, 10)}**`,
      `- 已收录来源截止：**${refresh.source_cutoff_date}**`,
      `- A 股新增上市核对截止：**${refresh.a_share_listing_reconciled_through}**`,
      "- 覆盖市场：A 股与美股",
    ].join("\n");
  }

  return [
    "| Listed issuers | Chains / segments | Company mappings | Specific mappings | Public sources |",
    "| ---: | ---: | ---: | ---: | ---: |",
    figures,
    "",
    `- Data version: **v${version}**`,
    `- Last checked: **${refresh.last_checked_at.slice(0, 10)}**`,
    `- Data last changed: **${refresh.last_changed_at.slice(0, 10)}**`,
    `- Included sources run through: **${refresh.source_cutoff_date}**`,
    `- New A-share listings reconciled through: **${refresh.a_share_listing_reconciled_through}**`,
    "- Markets: A-shares and US-listed securities",
  ].join("\n");
}

export function syncReadmeSnapshotSummary(readme, graph, locale) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end <= start || readme.indexOf(START, start + START.length) !== -1 || readme.indexOf(END, end + END.length) !== -1) {
    throw new Error(`README ${locale} must contain exactly one snapshot summary marker pair.`);
  }
  return `${readme.slice(0, start + START.length)}\n${renderSnapshotSummary(graph, locale)}\n${readme.slice(end)}`;
}

export function assertReadmeSnapshotSummary(readme, graph, locale) {
  if (syncReadmeSnapshotSummary(readme, graph, locale) !== readme) {
    throw new Error(`README ${locale} snapshot summary is stale; run npm run update:weekly.`);
  }
}
