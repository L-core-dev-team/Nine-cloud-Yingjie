# YJ-P02-I2｜OpenAI Images 真实付费前：独立美元额度、持久发送许可与图像外发审查

- 日期：2026-11-22（北京时间）
- 状态：**仅任务书已创建；I2 业务代码与测试尚未执行；真实 API 调用未授权**
- 工作分支：`codex/yj-p02-i2-image-monetary-gate`
- 接续固定 SHA：`codex/yj-p02-i1-image-adapter-offline@31af7814f5805046ca5dc9a89d25cf685821ae3a`
- 九霄上游只读：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 当前供应商已选 OpenAI API；图像候选 `gpt-image-2.6-sunburst`，生成与编辑均只作为**离线技术设计候选**。实际 API Project 访问、当日定价、图片质量及真实使用效果未核验。
- **唯一立即授权范围：零网络代码开发、静态文档核查、假密钥/假 HTTP/内存 SQLite 与允许范围内的本机文件测试。新增真实 OpenAI 模型 GET、文字推理、图片生成/编辑 POST 均为 0；不得读取用户真实 API Key，不得收费，不得使用旧 L1/L4 许可。**
- Windows `127.0.0.1 connect EACCES` 环境阻塞已由 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1) 追踪；I2 不能绕过审批，原生 PG/Chrome 在环境未合法开放前一律 `ENV_BLOCKED`。

## 一、开工先核对的真实进展

I1 的 [真实报告](../reports/YJ-P02-I1-image-adapter-offline-report.md) 和 [67 项测试回执](../reports/evidence/YJ-P02-I1/verified.json)已经给出：

- `OpenAIImageProvider` 为 generate 创建 `POST /v1/images/generations` JSON；edit 创建 `POST /v1/images/edits` multipart，指定单张 PNG 和审查过的 I0/I1 原始参考字节。
- 来源严格经过真实已保存 `completed-history` 的历史摘要/scene/visual 核验，不能从行动、参考图或模型自报填空；三人完整名单/五人到场/晚间亮灯的合成提示与 PNG SHA 已在实际编码请求中检查。
- Provider 当前 `mode=mock` + 固定假凭据 + 无网运输，采用 `Reservations` 合成单位（**不是美元货币门禁**），并且必须使进程 `net` 权限为 false。非 mock 模式直接 `LIVE_DISABLED`，这是正确安全默认。
- I1 60/60 协议/负例与 7/7 ImageTasks/持久原件/恢复全部 PASS，两次最终测试回执哈希一致；原生 PostgreSQL、Chrome 与实时图片服务 NOT_RUN。历史 YJ-02 图片由 Codex image_gen 工具获得，不是本应用 API 生成。
- `ImageTasks.dispatch` 目前在正式 provider `send` 之前先创建 `sentAt`/waiting 的 attempt；I1 Provider 则在 `send` 内完成实际素材外发及合成预算授权检查。**I2 必须特别审计并修补“本地被拒绝但 PG attempt 已标 sentAt”的语义，明确区分发送前拒绝和可能已发。**
- 旧 L1 `ACKNOWLEDGED`，L4 `UNKNOWN_STOP`（历史送达与费用未知），L5 `PARTIAL`，L5B `ENV_BLOCKED`。这些都不是本任务可以自行改成成功的事项。

开工必读：`AGENTS.md`、`docs/handoff.md`、`docs/decisions.md`、`docs/requirements.md`、`packages/openai-image/{index.mjs,protocol.mjs,prompt.mjs,context.mjs,png.mjs}`、`packages/image-tasks/{index.mjs,schema.sql,files.mjs}`、`packages/provider-readiness/reservations.mjs`、I1 tests/fixtures、L4R 前端阶段审计代码与报告、YJ-02 和 YJ-05 原件/图片任务证据。

## 二、工作包 A：可证明的货币预算与逐操作许可（不自动实发）

### A1. 单独的美元授权协议

新建与历史项目完全隔离的 `ImageMoneyGrant` / `ImageAttemptLedger`（名称可调整）：

- 不从 L1/L4 的 SQLite 账户表重建/复用旧许可，也不拿 P01 的测试整数单位当美元。图片**生成、参考编辑分别计算并获得未来各自独立批准**，不得因为生成获批就默认允许编辑。
- 每个未来授权至少绑定：不可复用 approvalId、Model ID、官方 endpoint/method、操作 generate/edit、画面尺寸/质量/n/格式、scope 与 owner/session 的单向摘要、sceneId、visualVersion、eventKey、requestKey、已保存正文来源 revision/摘要、promptSha256、输入原件 SHA 与具体外发用途、最大请求数、批准时间/过期时间、USD 单笔及总预算上限、明确按 token/规格构造的计费假设快照。
- 没有用户**未来新明确批准**的单笔美元上限、模型、数据、参考图外发用途以及本人可信触发时，`allowLiveSend=false`，无法创建可真实发送的 permit。I2 本轮只能使用带 `origin=mock` 的测试批准，不得生成能通过生产门禁的“默认授权”。
- 本机 mock grant 应全生命周期固定批次、不允许依靠换 UUID、会话、分支、进程和新 attemptId 重新占用相同一笔；并发跨进程争用以 SQLite FULL 同步测试，真实 PG 设计必须说明跨进程一致性的权威数据源。

### A2. 单次/总预算与不确定费用 fail-closed

- 实施明确的 `preflightPriceSnapshot` / `maxChargeBound` 或等价纯函数。开发时**再次核对官方当日图片模型定价与协议**，按文本输入 tokens、参考图图像输入、图片输出、图片尺寸、质量等实际计费维度分别建模；不得假设“生成一张图成本固定”。
- 对每一次请求，只有**可确定且可强制限制的最坏费用上界**低于用户未来批准的 USD 总预算时，才可能真实发送；否则必须 `COST_BOUND_UNVERIFIED`、`LIVE_BLOCKED`。无官方可验证的最大 output token/图像输入 charge 算法时，不能根据估测平均值假装硬约束金额，不能为完成开发编造 token 上限。
- 定价以版本/核查日期和权威来源快照审计，模型或质量/大小变化、价格过期、图片参考增减、隐藏 token 计费不明、币种不一致、project 身份不一致立即拒绝。应用外部真实账单不可原子限制：须明确写出“客户端预留上界”与“供应商最终计费金额”差别。
- 对真实响应 `usage`、request id、billing/cost：仅从官方回执有证据的字段读取；未返回用量则记 null，不伪造 “实际 USD”。mock 里可以使用明确标记的合成费率而不得冒充官方价格。

## 三、工作包 B：修复发送前语义与持久防重复

- 设计并实装可注入的**pre-send gate**，在 ImageTasks 开始 possible-sent 边界前完成：宿主认证、已保存正文/scene 复验、当前视觉版本、references 外发权与 SHA、Operation、单次授权、可证预算、model/endpoint、调用是否被禁。所有这些失败必须记录 `NOT_SENT`，不得生成误导性的 `sentAt` 或给外发尝试占位。
- 在同一权威持久事务中（生产建议使用当前 ImageTasks PG/权威存储），记录当前逻辑事件的权利、审批/预算预留、attempt 与 `possible-sent`，**提交成功后**才允许真的调用外部 provider。若涉及 PG 与 SQLite 双存储而无法原子，报告 `ATOMICITY_BLOCKED`、保持 `LIVE_DISABLED`，不能用两个分别成功的数据库当作“原子预算扣除”。
- 要考虑在事务内部不得执行对公网请求，也不应通过用户输入的 URL 取参考图。外发前复检 source 与参考摘要必须为唯一绑定快照，防止预算审批后素材被替换。
- 如果场景后来修改、页面关闭、图像被撤权或有人在生成中切换地点，旧请求即使返回也只能进入原 attempt/pending 原件，不应落到新的活动视觉状态中。
- 收到 400/401/403/422/429 等**已验证明确拒绝**与 5xx/timeout/断流/服务端可能接收但回复丢失需要分开。只在确实证明未进入发送边界时 `NOT_SENT`；一旦 possible-sent，未知不能因补发、重启或换 UUID 失去占用。
- 引入 L4R 的脱敏阶段审计思想：`gate-checked` / `money-reserved` / `possible-sent` / `provider-response-seen` / `original-saved` / `pending-review` / `stop`，只写非敏感 runHash、UTC、固定枚举、grant hash；不打印凭据、私人故事、prompt 明文、参考图 byte、非脱敏路径或身份。
- 不默认支持远端查询、取消或幂等；若官方接口没有明确确认的能力，providerRequestId/usage/远端状态可以为 null，不可凭模拟返回创造。

## 四、工作包 C：独立的两步图像真实试点准备（**暂不允许实际发送**）

- 构建可复用的**未来批准清单和可阅读的页面/终端预检规范**：第一笔 generate，只用合成酒馆开场的许可字段；之后只有第一张真实返回 PNG 获有效审核、同一 scope/场景权利仍有效，并且道主明确单独批准 edit 外发，才允许第二步 edit。不得自动把 YJ-02 旧真图作为已获准外发的资产。
- 用户要能看到：本次模型、用途、合成提示的全文预览、是否包含参考原图及准确 SHA、画幅/质量、最大 n、预计费率与**保守上界是否真的可证**、单笔/总预算与累计占用、唯一按钮的含义。检查权限/填写 Key 与最终真实发送是不同动作。
- 受保护的 credential UX 只可使用未来经过验证的可信页面或原生秘密输入；**本轮不可要求输入真实 Key，也不能启用任何真实公网出站**。如原受管环境仍 EACCES，Chrome/PG/HTTP 本机预览只能 NOT_RUN，不得用 Dot 不同沙箱通过来替代。
- 模型质检另列为后续真图审阅：人物是否 3→5、服饰/位置一致、柜台/双窗是否保持、时段光照更新、是否凭空添加人物，均需真实 PNG 视觉核对。现有 fake PNG 仅验证协议和文件有效，不代表画质或编辑准确率。

## 五、脱离本机 TCP 的 I2 离线必测清单

在当前受管 Windows 环境中，**即使 loopback 被 EACCES 拦截**，也应完成且保留脱敏回执：

1. 纯内存正负例：缺美元批准、模型/规格修改、未验证官方定价、参考图输入成本未知、不能证明 worst-case 费用、预算不足、原图缺外发权、scope 错、过期审批、替换 prompt SHA、同逻辑请求用不同 action UUID 的拒绝。
2. 两进程/多实例 mock ledger 争用唯一许可；强制进程退出时 `possible-sent` 持久化，第二进程零重发；模拟历史记录丢失、图片保存失败、审阅被拒、引用失效、迟到回包均不重新动用费用。
3. 完整走一次 `ImageTasks.dispatch -> provider.send -> receive -> Originals.save -> pending review` 的内存/测试替身流程，显式断言：**发送前拒绝的本地测试不应虚构可能外发、不会错误写 sentAt；成功收到 fake PNG 才保存待审；复用/跳过永不创建真实发包**。
4. 使用真实的 YJ-02 I0/I1 文件做**本地**参考字节和编码核对，但注入 fake transport；不得在真实 API 发送任何原图片文件。
5. 回归 I1 原 60/60 + 7/7、公共契约 10/10、L3 30/30（含兼容 65）、P01 7/7、L1/L4 fake 各 15 项及图像资格相关测试；保留本轮实际失败、跳过与复跑原因。
6. 原生 Chrome、真实 PostgreSQL、九霄 completed-history ↔ 映界 ↔ Images 全链路因 Issue #1 仍拒绝 `127.0.0.1 connect` 时只标 `ENV_BLOCKED / NOT_RUN`。**禁止使用替换 shell、提权、代理隧道、修改防火墙或把网络接口暴露公网的方式绕过沙箱。**

如果在不能确认货币 worst-case 上界的现实条件下无法交付一个可安全激活的发送许可，仍然可以完成全套纯功能与持久防重离线验收，但必须将**真实付款放行状态保持 `LIVE_BLOCKED_COST_BOUND`**，不标成真正“可以马上点击发图”。

## 六、交付与未来验收门槛

提交：

- `packages/openai-image/` 与 `packages/image-tasks/` 中经审计的最小可插拔 budget/approval/send-ahead 代码和非网络测试；
- `docs/reports/YJ-P02-I2-image-money-gate-report.md` 与 `docs/reports/evidence/YJ-P02-I2/`（分层记录真实运行、mock、NOT_RUN）；
- 后续用户批准表单/读屏清单（不含密钥、不自动创建真 grant）、每次图片测试的模型/场景/图像许可/预算/审阅门禁；
- README、docs/handoff.md、docs/task-sequence.md、docs/verification.md、docs/decisions.md、CHANGELOG.md；复跑命令、源码 SHA 和回退；
- 保留 L1、L4、L5、L5B、I1、Dot ENV 的各自分支与原始账本/日志，**不修改任何 main**。

最终状态务必分层：

- `I2_GATE_OFFLINE_PASS`：离线钱额协议、发送前授权、持久防重、假收包/保存/待审/撤权均通过，且已明确证明无真实请求；
- `I2_GATE_PARTIAL`：需进一步修复功能/安全用例；
- `LIVE_BLOCKED_COST_BOUND`：即使模拟通了，真实计费最坏金额没有可证上界或项目权限尚不明，也必须同时保留的真实放行状态；
- `ENV_BLOCKED`：原生 TCP/PG/Chrome 仍不可测试，和功能状态独立标记；
- **`REAL_IMAGE_GENERATION_PASS` / `REAL_IMAGE_EDIT_PASS` 本轮严禁使用。**

### 后续另行批准的真实测试（本任务没有授权）

只有当前工程全部满足后，再向道主独立说明并询问下一笔真实图片调用：准确模型、生成 or 编辑、质量/尺寸、仅开发自编合成酒馆、允许外发的图片原件与 SHA、最多请求次数、**新 USD 预算上限**、当前 API Project 权限及最终受信页面人工触发。生成与编辑按两笔分别审核/授权；禁止继承 L4 $0.10 或默认复用旧图像工具试验。真实计费无法安全限制则维持 LIVE_BLOCKED。

## 七、Codex 汇报格式

```text
道主，YJ-P02-I2：I2_GATE_OFFLINE_PASS / I2_GATE_PARTIAL

当前分支、本地/远端完整 SHA、工作区：
I1 67/67 与本轮实际回归、失败记录：
审批/货币预算字段和独立 generate/edit 授权：
图片官方计费维度及 worst-case 上界是否有可靠依据：
ImageTasks 发送前校验与 sentAt/possible-sent 的新语义证据：
跨进程 claim、崩溃、unknown 后绝不补发：
generate 与 edit 的 outbound 源故事和原图外发许可：
假返回 PNG 存盘后 pending review/撤权/迟到的真实运行结果：
L5B 的 TCP EACCES 是否仍阻止 PG/Chrome，NOT_RUN 项：
本轮真实 OpenAI 模型 GET/文字/图片请求数是否全部 0、费用 USD 0：
L1 ACKNOWLEDGED、旧 L4 UNKNOWN_STOP、L5 PARTIAL 和原 main 是否保持：
真正是否能够受控发送真实图片（未授权时必须 LIVE_DISABLED）：
官方证据核查日期、脱敏报告/回执与回退：
```
