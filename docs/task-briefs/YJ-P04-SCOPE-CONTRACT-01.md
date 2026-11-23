# YJ-P04-SCOPE-CONTRACT-01｜可信叙述层级契约：上游审查与最小设计

- 日期：2026-11-23（北京时间）。
- 负责人：映界架构审查；后续 Codex 可据此独立核查，**本轮不是业务实现任务**。
- 独立分支：`codex/yj-p04-scope-contract-01`；从 H3-B2S 最终 `c89021c0f5cff1fa37705c9e14b7f739d74bd102` 接续。
- 本轮授权：道主明确同意“调整方向”，认可**先核查《九霄》现有权威来源、建立最小叙述层级契约、再决定工程实现**。本轮仅准备可审计的架构任务书、源码证据报告和文档索引；不得把同意调整解读为允许修改《九霄》、开发新接口、开真实模型 API 或实施 H3-C/D1。
- 历史状态：H3-B2 `FAIL`、H3-B2S `FAIL` 均保留；当前生产默认入口与两项目 `main` 不变，旧安全门禁、历史失败、预留开启记录不改。
- 当前状态：**SCOPE_CONTRACT_ARCHITECTURE_DRAFT / IMPLEMENTATION_NOT_RUN**。

## 0. 立项原因和直接证据

先读 [当次上游源码核对](../architecture/YJ-P04-SCOPE-CONTRACT-01-upstream-audit.md)、[H3-B2S 最终报告](../reports/YJ-P04-H3B2S-narrative-scope-safety-report.md)、原 [《套戏》附加复现](../reports/evidence/YJ-P04-H3B2S/post-held.json) 与 [H3-B2《雾散后》验收](../reports/evidence/YJ-P04-H3B2/acceptance.json)。

H3-B2S 回放中《雾散后》第 3 回合已能隔离梦境、第 7 回合现实兑现已正确确认；但《套戏》第 3 回合外层演出未识别，导致内层推演错误挂到现实根层；第 7 回合推演结束 `pop` 后返回根层，第 8–9 回合的剧中承诺和交付被赋予现实资格。附加复现**1 个虚假现实事件**足以维持 FAIL。冻结预留 20/22 现实真阳性与 0 原例误入账不能覆盖这一风险。需要由**可信来源声明叙事范围**，不能将关键词猜测、来源 SHA 或模型自述等同于事实权威。

### 已知系统边界（2026-11-23 源码只读）

- 上游 `L-core-dev-team/Nine-cloud`，固定 `main@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`；非早期 YJ-01 的 `cd25360` 旧基线。源码的角色卡 `CardImportService.history` 在按 owner/session 与 `status='completed'` 过滤后返回 `key, action, narrative, resulting_revision`，不包含 `scopeId/parentFrame/worldKind`；群聊历史另有 `participant_id/ordinal/body`，不等于世界层级。
- `apps/api/src/card-import/schema.sql` 的 `card_import.requests` 可存 completed narrative，但无叙事 scope 或世界事实回执表；生成/提交只保证保存成功、修订一致、请求归属，并不能独立判定梦境和演出。
- 上游原生 `packages/contracts/src/{event.ts,turn.ts,decision.ts,save.ts,world.ts}` 的规则事件和 accepted receipt 的确含 save/branch、规则版本、事件与 revision 等权威转移约束；但这属于**另一个接口/存档体系**。未发现已接通角色卡 `completed-history` 的逐段 scope 证明；不准因为 native DomainEvent 可签认，就声称卡会话每段已经有权威世界层回执。
- 映界 `packages/contracts/src/schema.ts` 的 `fromCardHistory` 接纳相同四个历史字段并将来源标为 `evidence:"completed-history"`，表示已存文字来源，不是 `actual-world-fact`。旧 H3-B2S `scope.mjs` 是研究端从正文推断的栈，来源有效不代表父栈推断正确。
- 上述仅为**当前远端源码静态核查**，不是九霄 Windows 联测、运行数据库迁移或 API 真实响应。见审查报告中的 `VERIFIED/NOT_VERIFIED` 划分。

## 1. 产品原则与决策边界

**九霄是上游剧情、行动结果、世界状态的权威；映界不得以猜测修正九霄权威事实。** 角色卡自由生成的每段“旁白”若尚无上游验证机制，不能因来自模型或 completed 状态就自动成为可信叙事范围记录。

需要严格分开：
1. `PersistedNarrativeSource`：已保存、可核 SHA、可确定修订和用户/会话的正文。
2. `ScopeProposal`：由文本分析器或模型提出的 world/frame/parent 起止候选，**仅作待核**，不能给事件现实入账权限。
3. `AuthorityAttestation`：由具有明确权限的**服务端上游权威机制**针对特定源区间给出的有效叙事层级声明；必须先论证该机制如何独立建立/校核层级，不能只把模型猜测加个 `trusted=true`。
4. `DomainEventReceipt`：上游原生规则已接受的状态转移；只能对其确有表达且可核验的事实作授权证明，**不自动覆盖卡会话任意叙述层级**。
5. `WorldFactAdmission`：映界根据 `AuthorityAttestation` 和／或明确适配的 `DomainEventReceipt`，再结合原文支持/反证、H3-A 因果审查确认的实际世界事件；没有符合来源时只能保持待核。
6. `VisualEligibility`：还要独立经过 S2 角色/地点/视角、I1/I2 受信任务与许可；这与剧情事实确证不是同一个权限位。

当前上游没有证实具备第 3 项，因此**最小草案不得通过“本地自签”或“模型说明”虚构第 3 项**。未被权威认证的段落可展示文字／候选，但不能使角色、地图、权益或图片出现不可信事实变化。

## 2. 最小契约草案（设计，不是已存在的接口）

建议名称 `YJ-Trusted-Discourse-Scope/v0.1-draft`。严格区分 `AuthorityEnvelope` 和 `ScopeSpan`：

```text
AuthorityEnvelope [DRAFT ONLY]
  schemaVersion
  issuerSystem                // 严格限定可核验的上游宿主/服务，不信客户端自称
  authorityKind               // verified-host-scope | rules-domain-event | unverified-proposal
  sourceKind                  // card-history | native-turn
  ownerId
  sessionId? / saveId? / branchId?
  requestKey / acceptedReceiptKey
  revision, sourceKey, narrativeSha256
  sourceProof / receiptDigest  // 需确定威胁模型和服务端认证方式；裸字符串/哈希不构成权威
  attestedAtRevision, learnedAt
  policyVersion / upstreamCommit
  spans: ScopeSpan[]

ScopeSpan [DRAFT ONLY]
  start, end                   // UTF-16 半开区间，绑定原正文
  frameId, parentFrameId
  worldKind                    // current-reality | dream | staged-performance |
                               // hypothetical | reported | retrospective | unknown
  transition                   // enter | exit | inherit | replace | unknown
  speakerStatus / narrativeVoice
  effectiveFrom / effectiveThrough
  verificationStatus           // verified | proposed | unresolved | contradicted
  proofRefs[]                  // 精确指向原文/规则/上游授权结构化事件
```

关键规则：
- 使用**不与现有 SourceSchema 混淆的版本化补充契约**；不直接修改旧合同/数据库；预留字段只做类型设计。
- 来源必须按 owner/session/save/branch/key/revision 哈希和来源权限校验，跨线/跨用户/未来读写拒绝；不能仅比较字段字面或 SHA 来“验签”。
- 每一个开合框必须有指向**正确父框**的权威过渡；关闭内层 `hypothetical` 只能回到外层 `staged-performance`，未知外层不得默认 root reality。一个回合里可以有多次转换，每段均有确切 UTF-16 引用。
- `attestation` 并非验证中文语义正确的魔法。设计评审必须先回答：**谁有独立资格确定这一段属于什么层？它凭什么可信？** 若提供方只是同一个模型的另一段自由文本，标注仍是 `proposed`。
- `retrospective` 的已发生历史、`reported` 的第三方主张以及 `dream` 中确实存在的梦内动作，都可存作层内可见内容，但未经上游确认，不自动写作当前世界事实。
- 允许某些来源无层级证明：`scopeStatus=unknown`，仍能继续文字游戏与保留文本待核；**不能把全部缺失 scope 的文字一律宣称永不可能生成图片**，须区分可使用已有可信视觉状态、展示旧图和本轮新增事实的权限。
- 不允许从未来的“现实回归”声明倒写旧 `asOf` 已确认事实；后续可以按 `learnedAt` 新增澄清、撤销或重核，但历史回放和原始证据保持。
- 上游的事件规则真正可证明产权/行动状态时，应按 event type/字段白名单独立适配，不得用通用 `payload` 任意键作视觉事实。

## 3. 备选方案的真实成本与风险

| 方案 | 适用 | 限制/风险 | 本轮允许 |
| --- | --- | --- | --- |
| A. 上游在已完成叙事提交时生成**服务端可验证的分段 scope 收据**，与原正文和修订原子绑定 | 长期结构性解决方向 | 需要九霄上游开发、可靠语义权威形成机制、存储/迁移/兼容与安全审计；简单将同模型输出签名仍不证明叙事含义正确 | **只设计与列阻塞，不改上游** |
| B. 复用原生 `accepted turn + RULES events` 能力 | 原生引擎明确认可且可白名单映射的状态事实 | 角色卡与原生回合不同系统；目前未证实卡会话有相同事件流、scope 接口 | **只读评估适配边界** |
| C. 继续本地语义 scope 提议，无法证实时 `unknown/text-review` | 可行的安全研究退路 | 不能证明真实泛化，过度拒判，不能给未知事实升级为“现实已发生” | **可设计 fallback，不把其当最终权威** |

不能因当前证据不足就自行替九霄改现有生成链或 DB schema。应先由上游负责人决定可承诺哪些字段、何种验证来源；如果做不到，映界必须把“缺少独立权威证明”作为真实阻塞，而非假装完成。

## 4. 本专项四个交付 Gate（设计/审查专用）

**Gate A｜上游证据审查。** 固定并记录九霄当前远端 main SHA，检查 owner/session/请求/修订和 group 内容、native turn/save/event 权限、映界 current source validation；标注每项 `VERIFIED_SOURCE`、`STATIC_ONLY`、`NOT_VERIFIED`。阅读历史报告不得冒充当次运行。本轮前置静态审查已产[报告](../architecture/YJ-P04-SCOPE-CONTRACT-01-upstream-audit.md)；若 Codex 日后复核源码变化，必须追加新版本而非覆写结论。

**Gate B｜最小契约与威胁模型。** 输出字段、状态图、父子栈的语义、唯一性与来源校验、上游认证能力假设、schema version / error cases；明确 `signature≠truth`、`completed≠real`、`rules event≠freeform narrative scope`，画出《套戏》《雾散后》到事实权限的全链路。**本轮只提交本文草案，不开发代码**。

**Gate C｜设计对照与模拟证明方案。** 冻结至少三类需要以后离线原型验证的正反场景（仅规范，不造新的正式 held 数据）：
- 《套戏》real → staged → hypothetical → staged，不能跳 root；增加剧中前件/后件仍 0 reality fact；未来现实新交付需独立前件；
- 《雾散后》real → dream → real，第 3 回合不确证、第 7 回合有独立现实证据时可确证；历史实事在梦中撤销不得被写毁；
- 缺收据／错主键／错 SHA／伪造 `issuer`／错父层／跨用户、会话和分支／相同文字不同修订／未闭合嵌套／同回合切场／未来澄清。
设计评分要同时测**假的现实事件 0**与**有上游可证证据的现实真阳性非零**；不能靠全弃判换 PASS。独立人工/自然小说评价仍需 H3-C 独立批准。

**Gate D｜决策与验收边界。** 向道主提交 ①上游真正能证实的能力清单；②不可用的可信 scope 缺口；③最小接口草案和威胁模型；④上游改动触点与成本/兼容风险；⑤ A/B/C 方案与推荐；⑥阶段性设计状态、后续另需谁授权。可以结论为 `SCOPE_CONTRACT_DESIGN_READY / UPSTREAM_AUTHORITY_GAP`，**不能称“安全 PASS”或“新接口已接通”**。不得沿用旧 H3-B2S FAIL 改写为通过。

## 5. 必须保留的工程和权限边界

- H3-B2S 最终：`FAIL`，旧《套戏》附加复现虚假现实事实 **1**；历史 1,765 前缀、3,517 spans、222 evidence edges 的原审计按回执保留。
- 不修改九霄 `L-core-dev-team/Nine-cloud`、映界两个 `main`、旧 H3-B2/H3-B2S 实现或已冻结语料。
- 本轮只做 GitHub 架构文档准备：**没有新 Node/PG/Chrome/Codex 工程测试**；未建新运行接口、不发布上游 API、不外发素材，真实模型/图片调用 0、USD 0；旧 I2 `LIVE_BLOCKED_COST_BOUND` 不变。
- 未验证的独立 JSON 认证手段必须标明设计待定；不允许以 `hash` 或 `sourceKey` 值存在就认定来自上游权威。
- 下一个实际实现任务要有新的明确许可、单独分支、先冻结未见评价，再开发，保留所有老红灯及失败；不要把已公开的《雾散后》《套戏》作为新独立 held。

## 6. 下一次 Codex 只读架构复核交接格式

```text
YJ-P04-SCOPE-CONTRACT-01 / ARCHITECTURE_REVIEW_ONLY
Yingjie branch + base/final GitHub SHA; current main untouched:
Upstream Nine-cloud current main SHA and source files rechecked:
CardImport history exact fields, auth and semantics; structured scope receipt exists? evidence:
Native TurnReceipt DomainEvent applicability and limitation:
Yingjie fromCardHistory source authority boundary:
Contract schema/provenance and its actual trusted issuer (or GAP):
《套戏》 incorrect parent and 《雾散后》 positive-control diagrams:
Options A/B/C recommendation, estimated cost/risks and rejected alternatives:
What requires new upstream permission and new test data:
Actual code tests, model/image calls, USD cost, PG/Chrome:
Design READY vs AUTHORITY_GAP; never claim interface integrated:
```

**本轮仅开展架构调整与文档准备，后续代码/上游适配、H3-C 真正盲评、D1/Q1、生图与生产部署均不在本次许可。**
