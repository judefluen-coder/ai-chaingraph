# AI-ChainGraph / 链图 AI

本地优先的 AI 产业链 A 股研究工作台。打开即浏览，搜索即定位，数据自建自管。

AI-ChainGraph（链图 AI）是一个本地优先的 AI 产业链 A 股研究工作台原型。目标是帮助研究者以“打开即浏览、搜索即定位”的方式，组织 AI 基础设施产业链的上下游结构、环节划分、公司分布和证据摘要。关系图是信息组织界面，不是投资分析结论。

当前 `v0.2` 版本在 `v0.1` 三栏研究工作台上补齐了最小本地数据闭环：

- 左侧产业链树：四条 AI 基础设施链路，按环节逐层展开。
- 中间关系图：React Flow 交互图谱，展示节点关联和公司映射。
- 右侧详情面板：节点详情、公司卡片、证据摘要、搜索定位和人工校正入口。
- 列表入口：将公司映射按公司、产业节点、证据等级、时效调整和审核状态展开，便于核对。
- 数据提供层：优先读取本地 API，其次读取 public snapshot，最后回退虚构 demo。
- 本地导入：可校验 canonical snapshot，并写入被忽略的 `data/snapshots/current.json`。
- 数据状态：展示数据集类型、证据时效、行情快照声明和待审核数量。
- 反馈闭环：浏览器本地审核队列支持 JSON/CSV 导出。

仓库默认仅包含虚构示例数据。完整数据由用户在本地或私有仓库中自建，不依赖任何外部服务。

## 免责声明

**AI-ChainGraph（链图 AI）是信息组织与产业研究辅助工具，不是投资决策工具。**

- 本项目提供的所有内容，包括产业链结构、公司映射、关联关系、证据等级、示例数据和截图，仅为信息整理与知识呈现，不构成任何形式的投资建议、买卖建议或交易策略。
- 项目中展示的上市公司、产业环节和关联关系，不代表对其投资价值、股价走势或公司经营状况的判断。
- 证据等级只描述信息来源可靠性，不代表未来表现。
- 当前仓库内置公司名、行情和证据均为虚构示例，只用于本地原型验证。
- 使用真实数据前，请自行查证原始来源、授权边界和数据时效。

### 数据授权与合规边界

- 本仓库只提供代码、schema、导入框架和虚构示例数据，不分发任何真实金融数据、行情数据、研报原文或第三方数据源内容。
- 用户自行导入的真实数据（行情快照、研报摘录、公司映射、证据库等）的全部版权和合规责任由用户承担。用户应确认其数据来源的授权协议允许在本地工具中存储和使用。
- 本工具不内置、不捆绑任何特定数据源或行情 provider。数据源适配器为扩展接口，具体接入由用户自行配置和授权。
- 如果用户选择将私有数据仓库公开，请确保其中不包含受版权保护或授权限制的第三方内容。

## 本地运行

```bash
cd ai-chaingraph
npm install
npm run dev
```

默认开发服务由 Vite 启动，终端会给出 `http://127.0.0.1:<port>/`。如果只做构建检查：

```bash
npm run smoke
npm run build
```

## v0.2 本地数据闭环

数据读取顺序：

```text
VITE_CHAINGRAPH_API_BASE /api/graph
  -> /snapshots/current.json
  -> src/data/demoGraph.json
```

公开仓库中的 `src/data/demoGraph.json` 只保留虚构示例。真实或半真实数据应放入 `data/`、`feedbacks/`、`logs/`、`secrets/` 或私有仓库；这些路径默认由 `.gitignore` 覆盖。

校验本地 snapshot：

```bash
npm run import:snapshot -- data/local-only/optical-communication-sample.snapshot.json
```

校验并写入本地 current snapshot 与导入报告：

```bash
npm run import:snapshot -- data/local-only/optical-communication-sample.snapshot.json --write
```

写入产物位于：

- `data/snapshots/current.json`
- `data/import-reports/*.json`

这些文件不会进入 Git 跟踪。若要让前端直接读取本地 current snapshot，可在本地开发时自行把已脱敏 snapshot 复制到被忽略的 `public/snapshots/current.json`，或启动本地 API 并设置 `VITE_CHAINGRAPH_API_BASE`。

### 证据等级与时效

- `L1`：强确证，来自更直接、更可复核的公开来源或用户授权材料。
- `L2`：合理推断，来自多源交叉验证或产业逻辑推断，仍需保留来源。
- `L3`：公开线索，只能作为待审核研究线索，不应直接进入结论。
- 时效调整相关性会结合证据发布时间、`stale_threshold_days`、关系相关性和纯度字段重新展示。它只用于排序和审核提示，不代表投资评级。
- 行情快照是本地导入时点数据，可能延迟、遗漏或有误，不用于实时交易。

## 技术栈

- 前端：React + Vite。
- 图谱：React Flow。
- 示例数据：`src/data/demoGraph.json`。
- Schema：`schemas/chaingraph.schema.json` 与 `schemas/sqlite-schema.sql`。
- 后续扩展：FastAPI/SQLite/FTS5/ETL adapter 可在当前 schema 上继续落地。

## 当前能力

- 三栏工作台：左侧产业链树，中间关系图，右侧详情与证据面板。
- 列表视图：按当前链路、证据等级和搜索词列出公司映射，点击行内公司或节点可同步右侧详情。
- 默认浏览：覆盖算力硬件、光通信、PCB/材料、电力与液冷四条链路。
- 搜索定位：支持节点名、别名、公司名、股票代码和证据文本；命中后保留可折叠搜索上下文并进入详情。
- 示例公司卡片：展示股票代码、行业、关系类型、证据等级、时效调整相关性、纯度、待审核状态和行情字段占位。
- 人工校正入口：反馈类型、来源 URL 和说明会写入浏览器 localStorage 的待审核队列，可导出 JSON/CSV。
- 实验性接口预留：`market_signal` schema 和页面入口已保留，v0.2 不生成信号。

## 可扩展数据接口

当前 v0.2 为本地优先前端原型，以下接口已在 schema 或脚本中落地/预留：

- 行情快照：`quote_snapshot` schema 已定义字段（股价、市值、PE/PB、成交额、来源与延迟标记），可通过行情 provider adapter 导入本地 SQLite。
- 市场情报信号：`market_signal` schema 预留了事件、预警、情绪、政策、财报、供应链等信号类型，支持外部系统后续推送。
- 人工校正闭环：用户反馈写入本地 `review_queue`，可对接后续人工审核或自动校验流程。
- 多源导入框架：`scripts/import-snapshot.mjs` 已支持 canonical snapshot 校验和本地写入；CSV/JSONL、ChainKG 同形态数据和行情 provider adapter 可在此基础上继续扩展。

这些接口是能力预留，不是功能承诺。具体可用性取决于后续版本的实际实现。

## 数据策略

开源仓库只放代码、schema、导入框架和虚构示例数据。完整真实研究库、抓取后的证据库、行情缓存、研报摘要和人工校正记录应保留在本地或私有仓库。

后续真实数据建议按三层进入：

1. 数据源适配器输出 canonical records。
2. schema 校验、去重、证据等级、相关性和纯度评分。
3. L1/L2 进入正式图谱，L3 和冲突记录进入 `review_queue`。

## 开源与私有数据边界

可公开：

- 应用代码、schema、评分算法、ETL 框架、虚构示例数据、文档和免责声明。

应私有：

- 完整 A 股映射库、真实证据摘录、抓取缓存、商业数据源结果、个人研究批注和未确认人工校正。

### 仓库边界与提交安全

项目的安全 Git root 应是 `ai-chaingraph/` 项目目录本身，而不是用户主目录或其他上层目录。提交或发布前请先确认：

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short --branch -- .
git ls-files --cached -- data feedbacks logs secrets public/snapshots '*.sqlite' '*.db'
```

期望结果：

- `git rev-parse --show-toplevel` 指向 `ai-chaingraph` 项目根，remote 指向正确项目仓库。
- `git status --short --branch -- .` 只显示项目内代码、schema、脚本和文档变更。
- `git ls-files --cached -- data feedbacks logs secrets public/snapshots '*.sqlite' '*.db'` 输出为空。
- 不要把用户目录、`data/local-only/`、`secrets/`、`logs/`、SQLite/DB 文件或商业数据源结果纳入 Git 跟踪。

## 项目结构

```text
ai-chaingraph/
├── src/
│   ├── data/demoGraph.json
│   ├── data/loadGraphData.js
│   ├── main.jsx
│   └── styles.css
├── schemas/
│   ├── chaingraph.schema.json
│   └── sqlite-schema.sql
├── scripts/import-snapshot.mjs
├── scripts/smoke-test.mjs
├── LICENSE
├── package.json
└── README.md
```

## License

MIT License. 详见 `LICENSE`。

## 下一步扩展边界

- `app/api`：提供 `/api/graph`、`/api/search`、`/api/node/:id`、`/api/refresh`、`/api/review`。
- `app/importers`：接入 demo、CSV/JSONL、ChainKG 同形态导入和行情 provider adapter。
- `data/`：本地 SQLite、JSON snapshot、review queue 与行情缓存目录，默认不进入公开仓库。
