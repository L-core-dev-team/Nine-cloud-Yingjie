# YJ-P03-S1｜从固定酒馆扩展到多地点叙事的可核证场景提取（离线阶段）

- 日期：2026-11-22（北京时间）
- 任务归属：Codex，映界**场景理解/剧情→图片事实**轨道，不是新的 API 支出或 Windows 环境排障
- 分支：`codex/yj-p03-s1-generic-scene-evidence`
- 基线：`codex/yj-p02-i2-image-monetary-gate@146f782aab1dd90dc7118a53fb14e88faafed4cf`
- 九霄原角色卡只读上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 状态：**只创建任务书；P03-S1 源码和测试 NOT_RUN**
- **明确禁令：**本轮不读取 API Key、不访问 OpenAI 模型权限/文字/图片 API，不产生费用。L1 `ACKNOWLEDGED`、L4 `UNKNOWN_STOP`、L5 `PARTIAL`、L5B `ENV_BLOCKED`、I1 离线通过和 I2 `LIVE_BLOCKED_COST_BOUND` 保持不变。不修改九霄/映界 main、不删除或迁移旧投影与审批账本、不接触万卡阁或真实私人剧情。

## 1. 为什么现在推进场景泛化，而不是继续叠付费门禁

I1 已有 Images generate/edit 协议的离线适配，I2 已有单独图像授权和模拟美元预算的持久发送前门禁；但真实价格最坏上界、账户权限及本机 TCP 仍未获确认。继续重复包装“马上可真实生图”没有证据。

另一条更直接影响游戏体验的缺口：`packages/first-play/scene-evidence.mjs` 的 `scene-evidence/1` 是 replayOnly 的合成首回合试点，只认识东村/西村青石酒馆和北城观星楼，固定人物称呼、结构与若干完全匹配的中文句式；后续连续性只支持部分原酒馆。I1 的 `packages/openai-image/prompt.mjs` 因依赖现有已保存文本回放，也继承这些限制。L4/I1 曾报告“事实完整的自然同义改写被不必要弃判”，不能据此宣称支持玩家自由探索。

**S1 目标：在不引入未经验证的模型判断、不更改玩家已经写入九霄的文字、不虚构场景内容的前提下，将“从 completed-history 拿到当前可见事实”的路径扩展到多个已登记场景和更多自然中文表达。** 至少能稳妥识别新场景中的地点、视点、方向、排他人物名单、结构、时段、光照；事实不完整或范围不明时继续 not-ready。

不以这项工作宣称已解决通用自然语言理解、人物视觉一致性或模型出图效果。

## 2. 必须复用且保护的仓库结构

先核对远端 HEAD、工作树及基线文件。开工必读：

- `AGENTS.md`、`docs/requirements.md`、`docs/handoff.md`、`docs/decisions.md`；
- `packages/first-play/{scene-evidence.mjs,extract.mjs,continuity.mjs,replay.mjs,story.mjs}`、对应 test/fixture；
- `packages/scene-state/{project.mjs,store.mjs,schema.sql}`、`packages/contracts/src/`；现有 `Scene/Visual/Fact` schema 0.1；
- [L3 场景审计报告](../reports/YJ-P02-L3-scene-evidence-report.md)、[L2 实文弃判分析](../reports/YJ-P02-L2-live-text-extraction-report.md)、[YJ-09 65 条样本与 25 回合](../reports/YJ-09-revisit-continuity-report.md)；
- `packages/openai-image/{context.mjs,prompt.mjs}`，I1 [离线协议回执](../reports/evidence/YJ-P02-I1/verified.json)；
- [I2 货币发送门禁报告](../reports/YJ-P02-I2-image-money-gate-report.md)；
- [Issue #1 环境阻塞](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)，本阶段不得继续用相同 EACCES 探针循环。

**保留默认宿主现行 /2 行为。** 新提取器暂名 `scene-evidence/2`，必须与 /1 分版本并且初期保持 `replayOnly:true`，测试须在新模拟内存状态/独立空库中验证。禁止用 v2 重写旧 v1 审计、旧版 PG 历史或 ImageTasks 的任何已用审批；版本或来源混用时 fail-closed。

## 3. 工作包 A：场景身份不再写死在正则中

- 引入受信注入的**场景注册表/解析接口**（例如 `resolveScene({parentName,name,aliases,source})`）。首期采用开发者自编的、静态可核验登记数据，包含稳定 sceneId、parentSceneId、别名和可辨认的所在地层级，支持两处同名地点。场景 ID **不可直接由自由中文、模型 JSON、玩家 action 或猜测生成**；注册表命中且唯一才能作为身份依据。
- 至少覆盖：原东村/西村青石酒馆、北城观星楼，以及**不同类型的三处新合成地点**（例如宗门山门、竹林客舍、云海栈道）。地点名称由测试基准固定，不使用私人世界书。相同地点不同别名应指向同一稳定 ID，不同区域相同名称不得串场。
- 无登记、模糊地点、只说“那个地方”、跨场景同名、旧图自报位置、反事实地点，全部返回 `not-ready` 或待核实，不能为了强行 ready 自动新建 ID。
- 人物称呼、结构不能仅靠原 `[蓝赭绿紫...]衣客`、柜台/双窗枚举；在可审查的明确**完整调查上下文**下允许有限泛化的汉字人名、称号与结构名，并验证去重、长度、歧义。不要把“楼梯旁三人”“有人”等自动扩充为具体名单；不应将动作、容貌、隐秘信息误判为独立人物。
- 不破坏 `SceneSchema` `VisualSchema` 的来源、修订、视觉版本及固定结构语义；若需要新的可选注册接口应优先保持现有 0.1.1 schema 不变，无法兼容则单列提案并保守停止。

## 4. 工作包 B：自然中文句式与安全语境

新增更灵活、但严格以已保存正文为证的解析层；必要时分离句子边界、语境分类和字段证据提取：

- 支持同一组事实的多种**独立标注**表达，例如“我在山门前朝北看去”“从山门回望北侧”“此刻日光透过竹林”“殿中除……再无旁人”“这里还站着……”等，必须区别玩家视点和第三人称叙述；不凭隐含常识猜方位、时段、人数。
- 同一字段可来自多个不冲突的子句，但冲突则弃判，不用新句悄悄覆盖旧事实；“三名弟子”不是排他名单，“有人站在门外”不是室内完整人数。人物不能因改写顺序丢失或重复。
- 区分**当前所见**与回忆、梦境、计划、传闻、对白、小说中的引号、否定、假设、反问、未揭示世界书以及多地点场景跳转；这些不能成为可见事实。对无关但不含视觉断言的对话，可尝试安全忽略，不应因为一段普通闲谈就清空全部已确认场景。
- 遇到任意不支持/无法定域的句子，依据其可能影响的字段选择局部 `unknown/partial` 或整个 `not-ready`。**宁可多留空，不可在上一张图片、提示模板或玩家 action 中找补**。不允许由模型自己附上的 JSON、标签、评分、图片或元数据代替正文 span。
- 提供修订号、保存正文 SHA-256、UTF-16 起止偏移、规则 ID、字段 complete/partial/unknown、当前性/玩家可知与拒绝原因。每个字段的 source span 必须能在**同一完成修订的原文**逐字切片验证。冲突、遗漏和同义表达到底为何留空应能从审计看出。

## 5. 工作包 C：连续性、复访与供图片适配器消费

- 至少验证三个新地点中的**一个双回合场景变化和一个离开复访**。只有由本次 saved history 明确确认“现场没有变化”或完整重查，才能恢复前次可用版本；未知人物去留、视点变化、跨场景提及、两处同名地点、缺乏全部名单时必须留空。
- 设计 v2 对已存在 `scene-state.project` 的 `create / visit / hold / leave / set / add / remove` 安全映射；不能出现编辑后自动把旧 PNG 分配给新场景的错误。不同会话同名场景不能复用状态和资产。
- 提供给 I2 的**纯离线绑定用例**：由 v2 新场景生成可信 `Scene/Visual`，再走 I1 图片 prompt builder 的安全过滤，验证 prompt 仅包含该场景已保存、已观察的字段；无完整身份/名单或有别名混淆时绝不能触发 generate/edit 请求。可以只测请求构造或通过明确的 v2 测试入口注入，不改动 production provider/预算或默认 /2。
- 新地点尚未有已获准真实参考 PNG 时，只验证可得的初图 prompt 与 `no-reference`，不伪造“编辑参考”通过；新图仍无自动审核或真实 API 权利。
- 图片外发/真实 API 一律 0；保留 I1 `IMAGE_ADAPTER_OFFLINE_PASS`、I2 `I2_GATE_OFFLINE_PASS` 但 `LIVE_BLOCKED_COST_BOUND`。

## 6. 工作包 D：不依赖 TCP 的测量、失败与回退

当前原受管 Codex Windows `127.0.0.1` CONNECT EACCES，**必须先完成所有无需 TCP 的开发与测量**，不要因浏览器/PG 不通而全任务停止。建议：

1. 在解析器编码前建立可审查、固定 SHA 的**全新合成语料**，不少于 **90** 个标注样本，覆盖不少于 6 个不同场景（包含两个同名异地）、至少 20 条自然同义阳性、50 条负向/边界、10 条连续性/复访。每条标明 expected scene、evidence 字段、spans、ready/not-ready、预期冲突和不足理由；开发与验收样本拆分，先锁定独立验收组，避免为了通过特例专门硬编码。
2. 以 baseline `scene-evidence/1` 和 `/2` 新版本对照统计：正例正确采纳、非必要弃判、负例错误采纳、无法识别。**新版本负例错误采纳目标为 0**；任何错误接受必须 FAIL。不能只列总体通过数，必须同时列阳性假拒绝和假接受。保留本轮发现的全部红灯/修复过程。
3. 构建纯进程内 `project` 重放与 v2 独立审计，用两套空状态检查相同正文修订的幂等与场景版本。对 owner/session/revision 与历史 SHA 错误必须直接拒绝或显式留空。
4. 测试 I1 初图提示与 I2 门禁在 v2 场景中的**不调用**状态；错来源不发图、不创建新真钱 grant。图片输出仅采用 mock 构造，不生成图片、不涉及旧私人素材。
5. 回归公共契约 10/10、旧 /2 和 /1 65 条规则样本、L3 30/30、I1 67/67、I2 40 项与其跨进程、防重，P01 7/7、L1/L4 模拟各 15/15；当前环境可运行的全跑，不将历史运行数字冒充这轮。需要本机 TCP/PG/Chrome 的 YJ-13 22、L4R 23、新原角色卡真实回环测试明确 `ENV_BLOCKED / NOT_RUN`。
6. 整体默认路径不变；v2 只在隔离测试或显式 replayOnly 模式。发现语料无法安全泛化时允许 `PARTIAL`，记录具体句式、限制和后续扩展，不得为了完成擅自降低确认标准。

## 7. 交付与完成判定

请实际提交源码、测试、标注语料、反例和脱敏证据：

- 新版本的 `packages/first-play/scene-evidence-v2.mjs`（名称可调整）、受信场景目录/解析接口与测试；
- `packages/first-play/test/` 中的至少 90 条固定/盲测合成语料、parser/continuity/integration 断言；
- `packages/openai-image/` 的 v2 仅测试集成（可新建专用测试 adapter，不开启实际业务路径）；
- `docs/reports/YJ-P03-S1-generalized-scene-evidence-report.md`、`docs/reports/evidence/YJ-P03-S1/` 明确字段完整性、错采/弃判、场景版本、禁网和实际回归；
- README、docs/handoff.md、docs/task-sequence.md、docs/verification.md、docs/decisions.md、CHANGELOG.md 的准确更新，保留所有前阶段原文件、失败记录和不可修改的基线。

**`P03_S1_OFFLINE_PASS`** 仅指新规则真实离线样本满足可证明的正确性与场景版本/图片提示边界，新旧回归保持兼容，且无真实 API 请求。它不代表任意自然中文都能被模型理解，也不代表现场图片或生产 PG/Chrome 已验证。

**`PARTIAL` / `NEEDS_REVIEW`**：任何错误接受、来源混用、过度放松角色名单或状态、或遗留未能通过的兼容回归必须单独陈述。遇到本机 TCP 限制按 `ENV_BLOCKED` 与上述业务结果分层报告。

旧 /2 默认宿主、L3 v1 与已保存原投影保持；新 v2 不可悄悄成为生产默认。不得重跑已经退出的 L4 试点，不得使用旧 L1/L4 许可，**不得将当前 I2 的 mock 预算当成真实美元授权**。

### Codex 最终报告

```text
道主，YJ-P03-S1：P03_S1_OFFLINE_PASS / PARTIAL / NEEDS_REVIEW

分支、本地和远端完整 HEAD、工作树：
新场景注册/同名异地身份规则及合成地点数：
新版本 scene-evidence 方法名与 replayOnly 状态：
全新语料数量、开发/独立验收划分与语料 SHA：
正例采纳、正例不必要弃判、负例错误采纳、负例正确留空：
人物完整名单、视角、结构、时间和光照的证据位置：
复访、场景版本与未知情况下旧图隐藏结果：
v2 → I1 可信图片 prompt 是否只消费已保存正文事实：
旧 /2、L3 v1、65 样本、I1、I2、P01/L1/L4 的回归 PASS/FAIL/NOT_RUN：
原生 PG/Chrome/YJ-13 环境阻塞项及 Issue #1：
本轮 OpenAI 模型查询/文字/图片调用数（应全 0）和新增费用：
旧 L1/L4/L5/I1/I2 与两个 main 是否保持：
新代码、报告、脱敏回执、回退及后续验收链接：
```
