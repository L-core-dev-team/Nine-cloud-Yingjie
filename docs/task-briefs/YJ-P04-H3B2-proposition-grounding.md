# YJ-P04-H3B2｜语义事实命题、独立证据核验与确认能力补强（仅离线）

- 编制：2026-11-23（北京时间）。
- 任务执行者：Codex；**仅上传执行任务书，本轮不直接执行代码**。
- 独立工作分支：`codex/yj-p04-h3b2-proposition-grounding`。
- 固定基线：`codex/yj-p04-h3b-semantic-candidates@4db0787f25fbd0a3a3c0f4a5a44681b7ecb28ce4`。
- **授权范围：**道主批准先准备 H3-B2 的任务书，强调此前应重视质量。当前只授权独立分支上的规划文档与交接索引；**不自动许可 Codex 启动业务代码**。若道主下一轮批准执行，才可按 Gate A → D 开展本文件的离线实现。
- **产品边界：**九霄负责已确认的剧情、世界事实、行动结果和文风；映界只读取有权访问、已经保存的 `completed-history`。不独立造剧情、不猜补隐含世界事实、不凭玩家 action、故事外资料或图片生成结果确认剧情变化。
- **权限边界：**不改九霄或映界 `main`，不切生产默认，不触碰万卡阁。禁止真实 OpenAI/第三方模型权限 GET、Responses、Images 生成/编辑，禁止 API Key、模型权重下载、私人素材外发、训练/微调、付费或生产部署。I2 `LIVE_BLOCKED_COST_BOUND`、原 L1/L4 许可和未知停止状态不变；本地 PG/Chrome `ENV_BLOCKED/NOT_RUN`、S3 `BROWSER_NOT_VERIFIED` 不可被离线测试冒充完成。

## 0. 为什么不直接做 H3-C / D1

以 GitHub 固定提交和原始回执为准：
- [H3-B 最终报告](../reports/YJ-P04-H3B-semantic-candidates-report.md)、[A/B 测量](../reports/evidence/YJ-P04-H3B/proposal-measurement.json)、[独立确认](../reports/evidence/YJ-P04-H3B/causal-admission.json)、[公开错拒](../reports/evidence/YJ-P04-H3B/public-errors.json)、[安全回归](../reports/evidence/YJ-P04-H3B/safety.json)；
- `packages/highlights/h3b/{README.md,replay.mjs,protocol.mjs,fixture.mjs}` 以及 `packages/highlights/h3a/{README.md,replay.mjs,collect.mjs,transaction.mjs}`。
- H3-B 为 **H3B_PARTIAL**；离线接口与来源安全 `H3B_OFFLINE_INTERFACE_SAFETY_PASS`，语义泛化 `SEMANTIC_GENERALIZATION_NOT_VERIFIED`。原 10 项公开错拒中 8 项恢复事实确证、2 项仅文本待核；恢复的 8 项属于同构案例，不能写作广泛语义突破。
- H3-B 新锁定 24 线/216 修订。正文 fixture 发现开发组 **15/22**、预留组 **4/21** 个应复核修订；其中真实安静高潮被候选发现为开发 **10/10**、预留 **2/9**，但**独立事实确证开发 0/10、预留 0/9**。即使 oracle 把 22/22 与 21/21 全部路由到待核，事实确证仍是 **0/19**。本地模拟规则、同作者标注，独立人工盲评 NOT_RUN；这两个集合已公开，今后仅能作为回归。
- H3-B 的 `validateBatch` 检查 scope、sourceKey、sha、原句 UTF-16 区间、实体字面出现等，**“引文真实”不等于“命题被证成”**；`replayHighlights3B` 中的 `corroboration()` 主要链接已经由事务确认的候选，而不能使未知文风的有效事实获得新的独立核验。因此不能只调候选规则/增加关键词或让 oracle 直接赋予确证权限。
- H3-A 的 12+52 定向因果安全、H3-B 30 项安全与 1,157 前缀重放曾通过。原冻结语料、预留开启记录、历史 FAIL 与中间红灯必须保持可读，不修改来制造“更高分”。

## 1. 设计目标与严格边界

本轮要补的是 **“用可证据化的语义命题表达陌生叙述，然后独立审核其是否成立”**；不是默认相信语言模型，也不是把最终事实全部推迟到人工审批。

定义四种互不混淆的对象：
1. **`NarrativeSuggestion`**：可能存在关键转折/高光，仅表示需要检查；与已证事实严格隔离。
2. **`SemanticProposition`**：有明确时间、人物、标的、关系或权益、事件前态/后态、极性、限定条件、声称来源、`asOf`、原文 spans 的**待核事实命题**。如“某人签署”“登记载明”“实质产权生效”“团体共有”“责任解除”“关系恢复”“承诺兑现”应为不同命题，不可用一个 `confirmed` 布尔值打包。
3. **`GroundingVerdict`**：独立核验证据，包括 `supported / contradicted / unresolved`，事实陈述层与叙事世界真实生效层分开，支持与反证分别可溯源，并保留校验时点与拒判理由。`source-valid`、`text-entails-claim`、`effective-in-story`、`causally-linked` 是不同判定。
4. **`VerifiedNarrativeEvent`**：只有 H3-A 兼容的可信证据事务确认后才成为事实事件、候选高光和排名的输入。仅有模型/fixture 声称不足以提升为此类。

### 1.1 语义命题接口不拥有事实写权限

- 实现可替换的 `proposePropositions(ctxPrefix)` 离线接口；可以由现有 H3-B 候选附带结构化命题，但提供方视为**完全不可信**，不准提交 `verified`、`settled`、`allowedToDraw`、`confidenceAsFact` 或绕过校验的系统字段。
- 仅用当前已授权、已保存历史；所有 spans 绑定 `scope/session/revision/sourceKey/narrativeSha256/UTF-16 [start,end)`，回溯前件要保持 `learnedAt`，不能借未来回合的后见之明证明早先承诺。
- 提供者输出只允许受限 JSON/普通数据，不允许执行其任意代码或读取外部文件。已有 H3-B 的**本地函数注入并非沙箱隔离**，本轮对真实不可信供应商的执行隔离 **NOT_VERIFIED**。若探索外部模型或子进程，停在接口说明，不得实际联网。
- 必须区分作者叙述、角色对话、第三方意见、传闻、梦境、回忆、条件句、反讽、否定、澄清、权利生效和法律/世界书权威声明；不以“主体字面存在于引文”证明主体角色绑定正确。
- 不可把尚未构建的九霄签名事件收据当作已有可用事实。可设计**可选的受信事实回执接口契约**并用合成假回执测试验证来源/权限；当前实际九霄世界事实回执需另行核查和授权，不能凭推测补证。

### 1.2 真正独立的事实核验

- 建立 `PropositionGrounder`（或等价模块）与 `H3A-transaction adapter`，**先收集所有同回合命题及限制性证据 → 查核原文是否支持 → 核验冲突和有效性 → 在草稿上原子提交**。候选模型的自报置信度或“理由”绝不算独立证明；需要来源于已存正文的可复核事实或经宿主核验的权威事件回执。
- 语义蕴含核验不只是字符串匹配：正反述、否定作用域、主客体、代理/集体、发言人身份、账户/受益组织区分、事实时间、权利类别与因果方向必须逐项评估。若确定性机制无法在陌生语句上可靠区分，**正确答案为 unresolved**；不得因为 oracle 金标对就放行。
- 允许来源于不同段落但同一实体的组合证明；禁止未经证据的跨故事线因果、仅凭时间先后或同名便关联，以及以真实登记代替实质权属。
- `documentValidity / registryState / substantiveRight / causalSupport` 四层沿用 H3-A，避免冒签和临时挂名回归；通过语义候选也不得覆盖独立事务拒绝。
- `group-beneficiary`（船工共有）与具体成员持股比例分开；`account`（如“济贫局公账”）与组织受益人分开；“放弃收益资格”和“暂交账本”、“解除担保”和“暂缓追偿”、“恢复往来”和“恢复法定关系”分开。
- 事实待核、场景可见事实、视觉适配资格分别存储。H3-B2 只分析文本和离线提案，`send:false`；无 S2 场景、人物完整名单、授权、I1/I2 受信任务门禁，绝不产生合规导演候选。

## 2. Gate A：冻结真实要验证的能力，再实现代码

**任何新业务逻辑写入前，先单独提交冻结样本与标签 SHA。** 建议最少 28 条完整故事线、260 个修订，其中至少 24 次可证安静高潮、80 条普通/待证高风险反例、20 组语义真假相反或转述/施事差异对照、8 条跨 8+ 修订长线、多故事线因果与两个相邻独立高峰。按故事家族、作者拟写策略和语义构式分离，预留不低于 40%；预留开启前冻结代码和评分器。
- 不直接复制 H3-B 那套同回合位置、固定“一条高潮/故事”的布局；改变关键回合位置与个数、对话/叙述比例、长篇铺垫长度和冲突结构。
- 每条样本至少冻结：①哪些修订值得文本复核；②可核 `SemanticProposition` 与文本直接支持的命题；③哪些故事事实已有效确认、哪些仅有登记/签署、哪些被否定或未知；④高光类型/依赖/首位与成对排序；⑤视觉资格保持独立；⑥推理前缀和金标理由。记录标注者独立性及仲裁争议。
- 追加至少 40 条**恶意或错误命题输入**：证据虽真但推论不真、错人错权、冒签、临时挂名、未来借证、错源、跨会话、群体份额伪推断、账户当组织、因果次序倒置、观点冒充裁决、含蓄否定、同回合后文修正。
- 公开旧集「渡船」「梵钟」、10 旧错拒及 H3-A 12+52 例必须保留原标签，建立新的独立仲裁意见但不能重标历史来刷分。
- 无独立人类标注时必须写 `INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN`。本轮**不允许凭开发者自编语料声称语言模型真实泛化已验证**。

## 3. Gate B：研究实现与假输入隔离

建议新入口 `narrative-highlight/3b2`，例如 `replayHighlights3B2(ctx, candidateProvider, propositionProvider)`。保持 H3-A/H3-B 旧入口及默认宿主不变，任何失败可回退。
- 独立实现 `proposal validation → evidence grounding → H3A compatible transaction → story ranking → S2 gate`；不能仅在旧 `corroboration` 放松为“只要引文真实就算已确认”。
- 使用三个严格不同的离线对照臂：**无候选基线**、**独立于金标构造的本地规则/人工编写假命题**、**oracle 结构化命题上限**。oracle 只能表明**证据核验机制**对理想输入有无能力，不代表识别器实际理解，也不能自行设置有效性；所有 oracle 数据隔离于业务包和默认路径。
- 研发必须输出可追溯的 `statement/grounding/contradiction/entailment/asOf` 审计。具体有效字段与账户身份要经原文 span 对账。**候选被正确路由但无法确认**要独立计数为 `candidate-only`，不可写成 factual TP。
- 提供者坏批次/撤权/异常/分段引用截断时，整个该批次拒绝或保守停机，不产生任何部分事实状态；严格限制最大上下文及单批条目。
- 需要调整 H3-A 的实际事实 schema 时，新增隔离适配层与对照，不能修改旧 H3-A 冻结版本、旧回执及运行时权限；旧的安全判断仍须可直接复现。

## 4. Gate C：严格 A/B、因果安全与真实局限

同文比较旧 `H3A`、`H3B`、`H3B2(local)`、`H3B2(oracle)` 四臂，独立统计：
- 候选发现 recall/precision、角色配对完整度、引用合法性、事实命题字段正确率、`supported/contradicted/unresolved` 混淆矩阵；
- **事实已确证的安静高潮** precision/recall，错误确证及错拒数、弃判率、剧情首位/Top-k/同线成对排序；对没有确证输出的 precision 记 `undefined`，不能当 100%；
- 关键拆因：①未提出候选；②候选未提完整角色/后果；③文本并不支持；④事实蕴含无法证明；⑤真实冲突反证；⑥原 H3-A 合法拒判；⑦S2 视觉资格不足。每个 FN/FP 逐例保存证据与判断。
- 固定旧危险样本冒签/临时挂名、公开 H3-A 12+52 个因果例，**高风险错误确证 0、事实来源穿越 0、无资格导演 0、跨会话借证 0、未来倒写 0、未经授权发送 0**；真实正常权益变化不能全部变成 unresolved。
- 新预留集应在冻结实现后一次性正式计分；预留结果不得用于同一报告中的实现调参。如修复后再测，该集降格为公开回归，另冻结真正未见集。
- 不能因为 oracle 达到高分便把整个 H3-B2 标为“语义理解已达标”；**出现新的逻辑误确证一律 PARTIAL/FAIL**。如果只有接口和安全通过但新集实际确证仍是 0，必须明确标记 `SEMANTIC_FACT_GROUNDING_NOT_VERIFIED`，不能用 `PASS` 遮掩。

## 5. Gate D：全量兼容复跑、性能与回退

- H3-B `1,157` 前缀 + 新冻结语料全部前缀顺序重放，查 `learnedAt/asOf`、撤销、证据区间、候选 ID、因果边、排名和去重，不能用未来信息改写旧前缀。
- H1 原 66、H2 原 318、H2R 原 328、H3A 原 12+52 与 941 前缀、H3B 历史 A/B、S1 102+13、S2 100+20、S3 静态 20/16、I1 67、I2 40 与竞态、公共契约 10、L3 30、P01 7、L1/L4 各 15 fake 回归，按当前真实执行结果记 `PASS/FAIL/NOT_RUN`；**H2R 旧两项红灯必须依旧可复现**。
- 离线 CPU 20/100/300/1000 修订；分别计候选抽取、命题验证、原文取证、冲突审核/事务提交、排名/审计。没有运行真实模型时不得称作模型延迟或准确率。
- Windows PG/Chrome、九霄真实自由角色卡、移动端、图片审美、独立人类盲评保持 `ENV_BLOCKED/NOT_RUN`，除非另有真实证据。本阶段不调用 API，也不触发费用许可。
- 留存首次红灯、原始失败、冻结 SHA、用户授权边界、所有已执行命令/退出码和最终提交。声明回退为直接使用 `replayHighlights3B(ctx, provider)` 或更保守的 `replayHighlights3A(ctx)`，不需要改数据库或生产。

## 6. 验收状态与强制报告

- **`H3B2_OFFLINE_GROUNDING_RESEARCH_PASS`**：只有新冻结语料的实际命题支持与确认有非零、可解释的正确进步，且所有安全硬门槛为 0、真实负例不被误放、正例没有通过全部弃判来“通过”，完整回归和审计可靠。此 PASS **仅限离线研究**，不能代表真实自然小说、实际 LLM 推理或独立人工评价已达标。
- **`H3B2_OFFLINE_INTERFACE_PASS / H3B2_PARTIAL`**：接口和来源/事务安全成立，但新文风蕴含或事实确认依旧为零/严重不足；必须明确 `SEMANTIC_FACT_GROUNDING_NOT_VERIFIED`。
- **`FAIL`**：任一硬门槛被击穿、虚构原文证据或越权出图等，不能被其他漂亮指标抵消。
- 项目整体最终判断以**事实确证 + 安全 + 未见文风**综合为准，不以 oracle 的理想上限或开发组得分单独宣布完成。

交付目录建议：`packages/highlights/h3b2/` 独立入口、propositions/grounding/schema、README 与 tests；`packages/highlights/test/h3b2/` 新冻结 corpus/protocol；`docs/reports/YJ-P04-H3B2-proposition-grounding-report.md` 和 `docs/reports/evidence/YJ-P04-H3B2/{freeze.json,proposal.json,propositions.json,grounding.json,causal-audit.json,public-errors.json,failures.json,prefix-replay.json,regression.json,benchmark.json}`。不存在的实际回执不得填造；最后更新 `README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/verification.md`、`docs/decisions.md`、`CHANGELOG.md`，附回滚路径与最终 local/remote SHA。

### Codex 交付格式

```text
YJ-P04-H3B2: H3B2_OFFLINE_GROUNDING_RESEARCH_PASS / H3B2_PARTIAL / FAIL
branch, base SHA, final local & remote SHA, clean working tree:
new corpus stories/revisions/dev/held, freeze commit/SHA and authorship/independence:
old H3B discovery 15/22, 4/21 and old fact 0/19 kept untouched:
proposal interface / proposition schema / independent grounding boundary:
H3A 12+52 dangerous causal cases, H3B 30 safety cases, all historical red logs:
four-arm A/B: proposal recall, proposition support, independently confirmed facts, top-1/rank, precision (undefined where none):
true confirmed / candidate-only / unresolved / rejected false: source spans and line-by-line explanations:
new or old semantic false confirmations, over-rejections, cross-session/future/visual gate/send violations:
all fresh regressions, 1157+ new prefix replay, CPU measurements:
real model API/Images calls, actual USD, PG/Chrome status:
full report, first-run failures, rollback and next H3C preconditions:
```

**本轮任务书准备不代表已经开始 H3-B2 工程。H3-C 独立自然文本盲评、真实语义模型、外部服务、私人素材外发、D1 视觉导演和 Q1 出图质量均需另行授权。**
