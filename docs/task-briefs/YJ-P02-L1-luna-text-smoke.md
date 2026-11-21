# YJ-P02-L1｜GPT-6 Luna 单次真实文字 API 受控试点任务书

> **2026-11-21 接续修订：** 道主已明确要求**不要让他手动设置 PowerShell 环境变量**，而由 Codex 提供可信、一次性的 API Key 输入界面。密钥交互与启动方式改由 [YJ-P02-L1-K](YJ-P02-L1-key-entry-ui.md) 执行。本文下面的环境变量说明是旧版历史方法，不应再作为向道主交付的默认操作。原单次 $0.10 Luna 文字许可及全部数据/防重限制不变；新 UI 未实现前不得声称已提供可填入口。

- 日期：2026-11-21（北京时间）
- 状态：任务书已准备；本任务书提交不代表代码已完成或真实请求已发送
- 仓库：`quakhiak34568-lang/Nine-cloud-Yingjie`
- 独立分支：`codex/yj-p02-l1-luna-text`
- 接续基线：`codex/yj-p02-openai-adapter@7f0d9d454886c6021a876cd3a8c9bcfda99404e9`
- YJ-P01 已完成：`codex/yj-p01-real-service-readiness@2caab0d92059d77097af5a4e6859f56e51516c99`
- YJ-13 本地交付：`codex/yj-13-local-demo-closeout@2b54c28e8e587e05311b957c5437024c6ecb4271`，LOCAL_DEMO_PASS
- 九霄只读上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 模型：**`gpt-6-luna`，不能自动切换其他模型**
- 预算：**本项已确认单次真实文字试点的总预算上限为 USD $0.10；不得把这一授权扩大到图片、更多文字请求或私人素材外发**

## 一、道主已确认的授权与明确禁止

本阶段道主已明确：(1) 使用**自己的 OpenAI API**；(2) 已有 API Key；(3) 同意以 GPT-6 Luna **进行一次小额真实文字测试，最高预算 $0.10**；(4) 先给 Codex 任务书执行。

本授权限于下面唯一一笔 **`POST /v1/responses` 模型推理调用**：使用本仓库已经存在的**开发自编合成酒馆**测试场景/角色和行动，不使用真实用户存档、私人角色卡、Discord/万卡阁、个人全局世界书、真实照片或图片原件。不调用 Images API，不调用其他付费模型，不自动补发，不做批量测量。用户未授权其余材料或费用。

**执行环境并未从聊天获得 API Key。** 只能检查当前本机受信进程是否提供 `OPENAI_API_KEY`；若没有，则在开始实际调用之前返回 `BLOCKED: API_KEY_NOT_CONFIGURED`，给用户在本机安全配置的说明。不能读取用户私有秘钥目录、桌面凭据、浏览器 Cookie 或打印变量值。不得将密钥放入仓库、任务输出、聊天、截图或浏览器。

本项“一次真实文字调用、USD $0.10”是**本次试点的明确范围授权**，不是修改账号层级的自动计费硬限额。若无法在本地用模型价格、token 上限及发送前授权账本约束费用，必须拒绝真实发送，不能靠猜测当前余额强行调用。

## 二、模型及官方协议验证

调用当日再次核对官方文档与项目可访问性，确认：

- 文本模型 ID：`gpt-6-luna`
- 路径：`POST https://api.openai.com/v1/responses`，只接受固定官方主机；不支持用户/世界书输入 endpoint
- 使用 `reasoning: {effort:"none"}`（模型支持），标准模式；不启用 pro/fast、工具、浏览器搜索、图像、音视频或 background
- `store:false`；这避免在 Responses 资源中为未来检索保存响应，不代表全平台绝对零日志；仍仅发合成资料
- `max_output_tokens:1200`（上限包括可见与推理输出 token），`truncation:"disabled"`，请求最多一次；不使用流式模式
- 官方 Standard 短上下文文本价格：输入 $0.10 / 100 万 tokens，输出 $0.50 / 100 万 tokens，**实际发送前重新查价格**。不使用其他计费工具、额外输入模态、长上下文或优惠费率的假设

官方依据：
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/your-data

若真实账户不支持 `gpt-6-luna`、接口、参数、币种或价格无法核实，停止并说明；不得自动改成 Sol、其他 Luna 版本或旧网关模型。

### 预算发送前检查

将所有将要真实发送的指示/输入/消息合计控制在 **8,000 input tokens 以内**（使用保守、可复查的计数办法；不能可靠计数时缩短至极小合成提示，仍不能保证则停止）。输出硬限制 `max_output_tokens=1200`，不允许 API 自动工具调用或追加补全。

以标准短上下文且上述参数为前提，最坏预计文本用量约：

```text
8000 × 0.10 / 1_000_000
+ 1200 × 0.50 / 1_000_000
= USD 0.0014
```

这只是按已核对官方 token 价对**单笔**文本推理的预估上界，**不是供应商账单的硬承诺**。若账户处理层级、特殊计费项、模型或当日价格导致该上界不成立，STOP。批准的本任务预算为 **USD $0.10，1 笔请求**；默认先保守占用整笔 $0.10 批准额度。任何出错/结果未知之后不自动再次调用，不接受新的“换 UUID”绕过。

## 三、开工前的代码和本地门禁

先确认 GitHub 远端实际 HEAD、本地工作树及是否存在后续 P02 适配实现；不得强制 reset、覆盖未提交修改。阅读：

- `AGENTS.md`、`docs/decisions.md`、`docs/handoff.md`
- `docs/task-briefs/YJ-P02-openai-adapter.md`
- `docs/reports/YJ-P01-real-service-readiness-report.md`
- `packages/provider-readiness/offline.mjs`、`reservations.mjs`
- `packages/local-demo/`、`packages/first-play/`、`packages/image-tasks/`
- 九霄固定上游的 `apps/api/src/card-import/service.ts`、`model-access.ts`、`local-provider.ts`、`card-provider-runtime.ts`

P02 当前远端只有任务准备，不能假装 OpenAI adapter 业务代码已做完。本轮必须先做并验证必要的**纯离线**文字 adapter、出站白名单、批准/预算门禁和本地 fake HTTP 回执，尽量复用九霄已存在的受信文字网关。不要为了单次文字调用重复开发全套图片 Provider，也不要在本次真实调用前顺手测试图片 API。

**发送前需要全部具备：**

1. 本机受信环境已安全配置 API Key，且官方项目/模型访问已确认；API Key 不进客户端、不上传 Git。
2. 使用独立合成账户与九霄原普通角色卡会话，唯一的行动 key 绑定现有 session/owner；P01 已验证的获准文字 allowlist 和数据最小化持续有效。
3. 离线断网预演证明真实请求**恰好只有一条**，请求中仅有已获准的简短合成酒馆指示与行动，绝无私人世界书、聊天记录、万卡阁/Discord、图片 bytes。
4. 持久化单次请求许可与占用记录，执行前以事务或等价受信原子步骤处理：`approvalId`、模型、scope、actionKey、输入摘要、max_output_tokens、预计最坏成本、`not-sent/possible-sent`；并发两个进程只能一个进入发送边界。按 P01/现有 PG 账本路径完成，不仅靠进程内计数。
5. 绝不依赖“API 自动重试”控制调用次数；禁用 SDK 自带重试（如使用 SDK，`maxRetries:0`）及上游自动重发；禁止二次生成、模型回退、自动代理/额外模型工具调用。
6. 日志不保留 API Key、Authorization、原始合成文本的意外转储；只存模型、官方响应 ID（如有）、action/session 的不可逆摘要、token/状态/费用估计。
7. 无法形成真实单次预算门禁时，标记 `BLOCKED: BUDGET_GATE_NOT_VERIFIED`，只能离线验证，**不进入实发**。

## 四、唯一一次真实调用的可验目标

仅对**开发自编的合成酒馆剧情**进行一轮角色卡行动。建议直接使用既有“东村青石酒馆，日间，柜台与双窗，掌柜、蓝衣客与赭衣客在场”的合成测试基线，行动简短如“继续观察酒馆”。如果需要指示模型输出结构化可见描述，只使用合成条目，不把未揭示世界书当已发生事实。

建议的正式请求条件（须先离线验证与当前官方参数兼容）：

```json
{
  "model": "gpt-6-luna",
  "reasoning": {"effort": "none"},
  "max_output_tokens": 1200,
  "store": false,
  "truncation": "disabled",
  "tools": [],
  "input": "此处由受信服务组装简短、可外发的合成酒馆剧情提示"
}
```

这个 JSON 只展示安全参数方向，不是可以绕过现有九霄鉴权的独立 `curl` 命令。优先让九霄现有 `CardImportService.act` 消费 **1 次实际 OpenAI 文字结果**，成功后按普通角色卡权威历史写入 completed-history，再由映界读取其实际保存正文；**不能将字面 player action 代替生成文本硬写进数据库**。

后续只读核对：

- 原行动、修订和 completed-history 正文（以 SHA 摘要记录）与九霄 PostgreSQL 一致。
- 映界 `scene-state` 的提取器实际从正文做判定：能识别则 ready；表达超出有限规则时 not-ready/abstain 也可接受，不能凭图改写文字。
- **实际图片任务、图片 attempt、Images API 调用均为 0**；本阶段绝不进入后续图片生成。
- 记录 API 返回的 `usage.input_tokens`、`usage.output_tokens` 和 `output_tokens_details.reasoning_tokens`（如有）；按调用当日官方价格标注 **估算成本**，与后续账单核对。缺失项填 `null`，不得虚构 $0.00。
- 成功后自动关闭 live 开关；失败、超时或送达未确认也立即关闭，未知可能已计费则 `UNKNOWN/STOP`，不能再次发送。

## 五、明确停止条件

以下任一触发立即停止并保留既有任务/资金预留，不做第二笔调用：

- API Key 未配置/没有模型权限/请求参数不支持；
- 无法核实 $0.10 预算及本笔最坏费用，或 input/output/token 规模超过约束；
- 资料超出合成测试许可、存在未经允许的真实用户私密文本；
- 出站域名与证书/实际请求目标异常；
- 出现 401/403、429、5xx、timeout、进程中断或不明传输状态；
- 收到未预期的计费层级、模型 ID、额外工具调用或不完整输出；
- 已记录 1 次可能送达的真实调用，不管得到成功还是未知。

本轮不批准实际生图、参考编辑、纠错替代、连续多轮真实故事、私人世界书外发、线上生产或手机真机测试。

## 六、测试、报告与状态

实际完成后提交：

1. OpenAI Luna 文本单次 adapter 与禁网/发送前门禁的可复查实现，优先复用 P01/既有 PG 会话/审批账本，不复制完整项目。
2. 合成 fixture 的离线请求断言（身份、最小文本、固定模型/端点、输出上限、store=false、禁重试、价格检查）和双进程抢占检查。
3. 实际 Chrome/PG/原角色卡 1 轮结果，注明真实 API 成功/拒绝/不可达与其确切次数；成功后完成 history SHA、映界状态以及图片任务为 0 的对账。
4. `docs/reports/YJ-P02-L1-luna-text-smoke-report.md` 和脱敏 evidence JSON；保留官方定价核查日期及响应 usage 但不保存凭据/私人内容。
5. 更新 README、`docs/handoff.md`、任务序列、验证和决策说明；保留 P01 OFFLINE_PASS、YJ-13 LOCAL_DEMO_PASS 以及原 P02 文档内容。
6. GitHub 独立分支代码+报告提交、最新 HEAD、本地/远端一致性与回退说明。无凭据或门禁不足时可交付离线部分，但必须标记 `LIVE_BLOCKED`。

### 判定

- `LUNA_ONE_CALL_PASS`：真实调用仅 1 次，确实使用 `gpt-6-luna`；结果由九霄存为 completed-history，可读回并经映界提取；实际用量已核实，未触碰图片 API，按已知费用核算未超过批准范围。
- `LIVE_BLOCKED`：密钥/模型访问/预算门禁等任一前置条件不足，真实调用为 0；只报告离线结果。
- `UNKNOWN_STOP`：单次请求可能已送达，但回执不明；不得重试，保留审批与任务身份供人工核对。
- `FAIL`：账本越权、错误模型/错误账户/重复发送或敏感材料外发等违反范围的情况，立即停用并保留证据。

文字真实试点**不是**图片试点成功、正式剧情泛化准确率通过或生产可用性证明。图片供应商下一笔须另行具体批准。

## 七、交给 Codex 的完成报告模板

```text
道主，YJ-P02-L1：LUNA_ONE_CALL_PASS / LIVE_BLOCKED / UNKNOWN_STOP / FAIL

分支与完整 HEAD，本地/远端一致：
受信环境是否有 Key（只回答 true/false，不披露值）：
核对的官方模型、端点、定价及计费层级：
离线校验（发送次数、权限、预算、并发防重）：
本轮真实 OpenAI 请求实际/可能发送次数：
响应状态、模型、token usage、单笔费用估算与官方账单待核对项：
九霄 completed-history 修订及正文 SHA 对账：
映界提取 ready/abstain 与图片发送 0 次证明：
报错/中断/unknown 和不重试证据：
后续真实图片试点仍未获授权的事项：
GitHub 代码、报告、脱敏回执与回退入口：
```
