# YJ-P02-L4R · 最终按钮只读取证与离线复现

**原 L4 维持 UNKNOWN_STOP。** 操作人报告点击，事后读取原页面得到“会话已结束”。没有现存证据把这次点击连到受信服务端的一条 POST /start、SQLite claim 或供应商响应。原调用的用量、费用、正文修订和 ready/not-ready 均未知。本轮 OpenAI 文字、图片和模型权限查询各 0，新增 USD 0。

## 原 Windows 上实际查到什么

| 核查 | 观察与证据边界 |
| --- | --- |
| 监听器与系统身份 | 在原工作区的 Windows 执行环境检查原回环端口，已无监听。此前同一任务中的启动器进程会话已返回退出码 0。当前 Node home 与当前 Windows profile 相符，旧进程无 PID/账户/home/可执行版本的受信快照可供比对。浏览器只连接回环地址，页面无法证明后端的 OS 身份。 |
| 目录与账本 | 只检查目标规范目录与原工作区已知回执。目录、SQLite 和真实回执均未找到。没有启动旧页面、打开 L1 账本、读取旧 PG 或创建替代账本。 |
| POST 与时间窗 | 旧入口没有按请求持久记录领取、POST 到达、门禁通过和受理时刻。13:02–13:12（北京时间）的三个已知 L4 工作日志属于离线测试；已知工作目录无 L4 HAR。Windows Security 和 Application 窗口日志不可读。旧页当前开发者日志未检查，自动审批拒绝了浏览器工具恢复文档操作，沿用此前已读取的页面提示。 |
| 发送顺序 | 旧实现先 inspect/gate，再建目录和收据，之后才进入 journey、arm、claim 和传输。同一机器、账户、home、代码路径且文件完整保留时，完全缺文件支持条件性 NOT_SENT_LIKELY。原进程身份和文件连续性无法验证，没有取得 REQUEST_NOT_DELIVERED_PROVEN。 |

以上分别使用本机只读观察、历史页面记录和版本化源码。GitHub 上的原回执核查材料保持原貌。[本轮取证清单](evidence/YJ-P02-L4R/historical-review.json) · [原点击后记录](evidence/YJ-P02-L4/post-trigger-review.json)

## 为什么会出现同一句话

用 Git 对象中的旧页面、脚本和 HTTP 服务端搭起独立回环服务，只注入假检查与假执行。Chrome 的第一种实验拦截最终 POST，使它没有传到服务端；第二种让 POST 到达并在服务端复检中拒绝。两次都显示旧的“会话已结束”，均未进入执行、创建存储或调用假传输。这两条不同路径均能解释原观察，无法据此选择历史根因。

修复后的同一个 POST 在服务端收到并校验后记录 `start-received`。通过复检、单次切换到 running 并落下 `start-accepted` 后，立即向浏览器刷出受理响应头。最终 JSON 随后在同一响应返回。按钮点击本身不产生“已受理”的提示。服务端能证明本次执行在传输前失败时返回具体状态；响应缺失、客户端无法确认或已有 possible-sent 时显示未知并引导只读核对。迟到的心跳不能覆盖终态。领取、检查、执行仍使用原同源、Host、随机会话、过期、密钥清理及防重检查。

## 阶段记录与停用边界

保护页面在监听之前建立专用审计文件。在按运行账户私有配置管理的入口审计目录中，以随机运行标识的 SHA-256 关联 UTC 时间及固定枚举阶段，文件以排他模式建立，每行同步刷盘。页面领取后显示相同核查编号。测试使用单独的临时目录。收据和模拟账本绑定该编号。日志不接受任意错误字符串、HTTP 头、OS 用户名、地址、正文、提示或密钥。没有阶段记录时不能逆推出“未发送”。

SQLite 的 not-sent / possible-sent 迁移仍先于传输，阶段日志不决定许可。模拟子进程在持久 claim 后直接退出；新进程读到 possible-sent 并拒绝第二次 claim。真实本机 PG/Chrome 合成回环另外核对了响应、已提交历史和场景复核的阶段顺序。本分支的旧 L4 启动器直接报告停用；权限查询助手仅接受显式注入的假传输。所有故障实验独立于真正的 L1/L4 许可、上游历史库与两个 main。

## 验证与复跑

[浏览器分场景回执](evidence/YJ-P02-L4R/browser.json) · [崩溃、租约与过期](evidence/YJ-P02-L4R/crash.json) · [回归与历史红灯](evidence/YJ-P02-L4R/regression.json)

- 新定向 Chrome/HTTP 检查涵盖旧版的两种相同提示、最终 POST 丢失、门禁拒绝、目录/收据/SQLite 故障、not-sent 中断、possible-sent 失联、已获响应但模拟 PG 提交失败、回复丢失，以及最终响应和心跳竞态。五种权限检查失败使用假 HTTP。模拟中报告的发送次数不计入真实用量。
- 90 秒租约与 15 分钟绝对时限使用受控时钟跨过实际阈值；在途检查同时经历真实的 8 秒浏览器心跳。旧测试另行覆盖重复领取、非法 Origin/Host/nonce/Content-Type、刷新、后退、pagehide、双击、原 UUID 和进程竞争。
- 公共契约 10/10，L3 原套件 30/30（含 65 条旧样本），P01 7/7，L1、L4 各 15 个假传输场景通过。首次 YJ-13 为 15/22，7 项 Chrome 导航因测试的名称解析规则误拦 127.0.0.1 而失败。保持外部连接封锁，显式放行回环后，独立新集群通过 22/22，无跳过或取消。历史 YJ-07 等待预设标签的偶发超时在通过轮未复现。
- **NOT_RUN**：原浏览器网络日志、旧进程身份复核、缺失 SQLite 的内容查询、真实供应商和平台用量核对。模拟 PG 失败不等于验证了真实 PostgreSQL 故障的每种原因。

按[本机运行说明](../local-demo.md)设置固定上游、Chrome 和 PostgreSQL 的路径。先构建契约。输出指定新文件名。旧版复现需要当前工作树的 Git 对象包含报告所述旧 L4 提交。

```powershell
$env:NODE_OPTIONS = '--require="' + (Resolve-Path packages/luna-text/test/loopback-only.cjs).Path + '"'
npm --prefix packages/contracts test
node packages/luna-text/test/trigger-forensics.mjs new-browser.json
node packages/luna-text/test/trigger-recovery.mjs new-crash.json
node packages/luna-text/test/key-entry.mjs new-security.json
node packages/luna-text/l4/offline.mjs new-card.json
node packages/provider-readiness/check.mjs new-p01.json
node packages/luna-text/test/check.mjs new-l1.json
node packages/luna-text/test/check.mjs new-l4.json --l4
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/scene-evidence.test.mjs packages/first-play/test/initial-survey.test.mjs packages/first-play/test/continuity.test.mjs
node packages/local-demo/check.mjs regression new-regression.json
```

回退只需停止使用此隔离分支。查阅旧审计时使用固定 Git 提交和既有回执；即使后续只读取证改变判断，旧 L4 许可仍然停用。
