# Contributing to AI-ChainGraph

感谢你愿意参与 AI-ChainGraph。这个项目的目标是做一个清晰、可复核、适合本地研究的 AI 产业链选股地图。贡献时请优先保护数据合规边界和普通投资者的可读性。

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
- 数据模型：schema、导入校验、证据等级、审核队列和去重逻辑。
- 示例数据：只能提交虚构 demo，不能提交真实行情、研报摘录、商业数据源结果或个人研究笔记。
- 文档：README、路线图、截图、示例 snapshot、使用指南和免责声明。
- 测试：demo 完整性、schema 边界、导入脚本和核心交互 smoke test。

## 提 Issue 和 PR

- Bug 请使用 `Bug report` 模板，并提供最短复现步骤。
- 数据模型、schema、导入或证据等级建议请使用 `Data or schema request` 模板。
- 产品体验建议请使用 `Feature request` 模板，并说明它帮助用户理解什么问题。
- PR 请填写 checklist，尤其是验证命令和数据安全边界。

## 数据安全边界

公开仓库只应包含代码、schema、脚本、文档和虚构示例数据。以下内容不要提交：

- `data/`、`feedbacks/`、`logs/`、`secrets/`、`public/snapshots/`
- SQLite/DB 文件、抓取缓存、第三方商业数据源结果
- 真实研报原文或受版权限制的摘录
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
- L3 线索必须保持待审核语义，不能作为结论展示。
- 公开导入示例放在 `examples/`，snapshot 示例应能通过 `npm run import:snapshot -- examples/fictional-ai-chain.snapshot.json`，CSV/JSONL 示例应能通过 `npm run validate:tabular`。
- 同一公司和产业节点的多条证据可以拆成多行导入；导入器会合并映射边并保留全部证据来源。

## Pull Request 检查清单

- [ ] 我已运行 `npm run smoke`。
- [ ] 我已运行 `npm run validate:example`。
- [ ] 我已运行 `npm run validate:tabular`。
- [ ] 我已运行 `npm run build`。
- [ ] 我没有提交真实金融数据、商业数据源结果或本地私有记录。
- [ ] 如果改动 UI，我已检查桌面、平板和手机主要布局。
- [ ] 如果改动数据 schema，我已同步更新 demo、导入脚本或文档说明。

## 产品原则

- 先解释产业链逻辑，再展示公司。
- 先展示证据和时效，再谈相关性。
- 不做买卖建议，不暗示收益预期。
- 让普通投资者能读懂，让研究者能复核。
