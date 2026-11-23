# YJ-P04-H3B｜语义高潮候选与可信因果门禁融合（离线质量专项）

- 编制：2026-11-23（北京时间）
- 执行者：Codex；独立分支：`codex/yj-p04-h3b-semantic-candidates`
- 固定接续：`codex/yj-p04-h3a-causal-safety@69e3cc8c6f5b3d228a6b90c5ed68c9e4b5b577bb`
- 本轮授权：道主明确同意继续 H3-B，强调**质量优先**。授权仅覆盖本任务所列的离线开发、冻结合成用例、可注入的假候选服务、离线回放、测试及独立分支提交。
- 初始状态：**仅任务书和接续记录已准备；H3-B 业务实现、冻结语料与测试尚未运行（NOT_RUN）**。GitHub 写入不代表 Codex 已启动、测试通过或用户电脑工作树已变更。
- 总目标：在不牺牲 H3-A 的因果安全底线下，让不同文风的安静高潮、集体权益、关系变化与长期兑现**能被提出为潜在候选**，并由独立证据机制核验，避免两类错误：把无效文书/暂时挂名当作生效；把第三方传闻/普通叙述错当作足以废除事实的反证。
- **不是本轮目标：**使用真实 OpenAI/第三方模型、下载模型权重、向外发送用户小说或参考图、训练/微调、生产接入、正式图片导演、画质测试、正式用户泛化验收。H3-C 独立人工/跨文风评价及真实模型选型需另行批准。

## 1. 不得变更的工程事实

先读 `AGENTS.md`、`README.md`、`docs/decisions.md`、`docs/task-sequence.md`、`docs/handoff.md`，核对下列固定来源，而不是依靠摘要修改历史：
- [H3-A 报告](../reports/YJ-P04-H3A-causal-safety-report.md)、[原 12 + 新 52 因果审计](../reports/evidence/YJ-P04-H3A/causal-audit.json)、[旧错误与错拒清单](../reports/evidence/YJ-P04-H3A/failures.json)、[回归回执](../reports/evidence/YJ-P04-H3A/regression.json)；
- `packages/highlights/h3a/{README.md,replay.mjs,collect.mjs,transaction.mjs,targeted.mjs,guards.mjs,record.py}`，`packages/highlights/h2r/`、`packages/highlights/v2/`，以及 S1/S2、I1/I2 的受信来源和权限契约。

H3-A 状态只为 **H3A_OFFLINE_CAUSAL_SAFETY_PASS**：原 12/12，新冻结 52/52（20 次有效处置、0 错误确证），23/23 定向门禁及 941 个前缀重放通过。但在公开旧集出现 10 个相对 H2R 的新增错拒，H1 15/16、H2 40/50、H2R 开发 21/25、H2R 已打开预留 2/23；已有正反例由同一开发者编写，独立人工盲评 NOT_RUN。

**必须追踪而非按词硬编码的公开错拒**：旧“渡船”集体共有；8 个“签署之后出现第三方说法”的近案；“梵钟”跨线收益变化。所有公开失败只能作为诊断/回归，已打开的 H2R 预留组不得再次作为未见盲测。原 H1/H2/H2R/H3-A 源文件、锁定语料、原始失败和报告不改写、不重标、不抹去中间红灯。

## 2. 目标架构：两种能力严禁混为一谈

`已授权完成历史 → 候选提议层（不可信） → 证据核验层（H3-A 不变量） → 叙事排名 → S2 视觉资格 → I1/I2 许可门禁`。

### A. 语义候选接口（不可信输入）

设计可替换的 `NarrativeCandidateProvider` / `suggestNarrativeCandidates()` 协议（名称可按仓库规范调整）。本轮只提供**本地同步或进程内 fake / fixture**；可在未来授权后接模型，但现在不得建立网络客户端。输入仅为经宿主授权、到当前修订为止可读取的完成历史，不得读 action 意图代替故事结果，不得读世界书未揭示内容，不得跨用户/会话或看未来。

建议候选字段（非供自行猜测事实）：`id, scope, session, asOfRevision, learnedAt, candidateType, importanceHypothesis, participants, entityRefs, eventClaims[], dependencies[], sourceSpans[], uncertainty, proposedVisualMoment?`。事件范围包括：
- 集体共有/分账及多个受益者；代理人、收益账户、行使权利的人必须分开；
- 关系疏离与恢复、弃约、承诺兑现、责任解除、放弃权利或资格、长期人物付出；
- 多线交织中“为谁而做、改变了谁的处境、改变有多持久”的静态高光；
- 传闻/假设/计划/回忆/角色台词、假转让/未生效/有限时效、同名、范围不清的 hard negatives。

候选只说明“**值得核查**”；不得自带 `verified:true`、`allowSend:true`、有权事实或能直接覆写账本的字段。模型给出的信心数/打分不等于事实证据。规范化字段的来源必须能追溯到原始文本；不许通过模型输出的“理由”代替原文。

### B. 证据核验与事实权限

- **内容与引用双重检查**：不能只验证引文确实存在，还须判断引文是否独立支持所主张的主体、客体、权益类型、生效时点及因果；如果只有候选服务自述“这是真的”，不算第二证据。
- 引文按 `scope/session/sourceKey/narrativeSha256/revision/UTF-16 [start,end)` 精确校验；重叠/截断、错来源、跨线、未来引文均拒绝。
- H3-A 的 `documentValidity / registryState / substantiveRight / causalSupport / support / against` 必须继续独立记载；整回合先收集矛盾，再原子提交。签条已被裁定冒签、临时挂名、伪文书、产权未生效不能被“语义模型很确定”绕过。
- 允许**仅将未确认的潜在高潮送往独立文本审阅/待核**，绝对不因此进入 `confirmed-peak`、`settled`、去重已确认状态或 `director-review`。只恢复“候选发现”不等于完成“高潮确认”。
- 若九霄未来可提供已保存、已授权且可校验的结构化事实回执，可设计只读的受信事实输入接口；**本轮没有这种已存在的可用回执证明，不得假装拥有**。没有可独立证实的来源，就维持 unresolved/abstain。
- 区分**否定事件真实性的证据**与**第三方观点、角色主张、旁观者传言**。仅后者存在时不得无故取消已有有效事件；若真有可核的新裁决，也不能忽略反证。对含混指代进行局部定位，禁止“同故事有人提出异议，所以全部权益无效”。
- 现在的 H3-A 安全实现可以包在新研究入口后，但不得在现有 H3-A 代码直接放宽审查；若需要新的证据类型，必须以独立代码、对照测试和可追溯契约增加。

### C. 排名与视觉导演

候选可以先有独立的 `potentialImportance`，通过证据核验的事件才可作为已确认关键时刻；最终高光排名不能把多个低确定性候选叠分成“确定发生”。排序考虑长期铺垫、关系/权益后果、人物代价、剧情目标兑现，而不是纯形容词、打斗声势、模板构图。重复的同一瞬间只提议一次；两个独立真实高光可连续。

**只有独立合格的 S2 当前画面证据、人物名单/地点身份、许可和 I1/I2 受信快照齐全时，才允许 `director-review`，全程 `send:false`。** 不能为了达到旧 12 个导演金标而补造地点、视角、光照或人物。H3-B 不写生图 prompt，不训练画风，不发图片请求。

## 3. 质量测试要揭露“假会理解”的情况

### Gate A｜先冻结能力与协议评价，再开发

- 在业务规则改动之前，单独提交全新**合成对照语料**及金标，建议不少于 200 个修订/至少 24 条完整故事线、含至少 60 条普通/不确定 hard negatives，并记录实际数量与分组。开发组与预留组按**故事家族/措辞策略/因果结构**分开，预留至少 40%；不能简单换名字/物件制造“新文风”。
- 除内容金标外，独立冻结一套“**恶意或错误候选输入**”契约测试：错引文、伪 SHA、跨会话、越时证据、伪权属、把台词当旁白、断章取义、同名主体、第三方传闻误作裁决、候选重复、后续撤销、权限更改、部分失效。
- 对原“渡船”、8 个近案、“梵钟”在实现前写出逐例证据意见：确认原金标确实有充分事实支持还是应该保留冲突；若需复核，**新增仲裁记录，原金标不动**。
- 对语义候选另存“候选发现评估”和“证据已确认评估”，两套分母必须不同，不能让 fake 先读金标后直接将答案提议出来。
- 标注者与代码作者相同须写 `INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN`。H3-B 尚无真实模型时，**不称模型在新文风上达标**。

### Gate B｜协议及离线融合实现

实现独立可回退入口，例如 `narrative-highlight/3b` 的 `replayHighlights3B(ctx, candidateProvider)`，默认不注入任何真实网络服务；fake 是确定性、本地数据，支持可控恶意/缺项/乱序输出。推荐将候选提供方视为**不可信来源**，先验证 scope/source 和结构，再交独立事实门禁，最后排名和视觉资格，任何解析异常不得部分提交。

在新研究入口保留 H3-A 的原子事务性审查/审计链；保留原 H3-A 源码和接口，确保直接回滚只切回其入口。源码中不得引用金标目录或评价输出作为推断输入。测试桩不得由标签动态生成“正确候选”；若提供 oracle 结构化候选，明确只证明**接口上限/安全边界**，不计作实际语言理解召回。

### Gate C｜分层 A/B 测量

同时报告至少三组，**不得混为一个“准确率”**：
1. `H3-A baseline`：未接新候选，仅运行当前冻结入口。
2. `H3-B untrusted fixtures`：固定、可复现、与评分标签隔离的候选输入，按原始正文触发；记录有效/无效候选被拒或待核，是否引入错误确证。
3. `H3-B oracle upper bound`（可选）：人为按金标提供理想结构化候选，只测接口能力和证据门禁，**不能代表真实模型召回、精确率或跨文风泛化**。

分别记录候选 recall/precision、事件事实确认 precision/recall、安静高潮 recall、跨线排序/top-1/top-k、抽样检视证据区间有效率、错拒数、误确证数、弃判率、视觉门禁失误、CPU 成本。对 10 个新增旧错拒逐例解释：是真正确认的修复、仅产生新候选，还是应保持不确定。特别对比“有效第三方信息”与“未经证实的第三方意见”；不得把已正确抑制的冒签/挂名重新打开。

**硬门槛**：冻结新集、原 12+52、旧 H1/H2/H2R/H3-A 可执行案例中，越权事实确认 **0**、未来剧透 **0**、跨会话借证 **0**、未经授权的导演候选 **0**、重复同一瞬间提议 **0**、真实 API 调用 **0**。相容正例不能因新增防护全部弃判；若发生重大召回倒退，应 PARTIAL 并列出失败。即使是 100% oracle 命中也不能宣称语义泛化成功。

### Gate D｜完整离线回归与回执

- 逐前缀重放旧 941 个 H3-A 前缀，再加新增冻结集前缀。核对 `learnedAt`、候选与证据编号、事务提交、撤销以及来源边；历史 as-of 结果不得被后来证据倒写。
- 原 H3-A 12/12+52/52 的历史测量仍保留，比较本次新入口与旧 H3-A；H1/H2/H2R 原测量、安全红灯、S1 102+13、S2 100+20、S3 静态 20/16、I1 67、I2 40/竞态、公共契约 10、L3 30、P01 7、L1/L4 各 15 假传输按当前环境能执行的实际跑；不能把旧次结果当当轮结果。
- 20/100/300/1000 修订 CPU 性能并区分 fake 候选构造、可信校验、因果审查、排名/审计。模型未运行，禁止把 fake 吞吐描述成真实 LLM 推理性能。
- 原生 PG/Chrome/九霄自由角色卡保持 `ENV_BLOCKED/NOT_RUN`，S3 `BROWSER_NOT_VERIFIED`、I2 `LIVE_BLOCKED_COST_BOUND`；真实图像审美、手机试玩、独立人工盲评和生产部署仍 NOT_RUN。不得绕过受管 localhost 限制。
- 完整保留新旧失败、首次红灯、废弃方案、预留开启时间、实际程序退出码、冻结摘要、最终提交和干净工作树证据。

## 4. 状态判断与真正的质量门槛

- 若仅通过可注入候选接口、恶意候选拒绝、完整因果回归和来源验证，可报告 **H3B_OFFLINE_INTERFACE_SAFETY_PASS**，但必须同时声明 **SEMANTIC_GENERALIZATION_NOT_VERIFIED**。
- 若真实新增错误确证、门禁越权、前缀污染，或必须靠按金标写死候选才能“提升”，状态只能是 **H3B_PARTIAL/FAIL**。
- 若新冻结集上由独立于答案、未看预留数据的可复现候选策略产生提升，可另外报告 **OFFLINE_FIXTURE_IMPROVEMENT**（列明作者、家族划分和局限），但不能包装成已证明“模型懂小说”。
- *后续 H3-C 真实自然文本和独立人工评价*、模型/费用/文本外发授权与 Q1 真实出图审美均是独立门槛。H3-B 不能为了交付 PASS 而削弱 H3-A 的安全。

## 5. 必须交付与汇报

- `packages/highlights/h3b/` 独立入口、候选输入契约、校验/证据衔接、可切回 H3-A 的回滚说明；旧 `h3a` 与生产入口不改变。
- 新冻结的语料、协议、SHA、开发/预留家族划分、恶意候选输入集；假候选与金标/评分器严格隔离。
- `docs/reports/YJ-P04-H3B-semantic-candidates-report.md`，和 `docs/reports/evidence/YJ-P04-H3B/` 下的 `baseline.json`、`corpus-freeze.json`、`proposal-measurement.json`、`causal-admission.json`、`safety.json`、`public-errors.json`、`prefix-replay.json`、`regression.json`、`benchmark.json`、`failures.json`；未运行的不伪造。
- 更新 `README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/verification.md`、`docs/decisions.md` 和 `CHANGELOG.md`，写清仍没有真实模型验证、运行环境限制及未来授权缺口。

### Codex 回报格式

```text
YJ-P04-H3B: H3B_OFFLINE_INTERFACE_SAFETY_PASS / H3B_PARTIAL / FAIL
branch / base and final local-remote SHA / clean status:
semantic generalization verified? NO unless separately authorized, with actual independent evidence:
new corpus: count, freeze commit SHA, families, dev/held, independence, held exposure:
proposal input: injection source, model/fake/oracle classification and leakage controls:
H3A evidence and transaction contract unchanged? precise differences:
public 10 error cases: true recovered / candidate-only / correctly abstained / unresolved:
A/B on same texts: proposal recall, confirmed event recall, top1, false confirmations, false refusals:
12+52 causal checks, historical prefix audits, unauthorized director/send occurrences:
H1/H2/H2R/H3A and S1/S2/S3/I1/I2/L3/P01/L1/L4 current-run results:
real model GET/text/image calls, actual USD charges, PG/Chrome status:
red failures, rollback path and next H3C gate:
```

**权限终点：仅授权 H3-B 离线开发、代码审查、冻结合成测试和分支提交。不得启动 H3-C、真实模型调用、模型权重下载、用户素材外发、出图、生产默认切换或修改任何 main。**
