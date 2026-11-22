# YJ-P04-H2R｜中文剧情高潮理解强化、独立评价与视觉证据对账（仅离线）

- 编制：2026-11-22（北京时间）；状态：**任务书已准备，代码实现和本轮测试尚未执行（NOT_RUN）**
- 目标执行者：Codex；工作分支：\`codex/yj-p04-h2r-semantic-generalization\`
- 固定接续：\`codex/yj-p04-h2-arc-payoff-cadence@c352f86f7213c6012b7382fc36f5665f45684c93\`
- H2 原冻结评价集：\`packages/highlights/test/h2-locked.jsonl\`；冻结提交 \`6f8cc871c44b498358535b2effb38067017b81c0\`，SHA-256 \`88456751358b5378076735a46a064856284c8ac450b42f8c74e7df71290b4152\`。
- 核心原则：**剧情重要性、事件事实是否确认、画面资格，必须分别判断。宁可不出图也不能误判事实、擅自补剧情或越过安全门禁。**
- 用户本轮只确认沿既有方向继续强化高潮识别与审美前置判断；**没有任何新增真实模型、图像生成、参考图外发、付费 API 或生产发布许可**。
- 严禁改九霄与映界 \`main\`，不改万卡阁；不切生产默认，保持 H2 \`replayOnly\`；不重启旧 L1/L4 许可、不触碰 I2 \`LIVE_BLOCKED_COST_BOUND\`，不绕过 Issue #1 的 localhost \`EACCES\`。图片质量、真人试玩、原生 PG/Chrome、手机和正式部署仍按实际证据标记。

## 1. 严格保留 H2 事实基线

原 H2 结论 **PARTIAL**，不得重写成 PASS。H1 原 66 修订运行 H1 为 15/16、0/50 误报、top-1 10/11；H2 对原集为 16/16、0/50、11/11。新冻结 34 会话/318 修订：H1 为 16/50、安静 0/34、误报 0/268、top-1 4/32；H2 为 46/50、安静 30/34、误报 0/268、top-1 29/32。H2 时机匹配 305/318；原金标期望 12 个 \`director-review\`，实际 0 个；其中 10 个缺 S2 当前完整画面证据，另 2 个缺唯一约定地点。**这不是允许解除视觉门禁的理由。**

必须保留源报告、原测量、历史失败、冻结标签，禁止为了分数修改旧文件、旧结果或替换负例。下列 4 个漏判是**公开回归与误差分析用例**，不能把其词组硬编码为通过条件：
1. 「书屋」修订 2：口语化赠契、旧书屋指称与当日生效的产权变更未联结。
2. 「渡税」修订 2：代词、划销个人份额与后续入公账的持续收益关系未联结。
3. 「两次赴约-辛竹」修订 4、5：承诺地点仅为「候星庭」，登记存在两个同名地点；后续调查不能倒推承诺时的地点身份。
前两项为**值得补强的语义识别**；后两项若缺独立证据，应输出 \`abstain/ambiguous\` 并解释，不能为追逐旧金标而猜测。原金标与新审计判断并行保留。

## 2. 先锁定新盲测包，后改识别器

**必须先提交冻结语料及标签，再开始业务规则修改。** 建议至少 300 个新修订、至少 36 条完整故事线，整条故事线分组；预留评估组不低于 40%，按故事结构、场景和句法家族分离，不能简单用同句换人名/物件从开发组复制到预留组。必须包含不同长度、不同措辞、至少 20% 非模板化叙述；修仙为主，加入日常/悬疑/家产/契约等迁移对照。若达不到目标，按实际数如实报告，不得补作已完成。

至少覆盖：
- 40 个明确有因果兑现的安静高潮；40 个似是而非的硬负例，包括暂借、代管、签署未生效、传闻、回忆、否定、假文书、伪归属、尚未行动的决定；
- 24 组跨 8–30 修订的铺垫与兑现、放弃目标、反转和多故事线交织；同名异人/同名异地与后续澄清；
- 16 组隐含权益/关系变更、自由指代、简称/别名消歧的配对正负样本；
- 16 组「剧情很重要但没有可核的当下视觉事实」与「画面明显变化但剧情普通」的对照；
- 12 组相邻双高潮、重复回顾、假高潮和延迟兑现的节奏检查；
- 贯穿「仅看到截止当前修订」与「跨会话/跨存档拒绝因果借证」负例。

新增标签应为两个**独立维度**：
A. 叙事价值/证据：\`confirmed-peak | potential-unverified | ordinary | unknown\`，类型、目标/对象/受益人、前后结果、证据 spans、依赖前文及不可认定理由。
B. 视觉资格：\`director-review-eligible | text-only-incomplete-visual | ambiguous-location | defer | suppress-duplicate\`，必须逐项保存地点身份、视角、完整人物名单、时段/光照、可见动作和权限快照。**不得从 narrative peak 推断 visual eligibility**。
保留原 H2 金标与新的证据审计意见；发生冲突时在单独 adjudication 文件记录双方理由，原标签不修改。标注者与规则作者若为同一人，必须标 \`INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN\`；如无法取得独立人工标注，不得夸称外部泛化已验证。

冻结提交写明 Git SHA、文件 SHA-256、dev/held 数量、故事家族去重规则和评价协议。评估期间预留组不得反复暴露给实现迭代；如对预留集调参，则原组降格为开发集并重新冻结真正独立的新预留组。

## 3. 实现范围：通用语义关系优先，拒绝新关键词补丁

在 \`packages/highlights/\` 新增独立可回滚的 H2R 研究入口，例如 \`narrative-highlight/2r\`（具体模块名由 Codex 按现有约定决定）。现有 H1/H2 源码、默认生产入口和原始冻结测试全部保持可回放。无需强制换模型或引入外部依赖；如需引入推理服务/大模型权重，停止该项并单独申请许可，本任务不自动授权。

重点：
1. **实体与指代**：资产简称/别名、代词、原持有人与受益人的确定性约束；明确区分同名、未解指代和后来才取得的身份信息。不能仅凭句子相邻、同地点或同人认定同一权益链。
2. **事件的前后状态**：动作发生、合同签署、权利生效、持续后果分离。必须有可追溯的原权属、行动人与受让者、标的、权益类型、相容的生效证据；持有钥匙/凭物不自动构成所有权变更。
3. **长线记忆与因果**：跨多个回合的承诺、代价、阻碍、关系、可信撤销与真实兑现；先前事件的 \`learnedAt\` 和回放截止不能被后来知识反向改写。未经揭示的世界书不能补证。
4. **高潮排序**：用已确认的持续后果、目标兑现、代价和关系改变排名，限制纯情绪形容词/场面规模的权重；允许安静高潮超过战斗；不重复发出同一次兑现。
5. **保守弃判**：把 \`recognized-but-unknown\` 与 \`no-event-recognized\` 分开，不能将全部弃判计作正确普通回合；对无法确认的两处「候星庭」原样承认歧义。
6. **视觉证据对账**：逐个复盘原 12 个导演候选，形成 \`narrativeDetected\`、\`sceneEvidenceComplete\`、\`sourceAuthorized\`、\`visualReviewEligible\` 四层矩阵，明确哪些是提取缺口、哪些是源文根本未提供信息；禁止凭新规则填造人物、地点、视角或光照。允许给九霄提出“未来可提供哪些已确认可见字段”的契约建议，但不得改九霄正文或主引擎。
7. **节奏与安全**：同一事件重复改写只提议一次；两个独立关键瞬间允许相邻提议。所有结果仍只是 \`text-only / defer / director-review / suppress-duplicate\` 建议，\`send:false\`，不得变成真实付费请求。

## 4. 执行次序及红线

**Gate A｜证据审计和冻结**：只读复核 H2 HEAD、H1/H2 两份报告、原测量与失败；先建立结构性失误分类、视觉 12 例矩阵；冻结全新语料和标签并单独提交。A 阶段不得修改 H2 业务规则。

**Gate B｜语义强化**：只在新模块/分支实现抽取、上下文记忆与弃判；先跑开发组，不看未公开预留组；对原 4 个失败及不同主题的反例出结构化证据链。

**Gate C｜一次性保留评估**：冻结实现 SHA 后才运行预留组。对 H1、H2、H2R 在同一文本和前缀下比较 precision/recall（按确认高潮、潜在但不确定、普通分别计数）、安静高潮召回、false-confirmation、top-1/top-3、pairwise、证据正确性、弃判率、视觉资格/时机错判。所有误判逐项保存。

**Gate D｜回归与性能**：对原 H1 66、H2 318、S1/S2/S3、I1/I2、公共契约、L3、P01、旧 L1/L4 离线用例按可运行范围复跑；至少检查所有历史前缀的未来信息隔离、跨用户会话不串线、视觉权限、关图、撤权、unknown 不重复发送。Node 单进程 CPU 性能分段计时，禁止把正则性能伪装成模型泛化或真实出图速度。

## 5. 质量门槛与状态判断

优先级：**错误确证/泄露 > 错误图像放行 > 重复高潮 > 召回漏判 > 排名偏差**。安全不能以更高召回换取。

- **硬门槛：** 在所有已执行评价中，未经证实的权益/关系生效被当作确认结果为 0、跨会话借证 0、未来泄露 0、视觉资格越权放行 0、重复同一高潮进入导演复核 0、真实外部请求 0。出现任一例必须记 FAIL/PARTIAL，不因总体测试率掩盖。
- **研究指标目标（非保证）：** 相对 H2 的新增独立预留组，安静高潮召回与排名均取得可解释改善；目标可暂定 confirmed-peak precision ≥95%、安静高潮 recall ≥85%、top-1 ≥85%，并单列各子组的样本量与不确定区间。若缺独立盲评，这些只能是自编材料上的离线参考。
- **视觉资格：** 原 12 例若源文/授权确实不足，安全的 \`text-only\` 或 \`ambiguous-location\` 视作正确克制；不能以达成 \`director-review=12\` 为验收目标。新独立完整视觉证据正例必须可以进入 \`director-review\`，且 \`send:false\`。
- **防过拟合：** 不为「书屋」「渡税」「候星庭」写特例；对等价同义改写、反例和跨题材实体均做成组测量；若预留组和新文风未通过，不得把开发组高分算成完成。
- 即使离线指标达标、回归全部通过，在未进行真实玩家文本与独立盲评前，最多 \`H2R_OFFLINE_RESEARCH_PASS\`，不得写“已具备高水平真实小说高潮理解”或“画质验收完成”。未达门槛则 \`H2R_PARTIAL\`，列出不能靠程序猜测消除的证据缺口。

## 6. 必须交付

- 独立 H2R 代码与 \`replayOnly\` 输入输出契约、回退指令；原 H1/H2 入口不变。
- 新锁定语料、原标签、证据标注、冻结 commit / SHA、数据家族划分与盲评局限。
- 原 4 个漏判逐条结构化解释；H2 原 12 项视觉资格矩阵（注明源文缺失 vs 抽取缺失）；新正负例与未来信息防护证据。
- \`docs/reports/YJ-P04-H2R-semantic-generalization-report.md\` 及 \`docs/reports/evidence/YJ-P04-H2R/\` 中 \`baseline.json\`、\`measurement.json\`、\`blind-eval.json\`、\`visual-audit.json\`、\`failures.json\`、\`regression.json\`、\`benchmark.json\`；未运行文件不得伪造。
- 更新 \`README.md\`、\`docs/handoff.md\`、\`docs/task-sequence.md\`、\`docs/verification.md\`、\`docs/decisions.md\`、\`CHANGELOG.md\`，分别写明真实已执行与待执行状态。

## 7. 回报格式

\`\`\`text
YJ-P04-H2R: H2R_OFFLINE_RESEARCH_PASS / H2R_PARTIAL / NOT_RUN
branch / base SHA / final local and remote SHA / working tree:
new corpus: freeze commit, SHA-256, number of stories/revisions, dev/held, prose and author independence:
H1/H2 unchanged: checksums and unchanged historical scores:
four misses: which were resolved with general causal evidence, which correctly abstained:
precise causality: valid/invalid rights and relationships, false-confirmations:
ranking: same-text H1/H2/H2R; quiet recall, precision, top-1, pairwise, abstentions:
visual: original 12 case-by-case: source gap vs extractor gap; new complete-evidence positive controls; send=false:
past-prefix/cross-session/duplicate/revocation checks:
offline full regressions, actual failures, benchmark:
PG/Chrome and live model/image checks: PASS/FAIL/ENV_BLOCKED/NOT_RUN:
network use, live API calls, added USD charges:
report and rollback links:
\`\`\`

**后续 D1 视觉导演与 Q1 参考画风/真实画质应作为下一阶段单独授权。此任务不生图、不使用用户尚未提供的参考图，也不进行训练素材外发。**
