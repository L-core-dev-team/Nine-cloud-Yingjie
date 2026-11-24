# 映界实施任务序列

## 2026-11-24 · YJ-P04-AI-SNAPSHOT-02R 有限试点 PASS

三次场景首答和两次独立审核已归档。C1 部分名单与未知边界分开；旧 C2 漏记掀帘被识别，新 C2 掀帘和完好水桶均有审核引文；C3 记录挂钩，水桶具体状态未知。回放原 B/D 各 24/24。C1/C3 独立覆盖审核待审。项目 API 费用 USD 0。[实际场景、原答及复跑入口](reports/YJ-P04-AI-SNAPSHOT-02R-report.md)

## 2026-11-24 · YJ-P04-AI-SNAPSHOT-02R 场景语义最小修复（已批准 / NOT_RUN）

道主已批准第一步的两条独立收尾线。此分支从 `df94c8225e8f49b8aca0f914efe889aa2e5724af` 接续。方向值受限标准化、部分可见的支持与限制证据分离、物件身份及可见状态与覆盖审核分离。B/D 原答回放，C1–C3 原文不变，最多 3 份新首答与 2 份独立 C2 遗漏审核；不扩大语料，不生图。原 AI-SNAPSHOT-02 FAIL 不变。

[完整执行任务书](task-briefs/YJ-P04-AI-SNAPSHOT-02R.md)。本次仅提交任务书与授权索引，实际实施、模型对话、补充编辑均尚未执行。现有 Luna API LIVE_BLOCKED、I2 LIVE_BLOCKED_COST_BOUND、H3-B2/B2S FAIL、自由角色卡权威缺口保留；项目 API 和额外 API 费用均为 0，不改生产、UI、PG、上游或两个 main。完成即汇报，不自动进入游戏闭环。另一线独立执行。

AI-SNAPSHOT-02 已完成九次独立 Codex 对话。隐藏后能重建当前观察，方向同义表达仍会错拒，C2 遗漏的布帘状态被当作完整值接纳，按验收标准为 FAIL。[九帧实测与逐例回执](reports/YJ-P04-AI-SNAPSHOT-02-report.md)。

## 2026-11-24 · AI-SNAPSHOT-02 与 VISUAL-CONTINUITY-01 并行（已批准 / NOT_RUN）

道主同意两线并行。共同基线 AI-SNAPSHOT-01 对话实验 `e9217391eeb5c76d9fad960413be40562b170c89`（首答 9/9，投影 5/9；A 24/24、3→2→2 正确，B/C 继承中断）。语义线：明确物理位置/朝向字段，实际前帧候选输入，有证据重新观察和局部纠正恢复；冻结旧九答和新提示，旧 B/C 六回合 + 一个新三回合，最多 9 份新独立 Codex 对话首答。视觉线：以实际 A 投影候选为输入，只允许现有订阅图像工具 1 次初始生成、1 次该原件参考编辑（尝试含失败/未知），A3 同字节复用；先审首图再编辑，直接交两张实际图，不开发 UI。两个独立任务分支同基线并行，不互相等待。

[语义修复任务书](task-briefs/YJ-P04-AI-SNAPSHOT-02.md) · [连续画面试点任务书](task-briefs/YJ-P04-VISUAL-CONTINUITY-01.md)。

本次仅登记任务及授权，实际实施、模型对话及图像工具调用仍 NOT_RUN。只允许合成内容、现有订阅能力；项目 API 0、额外 API 费用 0，不开放付费端点、I2、生产或两个 main。旧 AI-SNAPSHOT-01 API LIVE_BLOCKED、I2 LIVE_BLOCKED_COST_BOUND、H3-B2/B2S FAIL、自由角色卡权威缺口和 B2/native scene PARTIAL 保留，模型/图片均为独立研究候选。

## 2026-11-24 · AI-SNAPSHOT-01 发送前核查

本次 `LIVE_BLOCKED`。A/B/C 九槽已冻结，真实 POST 0、预留 USD 0。缺少本机凭据、项目 Standard 写入证据和可验证的完整费用上界。禁网流程测试 9 项通过。[三组实际状态与运行回执](reports/YJ-P04-AI-SNAPSHOT-01-report.md)。

## 2026-11-24 · 下一项 AI-SNAPSHOT-01（9 次 / USD 0.20）

道主对 `YJ-P04-AI-SNAPSHOT-01` 小规模真实文字语义提取实验明确回复「批」。批准原听雨酒馆三帧＋两组未见三帧，共最多 9 次可能送达的真实文字请求（失败也计数），总费用硬上限 USD 0.20，图片 0。固定基线 SCENE-SNAPSHOT-01 `53a452d7a8661901b00b9a22482d5b9792761566` 的 0/3 就绪、0/24 正确和原始审计不改。转向真实 AI 提议语义候选、程序校验来源/连续性、独立评分及人审；不得把机械通过或模型自报当权威事实。先冻结合成输入/独立金标/提示/模型/报价、建独立持久金额账本、通过前置安全门禁，再按三组九槽单次顺序调用。仅获准合成语料和必要前缀可外发；缺确切权限/价格/最坏费用证明即停，未知请求不重试。

[完整执行任务书](task-briefs/YJ-P04-AI-SNAPSHOT-01.md)。

本次只提交任务书及授权记录；工程执行与真实模型请求仍 NOT_RUN，费用新增 0，Codex 可直接在批准范围内开工。不启动图片生成或模拟派发、真实玩家读取、UI、生产、上游修改或两个 main。旧 L1 ACKNOWLEDGED、L4 UNKNOWN_STOP、I2 LIVE_BLOCKED_COST_BOUND、H3-B2/H3-B2S FAIL、角色卡 UPSTREAM_AUTHORITY_GAP 与 B2/NATIVE-SCENE PARTIAL 保留；真实文字批准仅限新独立任务，不复用旧批准或扩大授权。

## 2026-11-24 · 听雨酒馆三帧实测

结果为 `SCENE_SNAPSHOT_PARTIAL`。三帧就绪 0/3；首帧的三人名单仅为候选，第三帧排除了回忆，也未确认仍在场的两人。[三份文字输出](reports/evidence/YJ-P04-SCENE-SNAPSHOT-01/snapshots.txt) · [实际与预期对照](reports/YJ-P04-SCENE-SNAPSHOT-01-report.md)。

## 2026-11-24 · 下一项 SCENE-SNAPSHOT-01（小型离线实验，直接执行）

道主已明确批准 `YJ-P04-SCENE-SNAPSHOT-01` 小型纯离线文字实验，从 NATIVE-SCENE-01 `2357b1d217d7d68039033103b794825c06fc9b4d` 接续。固定同一听雨酒馆三段连续正文，林青、沈舟、苏禾三人 → 苏禾离场只剩两人 → 回忆三人但不污染当前。复用现有 S1/S2 的 scene-evidence/2、project、replay 与视觉审查。先冻结输入与独立金标，保留原文，实际运行后交付三份可读场景快照、证据和差异，不人工补字段、不改题硬编码拿 PASS。现有词表及回忆导致整段弃判的限制必须如实报告。

[执行任务书](task-briefs/YJ-P04-SCENE-SNAPSHOT-01.md)。

本次仅登记任务书及授权，实际实验 NOT_RUN；Codex 可直接执行。无新 UI、PG、真实玩家、真实模型/图片 API、模拟图片派发、付费、上游写入或两个 main 修改。保留 NATIVE-FACT-01 PASS、B2 PARTIAL、NATIVE_SCENE_PREVIEW_PARTIAL/BROWSER_NOT_VERIFIED、H3-B2/H3-B2S FAIL、角色卡 UPSTREAM_AUTHORITY_GAP 和 I2 停止线；本例不能证明通用自由叙事能力。

## 2026-11-24 · 原生场景试玩已交付，实机浏览器验收待补

双击 [原生场景试玩](../packages/native-scene/dist/index.html)，可在芦花渡和望气台之间回放 11 个节点。实际九霄认证和隔离 PostgreSQL 已验证当前地点与事后获知的历史行程。受管浏览器启动或本地文件导航受阻，最终为 `NATIVE_SCENE_PREVIEW_PARTIAL`。[运行报告](reports/YJ-P04-NATIVE-SCENE-01-report.md)。

## 2026-11-24 · 下一项 NATIVE-SCENE-01（已授权实施）

道主明确同意继续进入 `YJ-P04-NATIVE-SCENE-01` 可信原生位置→场景候选→离线试玩的有界工程试点。以 B2 `0bb6204a90bbc70bdf920fda57f5bc51d44e6af0`（`PARTIAL`，24 项真实服务 + 16 项故障对照通过、2 项生命周期依赖）为基线，优先复用固定九霄规则、B2 已受权读取、S2/S3 场景门禁与离线 UI。区分历史到达和实际当前地点、获证修订与知识时间；可信位置仅驱动部分场景状态，未知人物、结构、光照、视角等不填充，不构造完整 Visual 或出图许可。目标为可双击的独立离线 HTML，能真实体验芦花渡/望气台切换及受阻、复访、历史回放；示意占位不当实际剧情图。

A 固定最小路径 → B 实现场景适配和离线可玩页面 → C 实际来源及可见交互验收 → D 轻量兼容与交付。

[执行任务书](task-briefs/YJ-P04-NATIVE-SCENE-01.md)。

本次仅任务书、授权和索引，**实际代码及测试仍 NOT_RUN；Codex 可直接按任务书开工。** 允许同既有授权范围的隔离合成测试宿主、本地回环/PG 及普通浏览器检查；禁止真实玩家、上游/生产修改、真实模型/图像 API、付费、外发、两个 main、B3/H3-C/D1/Q1。B2 的原生归档/删除 2 项继续 UPSTREAM_DEPENDENCY/NOT_RUN，不降低旧矩阵。NATIVE-FACT-01 离线 PASS、H3-B2/H3-B2S FAIL、角色卡 UPSTREAM_AUTHORITY_GAP、I2 停止线保留。

## 2026-11-24 · B2 已实测 R3 重登录读取 R1

**NATIVE_READER_B2_PARTIAL**。官方权限机制授予本轮网络能力后，原探针取得 HTTP 200。真实认证、PG 与固定规则证实芦花渡到望气台的早期移动。42 项中，24 项服务行为通过、16 项真实 PG 取数后的验证器边界对照通过，2 项缺少原生 schema 3 存档的归档和删除入口。最终退出 2，已清理专用集群。[运行报告](reports/YJ-P04-NATIVE-READER-B2-report.md)

## 2026-11-24 · B2 实测停在本机 TCP CONNECT

**NATIVE_READER_B2_ENV_BLOCKED**。受管会话监听成功，连接返回 EACCES。实际认证与 PG 历史对账 0 次；42 项真实场景均未执行。固定规则通过官方非生产语义门禁，离线验证器 21/21，旧原生 298 个修订及 H3 的 1,765 个前缀已复跑。恢复条件为同一受管环境获准完成回环连接与 HTTP 200。[运行报告](reports/YJ-P04-NATIVE-READER-B2-report.md)

## 2026-11-24 · 下一项 NATIVE-READER-B2（实际工程执行，已批准）

道主审阅 NATIVE-READER-01 结论 `NATIVE_READER_DESIGN_READY / HISTORICAL_PROOF_GAP / UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED` 后明确回复「批准」，正式授权 `YJ-P04-NATIVE-READER-B2` 的本地隔离 Gate A–D 工程实施与真实联测。B2 从 `f2c4015e4295fd0a074d176e93d865a9802a6701` 接续，九霄固定 `f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`；仅限两组合成账号/新存档、真实本地认证、实际固定 RULES、回环服务、专用 PG 测试库、测试宿主捕获/只读取证。正常创建 R0，每次提交后捕获真实数据库状态，后来重读旧 R，独立核对事件行、回执、完整历史 R-1/R、权限、撤权和并发。不得继续用假仓储代替真实联测。

执行顺序：A 安全预检与冻结 → B 真实认证/规则提交/状态捕获及读取器 → C 实际端到端与权限/完整性/并发验收 → D 回归、脱敏证据、清理与交接。

[完整执行任务书](task-briefs/YJ-P04-NATIVE-READER-B2.md)。

本次提交只是任务书与正式授权登记，**尚未启动 Codex 本地工程、PG 或测试，Gate A–D 仍为 `NOT_RUN`。** Codex 可以直接执行，不必再等待同范围审批；环境/权限不满足须如实 BLOCKED。B3、上游核心/正式接口及生产 schema、真实玩家账号/存档、两个 main、真实模型/图片/外部邮件/付费、生产和 H3-C/D1/Q1 均未获授权。保留 NATIVE-FACT-01 合成 PASS、H3-B2/H3-B2S 历史 FAIL、角色卡 UPSTREAM_AUTHORITY_GAP 和 I2 停止线。

## 2026-11-24 · NATIVE-READER-01 历史证据读取（设计审查 / NOT_RUN）

道主已批准准备 NATIVE-READER-01 完整任务书及只读架构审查。基线 NATIVE-FACT-01 `5952a079ef7472f846a160954ca942df8fe69d71` 保持 `NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS`；九霄固定 `main@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。已查明 owner/save 回执、持久化 turn_events、哈希链、replayEvents、当前快照和一致性只读事务可供复用，但真实历史 R-1/R 状态对尚未验证。优先 B1 复用可信历史 checkpoint；缺证时设计 B2 新隔离合成测试账号/存档的真实服务试点；必要时才提出 B3 最小上游证明扩展。**本轮仅任务准备及只读复核，不授权代码、上游修改、PG/Chrome、真实账号/存档/API、付费/生图、生产或两个 main。** `UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`、自由角色卡 `UPSTREAM_AUTHORITY_GAP`、H3-B2/H3-B2S 历史 FAIL 和 I2 停止线保持。

[任务书](task-briefs/YJ-P04-NATIVE-READER-01.md) · [固定源码审查](architecture/YJ-P04-NATIVE-READER-01-upstream-reader-audit.md)。当前 `NATIVE_READER_ARCHITECTURE_REVIEW_PENDING / IMPLEMENTATION_NOT_RUN`；未来真实试点先另获授权，不以增加假仓储测试替代实际读取验收。

## 2026-11-23 · NATIVE-FACT-01 离线验收

NATIVE-FACT-01 Gate A–D 已完成，状态为 NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS。真实上游 reader、角色卡 scope 及 H3-C 继续单列，尚未实施。 [运行报告](reports/YJ-P04-NATIVE-FACT-01-report.md)

## 2026-11-23 · NATIVE-FACT-01 Gate A–D 获准纯离线实施

道主已正式批准 `YJ-P04-NATIVE-FACT-01` 的 Gate A–D **纯离线合成开发与验收**。授权范围：新合成语料先冻结、本地受信假宿主、规则事件白名单适配器、四臂测量、旧安全兼容回归及专用分支交付。**本次仅授权登记，Codex 尚未由本聊天启动，Gate A–D 仍 NOT_RUN。** 历史状态 `R-1/R` 不能由旧收据加最新存档推断；缺证必须 `UNVERIFIED`。真实九霄受认证 reader 未验证，禁止真实账号/存档读取、真实模型或图片 API、付费、两个 main、生产及数据库修改。H3-B2/B2S FAIL 保留。 开工顺序仍为 Gate A 冻结 → B 独立实现 → C 同文正反测量 → D 完整兼容回归，冻结后不能通过调整金标制造通过结论。

## 2026-11-23 · 下一拟办 NATIVE-FACT-01（仅任务书，NOT_RUN）

已为[原生 RULES 地点事实白名单](task-briefs/YJ-P04-NATIVE-FACT-01.md)建立新专用分支并完成[固定语义审查](architecture/YJ-P04-NATIVE-FACT-01-whitelist-audit.md)。建议下轮明确授权后开展 Gate A 先冻结 `move.arrived` 世界地点/子区域/`move.bypassed`/伪源正反对照，Gate B 受信宿主读回与版本化白名单离线适配器，Gate C 同文无事件、合法阻断、真已到达与篡改收据 A/B，Gate D 原 1,765+ 安全/兼容回归及可回退交付。**当前只有文档准备，Gate A–D 未运行**。角色卡 C 继续未知待核，A 逐段 scope 上游机制未实现；H3-B2/B2S FAIL、两个 main 与 I2 阻断不变。

## 2026-11-23 · YJ-P04-SCOPE-CONTRACT-01（架构审查优先，IMPLEMENTATION_NOT_RUN）

道主已同意 H3-B2S FAIL 后转换方向，**不再继续靠正则词表修复高危现实层错采**。当前独立分支提交[可信叙述层级契约设计任务书](task-briefs/YJ-P04-SCOPE-CONTRACT-01.md)和[九霄固定上游代码审查](architecture/YJ-P04-SCOPE-CONTRACT-01-upstream-audit.md)。任务顺序：Gate A 固定上游真实可证接口和权限；B 定义提议/权威证明/世界事实分离的版本化契约；C 设计《套戏》《雾散后》、未闭合/嵌套/错父层及源权限的离线验证用例；D 上游方案与阻塞决策。**此次只准备文件，Gate B 的可运行 schema、上游接口、离线样本、API 调用及新测试未实施。** H3-C、视觉导演/画质、生产实现均后置且需单独许可。

## 2026-11-23 · H3-B2S 验收结果

H3-B2S Gate A–D 已执行，结果 **FAIL**。研究分支交付范围回放、24 条故事、50 条不可信输入和 1,765 个前缀的核验。H3-C 尚未启动。 [运行报告与逐例证据](reports/YJ-P04-H3B2S-narrative-scope-safety-report.md)

## 2026-11-23 · H3-B2S Gate A–D 已批准离线开工（实测 NOT_RUN）

道主明确批准 Codex 执行[H3-B2S 任务书](task-briefs/YJ-P04-H3B2S-narrative-scope-safety.md)限定的纯离线 Gate A → B → C → D，工作分支 `codex/yj-p04-h3b2s-narrative-scope`。首步冻结与旧集不同的独立叙述层正反样本，之后才实现作用域及因果核验，并保证《雾散后》第 3 修订不确证、第 7 修订正确确证，同时不破坏旧现实事实。**本次仅授权落盘，H3-B2S 代码与运行测试尚未开始。** H3-B2 FAIL 仍属历史有效结论；真实模型、出图、生产、两个 main、H3-C/D1/Q1 不在许可内。

## 2026-11-23 · 下一专项：YJ-P04-H3B2S（仅任务准备 / NOT_RUN）

已基于 H3-B2 FAIL `a55d356` 建立独立分支、上传[叙述作用域安全修复任务书](task-briefs/YJ-P04-H3B2S-narrative-scope-safety.md)。建议执行 Gate A 先锁新独立故事/作用域标注，Gate B 建立跨修订和同修订真实/梦境/转述范围账本，Gate C 同文 A/B 双检误确证和现实真阳性，Gate D 完整回放旧 1,533 前缀及新增套件。**现阶段只是准备任务书，Gate A、业务开发和新测试尚未执行**。原 H3-B2 FAIL、生产入口及 I2 限额不变，后续 H3-C 需要单独授权。

## 2026-11-23 · H3-B2 离线验收结果

H3-B2 Gate A–D 已执行并交付，最终质量门槛 FAIL。生产、H3-C、真实模型和图片试点均未启动。 [报告及回退](reports/YJ-P04-H3B2-proposition-grounding-report.md)

## 2026-11-23 · H3-B2 Gate A–D 获准执行（尚未实际开工）

道主已批准 Codex 按[完整任务书](task-briefs/YJ-P04-H3B2-proposition-grounding.md)开展纯离线 Gate A → B → C → D；预计先冻结全新对照，再实现命题核验、一次性预留评价和完整历史回归。**本次仅记录授权，Gate A、代码、测试、实际回执依旧 NOT_RUN。** 不改变 H3-B PARTIAL、历史失败、生产默认或两项目 main。H3-C、真实模型和图片 API 仍须独立授权。

## 2026-11-23 · 下一阶段 YJ-P04-H3B2（仅任务准备）

[H3-B2 完整任务书](task-briefs/YJ-P04-H3B2-proposition-grounding.md)已在独立分支准备，从 H3-B 固定完成 SHA `4db0787` 接续。当前**仅任务书与交接索引，业务实现 NOT_RUN**。预定研究 Gate A 先冻结新语义正反对照；B 建立 不可信候选 → 可溯源事实命题 → 独立文本支持/反证 → H3-A 事务确认；C 单列候选、命题真实性、事实确认和视觉资格；D 新旧离线全回归。H3-C 真实自然文风独立验证、D1 视觉导演及生产模型均未启动。不得用 0/19 的旧事实确证反过来宣称已经泛化达标。

## 2026-11-23 · H3-B 离线实测交付

H3-B 已完成本轮离线执行，总体 H3B_PARTIAL。独立语义评价仍待单独授权。 真实模型调用及费用为零。[运行报告与回退](reports/YJ-P04-H3B-semantic-candidates-report.md)

## 2026-11-23 · YJ-P04-H3B：离线研究范围获准，任务书就绪（NOT_RUN）

[H3-B 语义候选和证据门禁融合任务书](task-briefs/YJ-P04-H3B-semantic-candidates-evidence-gate.md)已在独立分支准备，从 H3-A `69e3cc8` 接续。阶段 Gate A 冻结新语料/错误候选；B 可注入本地候选协议与安全审核；C 分离候选发现/事实确认/视觉资格 A/B，不能把 oracle 当 NLP 结果；D 回放旧 941 前缀、定向因果和兼容回归。H3-B 当前仅任务准备，无算法或测试新回执。H3-C 独立新文风评价及模型授权、D1/Q1 暂不开始，生产与付费门禁不变。

## 2026-11-23 · H3-A 离线因果安全验收

**H3A_OFFLINE_CAUSAL_SAFETY_PASS**。Gate A–D 已执行。原 12/12、新 52/52 和补充防护 23/23 通过。H3-B、H3-C 待独立授权。 生产默认入口沿用原版，新增真实模型费用为 USD 0。[运行报告与回退](reports/YJ-P04-H3A-causal-safety-report.md)

## 2026-11-23 · 下一专项：YJ-P04-H3A（仅任务准备）

[H3-A 完整任务书](task-briefs/YJ-P04-H3A-causal-safety.md)已准备，基线 H2R `e99fb10`。**先消除错误确证，再谈 H3-B 跨文风语义模型与 H3-C 独立评价**。预定执行 Gate A（留存原红灯与锁定新反事实）→ B（整修订证据审查和事务性提交）→ C（旧 12 项/新危险例/正例与前缀）→ D（旧 H1/H2/H2R 和 S1/S2/S3/I1/I2 离线回归）。当轮仅上传文档，**代码、实际测试、冻结新样本均 NOT_RUN**；两种 main、旧许可和真实费用门禁未改。

## 2026-11-22 · YJ-P04-H2R 质量强化结果

**H2R_PARTIAL**。Gate A 至 Gate D 已执行。开发 22/25、预留 2/23，独立文体目标未达成，保留全部样本与历史错误。 生产默认沿用原版，本轮真实请求和费用均为零。[运行报告与回退](reports/YJ-P04-H2R-semantic-generalization-report.md)

## 2026-11-22 · 下一专项：YJ-P04-H2R（准备就绪 / NOT_RUN）

已在 `codex/yj-p04-h2r-semantic-generalization` 上传[完整任务书](task-briefs/YJ-P04-H2R-semantic-generalization.md)，从已交付 H2 `c352f86` 接续。顺序为 **先审计和冻结独立语料 → 通用语义改进 → 一次性预留评估 → 全面离线回归**。H2 4 漏判与 12 个视觉证据不齐的案例不能通过硬编码、调金标或放宽 S2 审核“消灭”。**本轮新代码、冻结语料、执行测试均 NOT_RUN**；D1 镜头和 Q1 参考画质继续后置，API/生产许可未新增。

## 2026-11-22 · YJ-P04-H2 离线研究交付

YJ-P04-H2 已完成代码和离线验收，结论 **PARTIAL**。新集检出 46/50，旧 66 修订的 H2 A/B 达 16/16，导演时机仍缺锁定正例的视觉证据。 生产默认入口沿用原版，H1 可直接回放。新增真实模型请求和费用均为 0。[运行报告与复跑方法](reports/YJ-P04-H2-arc-payoff-cadence-report.md)

更新：2026-11-22。

**YJ-P04-H2 下一阶段任务书已上传：** [权益交接等安静高潮、跨故事线长期铺垫与兑现、相对峰值排名及少而精的候选出图节奏](task-briefs/YJ-P04-H2-arc-payoff-cadence.md)。基于 H1 完成 SHA，**H2 新规则/新评估尚未执行**；旧 H1 15/16、普通误报 0/50、top-1 10/11 原样存档。未批准任何真实模型或图片 API 调用，生产默认和主游戏不变。

## YJ-P04-H1 剧情关键事件与高潮研究

H1 已在独立离线回放中完成研究原型。14 条合成故事线的 66 个修订中，16 个标注关键时刻检出 15 个，50 个普通回合误报 0。漏判为渡船所有权变更。真实模型调用和费用均为 0。 [运行报告与回放入口](reports/YJ-P04-H1-highlight-replay-report.md)

**YJ-P03-S3 · S3_PREVIEW_PARTIAL。** 已交付固定 20 回合离线试玩。打开 [index.html](../packages/offline-play-preview/dist/index.html) 即可体验；携带 media 文件夹可查看独立的旧酒馆图册。20 回合与 16 项交互检查通过，当前 Windows 的原生浏览器在导航前退出，状态为 BROWSER_NOT_VERIFIED。[运行报告](../docs/reports/YJ-P03-S3-offline-play-preview-report.md)

**YJ-P03-S2 · P03_S2_OFFLINE_PASS。** 100 条预锁定合成案例中，44 条可入画，12 条需复核，10 条冲突，34 条条件不足。危险放行和不必要阻断均为 0。20 个连续修订经过三个地点，模拟生成与编辑各一次，实际费用 USD 0。 [运行报告与复跑](reports/YJ-P03-S2-scene-consistency-slice-report.md)

**YJ-P03-S1 · P03_S1_OFFLINE_PASS。** 六个登记地点、102 条预先标注回放，正确采纳 36 条、正确留空 66 条，错误采纳与不必要弃判均为 0。三个新地点已构造离线首图请求。 [运行报告、回执与复跑](reports/YJ-P03-S1-generalized-scene-evidence-report.md)

**YJ-P02-I2 · I2_GATE_OFFLINE_PASS。** 生成与参考编辑分别批准并从同一美元总额预留。40 个定向场景、跨进程竞争与崩溃恢复、148 项兼容回归通过。真实付款为 LIVE_BLOCKED_COST_BOUND。 [运行报告与回执](reports/YJ-P02-I2-image-money-gate-report.md)

**YJ-P02-I1 · IMAGE_ADAPTER_OFFLINE_PASS。** Images 首图与参考编辑已完成离线适配。协议、权限与响应检查 60/60，ImageTasks 与进程恢复 7/7。输出进入待审，真实发送关闭。本机原生 PG/Chrome 验收由 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1) 跟踪。[报告与复跑](reports/YJ-P02-I1-image-adapter-offline-report.md)

**YJ-P02-L5B · ENV_BLOCKED。** 当前 Windows 环境允许 Node 监听本机随机端口，连接同一端口时返回 `connect EACCES`。HTTP、原生 Chrome、临时 PG、L4R 与 YJ-13 本轮未运行；L5 维持 PARTIAL。[实测与脱敏回执](reports/YJ-P02-L5B-loopback-closeout-report.md)

**YJ-P02-L5 · PARTIAL。** 独立零预算账本、崩溃防重、12 项内存处理测试和 7 项真实 Chrome 页面测试已通过。Windows 沙箱阻止本机 TCP，原角色卡／PostgreSQL、L4R 与 YJ-13 整链路尚待验收。真实服务调用 0，L4 继续 UNKNOWN_STOP。[报告、回执与复跑](reports/YJ-P02-L5-one-shot-recovery-report.md)

**YJ-P02-L4R 已完成离线复现与修复。** 本机未找回原进程、真实账本或收据，原 L4 继续 UNKNOWN_STOP。旧页面在两条不同失败路径上给出相同提示；新页面区分服务端受理、发送前拒绝和送达未知。[取证报告与复跑](reports/YJ-P02-L4R-trigger-forensics-report.md)

**YJ-P02-L4 · UNKNOWN_STOP。** 本人报告已点击。原页面已结束，本机未找到真实回执与专用账本。实际用量、费用及最终画面状态未知，本次核查补发 0 次。[核查结论与历史离线验收](reports/YJ-P02-L4-luna-scene-pilot-report.md)

**YJ-P02-L3 已执行。** 新契约仅在隔离回放中使用。已验证首回合场景证据和后续酒馆连续性，真实服务和图片试点仍未运行。[结果、限制与回退](reports/YJ-P02-L3-scene-evidence-report.md)

**YJ-P02-L2 已完成。** 真实修订 1 已核对，结论为 CORRECT_ABSTENTION；局部表达识别 EXTRACTOR_GAP_FIXED_OFFLINE。[报告](reports/YJ-P02-L2-live-text-extraction-report.md)

**YJ-P02-L1 已完成，LUNA_ONE_CALL_PASS。** 一笔真实文字请求已保存并读回，原单次授权已用完。[报告](reports/YJ-P02-L1-luna-text-smoke-report.md)

**YJ-P02 接续入口：** 道主已选择 OpenAI API；[专用文字/图片 API 适配与安全门禁任务书](task-briefs/YJ-P02-openai-adapter.md)已在独立分支上传，业务实现与付费请求尚未开始。具体模型、项目 API 访问权限、参考图外发和费用预算仍待确认。P01 的 OFFLINE_PASS 与 YJ-13 的 LOCAL_DEMO_PASS 均保持。

**YJ-P01 OFFLINE_PASS，真实试点 LIVE_BLOCKED。** 原角色卡在合成数据上完成生成、参考编辑和保守留空；受信授权、预留上限、信息过滤与 unknown 重开防重已通过离线检查。 [回执与 P02 放行条件](reports/YJ-P01-real-service-readiness-report.md)

**YJ-13 LOCAL_DEMO_PASS。** 完整隔离回归连续 22/22、22/22；原角色卡 35 轮、第二会话 2 轮，已实测启停、回退和 14 表配对恢复。 [运行报告](reports/YJ-13-local-demo-closeout-report.md)

真实服务试点需先落实供应商、额度、授权素材与受信后端认证。

**YJ-11 交付记录。** YJ-11 已交付本会话图片历史、独立原件核权、反馈与受信撤下。YJ-12 继续核验断网、跨设备、乱序与恢复。[YJ-11 运行报告](reports/YJ-11-image-history-corrections-report.md)

**YJ-10 交付记录**　YJ-10 本地实现与验证已完成。原普通角色卡 14 轮共 4 次模拟发送，错图被拒后连续两轮交谈均未重发。最终两次综合回归各 19/19，真实模型调用 0。YJ-11 可按资产原归属及最新授权消费审阅、选择和拒绝记录。[报告与接口](reports/YJ-10-trigger-consistency-report.md)

**YJ-09 接续记录**　YJ-09 已完成本地工程交付。原普通角色卡 25 轮同一行动，东/西村同名异地、改名复访、含糊离场后隐藏与完整调查恢复、双版本 PG 重放均有逐轮回执。65 段合成对照中新版正确采纳 39、错采 0、放弃 26。YJ-10 可接入关键事件、当前图片适用性和可知范围审计。[YJ-09 报告](reports/YJ-09-revisit-continuity-report.md)

YJ-00 已获准启动，YJ-01 已完成本地 Node 合成文字运行基线。YJ-02 工具级实验已复核，可为 YJ-03 提供样例；独立后端图片 API 接入仍阻塞且未运行。YJ-03 已交付 0.1 共用契约与原 C01–C12 离线验证；独立复核后修补包至 0.1.1，新增定向回归通过。YJ-04 已完成完整契约复跑、真实普通历史读取及 PostgreSQL 恢复检查。周数从获准启动后的时间计算，正式产品验收指标由道主后续决定。

| 任务 | 前置依赖 | 交付与完成检查 | 建议窗口 |
| --- | --- | --- | --- |
| YJ-00 启动方向确认 | 用户最新指示 | 已获准启动；草案作为工作基线，暂定与后置项保留原状态 | 已确认启动 |
| YJ-01 固定运行基线 | YJ-00 | 隔离开发副本、固定提交和锁文件；跑通现有建局、行动、文字保存和继续；确定采用哪条会话与宿主路径 | 第1周 |
| YJ-02 验证关键生图能力 | YJ-01 | 用同一酒馆验证初图、参考图更新、增加人物和返回场景；记录实际模型能力、失败与限制 | 第1周 |
| YJ-03 明确共用数据格式 | YJ-01、YJ-02 工具级样例 | 实现最小共用契约与离线正反例，分开来源、视觉版本、参考资格和结果状态；供应商专属能力保留开放 | 第1–2周 |
| YJ-04 场景身份与变化记录 | YJ-03 | 稳定地点编号、别名、视觉版本和可见变化；区分现在、回忆、计划与猜测；能从存储恢复 | 第2–3周 |
| YJ-05 图片生成与任务处理 | YJ-03、YJ-02；真实接入需获准后端接口及认证 | 首个适配器、任务状态、参考图、结果保存、有限重试和未知结果处理；查询仅在供应商实际支持时启用；校验会话归属 | 第2–3周 |
| YJ-06 映界界面 | YJ-03 | 入口、独立图片区、文字区、等待与失败状态、生图开关；先用样例开发，再接真实接口 | 第2–3周 |
| YJ-07 世界书与预设图匹配 | YJ-03 | 复用已核验的世界书与资产目录，补充地点标签、适用条件和版本；匹配失败可留空 | 第2–4周 |
| YJ-08 串通首段真实游玩 | YJ-04、05、06、07 | 真实文字结果进入画面决策，图片显示并与回合关联；关闭生图、失败和恢复都能走通 | 第3–4周 |
| YJ-09 做好返回地点与持续变化 | YJ-08 | 酒馆复访、人员增减、地点改名与状态变化；新旧图片分别归属正确状态；重复会话不串图 | 第4–5周 |
| YJ-10 调整触发与一致性判断 | YJ-09 | 关键事件判断、旧图适用性、世界书与可知范围检查、明显矛盾图片处理；保留判断理由 | 第5–6周 |
| YJ-11 基本图片历史与纠错 | YJ-08、YJ-09 | 历史图与剧情关联、简单纠错、重新生成及按会话管理；地图切换细节不在此冻结 | 第5–6周 |
| YJ-12 恢复与终端稳定性 | YJ-10、YJ-11 | 刷新、断网、重开、乱序返回、关闭后返回、移动端尺寸和历史读取的定向检查 | 第6–7周 |
| YJ-13 连续试玩与初代交接 | YJ-12 | 形成可安装或可运行的试玩版本、已知问题、未达成需求、真实调用记录与后续顺序 | 第7–8周 |
| YJ-M01 地图与探索图鉴 | YJ-13及地图方案确认 | 复用地点关系与图片历史，再确定跨尺度地图组织方式 | 后续 |

## 各阶段最需要证明的事情

第 1–2 周应当证明现有文字玩法能接到真实图片服务，并摸清参考图修改的能力。若连续性效果不足，应先调整参考图与场景表现方式，不继续堆积界面工作掩盖问题。

第 3–4 周应当形成一段完整游玩：进入地点、文字推进、发生重要变化、保存并继续。第 4–5 周重点证明“回到同一个地方，变化仍在”。第 6–8 周集中处理出图选择、纠错、失败恢复与不同终端的真实使用问题。

图片效果、完成速度和并行收益都需要这些阶段的实际结果校准；不能把一次成功示例当成稳定能力。

## 当前任务状态

| 范围 | 状态 | 实际进展 |
| --- | --- | --- |
| YJ-00 | 已完成启动方向确认 | 用户授权开始、建仓并上传计划；未决产品细项保持原状态 |
| 仓库与文档初始化 | 已完成 | 私有仓库已创建，15份文件已上传；main分支、完整文件清单与逐文件Git blob哈希核验通过，见验证记录 |
| YJ-01 | 已完成 | 独立角色卡会话两次提交、刷新恢复与 PostgreSQL 对账通过；真实模型 NOT_RUN。[运行报告](reports/YJ-01-runtime-baseline-report.md) |
| YJ-02 | 进行中；后端接入子项阻塞 | 工具级样例已复核；独立准备分支已提交 `340c8bf`，报告记录 dry-run 与本地 mock 完成，本轮未复核该批补充实验。应用直连供应商仍 BLOCKED / NOT_RUN。[图片报告](reports/YJ-02-image-capability-report.md) · [原样例复核](reports/YJ-02-evidence-review.md) |
| YJ-03 | 已完成交付；定向修补已提交 | 原报告记录 8 组通过；两处边界缺口已修补至包 0.1.1，编译、新增 2 组与原来源映射 1 组通过。YJ-04 已在完整副本补跑全部 10 组与原图核对。[原报告](reports/YJ-03-shared-contracts-report.md) · [复核记录](reports/YJ-03-evidence-review.md) |
| YJ-04 | 已完成 | 角色卡已保存历史与独立合成酒馆分别验证，事务中断、并发重放、分页和跨进程恢复通过。[运行报告](reports/YJ-04-scene-state-report.md) |
| YJ-05 | 通用部分已完成；真实供应商阻塞 | PostgreSQL、参考编辑、原件核验、并发与跨进程恢复通过。[05 报告](reports/YJ-05-image-tasks-report.md) |
| YJ-06 | 本地实现已完成；待生产集成 | 九霄原角色卡页面、模拟图片后台、桌面及窄屏浏览器联调通过。[06 报告](reports/YJ-06-ui-report.md) |
| YJ-07 | 已完成本地交付 | 三类会话世界书来源、地点授权、预设图审阅和字节核验通过；原九步流程回归通过。[07 报告](reports/YJ-07-worldbook-assets-report.md) |
| YJ-08 | 本地首段游玩已完成；真实供应商待验证 | 已保存正文提取、五类自动选择和普通角色卡页面联调通过。补充散文 4 段一致、3 段放弃判断。[08 运行报告](reports/YJ-08-first-play-integration-report.md) |
| YJ-09 | 已完成本地交付 | 25 轮复访及未知恢复、版本化重放与原流程回归通过。[报告及回执](reports/YJ-09-revisit-continuity-report.md) |
| YJ-10 | 本地实现与验证已完成 | 已确认视觉变化触发、普通交谈抑制、审阅和参考资格、可知事实过滤。[运行报告](reports/YJ-10-trigger-consistency-report.md) |
| YJ-11 | 本地工程验证完成 | [历史、反馈、纠错与资格撤下](reports/YJ-11-image-history-corrections-report.md)；替代生成等待独立请求契约 |
| YJ-12 | 定向本地验证完成；连续全量回归待稳定 | [反馈恢复与 PG/原件恢复已核查](reports/YJ-12-recovery-terminal-report.md)；综合先 22/22 后 18/22（验证码 HTTP 429） |
| YJ-13 | LOCAL_DEMO_PASS，本地合成演示已完成 | [35 轮、独立回归、启停与故障恢复](reports/YJ-13-local-demo-closeout-report.md) |
| YJ-P01 | OFFLINE_PASS；LIVE_BLOCKED | [实现、实测、纠错独立身份提案与下一轮条件](reports/YJ-P01-real-service-readiness-report.md) |
| YJ-P02 | 待开始；OpenAI 已选、完整任务书已上传 | [OpenAI API 受信 adapter、生成/编辑协议、PG 发送前门禁与授权试点条件](task-briefs/YJ-P02-openai-adapter.md)；真实调用 NOT_RUN |
| YJ-P02-L1 | 已完成 | 真实文字 1 次，图片 0 次。估算 USD 0.0000287，正式账单待核。[运行报告](reports/YJ-P02-L1-luna-text-smoke-report.md) |
| YJ-P02-L2 | 已完成 | 真实正文只读回放与局部事实审计；原、新均留空，新增真实请求 0。[报告](reports/YJ-P02-L2-live-text-extraction-report.md) |
| YJ-P02-L3 | 待开始；任务书已上传 | [完成初始视觉场景的叙事证据/字段完整性契约，真实 API 为 0](task-briefs/YJ-P02-L3-scene-evidence-contract.md)，默认 /2 不变 |
| YJ-P02-L4 | `UNKNOWN_STOP`，许可已停止使用 | [点击后核查](reports/YJ-P02-L4-luna-scene-pilot-report.md)：受信回执/账本未找到，真实送达/费用/画面仍未知，不补发 |
| YJ-P02-L4R | 离线取证与修复完成；旧 L4 仍 UNKNOWN_STOP | [Chrome/HTTP 阶段记录修复、原环境核查与回归](reports/YJ-P02-L4R-trigger-forensics-report.md)；本轮真实请求 0 |
| YJ-P02-L5 | 进行中 · PARTIAL，原生回环验收受阻 | [在独立授权与账本下复用 L4R 可靠状态，并完成全禁网模拟](task-briefs/YJ-P02-L5-one-shot-recovery.md) |
| YJ-P02-I2 | I2_GATE_OFFLINE_PASS · LIVE_BLOCKED_COST_BOUND | [真正 USD 授权、成本上界与持久 pre-send 门禁](task-briefs/YJ-P02-I2-image-money-gate.md)；真实 API 禁止 |
| YJ-P03-S1 | P03_S1_OFFLINE_PASS · replayOnly | [多地点自然中文、完整人物名单、受信地点注册及可追溯 scene-evidence/2 旁路](task-briefs/YJ-P03-S1-generalized-scene-evidence.md)，完全禁真实 API |
| YJ-P03-S2 | P03_S2_OFFLINE_PASS | 100 条独立锁定语料与 20 回合模拟切片。原生 PG/Chrome 为 ENV_BLOCKED，真实图片为 LIVE_BLOCKED_COST_BOUND。 |
| YJ-P03-S3 | S3_PREVIEW_PARTIAL | 已交付可双击静态文件、逐回合只读预览和旧图档案；原生浏览器与手机体验待验。 |
| YJ-P04-H1 | 离线研究原型交付，仍有 1 条漏判 | [14 条线/66 修订中 15/16 高潮检出、0/50 普通误报、top-1 10/11](reports/YJ-P04-H1-highlight-replay-report.md)；非生产、0 图片调用 |
| YJ-P04-H2 | 待执行 · 仅完整任务书已上传 | [跨线 Arc Memory、权益转移、关键时刻排序、去重时机与视觉安全边界](task-briefs/YJ-P04-H2-arc-payoff-cadence.md)，完全离线 |
| YJ-P02-L5B | 环境阻塞 · ENV_BLOCKED | [在受许可的 loopback-only 环境完成本地 Chrome/PG/L4R/YJ-13 验收](task-briefs/YJ-P02-L5B-loopback-closeout.md)，不得提升公网权限或发真实 API |
| YJ-ENV-01 · Dot | 待执行；任务书已上传 | [合法确认本机 EACCES 阻断与最小 localhost TCP 能力](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/7d2badc6284174053ed3012766a79edd1346124f/docs/task-briefs/YJ-ENV-01-dot-loopback.md)；允许后移交 Codex 补 L5B |
| YJ-P02-I1 · Codex | 离线完成 · IMAGE_ADAPTER_OFFLINE_PASS | [OpenAI Images 生成、编辑离线适配、参考版权许可、费用门禁与假 PNG 响应](task-briefs/YJ-P02-I1-openai-image-offline.md)；真实 API 仍禁止 |
| YJ-M01 | 后续待开始 | 地图具体组织方式尚未确定 |

## 依赖说明

YJ-07只要求最小已有资料匹配能够返回结果或明确无匹配，不要求完成新美术资源生产。YJ-08的失败、关闭、迟到结果与归属检查属于第一次整合的一部分，不能全部推迟到YJ-12。

05、06 的共同接续分支为 `codex/yj-05-06-integrated`，实现提交 `59cf875649c9b676f59c63280bbc54b602d6b5c3`。

YJ-04 开工时的指引：先读[当前交接](handoff.md)和[YJ-03 复核修补](reports/YJ-03-evidence-review.md)，从 `codex/yj-04-scene-state` 消费[已实现的状态模块](../packages/scene-state/README.md)。原 YJ-03 成果保留在 `codex/yj-03-shared-contracts`，YJ-05 至 YJ-07 消费契约时应纳入 0.1.1 修补。项目全貌见[完整开工任务书 YJ-START-01](task-briefs/YJ-START-01-project-kickoff.md)，当前证据见[YJ-02 复核](reports/YJ-02-evidence-review.md)。YJ-03 可使用来源、参考和复用样例，但不把二者拼成真实会话到图片的联调证据。YJ-START-01 为文档编号，不增加开发任务阶段。
