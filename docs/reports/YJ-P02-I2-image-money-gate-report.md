# YJ-P02-I2 图片美元门禁运行报告

2026-11-22（北京时间），任务分支 `codex/yj-p02-i2-image-monetary-gate`，准备提交 `6c298ada07650167f18793e716a83a00272f9719`，继承 I1 `31af7814f5805046ca5dc9a89d25cf685821ae3a`。

| 层次 | 结果 | 本轮证据 |
|---|---|---|
| I2 离线 | **I2_GATE_OFFLINE_PASS** | 40 个独立场景通过。另以多个真实 Node 进程检验同一许可竞争、不同操作竞争总额、强退、重新打开和丢失 attempt 后重建。 |
| 兼容性 | **148/148** | I1 协议 60、任务及进程恢复 7、公共契约 10、L3 30（覆盖旧 65 条样本）、P01 7、L1/L4 假传输各 15、图片触发资格 4。 |
| 真实付款 | **LIVE_BLOCKED_COST_BOUND** | 两种操作均为 `allowLiveSend=false`。真实模型查询、文字推理、图片生成及编辑各 0，新增费用 USD 0。 |
| 原生集成 | **ENV_BLOCKED / NOT_RUN** | 沿用 Issue #1 的受管环境记录。本轮没有运行 TCP 探针、PostgreSQL、Chrome 或上游角色卡端到端。 |
| 真实画质、项目权限、账单 | **NOT_RUN** | 页面未启用，无 Key 输入，无真实图片供审阅。 |

[逐场景、原件摘要、阶段与进程回执](evidence/YJ-P02-I2/money.json) · [本轮回归命令与结果](evidence/YJ-P02-I2/regression.json) · [原环境 Issue](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)

## 预留与发送顺序

旧实现先写 waiting 和 sentAt，之后才在 Provider 内检查素材外发权和额度。本轮将 OpenAI 请求拆成准备和一次性传输。在 ImageTasks 事务内锁定观看许可、任务及参考原件，通过同一连接读取授权视图和源事件，重放已保存的合成正文。编辑还核对当前已接受的原件、SHA、审阅 ID 及可用性。准备阶段固定 JSON 或 multipart 内容。编辑授权须单独绑定此次用途与这张原 PNG。传输函数只在事务提交成功后执行。

I2 使用同一个权威库记录预算、许可、逻辑事件、attempt 与阶段。在固定测试批次内每种操作只有一个许可位置；另对 grant、event hash 和 run hash 施加唯一约束。整数 microUSD 避免浮点舍入。授权绑定 project、方法和端点、模型/规格、owner/session/scope 摘要、场景及版本、事件与请求摘要、源修订/正文摘要、提示摘要、参考原件与用途、次数、有效期、费率版本及单笔/批次上限。测试费率另有 24 小时有效期。全额占用保留于明确拒绝、失败及 unknown 之后，不根据缺失的用量或账单回补预算。

- **发送前拒绝**。可归属到任务的请求在授权、历史、参考、规格或预算校验失败时回滚预留，记录 not-sent、空 sentAt、零假传输。无访问权、过时目标、reuse 和 skip 可直接在调度前返回。注入 attempt 插入失败时整个事务回滚，账本、审计和传输均无新增。
- **可能发送**。只有已提交的 waiting/非空 sentAt 表示越过保守边界，不能据此认定供应商收到。提交后立即退出也占用原额度。单笔生成占用 4000、编辑占用 5000 microUSD，均为假服务的独立测试金额。在总额 7000 的测试里，两个不同授权并发竞争，恰有一笔进入假传输，另一笔 sentAt 为空。
- **进程故障**。两个进程争同一授权时只有一笔假发送；另一组在假传输入口以代码 73 强退。全新进程再次调度，两组新增发送都是 0。再单独删除测试库的旧 attempt 并使用新 UUID，既有持久占用仍拒绝发送。权威账本本身丢失时须停用批次并人工核对；不能由会话历史重建可用余额。
- **回包、审阅和撤权**。400/401/403/422/429 与 503、断流和超时分别处理。测试把 I0 或 I1 原件装入假 multipart 后解包核对 SHA。有效假 PNG 实际写盘、同步、回读并进入 pending。人工拒审后保持不可展示；撤权后的迟到图片仍归原 attempt。另跑通了首图模拟审阅、缺少编辑授权时拒绝、取得第二份模拟授权后引用该首图编辑的顺序。文件保存失败保留预留与已见回包阶段。测试空白图仅验证协议。
- **来源与审计**。回执提供三次成功路径的源正文、prompt、输入/输出 PNG 摘要。阶段表只接收固定枚举、UTC 时间及两个散列。供应商未提供的用量、请求标识、费用均留 null。测试回执中的 USD 0 是本轮零真实调用的开销。阶段表不充当授权或退款凭证。

权威事务在受管环境中使用 SQLite `BEGIN IMMEDIATE` 和 `synchronous=FULL` 实测。生产候选 SQL 要求在 ImageTasks 的同一 PostgreSQL 连接上执行 SERIALIZABLE 事务、锁住总额行，并将 attempt 与预算同时提交。部署前还需核验真实 PG 的锁竞争、隔离错误和提交失联恢复。若拆成独立 SQLite/PG 写入，须判为 `ATOMICITY_BLOCKED`。I1 兼容入口仍仅接受无网、固定假凭据与 P01 合成单位，不能用于 I2 钱额批准。当前无生产安装或账本迁移。

## 官方计价与缺口

2026-11-22 静态核对候选 `gpt-image-2.6-sunburst`。标准费率按每百万 token 计，文字输入 USD 5、图片输入 USD 8、图片输出 USD 30。上界计算不能依赖缓存折扣。生成涉及文字输入和图片输出，编辑另计参考图输入。官方计算器依据模型、质量和尺寸给出输出估算，且排除输入费用。单张 1536×864、medium、PNG 限定了请求规格。查阅的两条 Images 端点参数没有可用来封顶本次全部计费 token 或美元的字段；也没有取得该 Project 对这两种精确请求的完整最坏收费证明。因此真实上界返回 null。客户端预留只控制本应用的并发承诺，供应商最终计费仍需其实际账单。[模型与费率](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst) · [图片费用计算说明](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency) · [生成参数](https://developers.openai.com/api/reference/resources/images/methods/generate) · [编辑参数](https://developers.openai.com/api/reference/resources/images/methods/edit)

今后分两次审查模型、项目、数据、用途及单笔和总额，需新的明确授权与受信人工触发。当前 `livePreflight()` 固定保持关闭。项目准入、可强制的最坏费用、实际权限及原生事务验收仍待补齐。三人到五人、服饰、位置、柜台/双窗与傍晚灯光变化均待真实 PNG 人工判定。[未来受保护预检与审批清单](YJ-P02-I2-approval-checklist.md)

## 复跑、源版本与回退

Node v26.13.0。在分支根目录使用已准备的 packages/contracts 依赖及构建产物。测试命令的回执输出路径可选，提供时须使用新文件名。所有模拟批准、预留及原件写入专用临时目录。

```powershell
node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
node packages/openai-image/check-money.mjs
node packages/openai-image/check.mjs
node --permission --allow-fs-read=* --test-isolation=none --test packages/contracts/test/*.test.mjs
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/scene-evidence.test.mjs packages/first-play/test/initial-survey.test.mjs packages/first-play/test/continuity.test.mjs
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/trigger.test.mjs
node packages/provider-readiness/check.mjs
node packages/luna-text/test/check.mjs
node packages/luna-text/test/check.mjs ../l4-i2-new.json --l4
```

无网子进程内的同步与异步 fsync 能力检查均返回 ERR_ACCESS_DENIED。按 I1 的文件宿主边界，由父进程仅接收三个已知夹具摘要，调用原 Originals.save；假传输仍只在无网络权限的进程中运行。首次定向 37 项通过，补充双步骤、授权换号及费率检查后为 40 项；另完成并发总额检查。没有失败的功能套件。首次暂存检查报告 CRLF，按仓库 LF 修正并复验。原生环境不计入通过数。

关键源码 Git blob 分别为 ImageTasks `7b38216756bcebece2692e4de33162c2dcb417ab`、OpenAI Provider `bb024aad69c9b4ab91ac0b320d940eaaef170a98`、货币门禁 `84dbc2be2d015dadb452bead646a2d7ac96f9b6e`。在新工作树检出准备提交可回到 I1 行为；本次代码也可单独 git revert。保留所有历史许可、占用与审计，禁止将回退作为重发方式。L1 ACKNOWLEDGED、旧 L4 UNKNOWN_STOP、L5 PARTIAL、L5B ENV_BLOCKED 继续沿用原记录。
