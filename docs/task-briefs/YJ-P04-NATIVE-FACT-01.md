# YJ-P04-NATIVE-FACT-01｜原生规则事件白名单与可信位置事实的最小离线试点

- 编制：2026-11-23（北京时间）。
- 推荐执行者：Codex；独立分支：`codex/yj-p04-native-fact-01`，固定规划基线 `codex/yj-p04-scope-contract-01@eae794fc834142b11cc2aa71ffa668881537cc11`。
- 上游静态核查：`L-core-dev-team/Nine-cloud main@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。
- **最新授权状态（2026-11-23，北京时间）：道主在 Codex 完成只读审查后明确回复「批准」，许可 Gate A–D 纯离线合成开发、冻结、测试、回归及专用分支提交。**此次登记不代表已实际执行，Gate A–D 在本提交时仍为 `NOT_RUN`。真实上游账号/历史状态读取、模型/图片 API、付费、生产和两个 main 写入均未授权。
- 这是 **B（原生 RULES 事件白名单）最小研究试点**，并为 C（自由角色卡缺证只待核）设计隔离门禁；**不是 A（角色卡逐段权威 scope 回执）实现**。
- 保留 H3-B2 `FAIL`、H3-B2S `FAIL`（《套戏》附加复现虚构现实入账 1 次），原始冻结语料/首次红灯/历史回归和 I2 `LIVE_BLOCKED_COST_BOUND`。不改九霄或映界 `main`、生产默认、数据库、角色卡生成链、万卡阁；不运行真实模型、Images、参考图编辑、付费外发、联网供应商、或 H3-C/D1/Q1。

## 0. 为什么先选一个事件，而不继续正则修梦境

固定前提：
- [SCOPE-CONTRACT-01 上游审查](../architecture/YJ-P04-SCOPE-CONTRACT-01-upstream-audit.md)确认：角色卡 `completed-history` 证明正文保存，不证明每个字属于现实、梦或戏；原生 `accepted TurnReceipt + DomainEvent` 可证明**规则实际裁定**的事件，但还不能将任意自由正文区间升级为世界真实。
- [本专项事件语义审查](../architecture/YJ-P04-NATIVE-FACT-01-whitelist-audit.md)定位上游 `move.arrived` 的具体分支、`stateDelta`、`StoryArchive` 与根分支限制。
- 上游原生事件可能先于可选的模型叙述被提交，故“已经确认到达”应靠受认证 RULES 事件及合法状态变化，而**不是**模型说“你到了”。
- **重要例外：`move.arrived` 既可能用于世界地点切换，也可能用于同一 `locationId` 内的 `currentSublocationId` 变化；不能只检事件名，不能一律要求它改变世界地点，反之更不能因事件名就伪造新的 world location。**
- `move.bypassed` 也可能真的进入另一地点，却**不是本轮的白名单种类**。当前试点只能明确限定白名单覆盖范围，不能声称适配全部合法移动。

## 1. 目标与不可变范围

目标是在**隔离离线研究入口**消费经过上游宿主只读认证的原生规则回合，严格认定一类事实：

> `location-arrival/world-location-change`：接受的规则事件 `move.arrived` 明确含 `locationChange:{before,after}`，上游受认可的 reducer 从已保存前态应用该 delta 后得到可验证的新 `state.locationId`，`before!==after`，同存档、根分支、规则版本与修订连续吻合。

本试点默认只把这种情况作为“当前世界地点已变化”的**白名单正例**。同地点子区域变化不能冒充这个正例；如后续要把它作为单独 `sublocation-arrival` 事实，先核对 `currentSublocationId` 的 typed facts、delta 和受信 reducer，单设事件类型/验收，不用顶层 location 的含义掩盖它。

必须让出明确、可解释的三种结果：
- `CONFIRMED_NATIVE_LOCATION`：有真实宿主读回且规则来源、状态差异和可见权限匹配，映界可以存为**原生规则事实**；
- `NOT_A_WORLD_LOCATION_CHANGE`：受阻、同地点子区域、其他类型等不具有本白名单含义，禁止误写新的世界地点；某些可保留为其它事实候选；
- `UNVERIFIED / REJECTED`：权威来源不可读、字段不匹配、来源不一致、状态无法复核、版本无支持或不可信数据注入；不得生成确认事实。

所有输出还要区分**事实确证、场景更新候选、视觉资格、实际图片发送**，不能从第一项推导后三项已获许可。

## 2. 最小受信输入和验证边界

建议研究契约版本 `YJ-Native-Fact/0.1-research`（**不是已存在的生产端 API**）：

```text
TrustedNativeTurnInput [research-only]
  sourceKind: "native-turn"
  ownerId               // 来自当前已认证宿主上下文，绝不信 provider 自报
  saveId, branchId       // 当前 TurnReceipt/DomainEvent branchId 限制为 "root"
  requestKey / idempotencyKey
  receipt               // 上游经同一授权账号/存档查询并核对存储的 accepted TurnReceipt
  beforeSaveSnapshot    // 存在且可证明属于该 revision-1 的受信状态
  afterSaveSnapshot     // 经受信提交/重放取得，不能由 provider 任意填写
  optionalStoryArchive  // 已保存叙述作关联展示，不参与裁定事件是否发生
  verifiedSourceHandle  // 只能由受信宿主只读适配器产生，不可由外部 JSON 自称
```

开工前先证明/设计**来源真实性实现**：不能只运行 `TurnReceiptSchema.parse`、核对 SHA 或自己生成 `verified:true` 就声称已从服务器认证。研究入口可以用明确分层的**受信仓储假对象**模拟“宿主受认证读取”以验证逻辑，并给所有用例标 `SYNTHETIC_AUTHORITY_FIXTURE`；未完成真实 owner/save 访问控制的实际验证时，报告 `UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`，**不得宣称生产接通**。不要求/不得读取真实玩家账号和私有存档。

**历史状态硬门槛：**九霄 `GET /api/games/:saveId/receipts/:key` 仅在宿主提供 `readReceipt` 时挂载，读回的外层 `revision` 是读取时的最新存档修订，不能代表该历史收据的 `resultingRevision`。`GET /api/games/:saveId` 的最新存档亦不能证明历史回合 `R` 的受信 `R-1/R` 状态对。研究假宿主可使用受信检查点和完整、按提交顺序的事件批次重放，核对 R-1/R 及目标状态；任何缺失前态、漏事件、后态不符或认证不足都必须 `UNVERIFIED`。真实上游仍为 `UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`。

针对任意一条可发布事实检查：
1. 上游来源：`source=RULES`、已接受 `decision.status=accepted` 且成功 `outcome=success`；不采纳仅 `rejected`、`clarify`、`pending`、`legal_failure` 或 `MIGRATION` 作为这条事实。
2. 身份版本：owner/saveId/requestKey/`branchId=root`/receipt/event ID 归属、rulesVersion/event.ruleVersion 与允许的 reducer/规则版本核对；请求指纹和幂等语义与真正宿主来源一致。同主键不同正文或伪造单独事件拒绝。
3. 时间与因果：`beforeRevision=R-1`，`afterRevision=R`，receipt `resultingRevision=R`；跨修订重复、未来借证、跨 save/branch/owner、错误来源和回退时倒写拒绝；事件在同一 accepted batch 的重放顺序要保留。
4. 白名单动作：`event.type=move.arrived`，同时校验 `payload.from/to` 与 `stateDelta.locationChange.before/after`、前态 `state.locationId` 及最终 `after.state.locationId` 一致，before/after 是不同且有效的地点；`locationChange=null` 时**绝不创建世界地点变化**。
5. 规则引擎校核：优先复用固定版本的 `StateDeltaSchema` 和**对应已授权的 reducer**校验整个事件批次及前后事实，而非仅比较 payload 中的两串 ID。`payload.stateDelta` 为泛用 JSON 时必须严格解析、拒绝受保护字段/重复键/错误数组顺序；任何字段无法被正确投影，fail closed。
6. 读者可知：上游只确认世界变化并不自动证明玩家看见全部场景成员与细节；仅导出 `locationId` 的受信变更及在既有权限内可展示的内容。未获 S2 现场名单、I1/I2 许可不得生成 director suggestion 或请求。
7. 区分 `StoryArchive`：它能读回“该段叙述对应已提交规则回合”，**不保证每个自然语言句子准确、没有梦境/引用或能代表事件实体**。原生事件可确证位置；禁止把随附文本里的梦境家属、权属、交付升级为其他事实。
8. 冻结映射：只有经过确定版本白名单确认的字段/事件会被适配，`DomainEvent.payload` 其它任意键不可通用反射成事实。

## 3. Gate A｜先核对固定基线与冻结对照

本轮已获纯离线 Gate A–D 开工许可。Codex 实际开工前仍需核对分支 HEAD、独立工作树和权限边界；先执行 Gate A 冻结评价，再修改业务代码。
- 核对本分支最新授权 HEAD、本地工作树、上游固定 SHA；区分上游源码静态检查、过往报告与当次真正运行。保持两个 main 只读。
- 按**完整可信原生回合序列**准备合成冻结语料及质量协议，单独提交冻结文件与 hash，之后才能写适配器。
- 建议 >= 30 条独立合成原生回合故事/状态路径、>= 200 修订，dev/held 按故事和规则路径隔离（held 至少 40%）、>= 20 个白名单世界地点真阳性、>= 40 个恶意/混淆负例、>= 12 组“正文说到达但规则没有确认”的同文不同事实对照。达到不了如实报告。**不要求过量编造新世界书场景。**
- 高风险负例包括：`move.blocked`、`move.bypassed`（应严格归类本白名单范围外而非虚构“未移动”）、`move.arrived` 只移动 sublocation、已到同地点、不同前后态、receipt 合法失败、未接受/撤销、伪装 `RULES` 的 MIGRATION、错误 `ruleVersion`、错 owner/save/root、历史缺失、同事件重放/重复 id、事件批次中间缺一、无原始前态、正文和事件矛盾、未来证据、用户 action 与导入卡强行自称 authority。
- 标注每条 `trusted host source 是否存在`、`accepted/verified status`、`actual world location before/after`、`sublocation change`、`event whitelist verdict`、`published facts`、`unresolved/rejected`、`scene eligible`；**新叙述范围金标与事件金标不是同一件事**。
- 对 H3-B2/H3-B2S 已公开《雾散后》《套戏》和历史冻结仅做**公开回归**。如果 opened held 后改代码，必须降为公开并另冻新 held。

## 4. Gate B｜离线白名单适配器

建议独立 `packages/highlights/native-fact/` 或 `packages/native-facts/` 研究入口（最终由实际执行者根据仓库组织确定），不改上游源码、映界已有生产契约或默认运行入口。

设计/实现的关键职责：
- 明确的 `TrustedHostReader` 与 `UntrustedProviderEnvelope` 类型边界，假宿主专门注入可信读取结果，不接受 provider 提供的 signed bytes 或 `verified` flag 作为权限；
- 版本化 `NativeFactAdmission`：事实 ID 由 owner/save/root/requestKey/event ID/revision/规则版本的受信组合生成，缓存结果幂等且可重新回放；每条结果有 `reasonCode`、原收据 digest、验证过的事件类型及被使用的 delta 前后态，绝不泄露未授权事实。
- 批次行为：某一请求多个事件，按权威提交次序原子校核；若单个事件来源/应用 delta 失败，不能提前发布部分正确结果后继续失败；不得任意从多事件批次抽出一个 `move.arrived` 绕过同批更正。
- 把 `world-location-change`、`sublocation-change`、`nonarrival/blocked`、`other-authorized-event` 分开，首版只写 `CONFIRMED_NATIVE_LOCATION` 的规则事实，保留将来复用其它白名单的接口；引擎有合法绕行但本轮不支持时，要准确记 `OUT_OF_SCOPE_SUPPORTED_EVENT` 而不是错误标“根本没有移动”。
- 不改用户原始游戏存档，只对完成历史做只读派生投影。支持 as-of 回放、规则版本不匹配显式拒绝、历史变更版本兼容矩阵；没有受信前后态 `NOT_VERIFIED`。
- 与 C fallback 隔离：角色卡 `fromCardHistory` 仍只证明正文保存，不能流入本白名单 `native-turn` 构造器。自然语言范围猜测的 `ScopeProposal` 不得以相同字段样式冒充 `NativeFactAdmission`。
- 不请求视觉/图片；`send:false`，没有 I2 费用许可不得出站。画面可复用旧受信快照的既有资格，但本试点不新增景物/人物判断。

## 5. Gate C｜正负同文测量与硬门槛

至少设置四条对照：
- `trusted-native`：受信 host read + accepted turn + 规则 delta + 确切前后态，预期非零正确地点事实；
- `plain-prose`：仅保存“你到了某处”的文本或自由角色卡 history，**0 个白名单已证事实**；
- `untrusted-wire`：伪造 receipt/rule/event/stateDelta 或 self-issued flag，**0 个已证事实**；
- `scope-layer-mixed`：原生规则确认位置时，叙述中另有梦境/演出/反事实，**只确证规则位置**，不能推导梦里的交付/人数/权属。

报告 `TP/FP/FN`、白名单精确率与召回、`undefined` 情况、误受已拒收据数、重复计数、跨账号/存档/分支和越时借证、场景越权候选和 `send` 计数；记录来源、规则版本、delta 证据和 reject reason。新 held 一次正式开封；零硬门槛错误同时**有实际真实正例**才能报告通过。任何一例无权证据创建或误修改 world-location 都为 FAIL。

**具体事件矩阵：**
- `move.arrived + locationChange:{before:A,after:B}` 且受信前态 A/后态 B、权限及规则版本正确 → 允许 1 个 world-location 正例；
- `move.arrived + locationChange:null` 且 `currentSublocationId` 变化 → world-location 正例必须为 0（未来 sublocation 另开白名单）；
- `move.blocked` 或 rejected/clarify → 不产生已到新地点事实；
- `move.bypassed` → 另种可能确实到达的规则事件，但**本白名单不确证**；不许记录为“没有移动”的权威否定；
- 模型文字“你到了”，但规则实际 `move.blocked` → 不确证；
- 来源收据合法但 event fields 或前后态冲突 → 拒绝或保持 unresolved，不能部分落账；
- 同一 request/event 再次回放 → 同一已证身份，不新增第二条事件；
- 故事文字出现梦境/排演，而规则位置变化真实存在 → **只允许规则确证的位置变化**，文字不可旁路导入其他现实事实。

**安全门槛**：高风险 FP=0；错 owner/session/save/branch=0；未来倒写=0；假主键/同哈希假授权=0；越权视觉候选=0；未经授权发送=0；不得通过永久拒判来假 PASS。当前对 Native TurnReceipt 的 `branchId` 固定 `root`，非 root 必须报告未支持而非虚构兼容。

## 6. Gate D｜回归、可回退和如实结案

- 实际重放 H3-B2S 已有 1,765 历史+新增前缀、H3-A 12+52 因果安全、H3-B 30、H3-B2 52，及其报告列出的 H1/H2/H2R、S1/S2/S3、I1/I2、L1/L4、L3、P01 和公共契约；每个命令、退出码、首轮红灯与重试均真实记录。旧 H3-B2/H3-B2S `FAIL` 和 H2R 原失败继续可复现且原回执 hash 不改。
- 复核本任务的来源适配器新前缀、时间线/Idempotency、批次原子性、误导自然语言绕过、跨 owner/save、反事实；短/中/长回合的 CPU/内存测量不得冒充真实 API 延迟。
- 只对研究分支的合成输入运行；如本机没有本地 PostgreSQL/Chrome 依赖，请标 `ENV_BLOCKED/NOT_RUN`，不伪报实机 PASS；真实上游受认证请求和签名/授权能力若未端到端验证，明确 `UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`。
- 最终交付任务报告、冻结 SHA 与 gold（公开后的角色无关合成语料）、最初失败、原始命令和退出码、对照矩阵、白名单/版本表、每条事实来源证明、拒绝理由、回退说明和 final local/remote SHA、工作树状态。回退直接不启用新入口；生产默认不变，无数据库迁移。

### 状态词
- `NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS`：仅指在受信仓储**合成假宿主**与新冻结集上，事件白名单、状态核验、原生可证地点 TP 非零、安全与兼容均通过。仍**不代表**真实上游受认证接入、原生浏览器完整联测、角色卡分段 scope 或图片生成达标。
- `NATIVE_FACT_PARTIAL`：只完成类型和安全壳或真实正例不足；外部权威读回等未验要单列 gap。
- `FAIL`：任何伪规则已证事实、跨权限借证或越权发送。
- 本任务无论试点结果，角色卡 `UPSTREAM_AUTHORITY_GAP` 仍保留，不能以原生模式 PASS 宣告 H3-B2/H3-B2S 历史 FAIL 解除。

### Codex 交付格式

```text
YJ-P04-NATIVE-FACT-01: PASS / PARTIAL / FAIL
branch, base SHA, freeze SHA, final local+GitHub SHA, worktree:
fixed upstream main SHA and exact event/reducer semantics:
authorized host-read boundary verified? synthetic-only vs actual:
selected whitelist and excluded move.bypassed/sublocation:
accepted root receipt, ruleVersion, event and delta proof:
trusted-native TP/FP/FN vs plain prose / untrusted wire / scope mixed:
world-location vs sublocation, ambiguous/blocked, duplicate and multi-event:
facts admitted, source proof, permission/visibility and send:false:
H3-B2/H3-B2S FAIL preserved, old safety and compatibility regressions:
fresh commands, exit codes, held opening/lock, benchmarks:
actual model GET/text/Images calls 0, USD 0, PG/Chrome:
rollback, risks, next authorization needs:
```

**最新授权已生效：Gate A–D 纯离线合成实施可以开始；本次 GitHub 登记不代表 Codex 已运行或通过验收。真实九霄账号/存档读取、真实模型和图片 API、付费、生产部署、上游代码/数据库、两个 main 写入及 H3-C/D1/Q1 均不在授权内。**
