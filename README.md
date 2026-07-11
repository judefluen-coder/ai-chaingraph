# AI产业链研究地图 / AI-ChainGraph

[![CI](https://github.com/judefluen-coder/ai-chaingraph/actions/workflows/ci.yml/badge.svg)](https://github.com/judefluen-coder/ai-chaingraph/actions/workflows/ci.yml)
[![Code License: MIT](https://img.shields.io/badge/code-MIT-2ea44f.svg)](LICENSE)
[![Data License: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-2ea44f.svg)](DATA_LICENSE.md)

[English](README.en.md) | 简体中文

从产业链出发，沿上游、核心环节和下游应用发现 A股与美股公司，并追溯每条关系的公开依据。

Start from an AI industry chain, follow the upstream-core-downstream path, discover public companies, and trace every relationship back to public evidence.

> AI-ChainGraph 是信息组织与产业研究辅助工具，不提供、不构成、不暗示投资建议、买卖建议、收益预测或交易策略。

![AI产业链研究地图桌面首屏](docs/assets/ai-chaingraph-desktop.png)

## 为什么做

传统股票工具通常要求用户先知道公司名称，再搜索它属于什么概念。AI-ChainGraph 把发现顺序反过来：

```text
AI 产业全景
  -> 选择产业链
  -> 查看上游 / 核心环节 / 下游应用
  -> 发现 A股与美股公司
  -> 查看公司路径、关系依据、来源与同行
```

它回答的是“这家公司在产业链哪里、为什么相关、关系从哪里来”，而不是“应该买哪只股票”。

## 产品原则

- **产业链优先**：默认入口是产业全景，公司搜索只是快捷方式。
- **关系优先于指标**：不展示相关度百分比、纯度分、潜力分、目标价或推荐评级。
- **发布即消费**：访问者只看到维护者正式发布的关系，不需要审核、校正或确认数据。
- **来源可追溯**：公司关系保留事实说明、来源类型、原始链接和最后核验日期。
- **公开且免费**：软件使用 MIT，项目原创公开数据使用 CC BY 4.0。
- **面向全球**：目标覆盖 A股与美股，canonical schema 已支持中英文字段；完整双语界面是 v1.0 发布门槛。

## 当前体验

- 产业全景首屏：按算力硬件、光通信、PCB/材料、电力与液冷进入链路。
- 三阶段路径：在同一视图中查看上游、核心环节、下游应用和对应公司。
- 公司目录：展示公司、产业链位置、关系依据、事实说明和最后核验日期。
- 上下游关系图：自动布局产业流向和公司位置，箭头表达关系方向。
- 公司详情：通过产业链路径对比展示完整路径、可比公司、证据时间线和公开来源。
- 搜索与市场筛选：支持产业环节、公司、代码、别名、证据文本以及 A股/美股筛选。
- 本地观察列表：观察备注只保存在浏览器，可导出 JSON/CSV。
- 响应式工作台：桌面三栏；手机使用“产业链 / 股票池 / 关系 / 详情”底部导航。

当前仓库仍使用**虚构 demo 数据**验证产品和数据模型，尚未完成真实 A股与美股全量覆盖。不要把 demo 公司、价格或证据当作真实市场信息。

## 关系依据

面向用户的关系不依赖模糊分数，而使用三类可解释依据：

| 关系依据 | 含义 | 典型来源 |
| --- | --- | --- |
| 官方披露 | 公司直接说明产品、业务、客户或供应关系 | 年报、公告、交易所问答 |
| 产品事实 | 官方产品资料能够确认产品能力和应用位置 | 公司官网、产品手册、专利 |
| 产业推导 | 根据公开产业结构连接上下游环节 | 行业资料、多来源交叉验证 |

具名供应商或客户关系只有在公开来源明确点名双方时才发布。产业常识可以连接产业节点，但不能被包装成未经证实的公司供应关系。

`L1 / L2 / L3` 保留为维护者的数据来源分级：

- `L1`：公司或监管机构直接披露，可直接复核。
- `L2`：产品事实或多来源交叉验证，保留推导边界。
- `L3`：待维护者补证的公开线索，不进入访问者看到的正式图谱。

## 目标覆盖范围

- A股：上交所、深交所、北交所正常上市普通股。
- 美股：NASDAQ、NYSE、AMEX 普通股与主要 ADR。
- 首版不包含：OTC、ETF、基金、SPAC、已退市证券。
- 产业范围：AI 基础设施、芯片与算力、服务器与存储、光通信、PCB/材料、电力与液冷、模型与软件、终端与行业应用等主要链路。
- 更新节奏：每周生成数据更新 PR，由维护者合并后发布。

这是 v1.0 的覆盖目标，不是当前 demo 的完成度声明。

## 本地运行

```bash
npm install
npm run dev
```

Vite 会输出本地地址，通常是 `http://127.0.0.1:5173/`。提交前运行：

```bash
npm run smoke
npm run validate:example
npm run validate:tabular
npm run build
```

## 数据读取顺序

前端保持本地优先，不依赖付费服务：

```text
VITE_CHAINGRAPH_API_BASE /api/graph
  -> /snapshots/current.json
  -> src/data/demoGraph.json
```

`public/snapshots/current.json` 是静态站点唯一跟踪的公开发布快照，当前与虚构 demo 保持一致。其他本地 snapshot 默认被 Git 忽略；未来真实数据也只会在通过来源与许可检查后替换这个发布文件。

启动本地 API：

```bash
npm run api
```

只读研究接口包括：

- `GET /api/graph`
- `GET /api/search?q=光模块`
- `GET /api/node/:id`

`/api/review` 是维护者本地数据工作流的兼容接口，不在访问者前端中出现。

## 数据导入

校验 canonical snapshot：

```bash
npm run import:snapshot -- examples/fictional-ai-chain.snapshot.json
```

CSV/JSONL 表格每行表示“公司 -> 产业节点 -> 证据”的一条映射：

```bash
npm run validate:tabular
npm run import:tabular -- examples/fictional-ai-mappings.csv --print-snapshot
```

导入字段支持产业阶段 `stage`、中英文字段、关系依据 `relation_basis`、事实说明 `relation_summary` 和最后核验时间 `last_verified_at`。同一关系的多条证据会合并并保留全部来源。

本地写入产物位于被 Git 忽略的 `data/snapshots/current.json` 和 `data/import-reports/*.json`。公开发布的数据应经过来源许可检查后，通过独立数据 PR 合并。

## GitHub Pages

仓库包含 `.github/workflows/pages.yml`。仓库公开并在 Settings -> Pages 中选择 GitHub Actions 后，推送到 `main` 会构建静态预览。

## 项目结构

```text
src/components/          产业全景、公司目录、关系图和详情组件
src/lib/graphViewModel.js 公开图谱的筛选、关系解释和自动布局
src/data/demoGraph.json  虚构 demo canonical snapshot
schemas/                 JSON Schema 与 SQLite schema
scripts/                 snapshot/CSV/JSONL 导入、API 和 smoke test
examples/                虚构导入示例
docs/assets/             README 截图
```

## 贡献数据

欢迎贡献新的产业节点、公司映射、公开来源、双语文案和数据管道。提交关系时至少需要：

- 明确的产业链与上游/核心/下游位置。
- 可复核的公开来源 URL、标题、发布日期和简短事实摘要。
- `official_disclosure`、`product_fact` 或 `industry_inference` 之一。
- 公司证券代码、交易所与稳定 ID。
- 不复制受版权限制的长篇原文，不提交付费数据源结果或个人账户数据。

开发与数据规范见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 仓库边界与提交安全

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short --branch -- .
git ls-files --cached -- data feedbacks logs secrets '*.sqlite' '*.db'
git ls-files --cached -- public/snapshots
```

第一条命令应无输出；第二条只能输出 `public/snapshots/current.json`。抓取缓存、密钥、个人研究笔记、商业数据源结果和本地数据库不得提交。

## 路线图

- **v0.3 产品基础**：产业链优先首屏、三阶段路径、可解释关系、响应式图谱。
- **v0.4 双语体验**：中英文切换、双语搜索与缺失翻译检查。
- **v0.5 公开数据管道**：免费公开来源适配器、实体去重、每周自动数据 PR。
- **v0.6 覆盖扩展**：按产业链逐批完成真实 A股和美股公司映射。
- **v1.0**：主要 AI 产业链、目标市场、双语界面和每周更新流程达到公开发布标准。

## License

- 软件代码：MIT，见 [LICENSE](LICENSE)。
- 项目原创公开数据：CC BY 4.0，见 [DATA_LICENSE.md](DATA_LICENSE.md)。
- 外部来源内容仍受原权利人的许可条款约束。

## 免责声明

AI-ChainGraph 是信息组织与产业研究辅助工具，不是投资决策工具。展示公司与产业环节的关系，只说明公开资料支持该关系，不代表对公司价值、经营质量、股价走势或未来收益的判断。请始终回到原始来源独立核验。
