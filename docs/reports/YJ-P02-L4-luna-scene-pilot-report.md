# YJ-P02-L4 · 单次 Luna 合成酒馆试点

## 点击后的只读核查 · UNKNOWN_STOP

2026-11-22 北京时间 13:10。用户报告已点击最终执行按钮。原页面显示“会话已结束。若已点击开始，请核对本机脱敏回执。”本机固定 L4 目录、其中的 SQLite 账本与真实回执均未找到。在可见的应用沙箱和工作区中也未找到对应副本。此次只读核查补发 **0 次**。

真实请求是否抵达服务商、输入和输出 token、按量估算费用及账单金额均未知。未取得可关联的真实 completed-history 修订或场景投影，因此最终 ready/not-ready 未知。下方 831 和 1,200 是请求预算的输入和输出上界；离线回执里的用量和 ready 只属于合成回环。

按 **UNKNOWN_STOP** 收口，证据状态为 **RECEIPT_UNAVAILABLE**。前者是此次核查的停止决定，原 SQLite 状态未知。当前批准对象停止使用；任何补充核对仅使用已有回执、会话或服务商记录。[点击后核查记录](evidence/YJ-P02-L4/post-trigger-review.json)

## 点击前的离线验收

2026-11-22（北京时间）。任务从 `e52d0f1e2e4b07782cd809acd31357307168016e` 接续。**PREP_OFFLINE_PASS**。本报告的离线验收时点，真实推理 0 次，图片请求 0 次，新增费用 USD 0。项目密钥可见性和真实写入权限属于不同检查，须由用户进入本机页后核实。付费阶段的用量、真实正文保存、提取和账单均为 **NOT_RUN**，以单独的真实执行回执为准。

## 批准范围与请求

批准对象为 `YJ-P02-L4-single-luna-scene`。本次在已批准模板基础上压缩措辞，描述东村青石酒馆、玩家站在正门向北观察、两类固定陈设、正午日光和经过完整调查确认的三名成员。页面可展开查看与请求相同的全部文字。固定请求只接收限定行动，序列化摘要将提示、模型、输出上限和请求选项一起锁定。新增或替换角色卡、世界书、历史、提示和图片均无法进入请求。[实际提示和固定摘要](../../packages/luna-text/l4/request.mjs)

使用官方全球 Responses 端点、`gpt-6-luna`、Standard、无工具、`store:false`。调用日核对模型价格，每百万 tokens 普通输入 $0.10，缓存读取 $0.01，模型页列出的缓存写入 $0.125，输出 $0.50。对固定请求的完整 UTF-8 字节数另加 128 个 framing tokens，输入上界 831，输出最多 1,200。按更高的 $0.25/M 输入写入价预留，费用上界 $0.00080775；批准的额度为 $0.10。日期或请求摘要变化即停。成功回执用服务商实际 token 数和该短输入的 Standard 费率估算，最终结算以项目账单为准。[官方模型价格](https://developers.openai.com/api/docs/models/gpt-6-luna) · [官方费率表](https://developers.openai.com/api/docs/pricing)

## 用户触发和防重

入口仅绑定 127.0.0.1。邀请仅可领取一次，验证 Host、Origin、会话随机值和显式确认标头。先本人填写 Key，再点击检查，才会向官方发出无正文的 `GET /v1/models/gpt-6-luna`。不会在密钥录入时测试推理。页面还要求本人核实当前项目具有 Responses 写入及 Standard 美元计费权限。读接口仅证明模型可见，真实生成是否被服务商接受需要看唯一 POST 的结果。页面关闭、过期或执行完后清理内存中的凭据。

只有「执行本次唯一请求」可启动新普通角色卡回合。固定专用账本 `~/.nine-cloud-yingjie/yj-p02-l4/approval.sqlite` 将批准对象、费用、到期日、用途、请求摘要和该回合身份绑定。传输前用 SQLite 原子提交 possible-sent，远端拒绝、未知、超时、失联或重启后均不重发。回执记录响应 ID 的摘要，回环卡库只在本机保存生成正文。L1 账本不参与任何 L4 路径。

## 离线实测

| 检查 | 本轮结果 |
| --- | --- |
| 公共契约、L3 及兼容样本 | 10/10、30/30，含原 65 条规则样本。 |
| P01、L1 和独立 L4 假传输 | P01 7/7。L1、L4 各 15 个场景。L4 两进程竞争只有一次能够 claim，模拟崩溃后重新打开仍锁定。 |
| 原角色卡回合 | 真实 Chrome、鉴权 HTTP、本机 PG 保存并读回假模型正文，修订 1 为 completed；核对请求标识、正文摘要、来源和七类证据，场景 ready。图片 task、attempt、send 均为 0。 |
| 页面权限门禁 | 在真实 Chrome 填写假 Key，假权限接口拒绝时执行按钮禁用；返回正确模型后仍等最终点击。11 项原有页面安全检查仍通过。 |
| YJ-13 | 完整回归 22/22，0 失败、跳过、取消。L3 曾记录的 YJ-07 标签等待超时本轮未复现。 |

九个预先标注的合成变体包括标点与顺序变化、同义自然叙事、非排他名单、梦境、不同题材的观星楼，以及虚构人数或朝向。3 条接受，6 条弃判，错误接受 0，另有 1 条自然同义叙事因超出语法而多余弃判。旁路先运行原 L3 提取，再只用合成设定否决可辨认的矛盾。设定不提供缺失字段。无法识别的自然叙事不能据此判为确实缺少某项事实。实际模型遵循率仍未知。[回环与语义回执](evidence/YJ-P02-L4/offline.json) · [原回归和安全检查](evidence/YJ-P02-L4/regression.json) · [L4 防重与响应测试](evidence/YJ-P02-L4/transport.json)

## 本机复跑与交接

按[本机环境说明](../local-demo.md)设置固定九霄、Chrome 与 PostgreSQL 路径并构建契约。在映界根目录执行下列离线命令，回执传入尚不存在的文件名。

```powershell
npm --prefix packages/contracts test
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/scene-evidence.test.mjs packages/first-play/test/initial-survey.test.mjs packages/first-play/test/continuity.test.mjs
node packages/provider-readiness/check.mjs new-p01.json
node packages/luna-text/test/check.mjs new-l1.json
node packages/luna-text/test/check.mjs new-l4.json --l4
node packages/luna-text/test/key-entry.mjs new-key-check.json
node packages/luna-text/l4/offline.mjs new-l4-browser.json
node packages/local-demo/check.mjs regression new-yj13.json
```

以下为触发前的启动方式，本次批准对象已停止使用。用户在本机 Windows 终端执行 `node packages/luna-text/l4/launch.mjs --open` 可打开保护页面，保持终端开启。每次启动签发新的短期页面邀请，仍受同一份 L4 账本约束。最终点击后查看上述专用目录的 `receipt-*.json`。可核对响应标识摘要、用量、估算金额、原会话正文摘要、分字段证据的 UTF-16 位置及拒绝理由。响应可能送达但缺回执时按 UNKNOWN_STOP 保持锁定，已确认模型返回但缺数据库核验时单列 ACKNOWLEDGED_HISTORY_UNVERIFIED。停止 L4 入口即可退出试点，默认宿主和旧提取版本继续按原路径工作。
