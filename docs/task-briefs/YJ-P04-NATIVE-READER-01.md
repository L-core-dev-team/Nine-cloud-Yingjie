# YJ-P04-NATIVE-READER-01｜上游受认证历史状态读取审查与最小接入方案

- 编制：2026-11-24（北京时间）。
- 映界接续：`codex/yj-p04-native-fact-01@5952a079ef7472f846a160954ca942df8fe69d71`。
- 九霄固定源码：`L-core-dev-team/Nine-cloud main@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。
- 独立任务分支：`codex/yj-p04-native-reader-01`。
- **授权：道主批准准备本专项完整任务书和源码审查。本轮允许只读架构复核和方案设计，不授权业务代码、数据库迁移、真实账号/存档读取、实际 API 联测或启动后续实现。**
- 当前 `NATIVE_READER_ARCHITECTURE_REVIEW_PENDING / IMPLEMENTATION_NOT_RUN`。
- 上一项 `NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS` 保留：32 条合成路径、298 修订、60 次白名单地点变化正确确认、0 FP/FN、138 次异常读取拒绝；真实 reader/历史状态对仍 NOT_VERIFIED。
- 保留 H3-B2/H3-B2S 历史 FAIL、角色卡 `UPSTREAM_AUTHORITY_GAP`、I2 `LIVE_BLOCKED_COST_BOUND`，不修改两个 main、不启动 H3-C/D1/Q1。

## 0. 核心目标

先读[固定源码审查](../architecture/YJ-P04-NATIVE-READER-01-upstream-reader-audit.md)、[原生事实运行报告](../reports/YJ-P04-NATIVE-FACT-01-report.md)、[正式验收](../reports/evidence/YJ-P04-NATIVE-FACT-01/acceptance.json)、`packages/native-facts/{reader.mjs,admission.mjs,README.md}`、SCOPE-CONTRACT-01 设计和 AGENTS/交接。

上一项证明了：映界拿到受信合成宿主的原生规则回执、完整事件批次及历史前后态时，可以安全接纳固定版本的世界地点变化。本专项要解决**真实服务权威来源**，不是再扩充一轮假仓储数据，不扩大事件白名单，也不回到自然语言猜测现实事实的旧路线。

分别回答：①什么认证主体有权读到对应的已提交回执和完整原始事件；②任意历史回合 R 的 R-1/R 状态来自哪里；③如何取得同一一致性读取截面的、最小披露的权威证据。后续真实试点只允许在另行批准的隔离合成测试账号和新存档中进行。

## 1. Gate A｜只读审查现有设施

固定远端 SHA 与本机已有副本的版本，不擅自切换或修改他人工作树；若上游已推进，保留本固定基线，另列差异。逐项给出准确源码路径、行范围和 VERIFIED_SOURCE / STATIC_ONLY / NOT_VERIFIED。

- 九霄 `apps/api/src/routes/games.ts`、`app.ts`、`index.ts`：认证 owner、readReceipt/StoryArchive 挂载条件、游戏/回执/故事读取、错误状态、分页、as-of。外层读取时 revision 不等于内部 receipt.resultingRevision；confirmed 不等于 accepted/success。
- `apps/api/src/services/{authoritative-game.ts,postgres-cloud-save-repository.ts,npc-memory-turn-transaction.ts,postgres-server-turn.ts,story-archive.ts}`：owner/save/key 校验、当前快照与提交时原子写入的区别、归档/撤权/生命周期、是否有真实历史前后态接口。
- `packages/db/src/schema.ts`、`packages/db/drizzle/0013_event_integrity_ownership.sql` 及后续有效迁移和权限：game_saves、turn_requests、turn_events、sequence、previous_hash/event_hash、是否有 revision-indexed checkpoint。哈希链仅是完整性的一部分，空链或丢尾也可能出现自洽校验，必须与实际 receipt 批次、修订连续、版本和受信目标状态对账。
- `packages/domain/src/{event-log.ts,state-delta.ts,prologue-v1-rules.ts}`、P1 插件：真实固定版本 reducer、完整批次顺序、状态前置条件、root 限制；不得用任意版本的通用 delta 投影冒充该版本规则核验。
- `apps/api/src/services/account-export.ts`：仅借鉴一致性只读事务，禁止使用全账号导出作为映界取数捷径。
- `packages/db/pending/0027_narrative_publication.sql` 及相关草案：pending 不能算部署事实；叙述上下文快照不等于历史 WorldState/SaveEnvelope；不得自行安装。
- 映界原生 reader/admission：WeakMap 合成凭证不是网络认证或任意同进程不可信插件隔离；现有 admission 要求的完整状态和固定 reducer 不能悄悄删掉。

本阶段产出「接口—数据—权限—历史证明」矩阵；源码只能证明接口和实现存在，不能证明实际部署或账号读取成功。本轮不得连接真实服务、真实账号、数据库或玩家存档。

## 2. Gate B｜三条路线的最小方案（仅设计）

| 路线 | 优先级与要求 |
| --- | --- |
| B1 复用现有历史证明 | 优先检查是否存在合法可读的可信 checkpoint/R-1/R、完整已提交事件与可独立核对目标态。若有则复用既有认证、仓储与 replayEvents；没有 checkpoint 就不能把当前存档冒充历史 |
| B2 隔离新建测试存档 | B1 缺证时的优先试点：未来单独获准后，使用真实本地九霄认证、PG、规则提交服务，新建合成测试身份/存档，取得真实 revision 0 检查点及后续每次提交的历史证据；复用上游原子提交/查询，明确证据签发组件。不得只换一组假宿主，也不得为旧存档补造过去状态 |
| B3 最小上游证明扩展 | 前两项不足时，评估提交时原子保存的受信状态对/摘要、周期 checkpoint 或窄范围读取服务；明确写入时机、生命周期、授权、存储成本、兼容与回退。上游负责人未批准前只能提案 |

从可信当前状态逆向重建仅作待论证选项：必须证明版本固定、所有变更可逆、事件批次完整且无旁路写入/迁移、存在独立核对证据，并区分后来重建与过去 as-of 的可知事实。自洽逆推不等于实际历史，缺证 UNVERIFIED。

### 最小历史证明契约（草案，并非已有 API）

```text
NativeHistoryEvidenceRequest
  saveId, branchId="root", requestKey, targetRevision
  // owner 由真实认证宿主解析，不接收调用者自报

NativeHistoryEvidenceResult
  status: verified | unverified | unavailable | denied | unsupported
  reasonCode
  scope: ownerBinding, saveId, branchId, requestKey, targetRevision
  observedThroughRevision, evidenceLearnedAt, proofReadId
  authority: actual-authorized-host | synthetic-test-host
  proofSchemaVersion, pinnedRuleVersion, canonArtifactHash
  receiptRef, receiptDigest
  persistedBatch: ordered identities/sequence/revision
  stateProof:
    revision-pair | checkpoint-and-complete-replay | unavailable
    beforeRevision, afterRevision, checkpointRevision?
    authenticatedStateEvidence, stateDigests
    eventChainAnchors, batchCompletenessProof
  allowedProjection: world location before/after
```

- 建议由真实上游宿主在同一认证及一致性只读截面（例如 PostgreSQL repeatable read read only）读取收据、事件与目标态。区分 target revision 与读取时截止 revision；正确处理分页、并发、超时、撤权、删除和缓存失效。跨账号/存档/branch 拒绝，不凭 HTTP 200、客户端 verified、哈希自报、纯文字或模型输出授予权威。
- 已接受规则回合应核对完整持久化批次与 receipt.events：同 save/root/key、身份、sequence、R-1/R、规则版本、无遗漏/重复/冲突。用上游实际 digest 规则核验哈希链和端点，而非另算不同格式哈希冒充数据库校验。
- 证据足以独立验证时才准入；完整私有状态可留在九霄受信宿主验证，只输出玩家授权且映界必要的最小证明。若需缩减既有 admission 的输入，设计独立版本化契约，不能删掉完整状态验证后仍冒称兼容或等价。
- 仍仅接纳固定版本的 `move.arrived` 顶层世界地点变化；同地点 sublocation、blocked、bypass 延用原分类，其他版本/非 root unsupported。事件缺证不能改写事实/地图/视觉，也不能据此出图。自由角色卡 history 无权获得原生事实签发权。
- 后来取得的证明按 evidenceLearnedAt/observedThroughRevision 保留，不能倒填过去 as-of 快照；历史记录和后续核验分离。
- 禁止导出真实用户全部数据、NPC 私有记忆、凭据、未授权角色卡/世界书，禁止将真实个人资料或真实存档放进 GitHub。

## 3. Gate C｜未来真实隔离宿主测试计划（本轮仅设计）

只有道主另行批准工程任务、确认九霄写入范围和本机环境后，才允许在独立本地 PG 测试宿主运行真实认证、原生规则提交与历史读取。使用新合成账号/新测试存档、正常服务路径和回环通信，无真实模型/图片；不连接正式玩家账号、线上存档或生产库。不得擅自突破旧 ENV_BLOCKED、沙箱和数据库许可。

未来试点最低要求：
- 至少两个隔离测试身份及各自存档；真实上游创建、持久化正常规则回合与 checkpoint/历史证据；至少一个符合白名单的实际世界地点历史正例，并在后来修订重新读取旧 R，准确验证 R-1/R。覆盖子区域、受阻及绕行；不能只用模拟仓储。
- 同一回合的两组比较：仅旧 receipt + 最新 save 必须 UNVERIFIED；受权且完整历史证据才允许确认事实。加入离开后返回同地，证明不能仅用 locationId 相等补证。
- 安全矩阵：未认证、owner/账号错配、错 save/branch/key/revision、伪造 receipt/source/hash、缺 checkpoint/事件、批次乱序/重复/缺尾、目标态冲突、rejected/clarify/legal_failure、非固定规则版本、未来借证、撤权/归档/删除后重复查询及缓存、客户端伪造权限。
- 并发测试：普通分离读之间实际提交新回合，对比一致性读取方案，禁止 torn read；确认授权撤销时的读取与复用结果语义。无法保证时阻塞，不谎报安全。
- 实际可证正例非零，越权/假事实/跨 scope/未来倒写/重复/视觉建议或发送均为 0；不得靠全面拒判取得 PASS。
- 未来执行前冻结测试矩阵/预期结果，记录实际命令、退出码、第一次失败、依赖及规则版本；保留旧 NATIVE-FACT-01 合成 PASS、60/60 和 138 异常回执及全部历史红灯。实际 PG 无法运行则 ENV_BLOCKED/NOT_RUN，不用扩大假仓储测试替代真实联测。

当前不执行上述测试，不跑重复的大套离线回归；后续实施任务中按授权锁定运行矩阵。

## 4. Gate D｜只读设计结案

请交付：
1. 已存在、可复用的认证/存档/事件/哈希链/重放和一致性事务；真实 R-1/R 或 checkpoint 可得性证据（没有则 GAP）。
2. B1/B2/B3 最小路线、具体依赖/文件、必要上游修改、是否需要九霄负责人单独授权、存储与兼容成本、可回退性。
3. 最小证明数据、签发者/权限、事务一致性、事件完整性、重放、历史知识时间及最小披露设计；不要承诺未经验证的接口。
4. 可执行的隔离真实 PG/认证试点计划、环境限制、正负安全用例、下一专项的具体授权需求和工程估算。
5. 若设计已完成可报 `NATIVE_READER_DESIGN_READY`；真实历史证明仍缺则同时标 `HISTORICAL_PROOF_GAP / UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`。**本轮不得报真实读取 PASS。**

## 5. 本轮权限和交接

当前只写映界独立分支的任务书、审查和索引；Codex 只读复核方案，未批准业务代码、上游修改、PG/Chrome、新测试数据库、真实账号/存档/游戏 API、模型/图片、付费、素材外发、生产、两个 main。上一项 PASS 与 H3-B2/B2S FAIL 均保留。I2 停止线、PG/Chrome ENV_BLOCKED/NOT_RUN 和角色卡 UPSTREAM_AUTHORITY_GAP 不改。所有未来执行必须另获明确许可。

```text
YJ-P04-NATIVE-READER-01 / ARCHITECTURE_REVIEW_ONLY
Yingjie branch/base/HEAD; upstream fixed/current SHA; local ref:
Existing authorized interfaces and stored event/receipt/checkpoint evidence:
Historical R-1/R availability; hash-chain and batch completeness:
B1/B2/B3 recommendation, minimal changes, ownership and risks:
Proposed read-only proof and consistency/authentication model:
Real isolated PG/identity test plan and positive/negative matrix:
Dependency/environment blockers, estimated work, next authorization:
Previous PASS and legacy FAIL retained; rolecard scope gap:
Actual actions/tests/network/real account/model/image/fee:
NATIVE_READER_DESIGN_READY / HISTORICAL_PROOF_GAP / ...
```

**本轮批准的是任务准备与只读架构复核，非实际实现或上游联测。**
