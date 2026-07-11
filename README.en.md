# AI-ChainGraph

[![CI](https://github.com/judefluen-coder/ai-chaingraph/actions/workflows/ci.yml/badge.svg)](https://github.com/judefluen-coder/ai-chaingraph/actions/workflows/ci.yml)
[![Code License: MIT](https://img.shields.io/badge/code-MIT-2ea44f.svg)](LICENSE)
[![Data License: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-2ea44f.svg)](DATA_LICENSE.md)

English | [简体中文](README.md)

An evidence-traceable AI industry-chain research map for discovering A-share and US-listed companies from the industry chain, not from a stock search box.

> AI-ChainGraph organizes public information for industry research. It does not provide investment advice, buy/sell signals, price targets, return forecasts, or trading strategies.

![AI-ChainGraph desktop overview](docs/assets/ai-chaingraph-desktop.png)

## Discovery Model

```text
AI industry atlas
  -> choose a chain
  -> inspect upstream / core / downstream stages
  -> discover A-share and US-listed companies
  -> inspect company paths, relationship basis, sources, and peers
```

The product answers where a company sits in the AI value chain, why the relationship exists, and which public source supports it. It does not answer which stock to buy.

## Principles

- **Chain first:** the default entry point is the industry atlas; company search is a shortcut.
- **Relationships over scores:** no relevance percentages, purity scores, potential scores, ratings, or price targets in the reader experience.
- **Published graph:** readers only see relationships released by the maintainer and never need to review or correct data.
- **Traceable evidence:** each company relationship carries a factual summary, source type, source link, and last verification date.
- **Open and free:** software is MIT licensed; original public project data is CC BY 4.0.
- **Global target:** the canonical schema supports Chinese and English fields. A complete bilingual interface is a v1.0 release requirement.

## Current Experience

- Chain-first AI industry atlas.
- Upstream, core, and downstream stage exploration.
- Company directory with relationship basis, factual explanation, and verification date.
- Directed relationship graph with automatic layout.
- Company paths, peer context, evidence timeline, and source links.
- A-share / US market filtering and search across entities and evidence.
- Responsive desktop and mobile workspaces.
- A private browser-local watchlist with JSON/CSV export.

The repository currently uses **fictional demo data** to validate the product and data model. Full real-world A-share and US coverage is not complete yet.

## Relationship Basis

| Basis | Meaning | Typical source |
| --- | --- | --- |
| `official_disclosure` | The company directly states the product, business, customer, or supplier relationship | Annual reports, filings, exchange Q&A |
| `product_fact` | Official product materials establish capability and value-chain position | Company websites, product manuals, patents |
| `industry_inference` | Public industry structure connects upstream and downstream stages | Industry references and cross-source validation |

Named supplier or customer relationships are published only when a public source explicitly identifies both parties. Industry knowledge may connect industry nodes but must not be presented as an unverified company relationship.

## Target Coverage

- Active common shares on Shanghai, Shenzhen, and Beijing exchanges.
- Common shares and major ADRs on NASDAQ, NYSE, and AMEX.
- OTC securities, ETFs, funds, SPACs, and delisted securities are excluded from the first release.
- Major AI chains from infrastructure and semiconductors to models, software, devices, and industry applications.
- Weekly data-update pull requests, released after maintainer merge.

This is the v1.0 target, not a claim about the current demo dataset.

## Run Locally

```bash
npm install
npm run dev
```

Run the project checks:

```bash
npm run smoke
npm run validate:example
npm run validate:tabular
npm run build
```

The frontend reads data in this order:

```text
VITE_CHAINGRAPH_API_BASE /api/graph
  -> /snapshots/current.json
  -> src/data/demoGraph.json
```

Start the local API with `npm run api`. Reader endpoints are `GET /api/graph`, `GET /api/search`, and `GET /api/node/:id`. `/api/review` remains a maintainer-workflow compatibility endpoint and is not exposed in the reader UI.

## Data Import

Validate a canonical snapshot:

```bash
npm run import:snapshot -- examples/fictional-ai-chain.snapshot.json
```

Validate CSV/JSONL tabular mappings:

```bash
npm run validate:tabular
npm run import:tabular -- examples/fictional-ai-mappings.csv --print-snapshot
```

The importer supports stage placement, bilingual fields, relationship basis, factual summaries, and last-verification timestamps. Multiple evidence rows for one relationship are merged while preserving every source.

## Contributing

Contributions are welcome for industry nodes, company mappings, public sources, bilingual copy, and data pipelines. Every published relationship should include a stable entity ID, stage placement, public source metadata, a concise factual summary, and one of the three relationship-basis values.

Do not submit paid data-source output, copyrighted long-form excerpts, credentials, personal brokerage data, or private research notes. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- **v0.3:** chain-first discovery, three-stage paths, explainable relationships, responsive graph.
- **v0.4:** Chinese/English switch, bilingual search, missing-translation checks.
- **v0.5:** free public-source adapters, entity resolution, weekly automated data PRs.
- **v0.6:** progressive real-world A-share and US coverage by industry chain.
- **v1.0:** major AI chains, target markets, bilingual UX, and weekly updates ready for public release.

## License

- Software: MIT, see [LICENSE](LICENSE).
- Original public project data: CC BY 4.0, see [DATA_LICENSE.md](DATA_LICENSE.md).
- Linked third-party source material remains subject to its owners' terms.

## Disclaimer

AI-ChainGraph is an information organization and industry research aid, not an investment decision tool. A displayed relationship only means that public information supports the connection; it does not express a view on company value, business quality, share-price direction, or future returns. Always verify the original source independently.
