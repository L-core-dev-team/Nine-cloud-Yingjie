# YJ-P02-L5 单次恢复试点离线报告

2026-11-22 · **PARTIAL**。本轮新增真实模型权限查询、文字推理、图片调用均为 **0**，新增费用 **USD 0**。历史 L1 已使用一次。原 L4 继续按 UNKNOWN_STOP 封存，送达情况、用量及费用仍未知。

| 验收范围 | 本轮结果 | 边界 |
| --- | --- | --- |
| 持久占用与进程恢复 | PASS | 两个 Node 进程同时 claim，结果 0、1。子进程以 73 强制退出，重开 SQLite 后仍锁定。模拟超时只发送一次，更换会话与 action UUID 也被拒绝。[回执](evidence/YJ-P02-L5/ledger.json) |
| 受理、清理与迟到回包 | 12/12 PASS | 内存 HTTP 直接驱动实际服务端 handler、持久账本与适配器，历史层使用替身。覆盖丢 POST、拒绝、过期、连接关闭、pagehide 清理、受理后租约过期、超过 8 秒的模拟回包、未知、已回包而历史失败、历史成功而投影失败、两种场景。含已认领邀请与同批次重开检查。[阶段与场景](evidence/YJ-P02-L5/session.json) |
| 前端提示与防双击 | 7/7 PASS | Windows Chrome 158.0.8127.36 实际执行页面脚本。文档、资源和 fetch 均由测试提供，分别检查响应头受理和最终正文，包含 lost、拒绝、过期、未知、回包待入库、ready、not-ready。[浏览器回执](evidence/YJ-P02-L5/chrome-ui.json) |
| 原生回环 HTTP、九霄角色卡、PG | BLOCKED | Chrome 首次访问本机随机端口报 ERR_NETWORK_ACCESS_DENIED。独立 PostgreSQL 实例初始化后的首次客户端连接报 EACCES。L5 未取得 revision 1、历史哈希或真实数据库投影回执。 |
| 兼容回归 | 部分通过 | 公共契约编译及 10/10、L3 30/30（含旧 65 条）、P01 7/7、L1 与 L4 各 15 项假传输通过；L4R 定向套件完成 0/23，YJ-13 完成 0/22。旧 UI 安全套件、L4 原角色卡演练及 L4R 的 HTTP 过期测试也受回环限制。[回归与首次失败](evidence/YJ-P02-L5/regression.json) |
| 真实 API 与生产页面 | NOT_RUN | 可执行入口仅接受内置假凭据，未核验实际项目权限或当日价格。 |

## 请求与审计

准备分支为 `codex/yj-p02-l5-one-shot-recovery`，准备提交为 `a8cafe5b6b4e78b91a59a67699e973335e6de534`。测试源目录以 L4R 的已提交包为起点，按 L5 基线的 123 个已跟踪包文件核查，覆盖本次改动。Node v26.13.0。GitHub 连接器用于仓库交接。

批准候选 `YJ-P02-L5-single-luna-scene` 使用独立的 mock-only 记录。它绑定官方 Responses 端点、模型、用途、固定请求摘要、核查编号、15 分钟预检期限、最多一次以及 0 纳美元预算。账本另绑定认证所得 owner、session 与原角色卡行动标识的摘要。完整请求 SHA-256 为 `81668ce88063ac40c0f1c01af0eb1b2c03a4f97c5d5e16346215418971187046`，输入界 640，输出最多 1200 token。请求关闭工具、存储、后台执行与流式输出。测试未使用真实价格，模拟回包的计费估算置空。

入口沿用 L4R 的随机本机端口、一次性邀请、Host/Origin 与同源令牌校验、CSP 和服务端复检。L5 页面仅提供只读假凭据。原角色卡路径固定选择假传输，沿用官方 HTTPS 端点、固定主机的 egress 检查与禁止重定向配置；TLS 公网握手未执行。

服务端在回送受理头以前排他创建并同步批次占用文件。随后创建执行记录，再通过 SQLite FULL 同步提交 `possible-sent`，最后才允许模型适配器提交固定正文。UI 租约和连接的关闭只撤销访问入口，已受理任务继续持有一次性取用能力。执行结束后清除缓冲区。断线的浏览器只能显示未知，最终结果通过本机账本和核查编号读取。若进程在可能发送后退出，账本保留原状态并阻止再次占用。阶段日志仅记录时间、核查编号和白名单事件。

## 场景结果

在有明确地点、视角、固定结构、时段、光照和排他名单的合成正文中，审阅器返回 ready。只说屋内可见三人时，返回 not-ready，具体缺项为 `incomplete:people`。错误地点、相反观察方向、旧图、模型自报结果和缺项正文均未建立 ready。八条定向样本里有一条事实充分的同义改写仍被保守拒绝；六条负例均被拒绝。这里只统计固定样本。

生产提取规则和审阅器未作修改。原角色卡演练脚本要求在 completed-history 回读之后核对 PostgreSQL 正文 SHA、修订、认证范围、场景证据、同一 scope 二次投影 applied=0，以及图片任务、attempt、send 全为 0。上述数据库断言在本轮仍待执行。

## 离线复跑

使用已有本机 Node、Chrome、PostgreSQL 工具和九霄只读工作副本 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。原生套件需要 `NINE_CLOUD_ROOT`、`CARD_DEMO_POSTGRES_BIN`、`YJ_PG_CLIENT_BIN` 和 `CHROME_PATH` 指向本机安装。旧 L4R 用例还需要本地 Git 中已有其历史源码。下面在映界仓库根目录执行；回执目录每次独立，已有文件采用排他创建。

```powershell
$out = New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) ("l5-proof-" + [guid]::NewGuid()))
$env:NODE_OPTIONS = '--require="' + (Resolve-Path packages/luna-text/test/loopback-only.cjs).Path + '"'
node packages/luna-text/l5/ledger-check.mjs "$out/ledger.json"
node packages/luna-text/l5/memory-check.mjs "$out/session.json"
node packages/luna-text/l5/chrome-ui-check.mjs "$out/ui.json"
foreach ($case in 'complete','nonexclusive','lost','reject','expiry','disconnect','timeout') {
  node packages/luna-text/l5/browser-check.mjs $case "$out/$case.json"
}
npm --prefix packages/contracts test
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/scene-evidence.test.mjs packages/first-play/test/initial-survey.test.mjs packages/first-play/test/continuity.test.mjs
node packages/provider-readiness/check.mjs "$out/p01.json"
node packages/luna-text/test/check.mjs "$out/l1.json"
node packages/luna-text/test/check.mjs "$out/l4.json" --l4
node packages/luna-text/test/key-entry.mjs "$out/legacy-ui.json"
node packages/luna-text/l4/offline.mjs "$out/l4-card.json"
node packages/luna-text/test/trigger-forensics.mjs "$out/l4r.json"
node packages/luna-text/test/trigger-recovery.mjs "$out/l4r-crash.json"
node packages/local-demo/check.mjs regression "$out/yj13.json"
```

本轮契约套件直接运行本机已安装的 TypeScript 编译器和 Node 测试文件。首次缺少仓库内 YJ-02 fixture，补齐后契约和 P01 均通过。另一次内存测试因 Node 权限模式拒绝 fsync 而失败，保留持久化要求后在操作系统沙箱内重跑通过。L4R 既有报告中的 YJ-13 15/22、修正后 22/22 均属历史记录。

## 运维与回退

`node packages/luna-text/l5/launch.mjs` 默认返回 LIVE_DISABLED。`rehearse` 仅启动本机一次性模拟入口，固定使用当前用户下独立的 `.nine-cloud-yingjie/yj-p02-l5-offline`。本轮实际检查使用隔离临时批次。使用 `node packages/luna-text/l5/launch.mjs status` 只读检查已有结果；在 status 后附页面上的 64 位核查编号可读取该次阶段记录。未找到证据时保留未知，不据此判断外部送达或费用。

回退时停止启动 L5，保留已有占用文件、SQLite 和阶段记录。需要撤回代码时，在本任务分支对本次交付提交执行 git revert。历史 L1/L4 账本无需参与。先补齐真实回环验收，之后任何付费试点还需道主独立批准模型、固定合成素材、最多一次和美元上限，核实当日计价、项目权限与真实传输策略，再经受保护页面最终确认。
