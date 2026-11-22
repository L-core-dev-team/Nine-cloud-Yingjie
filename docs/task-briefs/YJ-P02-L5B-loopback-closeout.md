# YJ-P02-L5B｜L5 本机 TCP 回环环境验收与 BLOCKED 项收口

- 日期：2026-11-22（北京时间）
- 状态：**仅任务书已提交；L5B 实际测试尚未执行**
- 隔离分支：`codex/yj-p02-l5b-loopback-closeout`
- 固定起点：`codex/yj-p02-l5-one-shot-recovery@94c29a1b68bb7f56626f530d3c0b1e132f15f38a`
- 九霄上游固定只读：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- **当前不批准任何真实 OpenAI 请求**：包括模型 GET、文字 Responses POST、图片生成/编辑。无 API Key、无真实供应商网络流量，费用 USD 0。
- **不批准通过提权、绕过自动审批、换不受管控的工具/环境、修改防火墙/系统安全设置、公开端口或打通公网隧道来规避沙箱。** 如果沙箱策略不允许 `127.0.0.1`，如实返回 ENV_BLOCKED，保持 L5 PARTIAL。仅在执行环境正常支持或操作者已明确授予*本机回环测试*所需权限时运行。

## 1. 来源与真正剩余缺口

先阅读：

- [L5 PARTIAL 原报告](../reports/YJ-P02-L5-one-shot-recovery-report.md)
- [L5 测试统计与环境阻塞](../reports/evidence/YJ-P02-L5/regression.json)
- [双进程竞争与 possible-sent 防重](../reports/evidence/YJ-P02-L5/ledger.json)
- [内存 HTTP 的 12 项回合结果](../reports/evidence/YJ-P02-L5/session.json)
- [Chrome 文档+fetch 全模拟结果](../reports/evidence/YJ-P02-L5/chrome-ui.json)
- `packages/luna-text/l5/browser-check.mjs`、`launch.mjs`、`pilot.mjs`
- `packages/luna-text/test/loopback-only.cjs`、`packages/local-demo/check.mjs`
- [L4R 真实回环与报告](../reports/YJ-P02-L4R-trigger-forensics-report.md)
- `AGENTS.md`、`docs/handoff.md`、`docs/local-demo.md`

L5 已证明：独立 MOCK-only 账本互斥与崩溃恢复通过；内存 HTTP 12/12；Chrome 页面通过实际脚本但文档/资源/fetch **完全由测试拦截**（7/7）；公共契约 10/10、L3 30/30 含旧 65、P01 7/7、L1 15/15、L4 15/15。

没有通过、也不能视为通过的部分：

1. **真正的 Chrome ↔ loopback HTTP**：`browser-check.mjs` 首次页面导航 `ERR_NETWORK_ACCESS_DENIED`；7 个 mode 各完成 0。
2. **真实九霄原角色卡 ↔ PostgreSQL ↔ 映界 PG 投影**：首次 PG TCP 连接 `EACCES`，没有 L5 `completed-history` 修订 1 或新 SHA。
3. **L4R 23 项真实本机回环定向检查**：0/23，外加旧页面安全检查、L4 原卡演练被阻。
4. **YJ-13 完整回归**：0/22，PG 初始化/回环连接 `EACCES`。

这次不是业务功能 23/23 或 22/22 失败，而是**环境拦截使这些测试尚未实际运行**。不要用 L4R 历史绿灯代替新的 L5B 实测。

## 2. 第一阶段：最小无密钥回环诊断，不碰现有真实项目

在当前获准执行的 Windows 环境，先运行**独立、最小、不会连公网的定向诊断**。如果执行层自动拒绝，立即 STOP，不尝试绕过策略。

- 固定只测 `127.0.0.1` 的随机 ephemeral port（必要时补 `::1` 做对照）；使用 Node 原生 `net.createServer` 和 `net.connect` 做同进程 TCP 回环。再以 Node 原生 `http` 做 GET 200 检查。记录 `LISTEN/CONNECT/HTTP` 的成功或操作系统错误码，**不打印完整本机用户目录、进程环境、Cookies、密钥、外部 IP**。
- 如网络策略允许，再将 Chrome 连接到**自己创建的空白本机临时页面**，只访问精确随机端口。捕获首次访问的 `ERR_NETWORK_ACCESS_DENIED`、`ERR_CONNECTION_REFUSED` 或超时类型。不要启用 Chrome 外部后台联网、代理绕行、公开端口。
- 独立运行一次 PostgreSQL 的临时沙箱集群端口可用性检查。首先确认 PG 二进制与凭据格式/依赖存在；不能修改现有安装、服务或已保存 L1/L4/原 PG 数据。只有在被允许的 loopback 网络下，才使用新随机临时集群/测试账号。
- 检查导致错误的具体层次：OS sandbox vs Windows security vs Node permission flags vs `loopback-only.cjs` preload 拦截 vs Chrome 的代理/host-resolver-rules。不要先假定只是单个策略；一旦因执行权限被拒，保留原错误证据，不使用其他执行媒介暗中补跑。
- 记录每个诊断的 run ID、源码 SHA、OS/Node/Chrome/PG 版本和是否执行在实际目标环境；仅脱敏。所谓“已允许本地回环”必须有真实客户端成功返回证据，不是只看到服务器开始监听。

若无法获得必要回环权限：输出 `ENV_BLOCKED` 和需要获得授权的**最小能力描述（只限 127.0.0.1 / ::1、临时端口、临时 PG/HTTP）**；不能把阻断迁移为业务失败或宣称 OFFLINE_PASS。本任务不是请求用户解除全部沙箱、禁用防火墙或扩大公网访问的许可。

## 3. 第二阶段：仅在合规回环可用时补跑

在必要权限合法可用、外部网络仍被测试封锁的环境中，使用**完整、已提交且一致的 L5 源码**及固定上游。每次创建新的临时回执目录与数据库，不覆盖旧证据。复跑顺序：

1. `node packages/luna-text/l5/browser-check.mjs` 的七个完整 mode：complete、nonexclusive、lost、reject、expiry、disconnect、timeout。必须分别核实真正的 **HTTP /start、Host/Origin/nonce、防重、stage journal、浏览器终态**，不能用全拦截脚本的 7/7 替代。错误场景不得被误报为“推理成功”。
2. `node packages/luna-text/test/key-entry.mjs` 原输入安全用例和 `node packages/luna-text/test/trigger-forensics.mjs` L4R 23 定向检查，另复跑 `trigger-recovery.mjs` 原租约、崩溃/possible-sent 不重试测试。完整记录实际 PASS/FAIL/SKIP，若项目内 testsRun 定义与 23 有差异按原回执说明。
3. `node packages/luna-text/l4/offline.mjs` 只运行原卡 mock 浏览器/PostgreSQL 参考回归，**不要运行旧 L4 launch.mjs 或旧真钱 UI**；保留 L4 UNKNOWN_STOP。
4. L5 `browser-check.mjs` 中涉及合成文字场景提取的模拟环节必须在新独立 PG 中实测；**如果项目没有独立的九霄 CardImportService + 真实 PG 联调脚本，按原 L5 taskbook 编写/修补最小 mock-only 集成脚本**，而不是把内存 history double 说成真实 completed-history。首次合成行动与结果由原九霄普通角色卡页保存，使用鉴权 history API 读回；核对 request.status completed、revision=1、SHA-256、owner/session/action key、scene-evidence 位置与 ready/not-ready（至少 complete 和非排他名册）；图片 task/attempt/send 均为 0。可用 `replayHistory` 在第二空库重复检查幂等。
5. YJ-13 完整 22 项至少一轮，出现旧预设标签 10 秒超时或新的 429 也如实保留，不能简单拉长全部超时或删红灯。需要额外一轮隔离复跑才能将偶发失败分析清楚。
6. 旧公共契约 10/10，L3 30/30（兼容 65），P01 7/7，L1/L4 mock 15/15 至少复核关键受影响项；如果本次资源允许可全量复跑。每一轮明确“本轮新运行”还是“引用 L5 先前证据”。

对可能开始真实发送的 L5 路径，必须保持 **LIVE_DISABLED**，独立批准预算仍为 0，所有 HTTP 请求都只能在 loopback 测试中使用合成响应；**绝不能把 CLI `rehearse` 当作可用真实付费入口**。

## 4. 交付、验收、回退

- **`L5_OFFLINE_PASS`**：仅在原 Chrome ↔ HTTP、九霄 CardImportService ↔ PG ↔ 映界、L4R 23、YJ-13 22（及必要安全回归）都有真实已跑且通过的证据、隔离源正确且无异常红灯时宣布。完整回归若有仍未解释的红灯，不得写无条件全绿。
- **`ENV_BLOCKED` / `PARTIAL`**：回环权限始终被拒、无法按允许范围执行测试或任何业务断言失败；写清已经完成、未运行的 exact case 数。成功的内存模拟与真正 HTTP/PG 结果分开。
- **`FAIL`**：发觉原 L5 的代码逻辑 bug，最小修复并有反向和回归测试；不能通过修改系统防火墙策略或者解除受限工具执行的方式解决。
- 保留 L1 ACKNOWLEDGED、L4 UNKNOWN_STOP、L5 mock-only 账本、之前所有原件/历史不变；不得触碰用户私人角色卡或万卡阁。
- 不创建任何新有成本额度、不开启模型权限 GET、无真实文字与图片请求，无 Key。
- 脱敏报告：`docs/reports/YJ-P02-L5B-loopback-closeout-report.md`、`docs/reports/evidence/YJ-P02-L5B/` 回执与权限阻断来源；必要的新小工具或测试只在独立分支提交；同步 README、docs/handoff.md、docs/task-sequence.md、docs/verification.md、CHANGELOG.md。核实本地/远端 HEAD 与 workspace 清洁程度。不要改两个 main 或 L5 原分支。
- 如果沙箱自动审批拒绝，必须停在 ENV_BLOCKED，**不要尝试用管理员权限、不同 shell、额外远程机器、SSH/代理/隧道等方式避开审批**。可以把需由环境拥有者明确授权的精确本机能力列成待办，不把它当作已经批准。

## 5. Codex 最终汇报格式

```text
道主，YJ-P02-L5B：L5_OFFLINE_PASS / ENV_BLOCKED / PARTIAL / FAIL

分支、最终 SHA、工作树：
执行环境是否明确允许 127.0.0.1/::1 TCP（哪些单独 LISTEN / CONNECT / HTTP 实测）：
是否出现了自动审批拒绝、是否严格停止而未绕过：
Native Chrome 7 个 mode：实际通过/失败/未运行：
L4R 23、旧输入安全、YJ-13 22：本轮真实通过/失败/未运行：
原九霄普通角色卡 completed-history 修订及 SHA、映界投影是否真实使用隔离 PG 复核：
合成模型输入及 scene ready/not-ready 是否与完整/非完整人物名单一致：
旧 L1/L4 许可不变；旧 L4 UNKNOWN_STOP 保留：
本轮真实 OpenAI 模型 GET、文字、图片请求均为 0：
任何仍阻塞的权限、日志及最低需要用户明确批准的范围：
脱敏报告、回执、代码提交、回退方式：
```
