# YJ-P02-L5B 本机回环验收

## Dot 核查后的单次复跑 · 2026-11-22 17:02（北京时间）

在原 L5B 工作树 `6d9fa510cb6daa75e50eb9a4ebd4a277a8a70ec5` 及其受管 Codex Windows 执行环境中运行原探针一次。源码 SHA-256 与前次 L5B、Dot 回执一致。TCP 监听成功，客户端连接同一临时端口仍返回 `connect EACCES`，探针退出码为 1，HTTP GET 未运行。Dot 在其会话中取得 HTTP 200，两份回执支持 `ENVIRONMENT_DIFFERS`；原 L5B 维持 **ENV_BLOCKED**。[本次脱敏回执](evidence/YJ-P02-L5B/post-dot-recheck.json) · [Dot 对照回执](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/85d5020e66c1e631e255ca04de548bb28ac997b0/docs/reports/evidence/YJ-ENV-01/loopback.json)

本次 L5 原生 Chrome 7 项、L4R 定向 23 项、旧输入安全 11 项、YJ-13 回归 22 项均为 NOT_RUN。没有启动临时 PostgreSQL，completed-history 修订、正文 SHA-256 与映界投影均未取得。收到 EACCES 后停止，没有第二次探针或权限变更。真实模型请求 0，新增费用 USD 0。

2026-11-22 · **ENV_BLOCKED**。L5 保持 **PARTIAL**。在当前受管 Windows 上，Node 在 IPv4 回环随机端口成功监听，同一进程发起的首次 TCP 连接收到 `connect EACCES`。已按门禁停止。[脱敏运行回执](evidence/YJ-P02-L5B/loopback.json)

| 步骤 | 本轮状态 | 观察 |
| --- | --- | --- |
| TCP LISTEN | PASS | `net.createServer` 在 `127.0.0.1:0` 收到 listening 事件 |
| TCP CONNECT | FAIL | 原生 `net.connect` 使用同一监听器分配的端口。系统调用返回 EACCES，未收到对端测试数据 |
| HTTP LISTEN / GET 200 | NOT_RUN | TCP 前置检查已被拒绝，探针关闭监听器并以状态码 1 退出 |
| Chrome 空白本机页、临时 PG 端口 | NOT_RUN | 没有启动 Chrome 或 PG 实例，也没有尝试 IPv6、代理或其他执行环境 |

## 阻断定位

实测时间为北京时间 16:21:52。Windows 10.0.26200，Node v26.13.0。探针使用数字 IPv4 地址和标准库，Node 权限模式关闭，未配置模块预载。拒绝发生在 Chrome、PG、项目预载器以及 HTTP 代理参与之前。当前执行环境将连接拒绝为 EACCES；仅凭此错误无法进一步区分沙箱规则和主机 Windows 安全策略。本轮命令获得执行，没有新的自动审批拒绝，也没有申请扩权。

文件及版本检查确认 Chrome 158.0.8127.36、postgres/initdb/pg_ctl 18.4、pg 8.23.1 和 Playwright 1.63.0 可用。pg 与 Playwright 从九霄固定上游的 API 包入口解析。已有临时集群代码按批次生成随机凭据。未读取现有数据库凭据或历史存档。

## 整链路验收计数

| 本轮项目 | PASS | FAIL | NOT_RUN |
| --- | ---: | ---: | ---: |
| L5 原生 Chrome/HTTP 七种场景 | 0 | 0 | 7 |
| L4R 定向用例 | 0 | 0 | 23 |
| 旧输入页面安全检查 | 0 | 0 | 11 |
| YJ-13 完整回归 | 0 | 0 | 22 |

L4R 崩溃/租约恢复套件、L4 原卡 mock 参考演练和 L5 角色卡 → PG → 映界投影均为 NOT_RUN。没有新的 completed-history 修订、正文 SHA-256、数据库图像计数或 ready/not-ready 判定。上表唯一前置故障见 TCP 探针，它未进入各套件的业务断言。

公共契约 10/10、L3 30/30（含旧 65 条）、P01 7/7、L1/L4 假传输各 15 项、内存 HTTP 12/12 及 Chrome 拦截页面 7/7 引用上轮回执。本轮未重跑这些检查。先前完整名单 ready、非排他名单 not-ready 来自模拟证据。[L5 原报告](YJ-P02-L5-one-shot-recovery-report.md)

## 交接与复核

任务分支 `codex/yj-p02-l5b-loopback-closeout` 的本地和远端准备提交均为 `6cb99b1654a1d6d1e1f84d920969e7454b8e02bb`，独立工作树开始时干净。九霄只读上游为 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。新增内容限于探针、脱敏回执和交接文档。L1 许可维持 ACKNOWLEDGED，L4 维持 UNKNOWN_STOP，L5 为 mock-only、真实预算 USD 0。本轮没有输入 API Key，OpenAI 模型 GET、文字及图片请求各 0，新增费用 USD 0。

后续所需最小能力为同一受管 Windows 环境内，允许 Node、Chrome 和隔离 PostgreSQL 使用 `127.0.0.1` 的临时 TCP 端口完成本机监听和客户端连接。所需协议只有本机 HTTP 和 PostgreSQL。无需公网、全局防火墙变更、管理员权限、付费授权或真实素材。

仅在该能力获合法配置后，从仓库根目录执行 `node packages/luna-text/test/loopback-probe.mjs`。核验 TCP 测试数据和 HTTP 200 均通过后，按任务书运行原生套件。当前探针源码 SHA-256 为 `8b7022155c9fa967ee3c84105ee68dead386eedd39e7f558aefc4595676f4f80`。回退只需在本任务分支撤回本次交付提交，历史回执与许可不参与回退。
