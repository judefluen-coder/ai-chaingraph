# Contributing to AI-ChainGraph

感谢你愿意参与 AI-ChainGraph。这个项目的目标是做一个清晰、可复核、面向全球投资者的 AI 产业链研究地图。贡献时请优先保护来源合规、关系准确和普通投资者的可读性。

## 开发环境

```bash
npm install
npm run dev
```

提交前请至少运行：

```bash
npm run smoke
npm run validate:example
npm run validate:tabular
npm run build
```

## 可以贡献什么

- 前端体验：更清晰的产业链导航、公司映射列表、详情解释和响应式布局。
- 数据模型：schema、导入校验、关系依据、实体去重和每周发布流程。
- 公开数据：欢迎提交有公开来源的真实公司关系和产业节点；不得提交付费数据源结果、受限原文或个人账户数据。
- 示例数据：`examples/` 与 demo fixture 必须保持虚构，避免测试内容被误认为真实市场信息。
- 文档：README、路线图、截图、示例 snapshot、使用指南和免责声明。
- 测试：demo 完整性、schema 边界、导入脚本和核心交互 smoke test。

## 提 Issue 和 PR

- Bug 请使用 `Bug report` 模板，并提供最短复现步骤。
- 数据模型、schema、导入或证据等级建议请使用 `Data or schema request` 模板。
- 产品体验建议请使用 `Feature request` 模板，并说明它帮助用户理解什么问题。
- PR 请填写 checklist，尤其是验证命令和数据安全边界。

## 数据安全边界

公开仓库可以包含代码、schema、脚本、文档、虚构示例，以及经过来源许可检查的结构化公司与产业关系。以下内容不要提交：

- `data/`、`feedbacks/`、`logs/`、`secrets/`、`public/snapshots/`
- SQLite/DB 文件、抓取缓存、第三方商业数据源结果
- 真实研报原文、公告全文或其他受版权限制的长篇摘录
- 未脱敏的个人研究记录和人工校正队列

提交前可以用以下命令确认没有误跟踪本地数据：

```bash
git ls-files --cached -- data feedbacks logs secrets public/snapshots '*.sqlite' '*.db'
```

期望输出为空。

## Demo 数据规则

- 公司、证据、行情字段必须是虚构或明确脱敏的演示内容。
- A股和美股 demo 都可以保留，但不能暗示真实买卖建议。
- 证据摘要应展示产品能力，不应复制真实受限内容。
- L3 线索只能用于维护者补证，不能进入访问者看到的正式图谱。
- 公开导入示例放在 `examples/`，snapshot 示例应能通过 `npm run import:snapshot -- examples/fictional-ai-chain.snapshot.json`，CSV/JSONL 示例应能通过 `npm run validate:tabular`。
- 同一公司和产业节点的多条证据可以拆成多行导入；导入器会合并映射边并保留全部证据来源。

## 公开关系规则

- 每个产业节点必须声明 `upstream`、`core` 或 `downstream` 阶段。
- 每条公司关系必须提供 `relation_basis`、`relation_summary`、`last_verified_at` 和至少一个公开来源。
- `relation_basis` 只能是 `official_disclosure`、`product_fact` 或 `industry_inference`。
- 具名客户、供应商关系必须由公开来源明确点名双方，不能只靠产业常识推断。
- 摘要只陈述来源支持的事实，不使用“高潜力”“受益最大”“纯度高”等投资判断。
- 已发布数据使用 CC BY 4.0；外部来源链接及引用仍遵守原权利人的许可条款。

## Pull Request 检查清单

- [ ] 我已运行 `npm run smoke`。
- [ ] 我已运行 `npm run validate:example`。
- [ ] 我已运行 `npm run validate:tabular`。
- [ ] 我已运行 `npm run build`。
- [ ] 我没有提交商业数据源结果、受限原文、凭证或本地私有记录。
- [ ] 真实公司关系包含公开来源、事实摘要、关系依据和核验日期。
- [ ] 如果改动 UI，我已检查桌面、平板和手机主要布局。
- [ ] 如果改动数据 schema，我已同步更新 demo、导入脚本或文档说明。

## 产品原则

- 默认从产业链发现公司，搜索只是快捷方式。
- 先展示关系事实、来源和时效，不展示模糊量化分数。
- 不做买卖建议，不暗示收益预期。
- 让普通投资者能读懂，让研究者能复核。
