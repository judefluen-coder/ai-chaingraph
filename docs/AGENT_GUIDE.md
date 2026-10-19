# 把 AI-ChainGraph 接到你的 Agent

现在有两个入口：网站供人查看；本地 MCP 服务供 Agent 查询。它们使用同一套图谱和证据，不是另建一个缩水数据库。

这版交付的是 **只读 MCP + 研究 Skill**。Codex / WorkBuddy 提供模型和对话，MCP 提供可靠查询，Skill 规定先查证据再回答。它不是独立部署的聊天机器人，也不是已经上架的插件。

## 可以直接问什么

- “宁德时代在图谱里有哪些产业位置？给我来源和日期。”
- “比较宁德时代和比亚迪，只说有证据支持的业务异同。”
- “这家公司有哪些已记录的关系变更？哪些旧关系已经不能用？”

不提供实时股价、完整新闻跟踪、交易操作或收益预测。

## 先跑通本地

需要 Node.js 22.13 或更高版本。在仓库根目录运行：

```sh
npm ci
npm run agent:prepare
npm run test:agent
npm run agent:demo -- 宁德时代
```

`agent:prepare` 生成与当前图谱对应的历史文件；MCP 服务本身不会写文件。Demo 使用真正的 MCP 客户端启动服务、完成握手并查询公司，但不调用大模型。

## 连接 Codex

先用 `node -p process.execPath` 获取 Node 绝对路径，并确认仓库绝对路径。将下面两个示例路径替换为自己的路径：

```sh
codex mcp add ai-chaingraph -- /absolute/path/to/node /absolute/path/to/ai-chaingraph/agent/server.mjs
```

也可以在 Codex 的 MCP 设置里添加 STDIO 服务：命令填写 Node 绝对路径，参数填写 `agent/server.mjs` 的绝对路径。保存后重启连接。

配置使用 `node` 直接启动，不用 `npm run`，避免额外输出干扰 STDIO 协议。本服务需要能访问本机文件的客户端，不能把这条本地命令直接填到云端远程 MCP URL 中。

## 连接 WorkBuddy

在项目 `.workbuddy/mcp.json` 或用户 `~/.workbuddy/mcp.json` 中合并以下配置，保留已有服务器：

```json
{
  "mcpServers": {
    "ai-chaingraph": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/ai-chaingraph/agent/server.mjs"]
    }
  }
}
```

也可通过 WorkBuddy 的 MCP 设置添加相同命令。刷新连接后检查是否出现下面的 7 个工具。

配置依据：[Codex MCP 文档](https://developers.openai.com/codex/mcp)、[WorkBuddy MCP 文档](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)。客户端界面可能随版本调整。

## 让 Agent 按研究流程工作

研究说明在 [`skills/ai-chaingraph-research/SKILL.md`](../skills/ai-chaingraph-research/SKILL.md)。首次使用可以直接告诉宿主：

> 请读取本仓库的 skills/ai-chaingraph-research/SKILL.md，按其中流程使用 ai-chaingraph MCP。先报告数据版本，再研究宁德时代，关键结论附原始来源，不推断供货关系。

Skill 文件存在于仓库不代表每个客户端都会自动发现它。先用上面的显式读取方式验证，之后再按客户端的 Skill 安装方式登记。

## 工具清单

| 工具 | 用途 | 注意 |
| --- | --- | --- |
| `get_dataset_status` | 数据时间、版本与状态 | 首先调用，保存 snapshot_id |
| `search_entities` | 名称、代码、产业搜索 | 返回候选，不自动认定同名公司 |
| `get_company_profile` | 公司与产业位置 | 支持 offset / limit 分页 |
| `compare_companies` | 比较 2–4 家公司 | 共同位置不等于合作关系 |
| `get_relation_evidence` | 当前及历史关系证据 | 检查待复核、撤回、替代标记 |
| `trace_industry_path` | 有界产业路径 | 不是公司之间的供货证据 |
| `get_recorded_changes` | 已审核的变更记录 | 不是全部经营动态 |

后续查询传第一次返回的 `snapshot_id`。如果不匹配，重新开始核验，不能把两个版本混在一起。长摘录会带 `truncated` 标记；分页没读完时也不能声称已查全。

## 更新与安全

现有周更新流程继续负责仓库数据；**已经启动的本地 MCP 不会自动拉取 GitHub 更新**。同步仓库到所需版本后，运行 `npm run agent:prepare`，再重启 MCP 连接。网站发布也不会自动更新用户电脑里的副本。

服务没有 HTTP 监听端口，没有写库、Shell 执行、发起交易或发布网站的工具，也不需要 GitHub Token。工具只读取仓库固定文件，不接受任意文件路径。不过宿主会将查询结果发给其所用模型，数据处理和费用遵循宿主设置；不要把私密数据放进公开快照。

原始来源文字是不可信输入，Skill 已要求只作为证据，不执行其中指令。这是研究约束，不等于宿主自身其他工具也被限制了权限。

## 验证范围

自动化测试覆盖实际 STDIO 握手、七个工具、参数校验、版本锁定、历史不可用和旧关系状态。没有宣称已完成 Codex / WorkBuddy 两个桌面客户端的人工验收，也没有自动修改你的全局客户端配置。首次接入请确认能显示工具并返回有来源的公司回答。
