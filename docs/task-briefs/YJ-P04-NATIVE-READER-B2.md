# YJ-P04-NATIVE-READER-B2｜真实本地认证、PostgreSQL 与原生历史事实最小端到端联测

- 编制：2026-11-24（北京时间）。
- 执行者：Codex；映界独立任务分支 `codex/yj-p04-native-reader-b2`，固定接续 `codex/yj-p04-native-reader-01@f2c4015e4295fd0a074d176e93d865a9802a6701`。
- 上游九霄固定源码：`L-core-dev-team/Nine-cloud main@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。已有本机检出可能仍为 cd25360；使用独立检出/工作树，禁止切换、覆盖用户既有工作树。
- **正式执行授权：道主已在审阅 NATIVE-READER-01 的 B2 方案后明确回复「批准」，允许直接执行本任务 Gate A–D，不再要求另一轮只读计划批准。** 授权范围是独立本地测试工作区、回环服务、专用临时 PostgreSQL 测试库、两组合成测试身份及新测试存档、真实认证与规则正常提交、测试宿主专用读取/捕获组件、必要的测试数据和代码、测试与报告、推送映界任务分支。没有授权 B3、上游核心架构/正式接口与迁移变更、真实玩家数据、生产、两个 main 或真实模型/图片/付费。
- **当前实际状态：授权已生效，工程 Gate A–D 尚未由本次文档提交执行，NOT_RUN。** 旧 NATIVE-FACT-01 的 `NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS`、H3-B2/H3-B2S 的历史 FAIL、自由角色卡 UPSTREAM_AUTHORITY_GAP、I2 LIVE_BLOCKED_COST_BOUND 保留。
- NATIVE-READER-01 只读结论 `NATIVE_READER_DESIGN_READY / HISTORICAL_PROOF_GAP / UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`；批准的是 B2 新合成存档局部试点，不是宣称任意真实旧存档可读取。

## 0. 目标、基线与不可替代的真实链路

先读 AGENTS、当前交接、[NATIVE-READER-01 设计任务书](YJ-P04-NATIVE-READER-01.md)、[固定上游审查](../architecture/YJ-P04-NATIVE-READER-01-upstream-reader-audit.md)、[NATIVE-FACT-01 运行报告](../reports/YJ-P04-NATIVE-FACT-01-report.md)、[其验收](../reports/evidence/YJ-P04-NATIVE-FACT-01/acceptance.json) 与 `packages/native-facts/{reader.mjs,admission.mjs,README.md}`。前项合成 32 条路径、298 个修订、60 个 TP/0 FP/0 FN、138 个异常拒绝，仅供回归。

目标只是一条足够坚实的 B2 端到端链路：

真实本地九霄认证 → 正常创建新合成存档 R0 → 真实序章规则服务提交 → 真实 PostgreSQL 保存 receipt、独立 turn_events、当前状态 → 测试宿主捕获真实已提交历史 checkpoint/前后态 → 晚于 R 后重新认证并按 R 查询 → 在一致性截面验证完整历史 → 映界研究入口确认白名单位置事实。

**身份、规则执行、数据库、持久化和授权检查必须真实运行；只有账号、游戏存档、行动、验证码投递和测试素材是合成的。** 不能把合成规则、mock pool、fake auth、手写回执或同一份 reducer 输出同时当金标/已提交状态来代替任一真实环节。只把 receipt 与当前 save 组合不是历史证据。新存档留证不等于旧存档补证。

## 1. Gate A｜安全环境预检、固定输入与测试矩阵

先核对两个 main、映界任务分支授权 HEAD、本机原工作区、九霄固定 SHA、工具/依赖版本、规则审批 digest 与官方非生产加载条件。使用明确允许的本机回环地址和独立测试目录/测试库；优先复用本机已有依赖及本地 PG 工具，不擅自下载模型、连接外网供应商或扩大环境权限。

- 参考九霄 `apps/api/src/card-import/joint-host.integration.test.ts` 的真实 `EmailAuthService + PostgresEmailAuthRepository` 与本地验证码收件器；该旧用例为合成规则，且有直接插入存档的测试准备，**不可作为本轮实际规则/正常创建存档通过证据**。
- 复用 `apps/api/src/services/{authoritative-game.ts,server-turn.ts,postgres-server-turn.ts,npc-memory-turn-transaction.ts,postgres-cloud-save-repository.ts}`、`routes/{auth.ts,games.ts}` 的实际认证、创建、回执与提交路径；使用上游官方允许的 P1 非生产规则插件及原生已审批版本，验证 semantic digest/审批门禁。不绕过授权加载；缺条件记 BLOCKED。禁止假造九霄负责人审批。
- 测试库必须是专用新库/独立实例或已明确批准的本地测试隔离环境。核对连接确实是回环、库名专用且数据源空/仅测试数据，使用最小角色；遵守上游 `assertLocalCardDatabase` 和其他适用 guard/迁移规则。仅安装固定版本正常、已批准的测试所需迁移，不应用 pending 0027/0028、生产迁移或改变既有 schema。严禁碰用户原 PG、Docker 容器、生产 DB URL、真实 Cookie、真实账号、已存在存档、真实邮箱。使用进程内本地验证码捕获或合成测试邮箱，不发真实邮件。
- 固定 B2 受权范围：测试宿主只绑定新建合成账号 A/B 及其创建的新存档，正常账号/会话认证；任何未知 owner/save/branch/key、非本次测试名单均拒绝。只允许必要的本地回环监听，关闭所有真实模型/外部供应商配置（含文本模型、API key 自动加载/探测）；正常行动请求关闭模型叙述生成，如需文字用已有确定性展示。不得修改安全沙箱或网络防护。
- 核查数据库事件 hash chain 的真实迁移版本：0013 摘要未含 branch_id，须额外校验 root 与身份；验链为 true 并不独立证明完整历史/端点/权限。检查已持久化 batch 对照、sequence 和 revision 连续性。
- **先提交冻结测试矩阵、输入路径、预期结果与评分/硬门槛，再实现新读证组件。** 金标基于固定规则规格与测试计划，实际独立数据库捕获用于核对重放，不把捕获失败删掉、不根据测量修改标准。已知 NATIVE-FACT-01 和旧 H3 案例均是公开回归。记录第一轮真实环境/工具失败与全部命令退出码；只有确实运行的用例可标 PASS。

若回环、PG、必要规则加载、测试认证或上游授权条件不可用：如实标 ENV_BLOCKED / NOT_RUN，记录尝试、原因和最小缺口，不另造假仓储宣布 PASS；不要求用户再次确认已经批准的 B2 范围。若确实需要扩大到 B3、新权限或外网，停止该超范围操作并报告。

## 2. Gate B｜实现测试专用的历史证据读取链

### B1. 正常创建与捕获（测试宿主，非生产）

- 两个**新合成身份**经过正常认证取得真实 session token/cookie，验证 token 解析由现有服务完成而非传入固定 owner。用正常 game create 路由/服务各创建新原生 root save，记录请求归属、真实 revision=0、pinned canon/rule/memory-policy 及真实创建记录。禁止 SQL 直接插入伪初态代替正常创建。
- 在首个行动前，由受权测试宿主从实际 PostgreSQL 独立读回 R0 完整 SaveEnvelope 并固定摘要/空日志端点。试点单写者/每 save 串行推进：每次正常规则提交成功后、下一次提交前，从数据库读取**已持久化的** Rn 完整状态、对应原始 receipt、turn_events 独立行的 sequence/端点并保存捕获证据。校验确切 revision；错过状态时不反造 checkpoint，记缺证。非 accepted 不创建新修订。
- 捕获记录绑定 owner/save/root、revision、请求键、来源事务/读取截面、规则和 canon 版本、event chain anchor/累计数量与摘要、实际捕获时点；测试侧保管完整状态，不默认泄露给客户端。捕获应追加且不可由外部 wire 覆盖；不要用重放出来的状态替代从 PG 独立读取的目标。明确单写者测试环境下如何保证读回的是本次提交而非别的写入。B2 允许测试专用受信存储，不声称具备 B3 的生产原子历史快照持久化；跨进程/重启若无已证 checkpoint 保留机制，必须明确不支持，不能倒推。
- 捕获/读取凭据、原始 Cookie、验证码、数据库连接字符串、个人数据不得上传 GitHub；仅交付脱敏合成证据、摘要和可复跑脚本。日志和环境输出脱敏。

### B2. 读取与完整重放（真实认证与 PG）

- 建议在独立本地宿主添加窄只读取证组件（代码归档在映界测试包或独立本地九霄测试包装，默认未挂载生产，禁止修改上游 main/正式 schema/API/规则生成链）。采用实际九霄身份服务解析 owner；仅接受 saveId/root/requestKey/targetRevision 等 locator。需要绑定有效 session、未关闭账号、未归档/删除存档，不信外部 owner、verified/hash/receipt JSON。不要为了便利读取全账号 export、跨账号表数据或任意 SQL。
- 在同一事务的一致性读取截面（参考 `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`，实测使用的策略与隔离级别必须记录）查询已授权 owner/save、目标回执、持久化完整事件行与端点。核对请求表中的 expected_revision、raw receipt.resultingRevision、accepted decision/成功类型、事件数量/逐事件字段、独立 row 与 receipt.events 的顺序/内容、sequence 无断裂、source=RULES、save/key/root、版本及真实 digest chain。区分 GET 外层最新 revision 与目标 R。不能仅以 verify_turn_event_chain=true、单个 hash 或 HTTP 200 就发布事实。
- 从独立捕获的 R0 或已证 checkpoint，用固定 `replayEvents`/P1 host reducer（含 creationRequestHash 等上游真实包装）按真实持久化顺序重放至 R-1/R。用分别捕获的真实数据库目标状态核验完整前后 SaveEnvelope/facts/规则版本，而非只看 locationId。核对该目标 R 在读取时确实已提交且完整，不以最终较晚的 save 代替；若缺可信 checkpoint、历史前态/后态、事件/端点、状态不一致、跨 scope 或版本不支持，UNVERIFIED/denied/unsupported，不入账。
- 明确授权线性化时点及交付时效：每次读取及每次缓存复用都实际重新认证、owner/save 生命周期核验；若会话撤销/账号关闭/归档删除在最终授权检查前完成，不得交付旧结果。单一 MVCC 历史截面本身不能保证当前撤权已生效；必要时在交付前用新的授权检查或受支持生命周期锁协调，记录实际保证与限制，不能承诺超出线性化点的已交付数据可被撤回。跨账号、撤权后的查询不暴露其他人的事实、快照、摘要或敏感错误信息。
- 区分 targetRevision、实际读取截面 observedThroughRevision、capture time 与 evidenceLearnedAt（首次具备有效证明的时点）。晚于 R 获知的历史证明只能追加到当前/之后的知识账本，不倒写过去 as-of 快照。重复请求不得新增第二个事实。
- 不要扩大数据披露。优先在受信测试宿主内复用 `admission.mjs` 的完整状态校核语义；若实现新的最小证明契约/入口，标明版本、issuer 实际身份和传输/受信调用边界，不能把 `openSyntheticReader` 的 WeakMap、返回的 source=SYNTHETIC_AUTHORITY_FIXTURE 或客户端声明改名就当真认证。若保留现有 admission 作为计算内核，另设真实受信组装层，明确区别来源；旧合成入口和回执不改。全链路输出必须可区分实际 PG、真实认证、规则、合成测试数据、测试捕获和映界派生结果。
- 仍仅发布固定版本成功 `move.arrived` 的顶层世界地点变化：from/to、非空 delta、完整前后态一致。子区域变化不发布世界地点，blocked 不误报到达，bypass 如实分类 `OUT_OF_SCOPE_SUPPORTED_EVENT`；不得宣称未适配的移动没有发生。其他字段、梦/戏中叙述、自由角色卡、未知规则及非 root 不进入本白名单。研究入口 `sceneEligible:false / send:false`；禁止调用导演/出图/外部模型。

## 3. Gate C｜真实端到端及安全验收（必跑）

先执行完整实际正例链，再做冻结的负例矩阵。至少两个独立真实认证的合成账号，各自正常创建 save。至少一笔白名单合法世界移动，在推进到更晚修订、退出并重新登录后，以相同 owner 重新查询旧 R，历史 R-1/R 由真实捕获与完整事件复核成立；**必须确认非零事实，不允许全拒判。** 如规则路径可达，覆盖离开再回同地点、同地点子区域移动、受阻及合法绕行；按固定实际规则动作序列推进，不直接改存档造正例。

| 对照 | 真实验收要求 |
| --- | --- |
| 历史正例 | 真实 auth/session + 正常创建 + 实际 P1 RULES + PG 持久化 + 独立捕获 + 旧回合重读；映界正确确认至少一条，逐事件/前后态对账 |
| 缺证对照 | 同一合法旧 receipt + 最新 save；错过捕获、缺 R-1 或 R、只提供位置相等；均 UNVERIFIED，不补造旧状态 |
| 规则边界 | sublocation 0 世界地点事实；blocked 0；bypass 单列；rejected/clarify/legal_failure 不冒充成功到达 |
| 身份/生命周期 | 未登录、伪 owner/header、错 session、A 读 B、错误 save/key/branch/revision、注销/撤销后重读、归档/删除后读与缓存；权限撤销在最终授权点前完成则拒绝 |
| 数据完整性 | 伪授权 wire、错规则版本、缺事件/缺尾/乱序/重复、错误 chain/anchor、receipt 与实际事件行不符、目标态冲突、非 root、重放冲突；整批失败不得前半批入账 |
| 并发 | 使用可重复的 barrier 使读取期间正常提交下一回合，展示旧分离读可能得到异修订，实际一致性读取正确固定截面或拒绝；模拟撤权竞态用真实服务操作；严禁以人工注入的 mock 结果代替真实 PG 读/写并发 |
| 时间、重复及披露 | 未来 R、晚到证明不可倒写、同一事件重复新增 0、跨账号/存档/分支/未知来源 0、只允许必要的地点事实、无视觉建议/发送 |

负例可以在专用隔离测试副本、验证器数据边界中构造损坏输入，但不得改动主正例存档、禁用 PG 完整性保护、修改生产库或使用侵入式测试绕过。分别报告真实服务层/真实 PG 用例与纯验证器故障注入，不能将后者冒充真实数据库攻击复现。无法执行的冻结场景如实 NOT_RUN/ENV_BLOCKED，核心门槛缺失不得报 PASS。若首轮失败要修复，保留红灯、原用例、日志和修订，不改金标。用户已授权 B2 范围内的本地修复，可继续实际测试；若需要 B3 另行审批。

## 4. Gate D｜回归、验收与退出

- 复用固定规则源码/现有依赖，重跑 NATIVE-FACT-01 公开 298 修订/60 TP/138 异常或其完整标准回归，核验先前 acceptance/evidence hashes 不变；重跑与新组装层有关的身份、来源、原生规则批次、时间和兼容测试，证明旧合成入口与新入口隔离。原 1,765 H3 历史前缀及 H2R/H3-B2/H3-B2S 红灯保持；使用上一专项已有回归驱动器，实跑结果逐项列出，环境阻塞如实记录。旧 H3 结果不得改写为 PASS。
- 测试前后独立核对两个 main、任务范围及变更文件；九霄工作树只许独立测试用包装/适配，任何上游远端修改、核心规则/生产接口或 B3 迁移均不授权。保留用户原工作区与数据库。
- 关闭本次启动的临时回环服务、数据库连接和测试进程。只清理本轮明确创建且可证明为测试专用的资源；若需保留独立测试证据/复跑环境，注明清理命令与范围。不得删除、修改用户现有账号、存档或数据库。回退只停止测试读取器，弃置派生证据缓存；不迁移生产。
- 提交 `docs/reports/YJ-P04-NATIVE-READER-B2-report.md`、脱敏 `docs/reports/evidence/YJ-P04-NATIVE-READER-B2/`、冻结矩阵/版本、测试专用代码、真实命令与退出码、初次失败、数据库/服务实际证据、认证/并发/权限/缺证逐例结果、完整历史重放对账、回归及旧证据核验、限制与回退。同步 README/CHANGELOG/handoff/decisions/task-sequence/verification，给本地与 GitHub 最终 SHA 及工作树状态；只推映界独立任务分支。
- 实测 **真实玩家账号和存档读取=0，真实模型查询/文字/图片 API=0，外部真实邮件=0，USD=0**。测试身份认证、回环 HTTP、临时 PG 的真实次数需另外明确报告，不将它们混作真实玩家或真实供应商调用。

### 验收状态

- `NATIVE_READER_B2_LOCAL_AUTH_PG_PASS`：仅在固定九霄真实本地认证 + PG + 实际规则 + 按修订捕获/重放 + 晚于目标 R 的真实受权读取 + 映界发布的整链均实际通过；正例非零；冻结核心权限/并发/完整性/缺证用例无失败，越权、误收、倒写、重复新增、视觉发送 0；明确范围仅**本轮新合成测试身份和新存档、测试宿主、固定规则版本**。分别记录 `LOCAL_TEST_AUTHENTICATED_READER_VERIFIED` 与生产/真实玩家/旧存档任意历史读取 NOT_VERIFIED，不能把旧数据缺口或角色卡 scope 视为解决。
- `NATIVE_READER_B2_PARTIAL`：已取得部分真实链路证据，但缺核心历史、真实认证、并发/撤权、完整数据或其他必要门槛；具体列缺口。
- `NATIVE_READER_B2_ENV_BLOCKED / NOT_RUN`：环境、规则权限或依赖无法建立真实链路；保留实际证据与最小阻塞，禁止用假宿主替代。
- `FAIL`：任何高危虚假确证、越权披露、未来倒写、未经授权发送或违规修改/访问。
- 本轮不自动授权 B3、生产、真实用户旧存档、H3-C/D1/Q1。角色卡 `UPSTREAM_AUTHORITY_GAP`、旧 H3-B2/H3-B2S FAIL 与 I2 门禁保持。

**道主本次批准已覆盖上述 B2 工程执行。Codex 可直接开工，不需要再交一次只读方案等待确认；不得越过明确授权边界。**
