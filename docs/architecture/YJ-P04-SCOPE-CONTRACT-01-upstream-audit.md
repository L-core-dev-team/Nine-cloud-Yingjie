# YJ-P04-SCOPE-CONTRACT-01｜九霄上游叙述层级来源静态核查

**核查方式：已连接 GitHub 直接读取源码，2026-11-23。没有本地九霄运行、数据库探测或新的 API 真实请求。** 与 YJ-01 2026-11-19 实测基线区分。

## 1. 固定版本

- 上游：`L-core-dev-team/Nine-cloud`，当次远端 `main@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。源码本轮均以该 SHA 读取；比早期 YJ-01 `main@cd25360c7929e10f8b2b0fad342fedd943d4f323` 更近。
- 映界：`quakhiak34568-lang/Nine-cloud-Yingjie`，H3-B2S 最终 `codex/yj-p04-h3b2s-narrative-scope@c89021c0f5cff1fa37705c9e14b7f739d74bd102`。
- 本次核查结论只对这两个固定提交有效，不保证后续上游代码或未检出分支没有新能力。

## 2. 来源能力矩阵（静态源码证据）

| 检查对象与路径 | 已证实的源码事实 | 不能由此推断 | 状态 |
| --- | --- | --- | --- |
| 九霄 `apps/api/src/card-import/service.ts` / `history(owner,id,after)` | 先校验 owner/session 存在，读取 `status='completed'`，只 SELECT `key,action,narrative,resulting_revision`，按修订升序最多 100 行 | `completed` 证明保存的是这段文本，不证明其中事件在角色卡世界的现实层成立；无逐段 `worldKind/parentFrame` | VERIFIED_SOURCE / STATIC_ONLY |
| 九霄 `apps/api/src/card-import/router.ts` | `GET /sessions/:id/history` 调用以上服务；group history 为另一条路由 | 路由没有提供 attested narrative scope API | VERIFIED_SOURCE / STATIC_ONLY |
| 九霄 `apps/web/src/card-import-client.ts` | `HistoryItem` 精确四字段；`GroupHistoryItem` 额外有 mode/participant_id/ordinal/body | 群聊发言者归属不等于叙述中的现实层 | VERIFIED_SOURCE / STATIC_ONLY |
| 九霄 `apps/api/src/card-import/schema.sql` | `card_import.requests` 存 owner/session、action、status、narrative、revision、model_snapshot；group_messages 存 participant_id/body | 当前定义未发现完整分段世界层或已证事实收据存储表 | VERIFIED_SOURCE / STATIC_ONLY |
| 九霄 `apps/api/src/card-import/context.ts` | 卡片世界书和历史参与模型上下文，卡片视为不可信导入文本 | 不能认定 model output 自报的世界层自动获上游授权 | VERIFIED_SOURCE / STATIC_ONLY |
| 九霄 `packages/contracts/src/{event.ts,turn.ts,decision.ts}` | `DomainEvent` source=`RULES/MIGRATION`，accepted `TurnReceipt` 验证事件 save/branch、规则版本、修订和请求指纹；`DecisionV2Schema` 有 accepted events | 这套原生回合收据不等于角色卡 `CardImportService.history` 逐段叙述标签 | VERIFIED_SOURCE / STATIC_ONLY |
| 九霄 `packages/contracts/src/{save.ts,world.ts}` | save v3 有 branch lineage，world state 有 player/location/elapsedMinutes/facts 字段 | 泛型 `facts` 或任意 event payload 不能自动证明任意自然语言片段的世界层 | VERIFIED_SOURCE / STATIC_ONLY |
| 映界 `packages/contracts/src/schema.ts` | `fromCardHistory` 只读四字段并将 `evidence="completed-history"` 写为 Source；另设 native-turn source 语义 | 同源正文的哈希不是“该段为现实”的独立证明 | VERIFIED_SOURCE / STATIC_ONLY |
| 映界 `packages/highlights/h3b2s/{scope.mjs,replay.mjs,semantic.mjs}` | 用正文正则构造 scope 栈，再根据 frame/epoch 放行现实事件；代码与 `post-held.json` 复现漏识外层后错误 `pop` 到根现实层 | 已有 frameId/parent/sha 的内部一致性不能修复错误的源叙述归属 | VERIFIED_SOURCE / FAIL_RETAINED |

**实际结论：在已读取的当前角色卡主线源码中，尚未发现可供映界直接调用的、服务端独立认证的“段落属于哪个叙事世界层”回执。** 这是**证据缺口**，不是断言所有九霄分支/隐藏接口必然不存在。

## 3. 《套戏》的严格区分

- 角色卡的 `completed` 修订已经保存原文，可核 sourceKey、revision 与 SHA，故来源 **VALID**。
- 第 3 修订“布偶的影子占满了幕，演的是下一折”实际表示进入外层演出，但当前研究解释器将其继承到 `current-reality`。
- 第 4 修订“戏里军师开始推演”进入内层 `hypothetical`，错误父层是 `current-reality` 而非 `staged-performance`。
- 第 7 修订“推演到此为止”退出 `hypothetical` 后直接回 `current-reality`；第 8–9 修订相同人物、物件、承诺和交付被确认。附加复现有实际错误现实入账 **1** 条。
- 正确的权威叙述路径应为 `root-reality → staged-performance → hypothetical → staged-performance → root-reality`；**最后一次返回必须有独立外层演出结束证明**。现在只有本地文本解析给出的假框架，不能因为父/子 ID 生成成功而视为独立证明。

## 4. 权威来源设计的待核问题

在将来提出九霄 API 改造前，需要上游负责人明确：
1. 哪个组件有权签发 `frameId/parentFrameId/worldKind`？它是否有比同一自由文本模型更可靠的结构化输入/状态依据？
2. 角色卡会话是否愿意将每次回答分解为经过验证的 span 与 frame 转移，与 `completed` 结果**原子持久化**？失败时是否整回合不提升事实？
3. 现有用户故事正文、早期旧会话、多模型卡/群聊、导入世界书如何兼容？历史没有回执时是 `unknown` 而非默认现实吗？
4. 如果只把模型自报标签作为 `proposal` 存储，谁负责 `attest`？如何防止客户端/素材/不可信卡注入 `verified=true`？
5. 上游原生 `DomainEvent` 的规则事件哪些明确可映射为实质世界事实，映射条件如何绑定 save/branch/revision？与卡会话之间是否根本无桥梁？
6. 上游认证用现有服务身份、持久化收据还是未来签名结构？**哈希可验完整性，不验授权者与语义正确性**。
7. 若无法在当前自由角色卡模式形成权威 scope，映界应只提供文本待核/继承已可信视觉状态，不应把无证明片段升级为现实事实，也不能宣称产品功能全部达标。

## 5. 本轮未验证项

`NATIVE_CARD_SCOPE_RECEIPT_NOT_VERIFIED`，`UPSTREAM_CARD_NATIVE_BRIDGE_NOT_VERIFIED`，`ACTUAL_SCOPE_TRUTH_SOURCE_NOT_ESTABLISHED`，`INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN`，`PG_CHROME_END_TO_END_NOT_RUN`，`REAL_MODEL_AND_IMAGE_NOT_RUN`。

本报告只是源码静态审查，不包含任何新的 API、数据库表、签名机制、承诺由九霄新增接口或生产接入的证据。下一步需要独立授权上游团队参与接口评审与实现，才能解除核心缺口。
