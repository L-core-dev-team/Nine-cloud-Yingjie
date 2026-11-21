# YJ-P01 真实服务接入准备

**OFFLINE_PASS · LIVE_BLOCKED**。核查起点为映界 `codex/yj-p01-real-service-readiness@7f381cdf258a469c4358bd6d08a6f54881afce71`，P01 离线实现为 `ec0196e267f3dd4dcde5c8a731b09509c4c8beac`。九霄只读副本固定在 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。本次为合成数据的进程内调用和本机集成。真实文字请求 0，真实图片请求 0，费用和用量均为 null。YJ-13 原分支 `2b54c28e` 的 LOCAL_DEMO_PASS 与原始证据保留。[YJ-13 报告](YJ-13-local-demo-closeout-report.md)

## 两条接面的实际位置（STATIC_PASS）

| 接面 | 固定代码的行为 | 放行真实试点前的差异 |
| --- | --- | --- |
| 普通角色卡文字 | 九霄 `CardImportService.act` 以鉴权 owner、会话及行动 key 建立 pending 请求，`modelAccess.admit` 绑定配置快照。构建上下文后调用 `model(input, signal, {owner,sessionId,key})`。超时、取消、过期请求、修订失配均受宿主检查。成功在事务内存正文并推进修订，历史接口只读 completed。 | 原 input 含指示、角色卡、已选择的世界书、历史、行动、消息和可选 persona。上下文长度截断不能代替逐项外发授权。试点需先在受信服务器选择可发片段，再生成最终 messages；卡片或世界书文字不得配置端点、权限或密钥。 |
| 文字网关与额度 | `createCardModel` 检查系统消息和角色序列，转交注入的 transport。`createCardProvider` 组合协议 transport 与受限出站客户端。本机 provider 模式需显式配置、获准 owner、未过期、凭据、固定 binding 和持久 allowance，并在发送前检查账户与 pending 请求。并发使用 PG advisory lock，次数先提交，送达不明不退款。 | 固定本机配置校验器仅接受其源码列出的 openai-chat、固定地址及代码档 `gpt-4o-2024-08-06`、`gpt-6-luna`；这是代码能力，供应商账户可用性、当前可购型号及本项目选型均未验证。此前的次数和 token 上下文控制还缺货币预算、授权素材摘要与供应商账单核对。 |
| 图片决策与发送 | `ImageTasks.submit` 核对会话、视觉目标、许可序号及 eventKey。`dispatch` 在事务内核对能力和参考，持久写 attempt 后调用 `provider.send({attempt,plan,referenceBytes})`。generate 无参考，edit 携带来源资产、SHA、审阅 ID、视觉版本、保留的人物和结构，以及受控的参考字节。 | 当前 planner 只允许 mock 且可匹配本地样例的动态画面。现有三张 PNG 与映界计划契约不能证明后端供应商支持生成、上传和编辑。真实接入须额外核对来源授权、请求字节与异步协议。 |
| 结果与归属 | YJ-05 按内部 attempt ID + requestKey 接收；本地 `returned` 必须有原始字节。文件保存器核验 PNG 并按 SHA 保存，创建资产时为 pending 审阅；随后按受信审阅结果及当前资格提供显示/参考。超时或传输异常为 unknown。 | 当前 receiver 不持久映射真实 job/usage/cost，也没有通用远端下载器。本机 SHA 对应固定样例的检查须另配真实语义审核；既有能力字段中的 query、cancel、idempotency 均不能直接对外承诺。 |

九霄源码入口见[角色卡服务](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/service.ts)、[受信模型接面](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/model-access.ts)、[本机授权和持久额度](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/local-provider.ts)、[出站装配](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/card-provider-runtime.ts)。映界侧见[图片任务](../../packages/image-tasks/index.mjs)、[计划与抑制重发](../../packages/first-play/planner.mjs)、[历史及纠错](../../packages/image-history/history.mjs)。

## P01 的可执行边界

新增模块由测试宿主显式装配，YJ-13 的默认启动入口、公共契约 0.1.1、交换版本 0.1、原 PG 表、根依赖和锁文件均沿用原版。模块中的唯一供应方为 `p01-local-fake`。它从三个受控行动与已审 PNG 中取数据，没有 URL、HTTP client、凭据读取或供应商 SDK。撤回该模块只需停止 P01 检查，原 demo 可继续使用。[适配代码](../../packages/provider-readiness/offline.mjs)

- **文字**。身份取自宿主第三参数及受信授权快照，按 owner、session、有效期与获准行动匹配。fake 只收到被批准的行动；即使输入带有系统指示、完整历史、persona、合成秘密或伪造身份也不投递这些字段。三轮 Chrome 演练中每条回复先保存为 completed-history，再核验投影正文摘要。第三轮遇到不支持的散文，保存修订 3 并进入 not-ready，没有图片 attempt。通用中文、高潮判断和开发自编语料的独立盲标仍待评估。
- **图片**。以当前已保存的事件、修订和视觉版本确认目标，再用独立批准的可见事实摘要筛选画面。fake 获得地点、人物、固定特点、昼夜、光照、视点和视角等显式字段。plan.reason、自由 change、原文、隐藏设定与整个世界书不会成为提示。参考编辑同时要求批准的文件摘要、对具体资产的 edit 用途许可、当前活动状态、accepted 审阅、相同归属、较早来源修订、实际 PNG 尺寸和原字节摘要。日志只保留参考摘要。获准本地展示本身不能授予外发许可。
- **预算**。测试宿主提供唯一批准编号、固定 owner/会话、到期时间、操作种类的合成单位上界、单笔和总额、总次数与并发数。私有 SQLite 事务以唯一逻辑请求原子占位，绑定变更、过期、任一上限缺失、累计超限或无空槽均阻止 fake 调用。文字以会话行动 UUID 去重，图像以原事件身份去重；替换 attemptId 不会建立第二笔。确认失败/拒绝保留次数与预留量，释放并发槽；未知保留槽和预留量。重开读取原记录。所有边界均按单个批准批次计算。[预留实现](../../packages/provider-readiness/reservations.mjs)
- **P02 所需的事务位置**。P01 的 SQLite 是离线验证账本。YJ-05 在进入 Provider 之前已经写入 sentAt；若只把真实授权校验塞进 send，发送前的拒绝也可能被外层保守记为 unknown。正式接入须在受信 PG 事务里合并资金预留、有效授权、当前参考资格及写前发送标记；发送前明确拒绝保留 not-sent。发送后查证失败要保留 unknown，重启只读核对，只有远端确认并且归属匹配才追加真实任务 ID、用量或费用。不得靠更换批准编号或重置本地账本恢复额度。实际账单上限还依赖可核对的最坏报价及供应商侧硬限额；无法界定最坏费用时停止发送。

## 供应商待核验矩阵

下表的状态针对未来真实服务。当前没有道主选定的供应商和获准的官方协议版本，技术配置留待核实。

| 待填项 | 状态 | 试点前应取得的证据 |
| --- | --- | --- |
| 文字协议/模型、生成端点和参考编辑端点 | UNKNOWN | 官方服务端 API、地区/账户调用权、准确模型和版本 |
| 身份验证和配置 | UNVERIFIED | 受信宿主的凭据注入方式、最小权限、轮换/失效行为、固定允许的主机 |
| 输入限制 | UNKNOWN | 上下文、提示与输出上限；图片尺寸/比例/格式、参考数量、上传方式、最大字节数 |
| 成功与失败 | UNKNOWN | 同步字节或异步 job、内容类型、状态与错误码；远端下载的来源/大小/类型边界 |
| 远端身份、查询、取消和幂等 | UNKNOWN | 哪个字段真实存在、何时签发、查询权限、幂等窗口、是否确认取消、迟到回执如何归属 |
| 费用 | UNKNOWN | 有日期与币种的官方报价，输入/输出、生成/编辑计费单位，失败/取消计费，额度和账单核对方式 |
| 数据及版权 | UNVERIFIED | 文本/图像可发送的具体范围、参考用途、留存/删除/训练条款、输出使用权、负责审核者 |
| 输出和审阅 | UNVERIFIED | 可保存的原始文件、隔离私有存储、独立语义审阅，以及拒绝/撤权后的处理 |

## 纠错替代身份提案（BLOCKED）

既有 `task.event_key UNIQUE` 表示一条已完成文字事件的原始决策；反馈命令 UUID 与受信裁决也是独立对象。现有 `replacementStatus()` 继续返回 `blocked:contract-adapter-required`。[图片任务表](../../packages/image-tasks/schema.sql) · [追加审阅流水](../../packages/image-history/schema.sql)

1. 在受信 invalidated 裁决对应的事务内，未来可创建一次 `correctionId`。拟以「scope、目标类型及资产/预设 ID、本次失效的审阅事件序号」的唯一约束去重，关联裁决与原事件、原修订、原任务（预设可为空）、资产及审阅代次。驳回反馈、历史回看、重复命令和同 SHA 的另一资产均不能创建替代授权。
2. 用新命名空间建立 `replacementRequestKey = SHA256(JSON([版本标签, scope, correctionId, 目标修订, 目标视觉版本]))`。这些字段来自服务端锁定的快照。每一纠错单默认最多一个逻辑替代请求；attempt 独立追加。发生画面变化或撤权时将旧请求停止展示，须重新审阅并授权。新结果归属该纠错单，原 task、错误图、裁决、正文和原 requestKey 保持可追溯。
3. 拟增独立纠错请求表和引用到尝试/结果的关联；旧行默认没有替代请求，不回填伪造事件。迁移前核对唯一性、索引、读取兼容及备份清单；新表需纳入停写恢复。先部署只读兼容和特性开关，再验证同一裁决并发、跨账户/会话、崩溃、unknown 不重发、迟到结果、撤权及共享 SHA；回退时先停新写、保留流水和 unknown 供只读对账。本轮无迁移、无替代发送，此提案交总集成协调。

## 当次验证与复跑

在映界根目录执行。契约编译需 Node/npm 和契约锁定依赖；本次使用既有 npm 缓存离线安装。硬隔离检查使用带网络权限开关的 Node 26.13，临时目录仅供 SQLite 合成账本。回环集成沿用 YJ-13 手册中的四个环境变量，另需本机 PG 和 Chrome。输出名须尚不存在。[环境手册](../local-demo.md)

```powershell
npm ci --offline --cache <已填充的本机缓存> --prefix packages/contracts --no-audit --no-fund
npm --prefix packages/contracts test
node packages/provider-readiness/check.mjs offline-new.json
node packages/provider-readiness/test/local-card.mjs card-new.json
node packages/local-demo/check.mjs regression regression-new.json
```

| 实际检查 | 当次结果 |
| --- | --- |
| STATIC_PASS | 读取上述固定源码、公共契约、YJ-13 运行手册及两份旧回执。原件、任务/审阅和权限表语义沿用。 |
| OFFLINE_PASS，契约与 fake | 公共契约重新编译，10/10。P01 禁网子进程 7/7、零跳过；缺授权/上限、语料未获准、资产不合格、预算耗尽及同键变体均未新增 fake 发送。两个独立连接竞争仅一笔进入；另用两个 Node 进程复核，首进程丢回包发送 1 次，第二进程重开同一账本发送 0 次。unknown 的 4 个测试单位仍占用。[禁网回执](evidence/YJ-P01/offline-final.json) |
| OFFLINE_PASS，本机 PG / Cookie HTTP / Chrome | Chrome 158.0.8127.36 在新认证集群的原页面完成 3 轮。最终这次收到 3 次 fake 文字、1 次 generate、1 次 edit。编辑输入摘要等于首张返回图，输出均经 YJ-05 私有保存及本地样例审核；第三轮保留正文、留空画面。两笔图片 attempt 的 providerRequestId、usage、cost 皆为 null。合计 10 个合成预算单位，真实 API 0 次。开发期间先行联调取得相同操作序列。[最终浏览器回执](evidence/YJ-P01/local-card-final.json) |
| 本次复跑 YJ-13 原 22 项 | 两个新认证集群分别为 **21/22**（83.910 秒）、**22/22**（77.329 秒），均无跳过。首轮 YJ-07 原场景入场时，等待“已审阅预设 · YJ-02 酒馆样例”超时 10 秒。失败点在预设标签，未观察到验证码 429；当时的画面状态和超时根因未确定。第二轮通过同一用例；没有修改该测试或放宽超时。保留首轮红灯，和 YJ-13 历史 22/22 ×2 分别计数。[首轮回执](evidence/YJ-P01/yj13-regression.json) · [复跑回执](evidence/YJ-P01/yj13-repeat.json) |
| LIVE_BLOCKED / NOT_RUN | 两条真实通道都未装载。禁网测试显式断言 Node 没有网络权限，回环集成只装配进程内 fake 并屏蔽浏览器外部请求。未申请或读取供应商密钥；没有真实回执、报价或账单。 |

源码检查与 fake 不覆盖在线提供商故障、跨主机预算一致性或真实语义审核，也未重做完整 35 轮长线或 YJ-13 冷备快照验收。

## P02 放行决定

**LIVE_BLOCKED**。须由道主选定服务/模型与后端使用权，确认可外发的文字片段和参考图及用途，确定次数、币种、单笔/总额与停止条件，指定审阅、留存与删除要求，并明确批准这批真实请求。凭据通过受信环境配置。准备齐全后另起分支，建议独立批准 1 条合成文字与 1 次生成 + 1 次参考编辑，分别验收。**NOT_RUN** 包括真实文字生成、真实图片生成/编辑、供应商查询取消与计费、真实输出盲评、手机真机及生产部署。
