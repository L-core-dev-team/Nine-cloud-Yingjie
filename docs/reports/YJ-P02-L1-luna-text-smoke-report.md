# YJ-P02-L1 单次 Luna 文字试点

## 真实试点已完成 · LUNA_ONE_CALL_PASS

北京时间 2026-11-21 22:34，操作人在本机终端提交了唯一一次测试。运行版本为 `13046a71d4defdd1d04117f80c1711830b3d9263`。只读复核确认本机仅一份执行回执，SQLite 仅一行批准记录，绑定、状态和响应字段逐项一致。账本为 `ACKNOWLEDGED`，本项许可已用完。[脱敏真实回执](evidence/YJ-P02-L1/live-result.json)

| 核对项 | 真实结果 |
| --- | --- |
| 供应商响应 | HTTP 200，`gpt-6-luna`，计费层级 `default`。真实文字 1 次，模拟发送 0 次。 |
| 用量与费用 | 输入 92、输出 39，其中推理 0 tokens。按当日 Standard 价估算 USD 0.0000287，批准上限 USD 0.10；供应商最终账单尚未核对。 |
| 正文保存与读取 | 原角色卡请求为 `completed`、修订 1。运行时核对了返回正文、PostgreSQL、已登录会话的 completed-history 及映界事件，SHA-256 一致。 |
| 映界提取 | 真实正文得到 `not-ready`，提取器保守留空。图片任务、attempt 和实际图片调用均为 0。 |

## 归档 · 实发前的离线检查

2026-11-21（北京时间）。**OFFLINE_PASS / LIVE_BLOCKED**。本机受信进程的 `OPENAI_API_KEY` 配置检查返回 false，项目的 Luna Standard 访问权限也尚未确认。预检在创建真实许可和发起模型请求之前停止。真实文字实际发送 0 次、可能发送 0 次、Images API 0 次。真实响应 ID、token、费用估算、账单均无可用数据。 [预检回执](evidence/YJ-P02-L1/live-preflight.json)

## 授权和协议

本分支从 `98d288348edb7f7e731111666d0cf397f1cb7499` 单独接续。只读九霄固定在 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。已检查 P02 准备提交和 P01 的受信回调、SQLite 预留及现有 PG 历史路径。P01 的预留单位为合成整数，本试点在同样的 SQLite 持久化机制下独立记录美元单位、唯一批准身份及请求摘要。当前仅批准同机同一服务账户的一笔合成酒馆文字推理。

固定官方 HTTPS 主机和 `POST /v1/responses`。正文由酒馆样例第 1 段、固定描述指示及获准行动组装，完整序列化请求受 SHA-256 固定。服务端核对原角色卡的 owner、session、action key，角色卡原始 messages、历史、persona、世界书和图片没有出站字段。沿用九霄出站模块的公网地址检查、DNS 固定和 TLS 主机验证。调用原生单次 HTTPS 传输，禁重定向。模型固定为 `gpt-6-luna`，`service_tier=default`、`reasoning.effort=none`、`store=false`、`max_output_tokens=1200`、`truncation=disabled`，工具列表为空，关闭流式与后台模式。store 参数控制 Responses 资源保存，平台另有自身数据留存政策。 [模型](https://developers.openai.com/api/docs/models/gpt-6-luna) · [Responses 协议](https://developers.openai.com/api/reference/resources/responses/methods/create) · [数据政策](https://developers.openai.com/api/docs/guides/your-data)

当日核对的 Standard 短上下文美元价为每百万输入 token $0.10、每百万输出 token $0.50。固定请求整体 UTF-8 字节数加 128 的协议余量为 609，含中文、参数和标点。这是针对这一个纯文本请求的保守估算，低于 1,024-token 缓存门槛和本地 8,000 输入上限。按 8,000 输入与 1,200 输出计算，单笔上界估算 $0.0014。输出已包含推理 token。批准总额 $0.10 全额预留，真实消费仍以项目账单为准。若跨北京时间日期或项目计费条件不同，实时门禁要求重新核价。 [官方价格](https://developers.openai.com/api/docs/pricing) · [缓存门槛](https://developers.openai.com/api/docs/guides/prompt-caching)

## 实际检查

| 检查 | 结果 |
| --- | --- |
| 公共契约 | 利用本机缓存安装契约锁定依赖并重编译，10/10 通过。 |
| 禁网请求与故障 | Node 26.13 的测试子进程无网络权限。15 个独立 fake 场景各进入一次 mock 传输；错 owner、session、行动 key 或未批准文字均被拦截。401、403、429 收到明确拒绝后停止。503、超时、重定向、畸形 JSON、额外工具、错误模型或层级、缺用量、异常输入计量、输出超限、不完整输出均停止。每项都复核了原键防重及重开账本后更换 UUID 仍被拒绝。[断网测试回执](evidence/YJ-P02-L1/offline.json) |
| 进程竞争与中断 | 两个独立 Node 进程就绪后共同争抢同一行，只有一个提交了 `not-sent → possible-sent`。胜者退出且未写回执，第三个连接读到原状态，再次占用被拒。单次 SQLite 原子更新先于网络传输，失败和未知均保留整笔预留。 |
| Chrome / PostgreSQL / fake | 实际 Chrome 在新本地账户的原角色卡页面提交一次行动，调用一次进程内 fake。九霄原服务写入一条 completed 请求及修订 1；使用已登录的普通 history API 读回。核对回包正文、PG 正文、历史正文和映界事件 SHA-256 均为 `b4bf16de90bc5d69bf5a154481fc98e37c766ac047e12bd2160929f004ffd0f4`。映界从 completed-history 提取为 ready。图片任务、attempt、Provider 发送均为 0。[浏览器与数据库回执](evidence/YJ-P02-L1/fake-card.json) |
| 真实服务 | LIVE_BLOCKED。无真实响应、真实历史修订或提取结果，均为 NOT_RUN。fake 回执中的 ID 和用量来自 fixture，真实用量和费用字段为 null。 |

## 复跑与接续

浏览器回执记录最终版本的单轮复跑。开发中另进行了两轮独立的本地 fake 联调，每轮使用新的临时账户和数据库。三次联调均未装载真实传输。宿主沿用九霄的本地合成配置；确认未来真实返回须同时查看独立许可账本中的模型回执和原 PG 历史。收到意外模型或计费层级会进入 FAIL 并保留可解析的 token，费用估算留空。

映界根目录使用 Node 26.13。禁网检查无需九霄数据库；回环集成另按 YJ-13 手册准备已编译的固定上游、PostgreSQL、Chrome 和本机路径。输出文件使用新名字，已有回执受到覆盖保护。[本地环境手册](../local-demo.md)

```powershell
npm --prefix packages/contracts test
node packages/luna-text/test/check.mjs offline-new.json
node packages/luna-text/run.mjs fake card-new.json
node packages/luna-text/run.mjs preflight preflight-new.json
```

真实试点限原受信机器和系统用户。先在对应 OpenAI Project 核实该项目可使用指定模型、Responses 和 Standard 美元费率。将实际核查的北京时间日期写入该进程的 `YJ_L1_PROJECT_STANDARD_VERIFIED_ON`；若已跨日，先复核官方价格和协议，更新代码中的审核日期并复跑测试。凭据仅由操作人在本机 PowerShell 7 隐藏输入，无需向聊天或 Git 提供。在同一终端执行完毕后清除进程变量。只有预检显示 READY 且当日离线检查通过，才执行一次 live 命令。

```powershell
$env:OPENAI_API_KEY = Read-Host 'OpenAI project key' -MaskInput
try {
    node packages/luna-text/run.mjs preflight
    if ($LASTEXITCODE -eq 0) {
        node packages/luna-text/run.mjs live live-new.json
    }
} finally {
    Remove-Item Env:OPENAI_API_KEY
}
```

live 在服务端读取凭据后立即从将被子进程继承的环境中清除。主机固定使用当前系统用户家目录下的 `.nine-cloud-yingjie/yj-p02-l1/approval.sqlite`，跨会话、工作树、UUID、程序重启均共用。保留该文件以及一次真实尝试后的本地 PG 集群和脱敏回执。任何 possible-sent、拒绝、UNKNOWN_STOP 或已收到回包但历史对账失败，均终止本项许可；仅可只读核对现有记录、响应 ID 和账单。不要删除账本、更换机器或另起账户补发。多主机协调未验证。回退可切回原 P02 准备分支，或在本任务分支 revert 实现提交；保留账本和已发生的历史。

YJ-13 的 LOCAL_DEMO_PASS 和 P01 的 OFFLINE_PASS 继续有效。真实图片、参考编辑、纠错替代生成、手机真机和生产部署均为 NOT_RUN。
