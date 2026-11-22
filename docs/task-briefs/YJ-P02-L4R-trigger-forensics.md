# YJ-P02-L4R｜L4 一次性输入页 UNKNOWN_STOP 只读取证与离线修复

- 日期：2026-11-22（北京时间）
- 状态：仅创建任务书；L4R 调查、编码与实测尚未执行
- 分支：codex/yj-p02-l4r-trigger-forensics
- 起点：codex/yj-p02-l4-luna-scene-pilot@75270ad14746c77c50e1ebbd2fc012e5df0a0f58
- 旧批准：YJ-P02-L4-single-luna-scene 已按 UNKNOWN_STOP 停用；L1 的 ACKNOWLEDGED 账本原样保留
- 本轮新增 OpenAI 真实文字、图片、模型查询请求 **全部禁止**。费用预算 USD 0。绝不可再要求道主输入 API Key 或点击旧 L4 按钮。

## 目标与核实过的源事实

阅读 docs/reports/evidence/YJ-P02-L4/post-trigger-review.json、docs/reports/YJ-P02-L4-luna-scene-pilot-report.md、packages/luna-text/l4/{launch,pilot,request}.mjs、packages/luna-text/key-entry/{server.mjs,entry.js}、packages/luna-text/{journey,ledger}.mjs 和所有相关脱敏离线回执。

2026-11-22 13:10（北京时间）用户报告已经点击最后执行按钮，页面提示“会话已结束。若已点击开始，请核对本机脱敏回执”。事后未找到标准 L4 目录、approval.sqlite 或 receipt-*.json；核查未补发。真实推理是否抵达服务商、用量、账单、正文与画面 ready/not-ready 均 UNKNOWN。离线合成回执的 ready 不可冒充真实通过。

代码核对：pilot.execute 在通过 inspect/gate 后，先创建 L4 目录与 receipt，再建立 SingleApproval；journey 内 ledger.arm 建立 not-sent 行，传输前 ledger.claim 原子改为 possible-sent。入口服务器仅在合法、同源的一次性 POST /start 后才进入 execute。前端对多种失败共用“会话已结束”文案，不能据此区分邀请失效、请求未抵达、受信预检拒绝与已发送后断连。

**重要条件推论：** 如果事后调查的是原来真正执行的同一机器、同一 OS 用户、同一 home/代码版本，而且文件未被移走或删除，那么完全没有目录与回执，强烈指向未进入发送阶段；但仅凭当前某个沙箱或用户名下缺文件不能证明未发送。本次 UNKNOWN_STOP 是运营停止判定，不是已经从 SQLite 读到的 UNKNOWN_STOP 行。

## 工作包 A：只读调查旧 L4 环境

1. 核对原浏览器实际连接的 loopback 监听器所在机器、进程及执行账户；核对启动器的运行版本和 Node userInfo().homedir 与后续取证使用的 home 是否一致。原进程若已消失，按 PROCESS_NOT_AVAILABLE 报告。禁止读取、上传或打印私密路径原文、OS 用户名、API Key、Cookie、登录会话或一次性邀请。
2. 只调查目标 L4 许可的规范目录和在原运行环境已知的目标回执目录；可只查看必要的文件名/大小/最后修改时间/哈希，不做全盘扫描。保留旧 L1 许可及两个项目数据库原件。找得到 L4 SQLite 时以安全只读或停写副本方式核对唯一 ID、scope、状态、收据与可能送达标记，注意 WAL 文件，不得改写任何字节。原用户项目如有真存档，严禁读取。
3. 只读检查已有日志/进程退出事件/已有本机浏览器网络日志（如存在），在有限时间窗口判断 POST /start 是否到达后端、是否经过 gate、是否创建回执、是否调用 journey、是否触发 ledger.claim。不得为取证重新启动原 L4 请求，也不得通过真实 OpenAI 查询来“测试一下”。
4. 可以在报告中提示用户自行进入 https://platform.openai.com/usage ，筛选项目和 2026-11-22 13:10 北京时间附近的已发生使用情况。统计可能延迟、聚合或只显示大于某阈值的价格；没有展示费用不能证明未调用。绝不索要 API Key 或平台账号。
5. 将结论严格分为 REQUEST_NOT_DELIVERED_PROVEN（真正证据足够）、NOT_SENT_LIKELY（条件性强推论）、UNKNOWN_STOP（送达不能排除），不可强行为了结束任务改判成功或 0 调用。即使最后证明未送达，**本次旧许可仍停用**，需要新授权才能进行下一笔真实测试。

## 工作包 B：纯离线复现前后端的模糊结束提示

所有实验都必须用假 Key、fake HTTP transport、新的私有临时账本与本机 127.0.0.1 浏览器，绝无真实 OpenAI 出站。至少复现：

- 过期邀请、重复领取、错误 Host/Origin/nonce/Content-Type、页面刷新/后退/pagehide，90 秒心跳租约和 15 分钟绝对生命周期；
- 点击检查前后窗口关闭、8 秒 ping 与 fake 模型可见性查询竞态；fake 401/403/429/超时和错误模型，不调用真正的 GET /v1/models；
- 已在页面点击“执行”但没有到达 POST /start、服务器拒绝、会话过期、inspect/gate 失败、无法创建目录/receipt、无法打开 SQLite；
- receipt 已创建但 ledger 未建立、not-sent、possible-sent、模型响应丢失、PG 保存失败、浏览器断连、进程退出；
- 双击、重复页面打开、改变 action/UUID、并发执行，全部必须保持一次性锁定和原有失败安全行为。

找出“浏览器显示会话结束而规范目录和回执不存在”的最小复现实例，并对照已知真实证据报告“能解释”或“无法证明为历史原因”。

## 工作包 C：在不降低密钥/防重安全前提下修复可观测性

- 新增无敏感信息的**受信阶段标记**，例如 invite-claimed、preflight-ready、start-accepted、gate-denied、receipt-created、ledger-not-sent、ledger-possible-sent、provider-response-seen、history-committed、scene-reviewed、stop。以单向摘要关联逻辑请求，UTC 时间戳及状态码可公开；不得记录密钥、授权头、原始合成正文、用户私有地址、进程环境变量。
- 对比旧代码，保证操作人只靠网页也能看出“检查/最终执行已受理/服务器确认未发送/可能已经发送但回执丢失”四种不同层次。前端若只知道 fetch 失败，必须显示 UNKNOWN 及只读核对指引，不能猜测 0 费用，也不能凭客户端点击宣称已发送。
- 限定能由受信服务器证明的错误码，如 INVITE_EXPIRED、CHECK_BLOCKED、START_REJECTED_BEFORE_SEND、RECEIPT_WRITE_FAILED、POSSIBLE_SEND_UNCONFIRMED；不要泄露异常堆栈。出站前可被证明拒绝，才有 NOT_SENT 结论。保留同源、CSP、随机邀请码、隐藏输入、内存密钥清理、TLS 校验、官方域名 allowlist 与额度门禁。
- 任何已经可能送达的请求，其服务端状态/ledger 必须先于网络发送持久落盘；浏览器刷新或中断不得重发。确保错误处理在受保护进程仍运行时能留下脱敏收口记录，但不能用日志把不确定送达伪装为确定。
- 对能触发旧页面误导文案的场景添加真实 Chrome 与本地 HTTP 测试；新回归要求在“后台未进入 execute”时绝无 receipt/ledger、能确定未发时明确报告，在 possible-sent 时锁定绝不重发。

## 工程验收与交付

本轮严禁重新输入 API Key、点击原 L4 执行按钮、改旧 approval.sqlite、创建新的真钱 grant 或产生新的 OpenAI 推理/模型查询。保留 L4 原报告和 post-trigger JSON 原貌，保留原真实结果 UNKNOWN。禁止更改九霄/映界 main、L1–L4 完成分支、万卡阁及任何个人数据。

运行原禁网与前端安全测试，L1/L4 15 个假传输场景、P01 7、L3 30、YJ-13 22 及新定向测试尽可能复测，分别报告 PASS/FAIL/SKIP 与已知偶发 YJ-07 预设标签超时，不通过不许标全绿。测试全程拦截非 loopback 目标，不发真实模型请求。

交付 docs/reports/YJ-P02-L4R-trigger-forensics-report.md、docs/reports/evidence/YJ-P02-L4R/ 脱敏回执、相关代码/测试、回退与再运行说明。同步 README、docs/handoff.md、docs/verification.md、docs/task-sequence.md、CHANGELOG.md。必须标清：GitHub 证据核对 ≠ 在用户 Windows 上亲自查看旧进程和文件；若无访问，列为 NOT_RUN。完成后提交独立分支并核实本地/远端 HEAD。

## Codex 最终汇报

- 分支、完整 SHA 与工作树；
- 实际检查的机器与源进程是否同一（不泄露路径）；
- 原 L4 回执、SQLite 和应用进程是否找到；
- 真实送达判定是 PROVEN_NOT_DELIVERED / NOT_SENT_LIKELY / UNKNOWN_STOP，证据和限制；
- 导致“会话已结束”的可复现前端/服务器路径与已修复缺口；
- 阶段审计、页面状态提示、心跳/并发及防重复发送的测试回执；
- 原 L1/L4 许可、PG 历史、main 是否完全保持；
- 本轮真实 OpenAI 文字、图片、模型查询请求新增均为 0，新增费用 0；
- 完成代码、证据、报告、GitHub 最终 HEAD 与仍需单独授权的事项。