# 映界实施任务序列

更新：2026-11-22。

**YJ-P03-S2 已准备下一阶段任务书：** [场景跨字段语义一致性校验、独立样本与 15+ 合成修订图片流程](task-briefs/YJ-P03-S2-scene-consistency-slice.md)。S1 102/102 的证据限于锁定合成语料；对夜间日光、正午月光等组合，S2 要在不改原标签的前提下单列入画资格与已揭示例外。**仅任务准备，S2 代码/测试 NOT_RUN；无真实 API，PG/Chrome 仍 ENV_BLOCKED。**

**YJ-P03-S1 · P03_S1_OFFLINE_PASS。** 六个登记地点、102 条预先标注回放，正确采纳 36 条、正确留空 66 条，错误采纳与不必要弃判均为 0。三个新地点已构造离线首图请求。 [运行报告、回执与复跑](reports/YJ-P03-S1-generalized-scene-evidence-report.md)

**YJ-P02-I2 · I2_GATE_OFFLINE_PASS。** 生成与参考编辑分别批准并从同一美元总额预留。40 个定向场景、跨进程竞争与崩溃恢复、148 项兼容回归通过。真实付款为 LIVE_BLOCKED_COST_BOUND。 [运行报告与回执](reports/YJ-P02-I2-image-money-gate-report.md)

**YJ-P02-I1 · IMAGE_ADAPTER_OFFLINE_PASS。** Images 首图与参考编辑已完成离线适配。协议、权限与响应检查 60/60，ImageTasks 与进程恢复 7/7。输出进入待审，真实发送关闭。本机原生 PG/Chrome 验收由 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1) 跟踪。[报告与复跑](reports/YJ-P02-I1-image-adapter-offline-report.md)

**YJ-P02-L5B · ENV_BLOCKED。** 当前 Windows 环境允许 Node 监听本机随机端口，连接同一端口时返回 `connect EACCES`。HTTP、原生 Chrome、临时 PG、L4R 与 YJ-13 本轮未运行；L5 维持 PARTIAL。[实测与脱敏回执](reports/YJ-P02-L5B-loopback-closeout-report.md)

**YJ-P02-L5 · PARTIAL。** 独立零预算账本、崩溃防重、12 项内存处理测试和 7 项真实 Chrome 页面测试已通过。Windows 沙箱阻止本机 TCP，原角色卡／PostgreSQL、L4R 与 YJ-13 整链路尚待验收。真实服务调用 0，L4 继续 UNKNOWN_STOP。[报告、回执与复跑](reports/YJ-P02-L5-one-shot-recovery-report.md)

**YJ-P02-L4R 已完成离线复现与修复。** 本机未找回原进程、真实账本或收据，原 L4 继续 UNKNOWN_STOP。旧页面在两条不同失败路径上给出相同提示；新页面区分服务端受理、发送前拒绝和送达未知。[取证报告与复跑](reports/YJ-P02-L4R-trigger-forensics-report.md)

**YJ-P02-L4 · UNKNOWN_STOP。** 本人报告已点击。原页面已结束，本机未找到真实回执与专用账本。实际用量、费用及最终画面状态未知，本次核查补发 0 次。[核查结论与历史离线验收](reports/YJ-P02-L4-luna-scene-pilot-report.md)

**YJ-P02-L3 已执行。** 新契约仅在隔离回放中使用。已验证首回合场景证据和后续酒馆连续性，真实服务和图片试点仍未运行。[结果、限制与回退](reports/YJ-P02-L3-scene-evidence-report.md)

**YJ-P02-L2 已完成。** 真实修订 1 已核对，结论为 CORRECT_ABSTENTION；局部表达识别 EXTRACTOR_GAP_FIXED_OFFLINE。[报告](reports/YJ-P02-L2-live-text-extraction-report.md)

**YJ-P02-L1 已完成，LUNA_ONE_CALL_PASS。** 一笔真实文字请求已保存并读回，原单次授权已用完。[报告](reports/YJ-P02-L1-luna-text-smoke-report.md)

**YJ-P02 接续入口：** 道主已选择 OpenAI API；[专用文字/图片 API 适配与安全门禁任务书](task-briefs/YJ-P02-openai-adapter.md)已在独立分支上传，业务实现与付费请求尚未开始。具体模型、项目 API 访问权限、参考图外发和费用预算仍待确认。P01 的 OFFLINE_PASS 与 YJ-13 的 LOCAL_DEMO_PASS 均保持。

**YJ-P01 OFFLINE_PASS，真实试点 LIVE_BLOCKED。** 原角色卡在合成数据上完成生成、参考编辑和保守留空；受信授权、预留上限、信息过滤与 unknown 重开防重已通过离线检查。 [回执与 P02 放行条件](reports/YJ-P01-real-service-readiness-report.md)

**YJ-13 LOCAL_DEMO_PASS。** 完整隔离回归连续 22/22、22/22；原角色卡 35 轮、第二会话 2 轮，已实测启停、回退和 14 表配对恢复。 [运行报告](reports/YJ-13-local-demo-closeout-report.md)

真实服务试点需先落实供应商、额度、授权素材与受信后端认证。

**YJ-11 交付记录。** YJ-11 已交付本会话图片历史、独立原件核权、反馈与受信撤下。YJ-12 继续核验断网、跨设备、乱序与恢复。[YJ-11 运行报告](reports/YJ-11-image-history-corrections-report.md)

**YJ-10 交付记录**　YJ-10 本地实现与验证已完成。原普通角色卡 14 轮共 4 次模拟发送，错图被拒后连续两轮交谈均未重发。最终两次综合回归各 19/19，真实模型调用 0。YJ-11 可按资产原归属及最新授权消费审阅、选择和拒绝记录。[报告与接口](reports/YJ-10-trigger-consistency-report.md)

**YJ-09 接续记录**　YJ-09 已完成本地工程交付。原普通角色卡 25 轮同一行动，东/西村同名异地、改名复访、含糊离场后隐藏与完整调查恢复、双版本 PG 重放均有逐轮回执。65 段合成对照中新版正确采纳 39、错采 0、放弃 26。YJ-10 可接入关键事件、当前图片适用性和可知范围审计。[YJ-09 报告](reports/YJ-09-revisit-continuity-report.md)

YJ-00 已获准启动，YJ-01 已完成本地 Node 合成文字运行基线。YJ-02 工具级实验已复核，可为 YJ-03 提供样例；独立后端图片 API 接入仍阻塞且未运行。YJ-03 已交付 0.1 共用契约与原 C01–C12 离线验证；独立复核后修补包至 0.1.1，新增定向回归通过。YJ-04 已完成完整契约复跑、真实普通历史读取及 PostgreSQL 恢复检查。周数从获准启动后的时间计算，正式产品验收指标由道主后续决定。

| 任务 | 前置依赖 | 交付与完成检查 | 建议窗口 |
| --- | --- | --- | --- |
| YJ-00 启动方向确认 | 用户最新指示 | 已获准启动；草案作为工作基线，暂定与后置项保留原状态 | 已确认启动 |
| YJ-01 固定运行基线 | YJ-00 | 隔离开发副本、固定提交和锁文件；跑通现有建局、行动、文字保存和继续；确定采用哪条会话与宿主路径 | 第1周 |
| YJ-02 验证关键生图能力 | YJ-01 | 用同一酒馆验证初图、参考图更新、增加人物和返回场景；记录实际模型能力、失败与限制 | 第1周 |
| YJ-03 明确共用数据格式 | YJ-01、YJ-02 工具级样例 | 实现最小共用契约与离线正反例，分开来源、视觉版本、参考资格和结果状态；供应商专属能力保留开放 | 第1–2周 |
| YJ-04 场景身份与变化记录 | YJ-03 | 稳定地点编号、别名、视觉版本和可见变化；区分现在、回忆、计划与猜测；能从存储恢复 | 第2–3周 |
| YJ-05 图片生成与任务处理 | YJ-03、YJ-02；真实接入需获准后端接口及认证 | 首个适配器、任务状态、参考图、结果保存、有限重试和未知结果处理；查询仅在供应商实际支持时启用；校验会话归属 | 第2–3周 |
| YJ-06 映界界面 | YJ-03 | 入口、独立图片区、文字区、等待与失败状态、生图开关；先用样例开发，再接真实接口 | 第2–3周 |
| YJ-07 世界书与预设图匹配 | YJ-03 | 复用已核验的世界书与资产目录，补充地点标签、适用条件和版本；匹配失败可留空 | 第2–4周 |
| YJ-08 串通首段真实游玩 | YJ-04、05、06、07 | 真实文字结果进入画面决策，图片显示并与回合关联；关闭生图、失败和恢复都能走通 | 第3–4周 |
| YJ-09 做好返回地点与持续变化 | YJ-08 | 酒馆复访、人员增减、地点改名与状态变化；新旧图片分别归属正确状态；重复会话不串图 | 第4–5周 |
| YJ-10 调整触发与一致性判断 | YJ-09 | 关键事件判断、旧图适用性、世界书与可知范围检查、明显矛盾图片处理；保留判断理由 | 第5–6周 |
| YJ-11 基本图片历史与纠错 | YJ-08、YJ-09 | 历史图与剧情关联、简单纠错、重新生成及按会话管理；地图切换细节不在此冻结 | 第5–6周 |
| YJ-12 恢复与终端稳定性 | YJ-10、YJ-11 | 刷新、断网、重开、乱序返回、关闭后返回、移动端尺寸和历史读取的定向检查 | 第6–7周 |
| YJ-13 连续试玩与初代交接 | YJ-12 | 形成可安装或可运行的试玩版本、已知问题、未达成需求、真实调用记录与后续顺序 | 第7–8周 |
| YJ-M01 地图与探索图鉴 | YJ-13及地图方案确认 | 复用地点关系与图片历史，再确定跨尺度地图组织方式 | 后续 |

## 各阶段最需要证明的事情

第 1–2 周应当证明现有文字玩法能接到真实图片服务，并摸清参考图修改的能力。若连续性效果不足，应先调整参考图与场景表现方式，不继续堆积界面工作掩盖问题。

第 3–4 周应当形成一段完整游玩：进入地点、文字推进、发生重要变化、保存并继续。第 4–5 周重点证明“回到同一个地方，变化仍在”。第 6–8 周集中处理出图选择、纠错、失败恢复与不同终端的真实使用问题。

图片效果、完成速度和并行收益都需要这些阶段的实际结果校准；不能把一次成功示例当成稳定能力。

## 当前任务状态

| 范围 | 状态 | 实际进展 |
| --- | --- | --- |
| YJ-00 | 已完成启动方向确认 | 用户授权开始、建仓并上传计划；未决产品细项保持原状态 |
| 仓库与文档初始化 | 已完成 | 私有仓库已创建，15份文件已上传；main分支、完整文件清单与逐文件Git blob哈希核验通过，见验证记录 |
| YJ-01 | 已完成 | 独立角色卡会话两次提交、刷新恢复与 PostgreSQL 对账通过；真实模型 NOT_RUN。[运行报告](reports/YJ-01-runtime-baseline-report.md) |
| YJ-02 | 进行中；后端接入子项阻塞 | 工具级样例已复核；独立准备分支已提交 `340c8bf`，报告记录 dry-run 与本地 mock 完成，本轮未复核该批补充实验。应用直连供应商仍 BLOCKED / NOT_RUN。[图片报告](reports/YJ-02-image-capability-report.md) · [原样例复核](reports/YJ-02-evidence-review.md) |
| YJ-03 | 已完成交付；定向修补已提交 | 原报告记录 8 组通过；两处边界缺口已修补至包 0.1.1，编译、新增 2 组与原来源映射 1 组通过。YJ-04 已在完整副本补跑全部 10 组与原图核对。[原报告](reports/YJ-03-shared-contracts-report.md) · [复核记录](reports/YJ-03-evidence-review.md) |
| YJ-04 | 已完成 | 角色卡已保存历史与独立合成酒馆分别验证，事务中断、并发重放、分页和跨进程恢复通过。[运行报告](reports/YJ-04-scene-state-report.md) |
| YJ-05 | 通用部分已完成；真实供应商阻塞 | PostgreSQL、参考编辑、原件核验、并发与跨进程恢复通过。[05 报告](reports/YJ-05-image-tasks-report.md) |
| YJ-06 | 本地实现已完成；待生产集成 | 九霄原角色卡页面、模拟图片后台、桌面及窄屏浏览器联调通过。[06 报告](reports/YJ-06-ui-report.md) |
| YJ-07 | 已完成本地交付 | 三类会话世界书来源、地点授权、预设图审阅和字节核验通过；原九步流程回归通过。[07 报告](reports/YJ-07-worldbook-assets-report.md) |
| YJ-08 | 本地首段游玩已完成；真实供应商待验证 | 已保存正文提取、五类自动选择和普通角色卡页面联调通过。补充散文 4 段一致、3 段放弃判断。[08 运行报告](reports/YJ-08-first-play-integration-report.md) |
| YJ-09 | 已完成本地交付 | 25 轮复访及未知恢复、版本化重放与原流程回归通过。[报告及回执](reports/YJ-09-revisit-continuity-report.md) |
| YJ-10 | 本地实现与验证已完成 | 已确认视觉变化触发、普通交谈抑制、审阅和参考资格、可知事实过滤。[运行报告](reports/YJ-10-trigger-consistency-report.md) |
| YJ-11 | 本地工程验证完成 | [历史、反馈、纠错与资格撤下](reports/YJ-11-image-history-corrections-report.md)；替代生成等待独立请求契约 |
| YJ-12 | 定向本地验证完成；连续全量回归待稳定 | [反馈恢复与 PG/原件恢复已核查](reports/YJ-12-recovery-terminal-report.md)；综合先 22/22 后 18/22（验证码 HTTP 429） |
| YJ-13 | LOCAL_DEMO_PASS，本地合成演示已完成 | [35 轮、独立回归、启停与故障恢复](reports/YJ-13-local-demo-closeout-report.md) |
| YJ-P01 | OFFLINE_PASS；LIVE_BLOCKED | [实现、实测、纠错独立身份提案与下一轮条件](reports/YJ-P01-real-service-readiness-report.md) |
| YJ-P02 | 待开始；OpenAI 已选、完整任务书已上传 | [OpenAI API 受信 adapter、生成/编辑协议、PG 发送前门禁与授权试点条件](task-briefs/YJ-P02-openai-adapter.md)；真实调用 NOT_RUN |
| YJ-P02-L1 | 已完成 | 真实文字 1 次，图片 0 次。估算 USD 0.0000287，正式账单待核。[运行报告](reports/YJ-P02-L1-luna-text-smoke-report.md) |
| YJ-P02-L2 | 已完成 | 真实正文只读回放与局部事实审计；原、新均留空，新增真实请求 0。[报告](reports/YJ-P02-L2-live-text-extraction-report.md) |
| YJ-P02-L3 | 待开始；任务书已上传 | [完成初始视觉场景的叙事证据/字段完整性契约，真实 API 为 0](task-briefs/YJ-P02-L3-scene-evidence-contract.md)，默认 /2 不变 |
| YJ-P02-L4 | `UNKNOWN_STOP`，许可已停止使用 | [点击后核查](reports/YJ-P02-L4-luna-scene-pilot-report.md)：受信回执/账本未找到，真实送达/费用/画面仍未知，不补发 |
| YJ-P02-L4R | 离线取证与修复完成；旧 L4 仍 UNKNOWN_STOP | [Chrome/HTTP 阶段记录修复、原环境核查与回归](reports/YJ-P02-L4R-trigger-forensics-report.md)；本轮真实请求 0 |
| YJ-P02-L5 | 进行中 · PARTIAL，原生回环验收受阻 | [在独立授权与账本下复用 L4R 可靠状态，并完成全禁网模拟](task-briefs/YJ-P02-L5-one-shot-recovery.md) |
| YJ-P02-I2 | I2_GATE_OFFLINE_PASS · LIVE_BLOCKED_COST_BOUND | [真正 USD 授权、成本上界与持久 pre-send 门禁](task-briefs/YJ-P02-I2-image-money-gate.md)；真实 API 禁止 |
| YJ-P03-S1 | P03_S1_OFFLINE_PASS · replayOnly | [多地点自然中文、完整人物名单、受信地点注册及可追溯 scene-evidence/2 旁路](task-briefs/YJ-P03-S1-generalized-scene-evidence.md)，完全禁真实 API |
| YJ-P03-S2 | 待执行 · 仅任务书已上传 | [新叙事挑战、字段与语义一致性区分、15+ 修订离线模拟出图与审阅连续性](task-briefs/YJ-P03-S2-scene-consistency-slice.md)；不更改默认提取或真实收费状态 |
| YJ-P02-L5B | 环境阻塞 · ENV_BLOCKED | [在受许可的 loopback-only 环境完成本地 Chrome/PG/L4R/YJ-13 验收](task-briefs/YJ-P02-L5B-loopback-closeout.md)，不得提升公网权限或发真实 API |
| YJ-ENV-01 · Dot | 待执行；任务书已上传 | [合法确认本机 EACCES 阻断与最小 localhost TCP 能力](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/7d2badc6284174053ed3012766a79edd1346124f/docs/task-briefs/YJ-ENV-01-dot-loopback.md)；允许后移交 Codex 补 L5B |
| YJ-P02-I1 · Codex | 离线完成 · IMAGE_ADAPTER_OFFLINE_PASS | [OpenAI Images 生成、编辑离线适配、参考版权许可、费用门禁与假 PNG 响应](task-briefs/YJ-P02-I1-openai-image-offline.md)；真实 API 仍禁止 |
| YJ-M01 | 后续待开始 | 地图具体组织方式尚未确定 |

## 依赖说明

YJ-07只要求最小已有资料匹配能够返回结果或明确无匹配，不要求完成新美术资源生产。YJ-08的失败、关闭、迟到结果与归属检查属于第一次整合的一部分，不能全部推迟到YJ-12。

05、06 的共同接续分支为 `codex/yj-05-06-integrated`，实现提交 `59cf875649c9b676f59c63280bbc54b602d6b5c3`。

YJ-04 开工时的指引：先读[当前交接](handoff.md)和[YJ-03 复核修补](reports/YJ-03-evidence-review.md)，从 `codex/yj-04-scene-state` 消费[已实现的状态模块](../packages/scene-state/README.md)。原 YJ-03 成果保留在 `codex/yj-03-shared-contracts`，YJ-05 至 YJ-07 消费契约时应纳入 0.1.1 修补。项目全貌见[完整开工任务书 YJ-START-01](task-briefs/YJ-START-01-project-kickoff.md)，当前证据见[YJ-02 复核](reports/YJ-02-evidence-review.md)。YJ-03 可使用来源、参考和复用样例，但不把二者拼成真实会话到图片的联调证据。YJ-START-01 为文档编号，不增加开发任务阶段。
