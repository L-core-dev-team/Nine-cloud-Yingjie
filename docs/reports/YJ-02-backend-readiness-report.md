# YJ-02 后端接入准备

2026-11-20 · `codex/yj-02-backend-readiness` · 任务书基线 `18c7dd9cf82f161024c1bfa3951b9a95d63b80f1` · 九霄只读基线 `cd25360c7929e10f8b2b0fad342fedd943d4f323`

**离线准备已完成。独立后端图片 API 为 BLOCKED / NOT_RUN。** 默认入口消费契约包 0.1.0 和已有酒馆样例，得到 3 个拟请求、2 个复用决策和 1 个额外的跳过样例，实际发送为 0。归档的 4 个 mock 场景各调用了一次本地函数。未知结果再次提交后仍保留同一尝试。三张旧图只读，本轮真实模型调用 0 次。[dry-run 回执](evidence/YJ-02-backend-readiness/dry-run.json) · [mock 回执](evidence/YJ-02-backend-readiness/mock.json)

## 接入条件核查

接手时核对任务分支与远端 HEAD，原图片分支工作区干净，新副本使用任务书提交的完整文件树。检查范围为映界跟踪文件、九霄的 Node / Worker 入口、API 路由、开发启动器、配置模板及当前进程配置名称。只核查名称存在性。

| 检查对象 | 结果 |
| --- | --- |
| 图片相关源码 | 上游 `apps/api/src/card-import/parser.ts` 读取卡片 PNG，`router.ts` 与 `export.ts` 导出已有或默认封面。Node 与 Worker 的入口、API 源码、启动器和配置模板中未发现文生图或参考编辑的供应商适配器。 |
| 上游已有配置名称 | `NARRATIVE_CONFIG_PATH` 配置文字叙事，`CARD_LOCAL_CONFIG` 与 `NARRATIVE_KEY_CARD_LOCAL` 供本地角色卡文字模型使用。部署模板中的 `API_IMAGE` 是容器镜像。四个名称均未出现在当次进程环境。 |
| 图片配置 | 现有后端未定义可确认的图片端点和认证变量。本轮按名称检查 `OPENAI_API_KEY`、`IMAGE_PROVIDER`、`IMAGE_API_KEY`、`IMAGE_API_URL`、`IMAGE_API_BASE_URL`、`FAL_KEY`、`REPLICATE_API_TOKEN`、`STABILITY_API_KEY`、`GEMINI_API_KEY`，均未发现。上述名称仅用于核查。 |
| 生成、单图编辑、取得原图 | 原 YJ-02 有 Codex 工具级证据。当前后端三项均未知，未进行实际网络请求或下载。mock 返回已有 PNG 的本地引用。 |
| 远端请求 ID、查询、取消、幂等、费用 | 后端能力均未知。未找到可核查的已选服务，供应商协议和正式配置名待接入时确定。当前实验入口仅提供 dry-run 与本地 mock，未实现网络发送、查询、取消。 |

核查使用 `git grep -ilE 'image|图片|图像'` 查找候选并阅读其实现，再搜索 `/images/(generations|edits)`、`IMAGE_API_KEY`、`IMAGE_PROVIDER` 等名称，对照 `.env.example`、`deployment/api.private.env.example`、`apps/api/wrangler.jsonc`、`apps/api/src` 和 `scripts/dev`。[上游封面导出](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/export.ts) · [部署配置模板](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/deployment/api.private.env.example)

## 契约映射

| 现有导出 | 本轮用途 |
| --- | --- |
| DecisionSchema、requestKey | 从 `fixtures/tavern.mjs` 读出 5 个计划。另用同一 schema 构造“玩家关闭图片”的 skip，单独标为 `skip-example`。生成与编辑产生逻辑输入，复用与跳过没有 Attempt。来源均为 synthetic-fixture。 |
| referenceEligibility、reuseEligibility | 从可信样例索引选取 Asset，再读取 storageKey 指向的本地 PNG，计算 SHA-256。编辑检查场景、版本、审阅、摘要和保留集合。S2 引用 I0 并保留三人，S3B 引用 I1 并保留五人。模拟摘要不符时拒绝进入传输。授权上下文仅覆盖本地样例。 |
| CapabilitySchema、AttemptSchema | dry-run 的 origin 为 offline，sentAt 为 null，状态为 not-sent。注入函数的 origin 为 mock，记录独立 attemptId、原 requestKey、模拟发送及观察时间。无远端 ID、用量、费用时保留 null。 |
| AssetSchema、resultLink | 模拟成功后创建独立 mock 资产记录。用原文件摘要、原目标及参考关系和本次 attempt 进行 linked 对账。原有 PNG 作为模拟结果的文件来源，新记录审阅状态为 pending。 |
| stopWaiting、nextAttemptAction | 已发送后抛出超时异常，原尝试进入 unknown，本地停止等待。查询能力未知时返回 hold-unknown。同一模拟会话内按 requestKey 保存原发送 promise，再提交原请求返回原回执。跨进程恢复尚待 YJ-05。 |

提示、文件来源和批次统计记录在实验外层。现有公共契约可表达本轮全部必需状态，无 schema、版本或根依赖变更。[准备与传输入口](../../experiments/yj02-backend-readiness/prepare.mjs) · [现有契约说明](../contracts/visual-contracts-v0.1.md)

## 检查命令与结果

从映界仓库根运行。实测 Node 26.13.0、npm 11.20.0。已有 npm 缓存包含锁定的两个包；本机在首条命令额外指定了该缓存的 `--cache` 路径。构建后的实验仅需要本地文件读取。

~~~sh
npm ci --prefix packages/contracts --offline --no-audit --no-fund
npm --prefix packages/contracts test
node --permission --allow-fs-read=. experiments/yj02-backend-readiness/run.mjs
node --permission --allow-fs-read=. experiments/yj02-backend-readiness/run.mjs --mock
~~~

契约构建和原有 8 组测试通过。两个实验命令均退出 0，输出 JSON。相同 Node 权限参数下 `process.permission.has('net')` 返回 false。归档时分别重定向到本报告链接的两个 JSON。开发检查与最终归档各执行一轮 mock，即本轮累计 8 次本地模拟发送，每轮 4 次。外部图片请求累计 0 次。

| 本地场景 | 已断言的结果 |
| --- | --- |
| 返回正常 | 原尝试关联目标与待审资产，模拟远端标识仅来自 mock 回包，文件来源明确为已存在的工具原图。 |
| 未提供远端元数据 | 返回资产仍可对账，远端 ID、用量、费用为 null。本地 attemptId 单独保留。 |
| 明确失败 | 保留原尝试并记录 failed 与固定的脱敏原因，无资产。 |
| 发出后结果未知 | 保留 sentAt 与 attemptId，记录 unknown，下一动作 hold-unknown。再次进入同一传输入口，仍只有一次发送，无远端取消推断。 |
| 脱敏与参考门禁 | 回包与异常使用合成敏感值，检查序列化输出无测试令牌、认证字段、签名下载地址和完整响应。对两次编辑分别注入错误文件摘要，模拟发送均为 0。 |

## 真实接入缺口

1. 确认供九霄后端使用的生成与参考编辑入口，取得其真实协议、允许的模型及本轮调用范围。
2. 配置可用的后端认证，确认发送原参考文件的方式，以及如何获取并保存返回图片。若服务提供远端 ID、查询、取消、用量或费用，按实际响应验证并保存来源。
3. 条件具备后先运行上述默认命令，复核 S0、S2、S3B 的逻辑输入和两个参考摘要。真实适配器需消费这些输入，将已验证的供应商响应映射为 origin=backend 的尝试与新资产。届时另存真实回执。当前 CLI 没有 live 模式。

本次没有新增图片、启动九霄、运行真实会话联调，或验证供应商行为。后续可直接使用本批逻辑输入、样例资产和未知结果回执继续接入。
