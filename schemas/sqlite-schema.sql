PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dataset (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dataset_type TEXT NOT NULL CHECK (dataset_type IN ('demo', 'local_real', 'mixed')),
  version TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  disclaimer TEXT NOT NULL,
  source_policy TEXT NOT NULL DEFAULT 'local_only' CHECK (source_policy IN ('public_demo_only', 'local_only', 'mixed_review_required')),
  data_license TEXT NOT NULL DEFAULT 'CC-BY-4.0' CHECK (data_license = 'CC-BY-4.0'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_job (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES dataset(id),
  adapter_type TEXT NOT NULL CHECK (adapter_type IN ('demo', 'csv', 'jsonl', 'manual', 'snapshot', 'quote_mock', 'quote_provider')),
  source_name TEXT NOT NULL,
  source_path TEXT,
  source_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('created', 'validated', 'partial', 'applied', 'failed', 'reverted')),
  total_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  review_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  error_json TEXT NOT NULL DEFAULT '[]',
  report_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS chain (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES dataset(id),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(dataset_id, id)
);

CREATE TABLE IF NOT EXISTS industry_node (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  node_type TEXT NOT NULL CHECK (node_type IN ('chain', 'segment', 'subsegment')),
  stage TEXT NOT NULL CHECK (stage IN ('overview', 'upstream', 'core', 'downstream')),
  chain TEXT NOT NULL,
  parent_id TEXT REFERENCES industry_node(id),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  aliases_json TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  description_en TEXT,
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company (
  id TEXT PRIMARY KEY,
  stock_code TEXT NOT NULL UNIQUE,
  stock_symbol TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('SH', 'SZ', 'BJ', 'NASDAQ', 'NYSE', 'AMEX', 'OTC')),
  name TEXT NOT NULL,
  name_en TEXT,
  full_name TEXT,
  industry TEXT,
  industry_en TEXT,
  listed_at TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kg_edge (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('directed', 'undirected')),
  weight REAL,
  evidence_level TEXT NOT NULL CHECK (evidence_level IN ('L1', 'L2', 'L3')),
  relevance_score REAL NOT NULL CHECK (relevance_score BETWEEN 0 AND 1),
  purity_score REAL NOT NULL CHECK (purity_score BETWEEN 0 AND 1),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  relation_basis TEXT NOT NULL DEFAULT 'industry_inference' CHECK (relation_basis IN ('official_disclosure', 'product_fact', 'industry_inference')),
  relation_summary TEXT,
  relation_summary_en TEXT,
  last_verified_at TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('accepted', 'needs_review', 'rejected', 'stale')),
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('node', 'edge', 'company', 'quote', 'signal')),
  target_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('L1', 'L2', 'L3')),
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  url TEXT,
  local_path TEXT,
  publish_date TEXT,
  excerpt TEXT NOT NULL,
  excerpt_en TEXT,
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  reliability REAL NOT NULL CHECK (reliability BETWEEN 0 AND 1),
  mapped_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer TEXT NOT NULL,
  stale_threshold_days INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS quote_snapshot (
  id TEXT PRIMARY KEY,
  stock_code TEXT NOT NULL REFERENCES company(stock_code),
  name TEXT NOT NULL,
  industry TEXT,
  market_cap REAL,
  latest_price REAL,
  change_pct REAL,
  turnover_amount REAL,
  pe REAL,
  pb REAL,
  quote_time TEXT NOT NULL,
  source TEXT NOT NULL,
  source_delay_note TEXT,
  refresh_job_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_signal (
  id TEXT PRIMARY KEY,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('event', 'alert', 'sentiment', 'policy', 'earnings', 'supply_chain', 'custom')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_ids_json TEXT NOT NULL DEFAULT '[]',
  severity TEXT NOT NULL CHECK (severity IN ('info', 'watch', 'important', 'critical')),
  source_system TEXT NOT NULL,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('new', 'linked', 'ignored', 'archived'))
);

CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('node', 'edge', 'evidence', 'quote', 'company')),
  target_id TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('stale', 'incorrect', 'wrong_mapping', 'wrong_category', 'concept_pollution', 'add_evidence')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'needs_more_source')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_note TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS chaingraph_fts USING fts5(
  entity_type,
  entity_id UNINDEXED,
  name,
  aliases,
  description,
  evidence_text
);
