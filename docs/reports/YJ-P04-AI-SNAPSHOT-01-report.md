# AI-SNAPSHOT-01 真实文字试点回执

后续独立 Codex 对话已取得九份首答。听雨酒馆三帧完整通过，装订室与值房的连续投影中断。Luna API 仍为 `LIVE_BLOCKED`。[九份实际场景文字与冻结评分](YJ-P04-AI-SNAPSHOT-01-dialogue.md)。

**LIVE_BLOCKED。** 2026-11-24 北京时间，从授权提交 `b5e69db80f18432c9e2546733f5a4192a28dba9f` 实际执行真实入口。首个阻塞发生在发送前。没有收到任何真实模型场景候选。

| 独立会话 | R1 实际文字 | R2 实际文字 | R3 实际文字 |
|---|---|---|---|
| A 听雨酒馆（已公开） | NOT_RUN，无输出 | NOT_RUN，无输出 | NOT_RUN，无输出 |
| B 石渠装订室（新编） | NOT_RUN，无输出 | NOT_RUN，无输出 | NOT_RUN，无输出 |
| C 盐井值房（新编） | NOT_RUN，无输出 | NOT_RUN，无输出 | NOT_RUN，无输出 |

每一槽的原文 SHA-256、待发送请求 SHA-256、字节数、运行状态及空候选均见[实际预检回执](evidence/YJ-P04-AI-SNAPSHOT-01/preflight.json)。三个组的实际名单人数、布景、变化、排除项和字段正确率均无法测量。A 的旧正则基线为 0/3 就绪、24 项未确认，此次没有运行旧实验，无法计算相对提升。独立人工审阅为 `HUMAN_REVIEW_NOT_RUN`。

## 发送前检查

- 当前进程、Windows 用户与机器级配置中均未发现 `OPENAI_API_KEY`，只检查是否存在。当前项目对确切模型的 Standard 写入权限也没有可验证记录。
- 查阅官方模型与定价文档确认 `gpt-6-luna` 支持 Responses 和结构化输出。Standard 短上下文每百万 token 的美元报价为普通输入 0.10、缓存读取 0.01、30 分钟写入 0.125、12 小时写入 0.25、输出 0.50。模型上下文上限为 1,050,000，超过 272,000 输入 token 适用长上下文费率。[模型文档](https://developers.openai.com/api/docs/models/gpt-6-luna) · [官方价格表](https://developers.openai.com/api/docs/pricing?latest-pricing-expanded=true)
- 已冻结最多 9 笔、每笔输出 3,200 token、序列化请求至多 16,000 字节。实际九个请求是 3,407–3,973 字节。按计划的 24,000 输入 token、最贵短上下文写入和输出限额算，每笔为 USD 0.0076，九笔为 USD 0.0684。这是**有条件的计算**：输出上限包括推理 token，但正文与 JSON 的字节数没有独立证明服务端封装后的计费输入上界，项目的全部适用收费和不确定响应的费用边界也未核实。没有用本地字节估计、预算提醒或缓存折扣放行。[Responses 参数](https://developers.openai.com/api/reference/resources/responses/methods/create) · [费率与条件记录](evidence/YJ-P04-AI-SNAPSHOT-01/pricing.json)
- 核查了本任务固定用户目录下的专用账本位置。未发现真实账本，本次没有创建、占槽或外发。真实 POST 尝试／成功／失败为 **0／0／0**；NOT_RUN **9**；模型 GET **0**；返回 token 无，供应商用量回执无，预留 **USD 0**；本次推理产生的费用 **USD 0**，项目账单未核对。图片、真实玩家资料与外发合成正文均为 **0**。

## 冻结与可复跑工作

[冻结提交 `e1de1fb`](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/e1de1fbd58131a0ee9f18692b930e5ef04d7164a) 在实测前锁定 B/C 原文、逐帧金标、评分器、提示、严格响应结构、模型与输出额度。A 直接读取原输入，金标单独供运行后比较。B/C 由同一执行者编写和标注；独立于请求输入，尚无独立人工盲评。

请求仅包含固定提示、响应结构及本组截至当前修订的正文。三个会话分开，无前次模型内容回灌。候选含当前值、增删或延续、可见性、排除层和精确引文。程序按同组修订定位唯一 UTF-16 范围，检查变更依据、前态身份及集合差量；人数只由完整名单导出。可保留部分名单和未知，也可表达确认无人。字段状态与差量派生的摘要仅用于候选比较；原文中存在引句仍不足以独立证明其语义。正式场景资格与派发均为 false。

账本使用本轮唯一批准 ID、固定模型与费率配置摘要、时限、固定顺序槽、实际请求摘要和整数 nano-USD。SQLite 以 BEGIN IMMEDIATE 在传输前独占预留并落盘；未决、失败或未知占用不返还。真实账本地址与工作树无关。仅 fake 可以使用测试专用文件，未读写旧 L1/L4 许可。首次真实预检退出码 2 已保留。

| 已执行命令 | 结果 | 退出码 |
|---|---|---|
| `python -B packages/ai-snapshot-pilot/run.py --live` | 发送前 LIVE_BLOCKED，九槽均未进入传输 | 2 |
| `python -B packages/ai-snapshot-pilot/test_pilot.py` | 9 个禁网用例通过，涵盖 9 槽及第 10 槽、并发争用、崩溃重开、金额、拒绝、超时、错档错模型、截断或缺用量、伪来源、部分名单和禁止图片通道 | 0 |
| `node --permission --allow-fs-read=* packages/first-play/test/s2-measure.mjs` | S2 100 条，错误放行与不必要阻断均为 0 | 0 |
| `node --permission --allow-fs-read=* packages/first-play/test/trigger.test.mjs` | 4/4 | 0 |

[定向检查与兼容回执](evidence/YJ-P04-AI-SNAPSHOT-01/offline.json)。fake 的返回仅验证流程。R1–R3 模型候选、引用蕴含、跨回合语义连续性及人工复核均未验收。

## 接续与回退

真实恢复条件为受信本机进程可用的本人凭据、项目对 Luna Standard 的权限证据、以及针对冻结请求可复核的全费用上界。凭据只由本人在受保护的本机输入；本轮没有要求把密钥送入聊天。保留同一个批准 ID、同一账本及已冻结实验；跨费率日须重新核实费率和窗口。回退可检出授权提交或在任务分支 revert 本轮提交。保留任何已产生的私有账本与原始回执。I2 仍为 LIVE_BLOCKED_COST_BOUND，历史评测和生产入口沿用原结果。
