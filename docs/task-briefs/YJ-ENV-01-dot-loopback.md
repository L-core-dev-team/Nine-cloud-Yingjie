# YJ-ENV-01｜交给白璃 Dot：本机 127.0.0.1 TCP EACCES 合法环境排障

- 负责人：白璃 Dot（只负责**环境问题**，不承担映界图片适配器开发）
- 日期：2026-11-22（北京时间）
- 分支：`dot/yj-env-01-loopback-permission`
- 固定基线：`codex/yj-p02-l5b-loopback-closeout@6d9fa510cb6daa75e50eb9a4ebd4a277a8a70ec5`
- 现有追踪：[GitHub Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)
- 原 L5B：`ENV_BLOCKED`；L5：`PARTIAL`；原 L4：`UNKNOWN_STOP`
- **权限原则：只做受许可的本机诊断和环境配置核查；不得绕过沙箱/自动审批/组织安全策略。**

## 一、已查明的起点（不要再假设是 Chrome/PG 逻辑 Bug）

[脱敏探针](../reports/evidence/YJ-P02-L5B/loopback.json)与[完整报告](../reports/YJ-P02-L5B-loopback-closeout-report.md)记录了：

- Windows 10.0.26200，Node 26.13.0，`127.0.0.1:0` 随机端口 `net.createServer().listen()` **PASS**。
- 同一 Node 进程向刚刚监听的数字 IPv4 地址和真实分配端口 `net.connect()` 返回 **`EACCES`**；HTTP GET 尚未运行。
- 没有启用 Node 权限模式、没有 `NODE_OPTIONS` 测试预载，Chrome、PostgreSQL 尚未参与；不是当前 JavaScript 预载的外网屏蔽所致。
- 因此前置环境阻塞：L5 native Chrome 7 项、L4R 23 项、旧输入安全 11 项、YJ-13 22 项全部 NOT_RUN。不要把 0/7、0/23 或 0/22 说成业务失败。
- 不知道是受管沙箱/网络容器规则，还是 Windows 安全策略。没有证据表明用户的电脑系统全局坏了；也不能宣称已获得相关权限。

**Dot 的唯一目标：在完全合法的执行条件下，定位是否能为这套开发测试提供最小的 localhost TCP 连接能力；若不能，提供清晰的阻塞责任方和可执行的审批请求。**

## 二、第一步：先辨认“谁在阻止 connect”

需要在**原受管 Windows 开发环境**核对运行主体、Node/Windows 版本、沙箱会话标识、工作区，以及是否使用了特定的 Codex/WorkBuddy 执行容器。只能读取必要的环境元数据，禁止发布账户名、家庭目录、代理配置明文、浏览器 Cookie、私人文件与任何 API Key。

沿用现有已提交的 `packages/luna-text/test/loopback-probe.mjs`；源码 SHA-256 应为 `8b7022155c9fa967ee3c84105ee68dead386eedd39e7f558aefc4595676f4f80`。**不要直接修改已验收探针以伪造 PASS。**

按照“最小权限和最小副作用”区分：

1. 检查是否有已公开的执行环境能力说明、网络沙箱策略/权限设置，是否规定 localhost 的 `connect` 不可用或需要显式批准。阅读现有设置与官方帮助，不要猜测。
2. 只读检查 Node 是否启用 `--permission`、模块预加载、Windows 应用容器/防火墙规则等可观察状态。**观察不到不等于不存在**，没有权限读取则报告。
3. 尽可能使用同一受管会话的原始探针日志核实 `LISTEN`、`CONNECT` 的操作系统错误，而不是重新解释 Node 应用错误栈。
4. 不要为了绕过拒绝，切换到管理员、禁用杀毒/防火墙、改组策略、修改 Windows 安全服务、用不同 shell/进程身份、宿主机与容器交替执行、代理/SSH/隧道、公开端口、替换二进制或自定义驱动。
5. 如果执行工具明确拒绝某项操作，**立即停止该方式**。仅可告知道主哪项能力需要由环境管理方通过正规入口允许；不要通过其它工具规避原拒绝。

## 三、最小所需授权与复核

真正需要的能力只有：

- 同一获准受管环境中，Node 对 `127.0.0.1` 分配的临时端口进行 `bind/listen` 和 **`connect`**；
- 后续同环境 Chrome ↔ 本机临时 HTTP 服务、Node pg 客户端 ↔ 临时 PostgreSQL 服务，均通过 localhost；
- 不开放公网、不启用 OpenAI、无管理员/系统全局规则改变，不读取用户真实数据库或私人角色卡。

如果 Dot 在自己实际已被授予权限的环境中可以合法配置或请求这种能力，先向道主说明具体改动范围、风险与如何撤回；**涉及系统/组织安全配置变更必须得到道主或策略拥有者的明确批准后才能执行**。正常由环境设置 UI 授权的动作按原工具要求申请，不能代用户伪造批准。

若审批无法取得或环境不支持此能力，直接 `ENV_BLOCKED`，给出管理方/产品文档的合理入口和最小授权请求，不要无意义再跑十次探针。

## 四、真正的验收与和 Codex 的交接

当且仅当合法获得回环能力后，使用完全隔离的新临时端口/进程进行：

- 与原 L5B 相同的 Node TCP LISTEN / CONNECT，必须**收到端口回传的测试数据**，而不仅是监听成功。
- 独立本地 HTTP GET 成功返回 **200**，记录只含 run ID/步骤 PASS/FAIL/错误码的脱敏证据。
- 简短检查 Node → 本机临时 PostgreSQL 的连接可行性；如工具依赖不足，报 NOT_RUN，不使用真实 PG 实例。
- 原生 Chrome 如有已授权测试入口，可以确认浏览器能访问仅包含空白合成内容的 localhost 页面；不查任何真实 OpenAI 站点。
- 一旦 127.0.0.1 最小探针三项通过，**停止继续侵入式环境诊断**，通知 Codex 按[ L5B 任务书](YJ-P02-L5B-loopback-closeout.md)补做完整原角色卡/PG/Chrome 回归。Dot 不改 image provider 代码。

已执行过的真实测试要列明日期与运行环境；未运行、因自动审批拒绝而无法执行的项应独立写出。若不能复现 EACCES，先报告 `ENVIRONMENT_DIFFERS`，不要悄悄认为原受管会话已修复。

## 五、提交与交付标准

提交 `docs/reports/YJ-ENV-01-loopback-investigation-report.md`、脱敏 `docs/reports/evidence/YJ-ENV-01/`（如能在仓库本分支写入）。如不能操作 GitHub，向道主返回一份完整脱敏报告和明确结论即可，不要触碰映界两个 main。可在 Issue #1 添加结论和所需最小许可，但**只有同一目标受管环境的真实 CONNECT + HTTP 200 获得核验证据并完成原 L5B 待测项之后才关闭 Issue**。

汇报必须区分：

- `ENV_FIXED_VERIFIED`：同一受管环境已合法开放 localhost，TCP 连接、HTTP 200 和相关复核真实成功；
- `ENV_BLOCKED`：受管环境明确拒绝、审批未获批或无法更改；
- `ENVIRONMENT_DIFFERS`：在其它环境测得通过，不能推断原沙箱已修好；
- `INCONCLUSIVE`：只得部分记录，无法定位策略层。

**禁止任何新的 OpenAI 模型权限 GET、Responses 文字 POST、Images API 生成/编辑调用；费用 USD 0。旧 L1 ACKNOWLEDGED、L4 UNKNOWN_STOP、L5 PARTIAL 保持原样。**

### Dot 汇报格式

```text
YJ-ENV-01：ENV_FIXED_VERIFIED / ENV_BLOCKED / ENVIRONMENT_DIFFERS / INCONCLUSIVE
实际诊断的 Windows/沙箱环境是否与原 L5B 同一环境：
原 EACCES 发生在哪一层，有哪些直接证据与仍未知：
有无任何自动审批/管理方拒绝；是否遵守未绕过：
合法配置或所需最小权限（若需修改安全策略须先获批准）：
新探针 TCP LISTEN、CONNECT 和 HTTP GET 200 实际结果：
Chrome/临时 PG 是否有真实可核证据：
哪份脱敏日志/报告或 GitHub issue 更新：
是否可以移交 Codex 补齐 L5B，而不是自动宣称 L5 PASS：
是否触碰旧许可、真实 API、现有私人文件（应均否）：
```
