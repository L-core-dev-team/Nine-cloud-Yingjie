# YJ-P02-L5｜修复后独立单次 Luna 场景实测的安全接续

- 日期：2026-11-22（北京时间）
- 状态：**仅任务书已上传，L5 业务代码/测试尚未执行；没有新的付费请求授权**
- 工作分支：`codex/yj-p02-l5-one-shot-recovery`
- 起点：`codex/yj-p02-l4r-trigger-forensics@d05c2355c32e0637aff4e2ce75a165ac7ac6769c`
- 九霄只读上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 模型候选：`gpt-6-luna`，Responses API，标准文字模式；**真实项目访问、当日模型定价和预算必须在实施时重新核验**
- **本次任务书仅授权无网络开发和本地 mock/PG/Chrome 验证。任何新的真实 OpenAI 文字推理、模型权限查询、图片 API 调用，均需新批准；截至本任务发布不允许实发。**

## 1. 原始事实及必须保留的结论

L1 真实一次 Luna 文字响应已通过，L1 单次许可为 ACKNOWLEDGED；L2 证明原正文缺少完整地点/视角/排他人物名单，正确 not-ready；L3 首回合证据契约的 32 轮合成联调及 23 组拒绝通过；L4 准备已离线验收，但用户点击后页面结束，未找到原 SQLite 与真实 receipt，因此 **L4 历史为 UNKNOWN_STOP**。

L4R 原 Windows 环境只读核查未找回旧进程/网络日志，无法证明当时 POST /start 是否到达，不能把“找不到账本”当作实际 0 请求。旧版页面在 (a) 请求未抵达、(b) 后端发送前 gate 拒绝时显示同样的结束文案。L4R 已离线修复受理/拒绝/未知提示与无敏感信息的阶段审计；23 项定向检查、L1/L4 各15 项假传输、P01 7/7、L3 30/30、契约10/10及修正网络隔离后 YJ-13 22/22。据原报告曾有一轮15/22被测试隔离误拦，须保留历史红灯而非删证。

- [L4R 修复报告](../reports/YJ-P02-L4R-trigger-forensics-report.md)
- [旧 L4 无法确认送达的核查](../reports/evidence/YJ-P02-L4/post-trigger-review.json)
- [L4R 原环境核查](../reports/evidence/YJ-P02-L4R/historical-review.json)
- [L4R Chrome/HTTP 复现](../reports/evidence/YJ-P02-L4R/browser.json)
- [L4R 断点、持久占用与恢复](../reports/evidence/YJ-P02-L4R/crash.json)
- `packages/luna-text/key-entry/{server.mjs,entry.js,stages.mjs}`、`packages/luna-text/l4/{launch.mjs,pilot.mjs,request.mjs,analysis.mjs}`
- `packages/luna-text/{ledger.mjs,journey.mjs}`
- [原 L3 场景证据契约](../../packages/first-play/scene-evidence.mjs)

**旧 L4 启动器已明确停用，旧单次批准对象 YJ-P02-L4-single-luna-scene 不得复活、清空或复制。L1 的唯一许可也不得改动。**

## 2. 本轮先做的工程（全部禁止真实服务）

### A. 新且独立的 L5 入口

- 创建 `packages/luna-text/l5/` 或同等独立边界，**不要改名重启旧 L4 入口**。候选用途仍为新的一次合成酒馆自然叙事试验：让 `gpt-6-luna` 用自然中文描述受信合成的地点、人物名单、视角、固定结构、时段与光照；一旦未来真的发送，必须先由九霄普通角色卡保存 completed-history，映界只基于保存正文做 `scene-evidence` 追溯与 ready/not-ready 判断。
- L5 批准身份（例如 `YJ-P02-L5-single-luna-scene`）独立于 L1/L4，必须绑定新批准记录、固定模型/官方端点、合成用途、请求完整 SHA-256、scope/actionId、失效日、最多次数和总货币上限。**现在没有新的费用授权，真实 permit 不得可执行**；可用独立的 mock fixture 验证账本。
- 传输侧必须带固定官方 HTTPS、DNS/TLS 校验和防非官方重定向；无工具/图片/后台请求，无自动重试；文本正文 `store:false`，单请求 token 上限按实际模型计费方式检查。模型/项目访问不可用、当日价格不明、预算超限就 fail-closed；不得回退其他模型。
- 在生产密钥输入之前审查 UI 是否由用户操作那台电脑能访问，优先 `127.0.0.1` 随机端口、单次邀请码、限定生命周期、同源 CSRF/Host/Origin/CSP、防公开网络；不要要求把 Key 发往聊天/GitHub，不能写入日志或数据库。

### B. L4R 的阶段记录必须在 L5 **真实发送路径**被完整使用

- 不只让假 HTTP 测试通过；L5 启动时先创建私有运行审计，显示核查编号和初步状态。在受信路径分别记录：invite-claimed / preflight-ready / start-received / start-accepted / receipt-created / ledger-not-sent / ledger-possible-sent / provider-response-seen / history-committed / scene-reviewed / stop（确实发生才记录）。
- **send-ahead invariant**：在网络可能发出之前必须已经成功创建足以持久恢复的账本、审批身份和 possible-sent，并同步落盘。失败在发送前要能明确写出 NOT_SENT（带有真实证据）；一旦可能已发送，任何浏览器断线、HTTP 回执中断、PG 故障或进程崩溃均 UNKNOWN_STOP，绝不能自动补发或用新 actionKey/UUID 绕过。
- 当浏览器收到了 `start-accepted`，它只能说明后端接受请求，不等于已给 OpenAI 发送/成功计费。无受信阶段证据不能推断费用。断线后只允许读取已有脱敏回执和状态，不能重放最终操作。
- **必须检查一个关键易错点**：前端 `pagehide`、8 秒 ping、心跳租约以及服务端关闭连接，不能错误把已接受执行的推理主动中止或擦掉唯一证据。使用可控 fake 响应测试慢请求、标签页关闭和断线。日志可以匿名、结构化，但不得保存 API Key、Authorization、秘密世界书、完整提示、个人身份或浏览器邀请 token。
- 显示结果须明确区分：发送前拒绝；服务器已受理；可能已发送但未确认；已获官方回包但尚未写入历史；completed-history 已保存并校验；scene ready 或 not-ready。UI 不能靠客户端按钮点击推断哪一种。

### C. 有明确依据的中文提取验证，不能为出图硬改规则

- 用开发自编合成提示/故事及反例跑 `scene-evidence/1` 与 L4 的审阅器（或其安全版本）。固定旧图、提示中的资料和模拟模型自报 JSON **不能填补**已保存正文缺失的地点、观察位置、完整名单、时段或光照。特别区分“三人被看见”和“只有三人”。
- 正常叙事有同义变体时允许 not-ready，但不得虚构事实。尽可能报告事实充分却被多余拒绝的原因和拟议版本改进；无独立盲评不要声称泛化正确率。
- 只在独立 PG/Chrome 回环内，验证原九霄完成正文回读、修订号与 SHA 一致、同一个 scope 的多次投影去重、视角/地点的语义边界以及映界不凭空生图。本轮所有图片任务和 attempt/send 都为零。

## 3. 离线完成检查

至少真实执行并记录结果：

| 范围 | 最低验收 |
| --- | --- |
| 新 L5 UI 与阶段日志 | 假 Key、真实本机 Chrome、HTTP；最终按钮已点击但 POST 丢失、服务端发送前拒绝、受理后断线、重启、超时、强制崩溃、密钥过期、已认领邀请；不会误报已发送/成功 |
| 持久单次许可 | 两进程竞争最多一次 claim；同一 L5 新批次超时/unknown 后不补发；旧 L1/L4 账本只读不动 |
| 角色卡整链路 | 原九霄浏览器页面 → PG completed-history → 映界场景审计。接受/拒绝均具明确源证据；没有任何图片派发 |
| 安全边界 | 请求与原文 SHA，服务端身份、scope 和私密内容过滤；不使用真实 OpenAI Key |
| 兼容回归 | 公共契约 10/10、L3 30/30、旧 65 样本、P01 7/7、L1/L4 假传输各 15 项、L4R 23 定向、YJ-13 完整 22 项；失败/跳过不许删 |
| 新真实调用 | **0 次**：包括 OpenAI 模型 GET、文字推理与图片；实际新增费用 **USD 0** |

交付代码、无密钥配置说明、脱敏 `docs/reports/YJ-P02-L5-one-shot-recovery-report.md`、`docs/reports/evidence/YJ-P02-L5/`、固定回归结果及回退说明。更新 README、handoff、task-sequence、verification、CHANGELOG 与必要的 decisions，核对远端 HEAD 与本地工作区；L4 原报告、UNKNOWN_STOP 决议与原 L1/L4 分支保持不变。

若旧事件已经无法取得更多证据，请停止继续纠缠取证，不要为了完成 L5 重演旧 L4 请求。L5 **必须是新的单笔许可**；现在只需要让程序在安全、可观察、独立的离线状态下准备好，而不是实际扣费。

## 4. 真实 L5 的进一步条件（本轮尚未授权）

下一次如果道主决定批准，建议范围仍为 **`gpt-6-luna`、仅开发自编合成酒馆文字、最多 1 次、USD $0.10 新总预算上限、图片 API 0 次**。这只是建议，不是自动继承 L1/L4 的批准。必须让道主重新明确同意本次新支出；完成当日价格与模型/Project 检查后，由他通过可信一次性页面填 Key 并单独点击执行。

即使后续真实调用成功，仍需逐项核对响应、tokens、估算费用、九霄已保存正文和独立场景审计。真实模型如果没有提供足够证据则保留 not-ready；不能将离线 fixture 的 ready 写成真实成功。

## 5. Codex 完成报告模板

```text
道主，YJ-P02-L5：PREP_OFFLINE_PASS / PARTIAL / BLOCKED

新分支和本地/远端完整 HEAD：
旧 L4 UNKNOWN_STOP 与原 L1/L4 许可是否保持：
L5 真实入口是否安全可访问（未获授权时真实请求禁用）：
阶段记录是否发生在可能发包前，是否可只读追踪：
假密钥、断线/超时/进程崩溃、防重与 Chrome/PG 测试回执：
模拟剧情在已保存 completed-history 中是否完整、scene ready/not-ready：
契约、65 样本、P01/L1/L4/L4R/YJ-13 各项真实通过/失败数：
新真实 OpenAI 模型查询/文字/图片调用次数（均应 0）和新增费用：
原 L4 真实送达/费用仍 UNKNOWN 的说明：
新一笔真正付费试点必须获得的用户授权与条件：
代码、脱敏报告、工作区/远端核对、回退入口：
```
