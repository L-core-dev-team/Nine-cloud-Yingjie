# YJ-P03-S2｜场景语义一致性审查与零网络连续试玩切片

- 日期：2026-11-22（北京时间）
- 任务状态：**仅准备完整任务书；S2 代码与测试尚未执行**
- 开发者：Codex；分支：`codex/yj-p03-s2-scene-consistency-slice`
- 固定接续：`codex/yj-p03-s1-generic-scene-evidence@6ed8d2b220c0e138bb4c7be88ac897e5a9aca81c`
- 固定九霄只读上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- **本轮授权范围仅限纯本地、无真实网络的源码与测试。无 OpenAI API Key，不允许模型 GET、Responses 文字、Images generate/edit 的任何实际请求；不得发生真实费用，不可激活已有 I2 的真钱门禁。**
- Windows 原受管会话的 `127.0.0.1 connect EACCES` 仍见 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)。S2 不负责重新测试或绕过。真实 PG、Chrome 和原角色卡回环集成仍需合法权限后另外验收。
- 原 L1 `ACKNOWLEDGED`、L4 `UNKNOWN_STOP`、L5 `PARTIAL`、L5B `ENV_BLOCKED`、I1 `IMAGE_ADAPTER_OFFLINE_PASS`、I2 `I2_GATE_OFFLINE_PASS / LIVE_BLOCKED_COST_BOUND` 不更改。

## 一、为什么紧接 S1 做这个

S1 已离线完成 [六个合成地点、102 条先锁定语料](../reports/YJ-P03-S1-generalized-scene-evidence-report.md)：新版 `scene-evidence/2` 的 36 条正例全部正确采纳、66 条负例全部正确弃判，错采与多余弃判各 0。历史 `scene-evidence/1` 在这批新表达上全部弃判，且原默认 `zh-visible-clause/2` 并未切换。三个新地点只验证过**内存图片请求构造（transmitted=0）**，没有新场景的真实图片、参考编辑或原生九霄 PG/Chrome 完整链。

**S1 的准确结论是“受限合成语料上的文本证据提取通过”，不是“普通玩家可以自由探索、文字与画面保证协调”。** S1 的开发/预留组共用同一合成世界、标签由开发过程提供，缺少独立人工/外部自然叙事盲评。

另有一个具体风险必须优先进入安全测试：

- 预锁定样例 `P30` 的原文同时写出“此刻已是夜间。日光照亮眼前”，被逐字段按原文正确提取；
- `P50` 的原文同时写出“此刻已是正午。月光照亮眼前”，也按标注被采纳；
- 这**并非直接证明提取器错误**，因为修仙世界可能存在特殊天象、阵法或其它明示设定；但“每个字段有原文 span”不足以单独证明组合**视觉自洽**。无补充证据不能把该组合无条件用于真实图片提示。
- 旧 S1 的语料和期望不改写、不抹除绿灯。S2 新建一个**独立于字面提取的图片资格审查层**，把尚无受信解释的异常组合标记为需要复核，避免 AI 直接画穿帮。

本阶段的目标：**把 S1 的可信字段转成可解释的“是否适合出图”的决定，并用一条真正连续的离线游玩切片证明图片任务的归属、待审、复用、参考编辑和隐藏旧图边界。**

## 二、开工必须读的源码和原始证据

1. `AGENTS.md`、`docs/requirements.md`、`docs/decisions.md`、`docs/handoff.md`；
2. `packages/first-play/{scene-evidence-v2.mjs,scene-registry.mjs,scene-evidence.mjs,continuity.mjs,planner.mjs,replay.mjs}`、`packages/first-play/test/s1-corpus/`；
3. [S1 运行报告](../reports/YJ-P03-S1-generalized-scene-evidence-report.md)、[新旧逐例测量](../reports/evidence/YJ-P03-S1/measurement.json)、[字段与来源审计](../reports/evidence/YJ-P03-S1/fields.json)、[保留旧错误接受诊断的回归](../reports/evidence/YJ-P03-S1/regressions.json)；
4. `packages/scene-state/{project.mjs,store.mjs}`、`packages/contracts/src/`、`packages/world-assets/`；
5. `packages/openai-image/{context.mjs,prompt.mjs,protocol.mjs,money.mjs}`、`packages/openai-image/test/s1-preview.mjs`、`packages/image-tasks/{index.mjs,files.mjs}`、`packages/image-history/`；
6. [I1 适配器结果](../reports/YJ-P02-I1-image-adapter-offline-report.md)、[I2 预算门禁](../reports/YJ-P02-I2-image-money-gate-report.md)、[YJ-09 复访与藏旧图](../reports/YJ-09-revisit-continuity-report.md)。

不得从早期工具实验里的三张 PNG 推断新宗门图片的实际人物一致性。不得读取真实私人角色卡、世界书、API 凭据、现有真钱账本或旧九霄生产数据库。

## 三、工作包 A：独立的场景语义审查（不要改变字面提取成果）

### A1. 新、版本化的候选图片资格判定

新增 `visual-consistency/1` 或等效的纯函数模块，明确输入来源为**同一认证 completed-history 的 S1 v2 audit + Scene/Visual + 当前受信、已揭示信息**。只输出保守资格与原因：

- `eligible`：文字字段完整，当前性、位置、归属、人数、连续性及组合含义有足够一致的证据；
- `needs-review`：字段分别可见但跨字段组合异常、缺少已揭示解释、上下文不足，**禁止此轮自动 generate/edit**；
- `conflict`：同一当前语境存在明显冲突、相互排斥断言，必须 `not-ready` 或 skip，绝不能编造新图；
- `not-ready`：来源、字段、身份或权限资格不足。此结果不得悄悄靠世界书、旧图或模型附加 JSON 补齐。

要报告 `fieldReady` 与 `imageEligible` 两个不同事实。例如 `P30`、`P50` 的**字面字段**可完整，但在当前语料**没有受信剧情明确解释**夜间日光、正午月光的前提下，应至少 `needs-review`；勿修改旧 /2 的原结果或锁定语料。对“修仙阵法在夜间制造人造日光”之类有**当下已揭示且可核 span 的明确说明**的合成正例，应允许从 `needs-review` 提升到 `eligible`，但不能靠模型猜设定、默认现实世界规则或隐藏世界书擅自判定。

### A2. 双重一致性与上下文断言

重点覆盖：

- 当前时段 × 当前光照与可解释例外；当前空间（室内/室外） × 可见光源；观察朝向 × 所述目标在何处；相同/不同地点的别名、跨尺度视野；
- 完整名单是否真排他，角色去留与参考图保留人数是否一致，三人到五人与反向离场，遮挡与不确定人数；
- 不可让旧图或世界书描述补全当前文字；用户 action、模型自报结构化结果不能作为唯一证据；
- 源字段偏移和继承字段的 `priorRevision` 必须明确，一旦被新剧情反证，继承资格撤销、旧图隐藏；
- 同一 scope 的场景引用与上一版比较；不同会话/账户不得因为地点同名而交换历史图片；
- 当前故事对普通闲谈无视觉变化时可安全 reuse；但“夜里原来还是日光”这样的异常不能只因 reuse 就跳过审核。

审查应有固定 reason code（如 `temporal-lighting-ambiguity`、`contradictory-observation`、`unverified-exception`），记录审计摘要与证据区间，不保存任何私人原文。未知直接阻断，不自动用付费模型做第二次判断。

**禁止为了得到 0 错采把所有正例一律留空；** 在新的独立标注集中报告 eligible 的真阳性、需要复核、误采与不必要阻断，并以错图风险优先。

## 四、工作包 B：真正独立的场景评估集合

S2 必须在实现审查逻辑前**先单独提交并锁定**一份开发者自编、与 S1 锁定语料不重复的新 corpus。建议至少 **80 条**，其中：

- 不少于 24 条有完整明确来源、应出图的正例；包含至少两处不在 S1 固定目录中的新受信合成地点、至少 2 个不同视角；
- 不少于 40 条需要弃判/审阅的负例：场景身份不明、排他名单缺失、冲突、异常天象而未解释、视角相矛盾、梦境/计划/引语/旧图影响、撤权/旧图失效；
- 不少于 16 条连续变化/多回合关联：人物加入/离开、光照变化、明确复访、无变化对话与不确定去留；
- 同时设置少量**特殊世界观例外被原文明确揭示**的用例，测试非机械地把所有非常规光照一律拒绝。

语料每条标注 expected literal fields、source spans、plausibility verdict、reason、scope/revision、预期 visualVersion 和 image eligibility。开发、预留验收集合分开，预留组在实现后不可改标签；所有自编与分组、文件 SHA、commit 在独立实现 commit 之前锁定。若不能取得另一名独立标注者或外部盲评，必须如实写 `INDEPENDENT_HUMAN_REVIEW_NOT_RUN`，不能用同一开发者的自标集合冒充真实玩家泛化准确率。

回放测量至少分别统计：**字面提取正确/不必要弃判/错采；场景审查 eligible 正确/过度阻断/危险放行/合理 needs-review**。任何危险放行或跨会话错误展示为 `FAIL`。记录所有遗留问题，禁止为了绿灯修改锁定负例或隐藏红灯。

## 五、工作包 C：15–30 分钟目标的离线连续试玩切片（无本机 TCP）

构建一个**纯进程内的合成会话驱动**（例如 `packages/first-play/test/s2-story-slice.mjs`），至少 15 个按顺序保存的合成剧情修订、3 处不同地点，并具有明确的时间/人物变化。与普通角色卡协议一致的数据结构由独立测试宿主提供，不能伪称真的使用九霄 PG、Cookie/Chrome。

逐回合按以下链路进行：

```text
合成九霄 completed-history 形状的受信回执
  -> createEvidenceReplay(scene-evidence/2，隔离状态)
  -> visual-consistency/1 审查（含 inherited evidence 核验）
  -> chooseFrame / 当前图资格
  -> I1 OpenAIImageProvider 的纯本地 fake transport
  -> I2 独立 mock grant/发送前持久占用（绝不打开 live）
  -> ImageTasks/Originals 保存合法 mock PNG 为 pending
  -> 明确模拟独立审阅，accepted 后展示/复用或用于受控 edit
  -> 人物到场/离开与别名复访时检查旧图失效和历史归属
```

注意 S1 当前 `packages/openai-image/prompt.mjs` 的原构造器会**拒绝 v2 新地点**：S2 应新增**明确 versioned、test-only 的桥接与身份绑定**，不偷偷放宽生产 Provider 的来源检查或将 `scene-evidence/2` 设为默认。若要变更生产入口，提出单独放行任务，而非本轮隐式迁移。

切片至少要证明：首场景的合成图 pending→人工模拟 accepted；人物从 N 到 N+2 的参考编辑需要新的 mock 图片 grant/外发许可；普通交谈 reuse 为 0 新图调用；未知人物去留立即隐藏当前图；切换异地不串图；回到原地需有可核的复访证据；迟到返回只能归属原 attempt；拒审后图不可展示也不能成为参考。**所有模拟图字节只是 PNG 格式测试件，不能据此宣称生成图真的保留人物/建筑或已具真实视觉质量。**

若当前测试替身无法严谨支持完整 ImageTasks PG 事务，明确分开每个子链路边界及其 `MOCK_ONLY` 限制；不能写成“九霄数据库全链路已通过”。

## 六、零网络回归、环境边界和费用边界

本轮当前执行环境可做的测试尽量全量执行并保留真实结果：

- S1 102 条原测量与 13 个额外边界；原样保留 LOCKED SHA `6a6e15a44cb8d6385e38d0e582b8814233fc7b15607f7e6940950b4034ffe249`、`scene-evidence/2` `replayOnly:true`；
- 旧公共契约 10/10、L3 30/30、旧 65 条、P01 7/7、L1/L4 假传输各 15；
- I1 67/67、I2 40 项及其跨进程崩溃/重开/独立许可和旧 I2 `LIVE_BLOCKED_COST_BOUND`；
- 新 S2 80+ 对照测量、跨字段一致性否决、可解释异常例外、至少 15 回合、PNG 原件保存与审阅以及无图/旧图失效；
- 原生 Windows loopback HTTP/Chrome、九霄 CardImportService↔真实 PG↔映界投影、YJ-13 22 和 L4R 23 项全标 `ENV_BLOCKED / NOT_RUN`（直到 Issue #1 合法解决）；**不要反复运行旧 TCP 探针**。
- 本轮 OpenAI 模型查询、文字、Images generate/edit、外部图片工具调用均 **0**；不打开 API Key 页面，不产生费用，不触碰旧 L1/L4 任何可能送达账本。

## 七、交付与验收

提交独立源文件、锁定语料、真实禁网测试、回归回执、风险记录：

- `packages/first-play/visual-consistency.mjs` 或等效版本化规则及 80+ 项新样本；
- `packages/first-play/test/s2-*.mjs` 的整段场景、图片模拟收发/待审/引用/隐藏与图片适配器测试专用桥接；
- `docs/reports/YJ-P03-S2-scene-consistency-slice-report.md`；
- `docs/reports/evidence/YJ-P03-S2/` 的脱敏 `measurement.json`、`story-slice.json`、`regression.json`；
- README、docs/handoff.md、docs/task-sequence.md、docs/verification.md、docs/decisions.md、CHANGELOG.md、回退说明、完整 HEAD 与本地状态。

验收状态：

- `P03_S2_OFFLINE_PASS`：独立锁定语料满足安全预期，危险出图和错账户错场景展示为 0，离线 15+ 修订链及审阅/复用/edit/隐藏均实测通过；原有回归保持且新真实请求为 0；
- `PARTIAL`：仍有实质错采、危险放行、未通过回归、连续性缺证据或验收样本不足；
- `ENV_BLOCKED`：原生 PG/Chrome 未运行，**与 S2 纯离线 PASS 独立**；
- `LIVE_BLOCKED_COST_BOUND`：I2 真钱门禁仍未放行，**不允许报告真实生成或编辑 PASS**。

完成后先向道主汇报阶段证据；下一阶段的生产 `scene-evidence/2` 切换、真实项目 API 权限、正式预算/图片数据外发及实际生成/编辑 **全部需要单独批准与实际集成验证**。不得默认升级为 production-ready。

### Codex 汇报模板

```text
道主，YJ-P03-S2：P03_S2_OFFLINE_PASS / PARTIAL

分支、最终本地与 GitHub HEAD，工作树：
S1 原 102 条和 13 检查是否保持，v2 是否仍 replayOnly：
S2 新标注语料数量、冻结提交、标注者独立性及其限制：
危险放行/正确审阅/合理阻断/过度弃判各数：
P30 夜间日光、P50 正午月光及已揭示例外如何判定：
不少于 15 回合的跨地点故事切片：文字来源、图任务、pending/accepted/rejected、reuse/edit/hidden：
有无使用真正的 PG/Chrome/角色卡，没用就明确 MOCK_ONLY：
旧 I1/I2/P01/L3/L1/L4 回归真实结果和未运行项：
旧 L1/L4/L5/L5B/I1/I2 状态是否保持，默认生产路径是否变化：
模型 GET、文字、Images 生成编辑、图像工具真实调用是否均为 0，实际费用是否 0：
源代码、语料、完整回执、报告、回退与 GitHub 提交：
```
