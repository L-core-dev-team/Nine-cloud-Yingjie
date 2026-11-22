# YJ-P02-L3 · 首回合场景证据

2026-11-22。在 `codex/yj-p02-l3-scene-evidence-contract` 的准备提交 `dea254405455feaf33b49e3af38b1e93b5c5f456` 上实施。固定九霄上游为 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。源文本来自原角色卡页面保存的合成正文。真实模型生成质量、真实图片、生产集成均为 **NOT_RUN**。

## 首回合的证据如何成立

普通角色卡的已认证历史端点提供 `completed-history`。投影按 owner/session/key/revision 串联行动和回执。`scene-evidence/1` 在全新隔离投影中读取修订 1。每份初始审计绑定来源、修订、应用 `trim()` 后的正文 UTF-8 SHA-256、规则名、UTF-16 的 start/length、当前性和玩家可知性。可按 scope/revision 对照事件的 `raw_text_hash`、`normalized_text_hash` 与已保存正文。字段索引指向审计中的证据位置。称为完整的字段只表示有足够依据填写该项，例如结构字段登记眼前明确描述的结构，并不声称整栋建筑已经测绘。[规则](../../packages/first-play/scene-evidence.mjs)

| 目标 | 来源与弃判条件 |
| --- | --- |
| sceneId、name、parentSceneId、aliases | 第一句必须明确到达区域内的具名地点。由受信的合成地点索引解析区域与名称，区分两村同名酒馆。初始别名为空。未登记的组合、仅有名称、事后才到达或多个地点均弃判。 |
| viewpoint、perspective | 同一玩家明确站在哪里、朝哪个方向观察。观察位置和方向分别入账，共用可核对的整句证据。 |
| people | 明确环顾且排他地列出全员时才能写全名单。仅列出可见成员时标记 partial。人物去留含糊或名单有重复均不能建立画面。 |
| features、fixedFeatures | 从当前明确可见的结构读取名称。只有原句也明确固定性才登记固定结构。本版只接纳限定的结构句式。 |
| timeOfDay、lighting | 分别要求明确时段和当前可见光源；两者各有证据。日光不能替代时段。 |
| source、visualVersion、decision | 来源和修订由受信历史适配器产生，`project` 通过既有 `currentFacts`、场景与视觉 schema 检查六个视觉字段，生成 V1 或后续版本。本实验关闭图片发送，完整状态的决策仍为 skip。 |

初始审计对每项记录 complete / partial / unknown。任一必需字段不完整就只保存审计和弃判原因。整段中有引语、梦境、回忆、计划、否定、未揭示内容、冲突或无法识别的语境时，保留分句位置并撤销当前事实资格。玩家行动、旧图、提示模板与模型自报 JSON 均无权补足字段。后续酒馆回合沿用已保存的完整基线和原 `/2` 连续性规则。在该旁路中，后续回合不能通过 `/2` 新建地点。观星楼的后续连续性尚未实现，超出范围时保守留空。

## 文字生成模板

候选模板按首次进入、观察不全、普通交谈与复访说明如何叙述，仅要求表达已发生且玩家能感知的事实。测试检查留白和自由叙事要求，且模板不含合成样本中的指定人物、地点、结构和时刻。状态为 **OFFLINE_PROMPT_VERIFIED**。合成回复由本地函数给出，本轮没有测量模型听从提示的概率。[候选模板](../../packages/first-play/scene-survey-prompt.md)

未来如果试验同一响应附辅助字段，仍需先保存叙事，再逐项校验来源、摘要、语境和文本范围。当前九霄普通历史没有承载独立模型字段的持久化与一致性协议，本阶段只采用从已保存正文派生审计的方案。

## 真实浏览器与合成剧情

在全新本机 PG 集群和回环 HTTP 宿主，通过 Chrome 原角色卡表单提交行动。每回合断言 HTTP 200，带原 Cookie 读回历史，核对 PG 请求为 completed、正文、键、修订与事件摘要一致。东村与西村的同名酒馆分别解析为 east 与 west，北城观星楼解析为 north-observatory。两个账户之间的历史读取被拒绝，同一人的独立会话和两个账户的相同视觉描述也没有混用目标。[脱敏浏览器回执](evidence/YJ-P02-L3/browser.json)

| 东村连续六回合 | 数据库中的结果 |
| --- | --- |
| 首次完整调查、原地谈话 | 两回合均为 ready，V1，3 人 |
| 两人明确到场 | ready，V2，5 人 |
| 离开、确认现场未变后复访 | 离开时 not-ready；复访恢复同一 V2，5 人 |
| 去留不明 | not-ready，当前视觉留空 |

23 种不合格首回合各自经过角色卡页面保存，包括行动声称地点但正文缺失、只列在场成员、缺视角、结构、时段或光照、非当前语境、不同村的同名地点、旧别名、JSON、错误旧图和未知人物去向。全部留空。共核对 32 个合成回合。在第二个空投影库中按历史重建六回合，结果与审计逐条相等，再同步新增 0 条。L3 浏览器实验图片 task / attempt / send 均为 0。既有完整回归在各自的临时库中另行执行历史 mock 图片断言。[独立合成文本和预期](../../packages/first-play/test/scene-evidence-fixtures.mjs)

## 验证结论 · OFFLINE_PASS

| 检查 | 本轮实测 |
| --- | --- |
| 公共契约 | 10/10 |
| 新契约正反例与模板、原提取规则 | 新测试 26/26，与原测试合并执行 30/30 |
| 历史 65 条 | `/3` 与 `/2` 的规则证据、操作逐项一致。`/2` 无错误接受，reference 批次有 1 条不必要弃判。`/1` 的 continuity 批次仍有 1 条历史错误接受。 |
| P01 与 L1 禁网测试 | P01 的 7 项测试、L1 的 15 个 fake 场景全部通过 |
| YJ-13 完整回归 | 首次实际执行 21/22，随后在两个独立集群依次得到 22/22、22/22；三次均无跳过或取消。 |

保留了三项实际失败。最初沙箱拒绝连接本机 PG（EACCES），当次运行 0 项。开放回环连接后的首轮回归中，原 YJ-07 浏览器用例等待预设标签 10 秒超时，其余 21 项通过。两次独立复跑均通过，未证实偶发等待的根因。新联调脚本第一次重建第二个空库时缺少原有外键依赖 `yingjie_image`（3F000），按既有依赖顺序初始化后，重建和重复同步通过。各次结果见[脱敏回归记录](evidence/YJ-P02-L3/regression.json)。

## 离线复跑与回退

先按[本机运行说明](../local-demo.md)准备固定上游、已安装的契约依赖和四个本机路径变量。在映界根目录运行，回执使用新文件名。

```powershell
npm --prefix packages/contracts test
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/scene-evidence.test.mjs packages/first-play/test/continuity.test.mjs packages/first-play/test/initial-survey.test.mjs
node packages/first-play/test/scene-evidence-browser.mjs new-scene-browser.json
node packages/provider-readiness/check.mjs new-p01.json
node packages/luna-text/test/check.mjs new-l1.json
node packages/local-demo/check.mjs regression new-yj13.json
```

旁路通过 replayOnly 标记、既有分版本审计以及独立数据库隔离，无公共 schema 或默认宿主改动。停止选用新旁路即可回退。复核旧记录时使用对应版本，比较新规则则对空投影库重放。L3 沿用 L2 查验过的真实修订 1 弃判结果，本轮未重新读取真实正文、原投影库或单次许可文件。[L2 原始复核](YJ-P02-L2-live-text-extraction-report.md)

本轮真实文字和图片请求各 0 次，新增费用 USD 0。受限词表覆盖的是可核验的合成叙事；自由中文、自然省略、错误或不可靠的叙述仍可能让规则弃判，完整措辞本身也无法证明叙述者所言属实。此次没有评估泛化正确率。未来真实试点需另行确认模型、次数、美元预算、可外发材料和授权。
