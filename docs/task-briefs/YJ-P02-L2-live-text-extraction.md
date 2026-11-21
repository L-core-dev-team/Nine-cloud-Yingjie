# YJ-P02-L2｜首次真实 Luna 正文的只读语义审计与离线提取改进

- 编制：2026-11-21（北京时间）
- 状态：**本文件为执行任务书；L2 业务执行、离线回放、原正文分析尚未进行**
- 仓库：`quakhiak34568-lang/Nine-cloud-Yingjie`
- 独立接续分支：`codex/yj-p02-l2-real-text-extraction`
- 固定起点：`codex/yj-p02-l1-key-entry-ui@7e714c01497b83b1de42069a47862a7d51c9f863`
- 九霄上游只读：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 公共契约：`@yingjie/contracts@0.1.1`；YJ-09 提取器现为 `zh-visible-clause/2`
- **实际网络调用预算：USD 0。真实文字请求、图片生成/编辑、供应商模型查询全部禁止。**
- 一次性旧许可 `YJ-P02-L1-single-luna-text` 已用完（`ACKNOWLEDGED`），必须原样保留 `~/.nine-cloud-yingjie/yj-p02-l1/approval.sqlite`，不得清空、更换工作目录/UUID、复制新的许可去补发。

## 一、真实断点与本项唯一目标

[L1 完成报告](../reports/YJ-P02-L1-luna-text-smoke-report.md)和[脱敏真实回执](../reports/evidence/YJ-P02-L1/live-result.json)已证明 2026-11-21 的 `gpt-6-luna` **1 次真实 Responses 文本调用**返回 HTTP 200。已记录 92 输入、39 输出 tokens、按当日费率估算 USD 0.0000287。九霄的 `completed-history` 第 1 修订和映界的事件正文 SHA 一致：

`1c65286041ae74ccae956c08bdca02b3e91f9273411834c83adbd98071e23f98`

但 `extractContinuity` 返回 `not-ready`，页面保留文字、没有图片任务。不能根据 39 输出 tokens 或这个 SHA 假装已知道正文内容，也不能未经检查就断定“提取器 bug”或“Luna 写得不够详细”。

**目标：在不调用任何真实模型的前提下，从当时已保存的原始文本做可复验的只读诊断，区分“事实本身不足，应该 abstain”和“事实充足但有限中文解析漏掉了可知事实”。只在安全且证据明确时做小范围离线改进。**

### 成功判定分支（不能强迫出图）

1. **正确 abstain**：该正文没有足够明确的当前地点、当前在场人员或视角等必要已知事实；`not-ready` 符合剧情优先与宁缺毋滥。交付真实理由与未来提取/输出所需信息清单，**不得为这条文字强行输出 ready**。
2. **可证明的识别缺口**：正文已经明确支持某些事实，但 `zh-visible-clause/2` 不认识句式、分句边界或对话范围。编写有根据的最小版本化改进；不凭推测补人、补灯、补建筑、补地点。
3. **原件已不可访问**：只有 SHA、回执和代号，无法从受信的原九霄测试库读到准确正文。此时应保留 `SOURCE_UNAVAILABLE`，不得根据模拟的 `walkthrough[0]`、编写另一段文本或向 Luna 重新请求来冒充原始输入。可仅完成现有规则的离线测试/文档，但不可声称已经解释了这次 `not-ready`。

## 二、只读获取原正文，不读取私人目录

先确认当前远端 HEAD、工作目录和本任务书，保留未提交成果。阅读：

- `AGENTS.md`、`docs/handoff.md`、`docs/reports/YJ-P02-L1-luna-text-smoke-report.md`；
- `docs/reports/evidence/YJ-P02-L1/live-result.json`（**仅 SHA 与统计，不包含正文**）；
- `packages/luna-text/journey.mjs`、`ui-pilot.mjs`、`ledger.mjs`、`packages/local-demo/cluster.mjs` 和 `packages/scene-state/test/local-db.mjs`；
- `packages/first-play/continuity.mjs`、`extract.mjs`、`replay.mjs`、`README.md`、`packages/first-play/test/continuity-corpus.json`、原 65 条合成标签和相关修订。
- 九霄上游普通会话的受信历史读取与 `card_import.requests` 的 completed 行关系。

**仅针对本次 L1 受控测试目录，不能遍历整个桌面或其它本地数据库**。L1 的 `journey.mjs` 使用 `packages/local-demo/cluster.mjs::fresh()` 创建用户临时 `yj13-demo-* ` 合成 PostgreSQL 集群；live 模式停止进程但保留目录。它的 `state.json` 含临时数据库连接凭据，**不可读出、打印、提交、上传或写入诊断**；仅由已存在的受信 Node/pg 辅助代码在本机读取连接信息。首先使用原执行上下文掌握的 cluster 路径、原本的脱敏本地回执/运行记录或操作者明确给出的 L1 测试目录。如果原上下文没记录路径，仅允许在当前用户私有 temp 下按固定前缀和 fixture 标识做**文件名与必要元数据**的定向识别，不读取其他项目或真实业务数据；无法确认唯一目标时停止并报告，不能“随便挑一个”。

最佳做法：对确认归属的已停止合成库做**停写副本**，在副本中启动 PostgreSQL，只读读取 L1 会话的 `card_import.requests` 对应完成行、普通会话 history、映界 `yingjie_scene.event`、`stream`、`extraction`。不得修改原库；没有副本条件时，用只读事务/只读权限，并记录无法验证的恢复风险。禁止删除表、覆盖历史或创建新角色卡行动。

对读到的原正文：

- 用 UTF-8 SHA-256 重算，并且必须**严格等于** `1c65286041ae74ccae956c08bdca02b3e91f9273411834c83adbd98071e23f98`；结果不符就 STOP，不把另一条剧情冒充真实样本。
- 在内存中按源 `revision=1`、owner/session/action 及 saved source key 核对，严格避免跨会话；不得根据仅有的行动提示词猜测正文。
- 原正文、角色卡、玩家身份、PG 密码、API Key、session token 都**不上传 GitHub、聊天、PDF 或公开日志**。测试必要时仅使用内存/本机用户私有临时文件，结束后清除；报告以哈希、长度、审计规则、错误类别和脱敏示例描述。
- 现有 `~/.nine-cloud-yingjie/yj-p02-l1/approval.sqlite` **只读核对其一行 ACKNOWLEDGED**，不得打开改写、删除、清空或复制为新批次。不要启动 `run.mjs live`、`key-entry/launch.mjs` 或 `terminal.mjs`，不要再次要求道主输入 API Key。

## 三、先做完全可复验的“为什么 not-ready”诊断

在**不修改提取器**时，对原始正文和同一事件之前的权威场景状态执行旧版本 `extractContinuity`：

1. 核对输入实际为 completed-history 而不是玩家 action、fake 生成文本或视觉提示。
2. 保留审计的 `method`、分句数量、UTF-16 的 `start/length`、`rule`、操作及结构化 `unknown reason`；不能把未识别的句子原文复制进 GitHub。
3. 判断阻断属于以下哪一类（可以多类，但需逐一证据）：无初始地点/场景基线；缺确凿在场人数/完整可见调查；缺结构、视角、时段等；包含当前与回忆/愿望/推测混杂；分句拆分或 Unicode 标点问题；人物句式/别称不在当前白名单；引用范围或否定句误识别；已存入 PG 的事件状态丢失或版本/来源不匹配；其它。
4. 将源文中的**每一个事实主张**标为：已明确当前可见、明确过去、转述/猜测/计划、含糊、不可判断；再逐字段列“有证据可设”“缺证据不可设”。标签可以由执行者初标，但不能冒称独立人工盲评。
5. 如果无足够完整当前画面事实，明确承认 `not-ready` 正确。不应为了产生一张图而补造三人、柜台、光照、隐藏房间或视角。可只给**未来新请求**的提示词改进草案，但本项零真实调用，不能改变既有保存正文。

## 四、仅在识别缺口已被实际证明时进行最小修正

优先新建**版本化提取器** `zh-visible-clause/3` 或更清楚的局部模块，而不是直接改变 `/2` 的同名语义。测试应使 /2 旧数据和旧回放仍可复现；版本切换、独立投影及审计说明必须完整。

具体原则：

- 只新增具备无歧义、当前已揭示事实的中文句型和明确词法，记录规则 ID 与原句位置。不要使用“只要提到人名就加入画面”“猜测故事中谁在酒馆”等宽松规则。
- 对小说式段落、对话、回忆、梦境、计划、否定、人物模糊离开、多地点跳转、历史复访、未知人物和世界书秘密必须保守；遇到弱证据可留空或保持待调查。
- 不能在分句匹配失败时静默改用历史上次已审画面覆盖新的不确定状态。若只确认某些已保存事实但没有完整视图，`not-ready` 仍可接受。
- 对不支持的自然语言，候选改进可以是“将来新增一个只读的受信视觉事实提取模型/结构化回执”，**但这一阶段不得调用额外模型，不得把普通文字模型输出来当已核实的事实**。
- 映界只能依据九霄已完成正文；模型结果/图片不能反向修改剧情。YJ-05 任务/attempt/原件权限必须保持原样，不能因离线修复自动派发图片。
- 如当前真实正文信息不足，不必为了提交代码制造“修复”。提交可验证的分类器诊断、用例、保守行为说明比制造假阳性更重要。

## 五、测试与验收证据

至少保留分层结果：

| 层 | 最低要求 |
| --- | --- |
| 原因重现 | 原正文 SHA 匹配、当前 /2 完全离线复现 `not-ready` 及明确 reason，或 SOURCE_UNAVAILABLE 说明阻塞 |
| 真文本判定 | 已明确事实和缺失项拆分；仅本机受控分析，不外发原正文 |
| /2 保护 | 原有 65 条合成参考、既有 /1 和 /2 的回放与历史上下文兼容 |
| 负向边界 | 计划、梦、转述、否定、含糊离场、不同地点同名、旧图撤权、尚未揭示世界书等不得产生错误已知事实 |
| 若有 /3 | 在隔离数据库里以**原已保存正文**重放，原九霄 completed-history、L1 审批账本及原投影库内容不变；审计中可追溯规则和位置 |
| 完整回归 | 公共契约 10/10，YJ-13 原 22 项至少一次、P01 禁网 7 项和 L1 当前离线 15 项（环境允许时）；失败/跳过/超时全部保留，不删除红灯 |
| 请求与费用 | `realTextCalls=0`（本轮新增）、`realImageCalls=0`；旧 L1 1 次不再增加，已确认原许可 ACKNOWLEDGED；本轮新增费用为 0 |

建议生成：

- `packages/first-play/test/luna-real-prose-replay.test.mjs` 或定向的只读工具，**禁止把原始正文直接写在版本库测试里**；可从本机特定受信目录以显式开关提供，未提供时应明确 `NOT_RUN/SOURCE_UNAVAILABLE` 而非偷偷用另一段测试文字伪装。
- 如果确有提取修正，则生成 /3 实现和与该缺口相似但**不包含原文**的合成正反例；保留旧 /2 测试及证据，说明版本迁移/回退。
- `docs/reports/YJ-P02-L2-live-text-extraction-report.md`、必要的脱敏 JSON 回执，包含原 SHA 校验、根因类别、操作数量、旧新版差异、风险与未验证项。
- 更新 `README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/verification.md`，不要改写旧 L1 LIVE_PASS 源报告。GitHub 在独立分支提交，核对本地/远端 HEAD。

## 六、状态与下一步

- `CORRECT_ABSTENTION`：原文已验证，确实缺少当前画面必要事实；现有 `not-ready` 正确，输出下一次**新授权**时可改善的新请求格式，但本轮不发。
- `EXTRACTOR_GAP_FIXED_OFFLINE`：明确表达事实的句式此前不识别；新版本离线验证修复并守住负向边界，不自动发图。
- `SOURCE_UNAVAILABLE`：无法取得可核 SHA 的原始 completed-history，不能声称知道原因；可完成静态安全准备。
- `PARTIAL / FAIL`：发现不一致、越权、旧版破坏、回归失败等；优先保护原历史。

此次不允许申请额外 API 费用或启用新的图片权限。未来可能根据离线发现再制定**全新且单独批准**的低额真实文字/图片试点，不能复用已用尽的 L1 许可。

## 七、Codex 最终汇报格式

```text
道主，YJ-P02-L2：CORRECT_ABSTENTION / EXTRACTOR_GAP_FIXED_OFFLINE / SOURCE_UNAVAILABLE / PARTIAL

接续分支与最终本地/远端完整 SHA：
是否找回 L1 原九霄 completed-history（不输出正文）：
原文 UTF-8 SHA 是否匹配 1c652860...be98：
/2 离线复现的具体审计 rule、unknown reason 与缺失事实类别：
真实正文有无足够当前场景事实（开发者初标，非盲评）：
是否需要 /3；如果有，新增的受限句式与负向反例：
原历史、L1 approval.sqlite、已有图片任务是否严格未改：
契约、65 参考句、YJ-13 22 项与 P01/L1 离线回归实际成绩：
本轮真实文字/图片调用是否均为 0：
脱敏报告、源码提交与安全回退说明：
下一次是否值得申请新的模型费用，以及理由：
```
