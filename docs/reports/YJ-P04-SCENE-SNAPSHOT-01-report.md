# 听雨酒馆的三份场景文字快照

**SCENE_SNAPSHOT_PARTIAL。** 同一合成会话顺序运行三段正文，画面就绪 0/3。首帧识别到了名单候选，第三帧识别到了回忆。这两项诊断均有原文跨度。三帧都未能发布当前场景，名单人数也始终未知。[机械输出的三份原始文字](evidence/YJ-P04-SCENE-SNAPSHOT-01/snapshots.txt) · [完整 result、audit、review 与输入摘要](evidence/YJ-P04-SCENE-SNAPSHOT-01/frames.json)。

| 回合 | 实际场景输出 | 与独立预期的差异 |
|---|---|---|
| R1 进酒馆观察 | 地点未确认；当前名单、人数、设施、时段、光照、观察位置、朝向均未确认。首帧未建立视觉版本，画面未就绪。 | 应为琥洲听雨酒馆，林青、沈舟、苏禾共 3 人；木桌、长凳、油灯，傍晚灯光，从正门向北看。实际只有排他名单句命中，未被采纳。 |
| R2 继续观察 | 地点与上述七个字段仍未确认，无法给出相对上一帧的变化，无可用视觉版本。 | 应为苏禾离场，留下林青与沈舟共 2 人，其他可见字段延续。程序没有确认离场，也未建立对应的新版本。 |
| R3 回想刚才 | 地点与七个字段仍未确认。没有把苏禾列为现时人物，也没有确认留下的两人。变化无法比较，画面未就绪。 | 应延续 R2 的两人、同一地点与布景，过去三人的谈话仅属回忆。实际识别了回忆，随后整段弃判；未能证明视觉复用。 |

三帧中人物外观、年龄、衣色、家具件数与精确布局均未知。没有补入第四名观察者，也没有把未确认的名单表示为零人。

## 首次失败与归因

- **R1** 首句同时叙述进入酒馆和观察朝向，未命中整句地点或视角规则。审计的五个跨度中，只有排他名单句匹配（UTF-16 范围 [20,38)）。名单精度为 `complete`，但 `admitted=false`，对应证据 `playerKnown=false`。设施句、时段与灯光合句及末句都未解析。投影返回 `not-ready / unresolved-clause`，视觉审查返回 `incomplete-evidence`。
- **R2** 两个跨度均为 `unresolved-clause`。离场与其余在场、不变设施和视角没有被转为可提交操作，前一帧也没有已确认的场景可继承。
- **R3** 第一处跨度被排除为 `memory-or-dream`，其余三处未解析。结果是安全但无法连续出图。它只证明本例未误纳过去的苏禾，尚未证明系统有能力在混合叙述中保留当下事实。

按每段的地点、名单、名单人数、设施、时段、光照、位置、朝向八项与金标对账，24 项预期均有值，实际正确确证 0 项、错误确证 0 项、未确认 24 项。这个数字只覆盖三段指定正文。进一步提高这一样例的实用性，最小缺口是为同句多项观察及回忆后的当前事实保留独立作用域，并在有证据的场景上处理离场和不变字段。本次没有更改规则。

## 来源、复跑与边界

授权提交 `35534a120c2205674fd5dabd74bb1a1f42f6bef7`。原文、行动标签与独立金标在运行前冻结于 `6ef717c9b803c658d7dfbb6cd41e1bad59a2dbac`。[输入](../../packages/first-play/test/scene-snapshot/input.json) · [独立金标](../../packages/first-play/test/scene-snapshot/gold.json)。核对了三个正文与任务书逐字相同，以及原始审计中的正文摘要。执行器只读取输入文件，使用已有 S2 session 在受信合成目录上建立空投影；每个修订经 scene-evidence/2 和 project，再经 reviewVisualHistory 从当时全部前缀独立重放，一致后输出。当次使用已有锁定依赖和编译产物。

| 实际命令（仓库根目录） | 结果 | 退出码 |
|---|---|---|
| `node --permission --allow-fs-read=* packages/first-play/test/scene-snapshot/run.mjs` | 3 份完整 JSON，重跑字节一致 | 0 |
| `node --permission --allow-fs-read=* packages/first-play/test/scene-snapshot/run.mjs --text` | 3 份文字 | 0 |
| `node --permission --allow-fs-read=* packages/first-play/test/s2-measure.mjs` | 100 条，错误放行 0、不必要阻断 0 | 0 |
| `node --permission --allow-fs-read=* packages/first-play/test/trigger.test.mjs` | 4/4 | 0 |

[回归原始回执](evidence/YJ-P04-SCENE-SNAPSHOT-01/regressions.json)。主实验的退出码表示执行完成，场景评价以三份实际输出为准。所有实验进程禁网；模型查询、文字或图片调用、模拟图片派发和费用均为 0。原 NATIVE-FACT-01 离线 PASS、B2 40/42、NATIVE_SCENE_PREVIEW_PARTIAL / BROWSER_NOT_VERIFIED、H3-B2/H3-B2S FAIL、角色卡 UPSTREAM_AUTHORITY_GAP 与 I2 LIVE_BLOCKED_COST_BOUND 沿用历史记录。
