# YJ-P04-H3A｜剧情因果错误确证修复与证据提交门禁（仅离线）

- 编制：2026-11-23（北京时间）
- 目标执行者：Codex
- 工作分支：`codex/yj-p04-h3a-causal-safety`
- 固定基线：`codex/yj-p04-h2r-semantic-generalization@e99fb10d51a96083cbc0087ced256201d088d074`
- **授权更新（2026-11-23）：道主对“下一步可以由 Codex 按任务书依次执行 Gate A → D”明确回复“可以”；因此现授权原 Codex 开展本文件所列的 H3-A 离线实现、冻结新测试、回归及独立任务分支提交。此刻仅授权生效，H3-A 代码、测试和验收仍为 NOT_RUN，需执行者实际完成后再更新。**
- 任务目标：**优先消除两类已证实的剧情因果错误确证**，建立整修订事实审查、证据冲突处理与事务性候选提交机制；在此基础上保留现有出图门禁及离线可回放性。H3-B（语义模型辅助理解）与 H3-C（真正独立新文风评价）是后续单独任务，本轮不做。
- 产品边界：九霄负责剧情、玩家行动、世界事实和文风；映界仅读取授权 `completed-history`。映界无权补写剧情、从行动提示捏造结果、依靠图像反向确认事实、泄露世界书未揭示信息，不能成为独立剧情引擎。
- 工程权限：不修改九霄或映界 `main`；不改万卡阁、不切生产默认、不访问真实私人小说/参考图、不调用模型权限 GET、Responses、Images 或其他真实生成服务、不输入 API Key、不下载模型权重、不外发素材、不动 L1/L4 许可或 I2 付费门禁。网络和模型真实调用必须保持 **0**，费用 **USD 0**。
- 环境限制：Windows 原 Codex `127.0.0.1 EACCES` 仍需独立解决；`ENV_BLOCKED/NOT_RUN` 不得被本次离线回归改写。S3 的 `BROWSER_NOT_VERIFIED`、I2 的 `LIVE_BLOCKED_COST_BOUND` 不变。不可更换执行环境或提高权限绕过安全拒绝。

## 1. 接手前的固定证据和历史结论

先阅读 `AGENTS.md`、`README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/decisions.md`，再核对：
- [H2R 报告](../reports/YJ-P04-H2R-semantic-generalization-report.md)；
- [H2R 因果失败证据](../reports/evidence/YJ-P04-H2R/causal-audit.json)、[一次性预留评价](../reports/evidence/YJ-P04-H2R/blind-eval.json)、[完整离线回归](../reports/evidence/YJ-P04-H2R/regression.json)、[旧结果归档](../reports/evidence/YJ-P04-H2R/baseline.json)；
- `packages/highlights/h2r/{semantics.mjs,replay.mjs,guards.mjs,evaluate.mjs,regression.py}`，及旧 H1/H2、S1/S2、I1/I2 的受信证据与门禁代码。
- H2R 分支最终 Git HEAD `e99fb10d51a96083cbc0087ced256201d088d074`。保留旧提交、失败回执、冻结语料和旧测量的字节摘要，不得覆盖或把 `H2R_PARTIAL` 改写成 PASS。

H2R 已完成 36 线/328 修订新冻结语料：开发 157、预留 171。开发组安静高潮识别 22/25，预留 2/23，预留 top-1 1/13。新评价的两组由同一开发者标注，独立人工盲评未做。**旧预留组已经开启，今后只能作为公开回归/诊断，绝不能再次当作未见盲测集。**

**两个必须保留的失败（不能只针对关键词硬编码修补）：**

1. `counterfeit-reported-with-different-wording`：原文先说邢黎签署陶场赠契，随后“验契官验明那张签条系冒签，裁定自始不算数”，再出现登记到陶会名下。原 H2R 仍把后来的登记归因于已失效签条。这里后续登记可以是独立的叙事事实，但**不构成前述签条有效的因果证据**。
2. `temporary-bookkeeping-while-disputed`：同一修订先有“产权当日登记在陶会名下”，随后明确说“这只是为诉讼临时挂名，受赠人还没有取得产权”。原 H2R 在读取前半句时已宣布产权转移，未等待完整修订的限制证据。

原 H2R 12 个对照实际 **10 PASS / 2 FAIL**，且两次 `send:false`。H3-A 必须先保存「修复前红灯」、然后在新版本说明为什么通过，保留新旧 A/B；历史失败不能从档案删除。

## 2. 根因与最小架构修正

现有 `SemanticMemory.advance(text, receipt)` 逐片段解析、更新 `pending/titles/settled/duplicates` 并可能立即建立 `confirmed-peak`。整段后续否定、冒签裁决或临时权属限制可能没有机会阻断或回滚；不能只扩大 `nonActual`、`disputed`、`invalidOutcome` 的正则清单。

本轮必须建立可测试的 **先收集 → 再核验 → 最后提交** 的研究链路：

### A. 事件和证据的分层

对每条候选保留：
- `statement/asserted`：文本确实声称或描写了什么；与是否属实/生效分开。
- `documentValidity`：文书的签署、冒签、否定、撤销、作废以及发生时间；不知道即 unknown，不因出现凭证自动赋予效力。
- `registryState`：记载/登记/挂名是否出现，这是一个可证事实，不自动等于可处分权益。
- `substantiveRight`：人物是否真正取得或失去对应所有权/收益权/决定权；如证据冲突则 contested/unknown。
- `causalSupport`：当前结果是否确实由某有效前件导致；必须保存支持和反驳各自的原句，若没有独立合法因果桥梁则 unknown。
- `asOfRevision` 与 `learnedAt`：事实在何时被叙述、其真假或效力在何时才可确认，不得用未来修订改写旧前缀的当时结论。

每项都要附可回溯的 `scope/session`、修订、`sourceKey`、正文 `sha256`、UTF-16 半开 `start/end`、引文、身份/别名来源与弃判/冲突原因。将「叙事上重要」和「事实已获确认」单独输出；不把分数当证据。

### B. 两阶段状态提交

1. 第一阶段只解析并收集**整次已保存修订**的事实、限制性从句、否定、引语、反证和可能的事件链；不提前持久改变已确认权属、候选、去重指纹、排名或导演建议。
2. 第二阶段执行同修订内的证据审查：限定语可能否定的是“产权已经移转”而不是“登记出现”——要按证据范围处理；无法确认指代、效力、受益人、标的或前态时保留 unknown。
3. 通过后才原子提交相容的状态、因果边和 `confirmed-peak`；若本修订后文否定/限制了该前件，必须使整个修订的权益确认不成立。未获确认的权属变化不得进入 `settled`、不能被错误去重或成为下一轮证据。
4. 更晚修订出现新裁决时，在**新的 as-of 状态**对既有主张标记撤销/有争议和新的证据归因，但不能悄悄改写此前前缀已经输出过的审计快照。以后又出现新有效契约，应允许重新形成真正的新因果链，不得永久全局禁止同一标的的合法处置。
5. 如果只可确认“登记有变”，不可确认“所有权已变”，可以单独记录登记事件，**不得确认产权高潮或认定原文契约就是原因**。不允许将注册登记与真实权属转移用一个布尔值表达。

### C. 不混淆修复范围

- 不在 H3-A 重新训练语言模型，不开发新图像模型、不扩展图片 Prompt、不凭自由发挥补足场景，不改 S2 `visual-consistency`。
- 语义模型辅助手段另属 H3-B；H3-A 可以引入一个独立 **`causal-guard`** 或 `narrative-highlight/3a` 离线回放入口，旧 H2R 代码与方法名保持可回退。模块命名以仓库风格为准。
- 即使记录了重要剧情，也必须保持 `send:false`，且无 S2 合格当前场景、权限和 I1/I2 任务资格时不能给出可发送建议。

## 3. Gate A：先冻结对照，再修改程序

**此阶段禁止改业务规则。**

- 原 H2R 的 12 项因果测试原样归档、原两次失败必须可重现（至少通过旧版本回放核对回执，不得抹去红灯）。
- 在新独立 `docs/reports/evidence/YJ-P04-H3A/` 和 `packages/highlights/test/h3a/` 建议准备不少于 **48 项新增定向对照**，先提交锁定原文、金标、证据区间和 SHA，再开始修复。若数量不足要如实说明。
- 对照覆盖至少以下类别：
  1. 冒签、代签、合同无效、撤回、裁决失效、文书被伪造；既有证据失效后**登记仍作为独立事实**。
  2. 登记/挂名/暂存/公示/诉讼保全 vs 真正权属/控制权/收益权取得。
  3. 同修订先声明后否认、先否认后有独立新证据、多句与跨句限制、仅否定部分权利。
  4. 更晚修订裁决失效、撤销与后续新有效签署；此前历史前缀不被事后倒写。
  5. 同名异人、资产简称冲突、权益类别不一致、受益账户与受益人不一致。
  6. 反例与正例并存：真正有效赠与、全新独立契约后过户、独立登记事实、两个相邻但因果无关的变化。
- 每类至少包含不同的中文表达方式，不以「陶场/邢黎/冒签/临时挂名」或少量同义词构成唯一通过路径。
- 独立人工标注未参与时仍如实记录 `INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN`。开发者自编语料不是真实小说泛化证明。

## 4. Gate B：实现、保守弃判与证据约束

- 先确认目前错误发生在哪个解析/状态提交路径，最小化影响其他包；保存每个修订修改前后的 `pending/title/settled/duplicate/candidate` 差异。
- 对旧失败样本和新互斥正反例输出可审计的 **assertion → challenge → legal-effective status → result → causation** 图链；反证是否取消的是因果边、登记事实、实体权利还是全部主张，必须明确。
- 对临时挂名和冒签等冲突，允许 `abstain` 或 `contested`，但不能一面声称 `confirmed-peak` 一面带着未消解的关键反证。
- 对前件已失效但后续另有独立有效事实的案例，只能在新独立前件具备证据时创建新因果边；不得因最近有登记句就自动链接旧签条。
- 每次确认要能从当时有权读取的 `completed-history` 重建。用户 action、猜测、模拟审阅结果、未揭示世界书不得补证。
- 所有新代码保持 `replayOnly:true`，不得接入生产默认；没有对外请求接口。

## 5. Gate C：定向反事实和历史连续性验证

最低必须实际检查：
- H2R 原 12 项中 **12/12** 必须正确（旧历史记录仍保留 10/12）；新增锁定集高危 **错误确证 0**。原 2 项需验证“原因正确”，不是只把 `confirmed` 改为 false 逃避检查。
- 真正有效的独立处置、登记和完成后果不能被无条件否定；记录正例召回、弃判数、错拒原因。若为了零错确证把所有权益变化都丢弃，应判 `PARTIAL`。
- 同修订正反事实的**前后顺序变体**、跨修订失效与合法重新签署、先登记后临时限定、跨会话同名资产相互隔离。
- 多前缀重放，证明截至每个修订的来源、候选 ID、`learnedAt`、证据区间、排名、因果边与后续的同修订裁决不会被未来知识非法改写；旧回放快照不可静默覆盖。
- 历史 H1 66、H2 318、H2R 328 及原 712 个前缀均作为**公开回归集**。H3-A 新规则对比 H2R 的安全、召回与排名变化；不能将旧预留组再次称作一次性盲测。
- 关闭生图、撤权、未知任务、迟到结果、跨会话来源与 I1/I2 资格保持原样；无授权视觉资格不能送导演，所有 `send` 为 false。

## 6. Gate D：全量离线回归、报告与严审

- 实际复跑可运行的公共契约 10、L3 30、原触发 4、S1 102+13、S2 100+20、S3 静态 20 回合/16 检查、I1 67、I2 40及跨进程恢复、P01 7、L1/L4 各15假传输、H1/H2/H2R 原测量。未运行项逐项注明 `NOT_RUN`，不可把历史通过视为本轮通过。
- 新方法基准：20/100/300/1000 修订 CPU 离线回放，区分初始化、证据抽取、矛盾判定、状态提交、排名/审计开销；不称作真实模型性能。
- 无法在当前受管环境执行的本机 PostgreSQL/Chrome 测试维持 `ENV_BLOCKED`，不能声称实机已验收。
- 质量优先级：**错误确证 / 未来泄露 / 越权出图 > 误拒重要剧情 > 排序偏差 / 性能**。本轮只修复因果安全，不以提升跨文风召回作为完成承诺；H3-B/H3-C 另立项。
- **验收状态**：高危错误确证 0、原 12/12、相容正例不全部退化、来源/时间/视觉门禁均通过，且保留红灯历史，才可写 `H3A_OFFLINE_CAUSAL_SAFETY_PASS`。任何高危错误或主要正例全面退化则必须 `H3A_PARTIAL` / `FAIL`。即使 PASS，也不是“真实小说因果理解能力合格”，不改变 H2R 旧 PARTIAL。

## 7. 必须交付的仓库文件

- 新研究入口与确定性冲突/状态提交模块、明确的输入输出契约和回退路径；旧 `h2r`、H1、H2 原入口及生产默认不改。
- 先于业务代码单独冻结新增对照；原 12 项和两项失败的旧记录完整留存。
- `docs/reports/YJ-P04-H3A-causal-safety-report.md`；
- `docs/reports/evidence/YJ-P04-H3A/` 内至少包括 `pre-fix.json`、`new-corpus-freeze.json`、`causal-audit.json`、`prefix-replay.json`、`regression.json`、`benchmark.json`、`failures.json`；只记录真实产生的证据，未执行不得生成伪回执。
- 更新 `README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/verification.md`、`docs/decisions.md` 和 `CHANGELOG.md` 的真实状态。
- 最终汇报本地与远端 SHA、工作树、具体运行命令、全部 PASS/FAIL/NOT_RUN、原两例证据链前后差异、仍然未知的场景与下一阶段 H3-B 的实际缺口。

## 8. Codex 回执格式

```text
YJ-P04-H3A: H3A_OFFLINE_CAUSAL_SAFETY_PASS / H3A_PARTIAL / FAIL
branch / base SHA / final local+remote SHA / working tree:
old H2R failures preserved; old 12 pre-fix 10/12 remains archived:
new frozen comparison corpus count, freeze commit and SHA, label independence:
assertion / documentValidity / registryState / substantiveRight / causalSupport schema:
two failures: as-of source evidence and changed causal edges:
old 12, new high-risk false confirmation, positive recall, abstention counts:
same-revision contradiction, later independent deed, prefix/learnedAt/cross-session:
H1/H2/H2R regression and S1/S2/S3/I1/I2/contract: PASS/FAIL/NOT_RUN:
PG/Chrome/real role-card status, model GET/text/images calls, added cost USD:
actual report, evidence, rollback and residual limitations:
```

**当前新授权仅覆盖本 H3-A Gate A–D 离线工作；不授予 H3-B 语义模型、H3-C 新评价、D1、Q1、真实模型/图片请求、素材外发、付费服务、生产部署或合并 main 的权限。若遭遇权限或环境阻塞，按报告记 ENV_BLOCKED/NOT_RUN，不得绕过。**
