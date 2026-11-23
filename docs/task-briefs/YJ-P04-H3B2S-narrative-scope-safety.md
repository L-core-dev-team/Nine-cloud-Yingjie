# YJ-P04-H3B2S｜跨回合叙述作用域、现实归属与因果证据隔离（离线修复专项）

- 编制：2026-11-23（北京时间）。
- 执行者：Codex；目标分支：`codex/yj-p04-h3b2s-narrative-scope`。
- 固定接续：`codex/yj-p04-h3b2-proposition-grounding@a55d356e6f8ae3740007cf8e8080f2bb679369b5`。
- **本轮授权状态：道主同意先编制并上传 H3-B2S 独立修复任务书。仅授权任务分支及文档准备；业务代码、冻结新样本和 Gate A–D 实际测试尚未启动（NOT_RUN），待另行明确开工。**
- **最终质量优先：H3-B2 的 `FAIL` 及其硬门槛退出码 1、原始金标、两次预留开启、第一次红灯、后续兼容回执必须原样保留。不能把本任务书上传、旧案例复跑或变更词表当成修复成功。**
- 产品边界：九霄生成权威剧情、角色行动结果、世界事实和叙事文风；映界仅读有权限且已保存的 `completed-history`，不得自行写故事、补世界书隐藏事实、根据玩家 action 推测结果、将图片反过来写成剧情。
- 许可边界：不修改九霄或映界 `main`，不触碰万卡阁或生产默认；不接真实模型 GET/Responses/Images、不调用付费服务、不下载模型权重、不外发私人文本/图片、不输入 API Key、不用历史 L1/L4 许可、不绕过 I2 `LIVE_BLOCKED_COST_BOUND` 或 localhost 安全限制。PG/Chrome/自由角色卡维持 `ENV_BLOCKED/NOT_RUN`，S3 `BROWSER_NOT_VERIFIED`；不得把离线回归冒充实机验收。

## 0. 接续证据、根因与危险假设

开工前先读 `AGENTS.md`、`README.md`、`docs/decisions.md`、`docs/task-sequence.md`、`docs/handoff.md`，逐项核对：
- [H3-B2 最终报告](../reports/YJ-P04-H3B2-proposition-grounding-report.md)、[最终 FAIL 门禁](../reports/evidence/YJ-P04-H3B2/acceptance.json)、[《雾散后》逐修订审计](../reports/evidence/YJ-P04-H3B2/repair/reserve-case-05.json)、[第二次预留冻结](../../packages/highlights/test/h3b2/reserve-2.jsonl)、[保留的首次失败](../reports/evidence/YJ-P04-H3B2/discourse-first.json)、[回归命令与退出码](../reports/evidence/YJ-P04-H3B2/repair/regression.json)；
- `packages/highlights/h3b2/{discourse.mjs,grounding.mjs,replay.mjs,propositions.mjs,scope-controls.mjs,discourse-audit.mjs,README.md}`；
- `packages/highlights/h3a/` 的权属/因果事务与 `packages/highlights/h3b/` 候选来源审核；S1/S2 与 I1/I2 的视觉/费用门禁。

固定事实：H3-B2 新预留 12 条故事/64 修订/7 个真实高光，本地方案 **6 TP、1 假确证、1 FN**；oracle 亦有同一假确证。已确认新预留《雾散后》：第 1 修订“她梦见了另一座城，下面几段都在梦里。”，第 2 修订的许诺和第 3 修订的交付/签收只在梦中；第 4 修订醒来并“回到现实”，第 5 修订重新许诺，第 7 修订重新交付/签收才有现实证据。两组角色/标的完全相同。第 3 修订被误确证，最终质量门禁 **FAIL / exit 1**。其他 H3-A 12+52 因果、H3-B 30 防护、H3-B2 52 定向和 1,533 前缀重放按既有证据通过，**但不能抵消这个 FAIL**。

具体工程问题不止漏了“下面几段”：当前 `advanceScope` 用分散的 `world`、`framing` 关键词同时命中来判定进入非现实层；`ground` 在全局 scope 为 current 时可能采纳没有“梦”字的真实引文；`replay` 的 `quarantined`、`legacyCut` 在跨叙述返回时还可能**永久屏蔽旧候选**。因此不能通过多加一个正则、永久将梦后全部判 unknown 或将所有后来回合重置为现实来刷通过。

## 1. 目标：叙述作用域作为事实来源的一部分

引入可解释、可回放的 `DiscourseScope` / `WorldFrame`（命名可调整），将**原文出处**和**故事内事实属于哪一层世界**分别编码：

- `scopeId` / 父层/嵌套关系、`worldKind`（`current-reality`、`dream`、`staged-performance`、`hypothetical`、`reported`、`retrospective`、`unknown` 等）、说话者/叙述来源与可信度/明示证据；
- `openEvidence`、`closeEvidence`（可为空）、`learnedAt`、`asOfRevision`、UTF-16 源区间、sourceKey、正文 SHA256、会话和读者当前可知范围；
- 事实 `assertion / observed-in-frame / independently-effective-in-reality` 三层结论；可保留“梦里确实发生了某个画面”这一**梦境内事件**，但不得转换成现实事件或为现实承诺提供前件；
- 每个前件、后件、反证、因果边、排行榜候选都绑定来源 frame ID；只有有明确、独立、合法的跨层转换证据，才可跨 frame 形成因果。人物/物件/文字完全相同不允许视为同一次现实事件。
- 现实的过去回忆与梦境虚构不同。回忆可为文本中真实陈述的历史事件，但不能默认是“当前正在发生的事件”；若没有可靠独立证据，不得从回忆直接铸造当前现实高光。`reported` 中的他人主张、真裁决、旁白事实应分开审阅。
- 不能把 `narrator` / `time=current` 等由不可信 provider 自报的字段当作叙述世界的授权；**先由可信已保存正文及其来源计算 scope，再给命题独立核验**。

### 1.1 跨回合与同一回合中的范围变更

- 对“下面几段都在梦里”“此后数页只是排演”“这几场都是假设”“下一章回忆”之类**范围声明**保守识别其覆盖边界。没有可证的结束时，不得因修订数够了就凭“几段”随意切回现实；有明确回返证据时应记录切回的起点。
- 一次修订内部可能同时发生“梦中交付—醒来—现实交付”；需要比整行更细的作用域区间，按原文从左到右建立范围过渡，不能仅用一个 `row.world` 覆盖整篇。
- 支持嵌套（梦里读到一封信、剧中人物梦醒、引用中的“回到现实”），区分**被引角色说自己醒了**与故事叙述层确实切回现实。
- 对省略主语、间接引语、引号不闭合、章节标题和转场不明确，宁可 `unknown/needs-review`，也不能伪造范围边界。
- **先前已被确认的现实历史不能因为进入梦境而被抹掉**：在新的 as-of 排名中区分当前适用性和历史有效性；梦中撤销不能取消现实历史。醒来后，真实的新前件和结果可以成立，但不能借用梦中交付的前件。
- 若进入 `unknown`，必须解释原因与影响范围；不应简单整会话永久禁判。

### 1.2 修订状态与回放不变量

- 作用域更新必须与 H3-A 事务式证据核验一致：解析整个需要核验的区间、识别限定/反证、在隔离草稿中审查，通过后再发布该世界层的合法事件；检测异常不得只提交前半段的确认。
- 历史前缀 `asOf` / `learnedAt` 不被未来叙述回写：第 4 修订明确醒来，不能改写第 3 修订的当时证据，但可在第 4 修订记录新的范围事实和当前状态；过去的审计快照不变。
- 映界只在 `current-reality` 且前件/结果同一可证现实层、非现实源未被借证、H3-A 其它四层因果审核通过时允许事实确证；梦/排演/未知只能做文本待核或源内观察。
- 旧 H1/H2/H2R/H3-A/H3-B/H3-B2 的已冻结代码和语料保持可直接回退，不应为 H3-B2S 改写旧目录的 FAIL 历史或默认宿主。建议独立 `packages/highlights/h3b2s/` 和 `narrative-highlight/3b2s`。

## 2. Gate A｜先冻结新叙述层评价，不得先打补丁

先做只读根因审计并单独提交**新的**正反对照、原文、标注、SHA 和预注册评分协议，然后再改业务代码。新语料需与 H3-B2 的公开《雾散后》有明显不同的作者措辞和结构，不得把同句替换角色当作新预留组。建议：
- 至少 **24 个独立完整故事、180 个修订**，按整个故事/文风家族分 dev/held（held 不低于 40%），同一作者自编必须明确披露；至少 32 个真实可确证高光/局部剧情变化，40 个虚构/转述/排演/猜测的硬负例，24 组成对“相同人物与物件、不同叙述层”的反事实；如果无法达数则按实情报告，不能编造。
- 覆盖显式/隐式梦境开头、跨修订延续、短段内切回、嵌套梦/戏、被引角色“醒来”、假冒现实说明、同名人物、无明确结束、回忆中的真实过去、文书证词、转述内容中真假混杂、数回合后才澄清、撤回与更正。
- 专门包含“进入非现实之前已经确证一个现实高潮—梦里发生相同事件—醒来后另有独立现实兑现”的**三段式**，检查旧历史是否保持、梦中不确证、醒来可重新确证，以及去重身份不串层。
- 准备至少 40 条反事实“元数据/候选层恶意输入”对照，含来源 hash 合法却误标现实、伪造范围结尾、跨会话相同字面、主体与事件混用、未来提供的结尾证明、用户 action 借证、没有提供来源区间的 provider 自报 `narrator`。
- 每条标签分别冻结故事层 frame、时间范围、事实源的叙述身份、实际现实生效、前后因果边、重要程度与是否可视觉审核；**事实确证与画面资格分开**。人工盲评没有执行就标 `INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN`。
- 现已公开的 H3-B2 两批预留语料一律只能作**公开回归**；如果看过新 held 错误并修复，原 held 立刻降为公开，必须重新冻结真正未见的独立预留。
- 《雾散后》原 1—7 修订 **只作必须通过的公开回归**，不可作为新独立泛化指标；原始 FAIL 仍存。

## 3. Gate B｜隔离实现与回退

- 新增可组合的叙述范围解析器与 `scope-ledger`：明确范围开启、结束、继承、嵌套、未知与叙述归属，提供每个修订和原文半开区间的审计。不能仅替换 `framing` 正则然后结束。
- 承诺/交付/签收等命题只引用与当前已可信 reality frame 匹配的前态和后态；梦里与现实的同人同物不可共用事件 ID、去重指纹、因果边或现实权限。叙述状态与事件状态分开。
- 不能仅凭 provider 的 `source=narrator` 或 `time=current` 信任现实归属；始终独立按可信原文与可选受信回执核验。真实九霄叙述事实回执目前 **NOT_VERIFIED**，仅允许用合成受信回执测试可扩展协议，禁止假装它已生产可用。
- 梦里角色说“叙述回到现实”不得解除父层作用域，真实叙述层确切结束时要允许回到现实。无法证明时 `unresolved`，且说明是“缺乏范围边界”而非“没有高潮”。
- 新入口只读 `completed-history` 且 `replayOnly`。所有建议 `send:false`，没有 S2 现场/人物名单/地点身份以及 I1/I2 许可时，绝不提出可发送生图行为；不修改 S2、ImageTasks 和旧收费授权。
- 保持 H3-A 原因果事务的文书/登记/实质权益/因果四层安全；无文书不能凭“梦中交付”赋予现实产权。单条无法定位源文的句子不能产生 fact。
- 独立代码与完整回退指令：新研究入口可切回 `replayHighlights3B2`（注意其 FAIL 不可视为安全默认）或优先回到更保守的 H3-B/H3-A；**生产默认不变**。不做数据库迁移。

## 4. Gate C｜同文安全与召回双重验收

须同时报告新旧同文四臂（H3-A、H3-B、H3-B2 冻结旧实现、H3-B2S 新实现；若加入 oracle 只报告为独立上限），并以 scope-level 和 event-level 两套统计：
- 范围开始/结束/嵌套和段内切换的 `precision/recall`、错误现实归属数、未知占比及理由；叙述层 `worldKind` 混淆表；
- 候选发现率、结构化命题角色/物件与状态准确、事实确证 TP/FP/FN、事实精确率（无预测为 `undefined`）、安静高潮召回、top-1/top-k/成对排序、相对 H3-B2 的错拒与错采；
- 整条上下文中梦中与现实使用同样句子的配对：第 3 修订必须 **不确证现实**、第 7 修订必须 **可在充分现实证据时确证**；包括先前现实事件保留/梦中撤销无效/有效现实重新签署与源历史排名不倒写；
- 任何一例将非现实转成现实、跨会话或未来借证、越权导演/发送、H3-A 原 12+52 因果安全破坏，均 **FAIL**；不能靠所有结果都输出 unknown 获取 PASS。新增可支持现实真阳性须有非零正确确证和可解释证据，而不是盲目拒绝。
- H3-B2 现有 6/7 真阳性与 1 误确证要保留历史数值并 A/B；新 held 只能在实现与评分器锁定后正式计分一次。冻结标签与原测试红灯永久保留。
- 所有安全失败必须输出原文 `UTF-16 start/end`、`scopeId`、触发器、叙述状态 before/after、相互冲突的证据和事实入账差异。不能因 30/30 或 52/52 安全小测试通过而忽略一个实际误确证。

## 5. Gate D｜完整回归、性能与证据链

- 回放 H3-B2 原 1,533 个历史前缀 **以及新冻结数据**，逐前缀比较 `asOf`、`learnedAt`、源键与 SHA、scope 树/栈、事实/事件候选与因果边、排行和关闭/重复/撤销状态。后文澄清不能非法倒写前一轮。
- 按可执行范围实际复跑 H3-A 12+52、H3-B 30、H3-B2 52、H1 66、H2 318、H2R 328、S1 102+13、S2 100+20、S3 静态 20/16、I1 67、I2 40及竞态、公共契约 10、L3 30、P01 7、L1/L4 各 15 fake 回归；**H2R 两项旧红灯与 H3-B2 新 FAIL 历史必须仍可单独复现**。未跑不得记 PASS。
- 记录 20/100/300/1000 修订的离线 CPU、墙钟、scope 边界解析、命题核验、账本提交、排名审计开销。禁止宣称任何真实模型延迟/画质/泛化达标。
- 新增回执应含 `pre-fix.json`、`freeze.json`、`scope-audit.json`、`case-wusan.json`、`proposal.json`、`grounding.json`、`causal-audit.json`、`failure-list.json`、`prefix-replay.json`、`regression.json`、`benchmark.json`，以及关键历史回执 SHA 对比；只写实际生成的文件。
- 补全 `README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/verification.md`、`docs/decisions.md`、`CHANGELOG.md`，原 H3-B2 `FAIL` 不变、状态按实际执行记录，最后核验 local/remote SHA、工作树与可回退入口。
- 原生 Windows PG/Chrome/九霄真实角色卡、独立人类评审、手机、真实画质、模型推理、H3-C 仍 `NOT_RUN/ENV_BLOCKED`，不越过原安全沙箱权限。

## 6. 验收用语、必须报告的失败

- `H3B2S_OFFLINE_SCOPE_SAFETY_PASS`：修复《雾散后》已知误确证，新冻结场景在无高危误确证、可恢复现实真阳性、跨层取证禁止、全部旧安全回归无倒退且新前缀/实际命令有证据时，才能使用；**这是范围安全离线通过，不等于小说语义泛化已达标**。
- `H3B2S_PARTIAL`：隔离与安全改进存在，但新增语言样例有严重错拒/混乱边界、真实事件确证能力仍不足或部分检查未执行；如有实质硬门槛失败，不能称 PASS。
- `FAIL`：非现实事件当现实、虚构因果污染、未来/跨会话借证、权限越界生图、事实回执伪造等高危错误；即便召回高也不得升格。
- 未有独立自然文风/人类盲评时必须继续 `SEMANTIC_FACT_GROUNDING_NOT_VERIFIED`；任务本身**不包含** H3-C、D1 或 Q1。

### Codex 交付报告结构

```text
YJ-P04-H3B2S: H3B2S_OFFLINE_SCOPE_SAFETY_PASS / H3B2S_PARTIAL / FAIL
base SHA, branch, freeze commit+SHA256, final local/remote SHA, clean worktree:
old H3-B2 FAIL and reserve-case-05 unchanged and independently replayable:
new corpus: story/revision counts, dev/held, family split and author independence:
scope model, boundaries, nested/unknown attribution, same-turn span source:
wusan rev3 negative, rev7 real positive, earlier real facts retained, quote resets denied:
H3-A 12+52 and H3-B 30/H3-B2 52 historical safety, false confirmations:
new text/proposition/confirmed facts, FP/FN, abstain, scope precision/recall, rankings:
all prefixes, original errors archived, first-red-to-fix changes, CPU:
H1/H2/H2R/S1/S2/S3/I1/I2/L3/P01/L1/L4 PASS/FAIL/NOT_RUN:
real model GET/text/Image calls, USD cost, PG/Chrome:
full report/evidence URLs, rollback and residual H3-C prerequisites:
```

**本轮仅获准准备此任务书及交接记录；若道主之后批准开工，才可让 Codex 执行 Gate A–D 的纯离线实现和测试。无论何时，本任务均不授权真实模型、参考图外发、付费图片、生产部署或修改两项目 main。**
