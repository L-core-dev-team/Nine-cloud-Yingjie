# YJ-P02-I1 · OpenAI Images 离线适配验收

**IMAGE_ADAPTER_OFFLINE_PASS**。在 `codex/yj-p02-i1-image-adapter-offline` 上从 `8a7b7f69c4bdf590b130feb8f2cf2743fee32640` 实施。Node v26.13.0 下两次运行最终测试均通过，脱敏回执逐字节一致。真实模型查询、文字生成、图片生成与编辑各 0 次，新增费用 USD 0。[测试清单与协议回执](evidence/YJ-P02-I1/verified.json)

| 范围 | 实测结果 |
| --- | --- |
| Images 协议、输入授权、输出验证、错误与防重 | 60/60 PASS，0 跳过。使用原生 Request/Response、FormData 与内存传输，执行 Provider 的 Node 进程禁网。 |
| ImageTasks、持久原件、审阅和崩溃恢复 | 7/7 PASS，0 跳过。使用真正的 ImageTasks 方法、原件文件系统及 SQLite 测试替身。两个进程竞争同一事件只进入一次传输；进程在占用后退出，重开同一账本的发送次数为 0。 |
| 兼容回归 | 契约 10/10；L3 30/30（含旧 65 条）；P01 7/7；L1 与 L4 假传输各 15 项；可见变化与参考资格 4/4；YJ-02 校验了 3 份历史原件、两次参考关系及两次复用。[回归回执与开发期间失败](evidence/YJ-P02-I1/regression.json) |
| 原生 PG、Chrome 和普通角色卡全链路 | ENV_BLOCKED / NOT_RUN。原受管环境的 EACCES 由环境管理方跟踪，I1 未重跑探针。没有本轮原生数据库修订及正文 SHA。[Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1) |
| 项目模型权限、真实图像输出与计费 | NOT_RUN。真实发送为 LIVE_DISABLED；无法据本次假图评价模型的人物保留效果。 |

## 实际请求与参考链

生产形状的协议通过注入的假传输消费。generate 的 JSON 与 edit 的 multipart 均固定官方 HTTPS 端点、同一个候选模型、单张 1536×864、medium、PNG。参考上传只有一个 `image[]` 文件部分，含源 PNG 的原始字节。编辑器分别列出留存、到场和离场的人物、结构变化以及光照和时段。测试从已经编码好的请求解包，并校验实际提示与原图 SHA-256。

| 合成剧情 | 路径 | 从请求中核验的内容 |
| --- | --- | --- |
| 白日酒馆 | POST /v1/images/generations | 3 人完整名单，无参考文件 |
| 两人到场 | POST /v1/images/edits | I0 原件，SHA 以 `7a70683b` 开头；保留原三人，新增两人 |
| 傍晚点灯 | POST /v1/images/edits | 上一张五人图 I1，SHA 以 `004fabce` 开头；留存五人，到场与离场列表均为空 |

原件来自既有 YJ-02 工具实验。本轮假返回使用固定的测试 PNG，因此三次协议回执的输出摘要相同。该 PNG 用于测试收件、存储与审阅。完整输入摘要、参考摘要及输出摘要见[脱敏回执](evidence/YJ-P02-I1/verified.json)。

## 来源、权限与状态

- 宿主把已认证的普通角色卡访问上下文交给 `readImageContext`。它检查当前活动许可，按修订回读 completed-history，将正文 SHA、事件键逐行与场景事件对照，并在返回前复验当前会话。提示构造器只消费从正文重放得到且与当前 Scene、Visual 一致的可见事实。初次场景要求完整调查；旧的固定酒馆样例通过其原有提取器处理。玩家行动、编辑指令中的自由文本、世界书原文与旧图细节均不进入图像提示。[来源读取](../../packages/openai-image/context.mjs) · [提示构造](../../packages/openai-image/prompt.mjs)
- 编辑逐项检查同一 scope/scene、当前有效的已接受原件、历史视觉版本、审阅 ID、原图 SHA、尺寸、PNG 格式及实际字节。外发授权同时绑定持有人、会话、操作、当前视觉、配置、提示摘要与参考原件。只有本机展示许可时会在传输前拒绝。
- 适配器默认关闭。模拟模式要求无网络权限的 Node 进程和固定假凭据，不从环境读取密钥。以逻辑事件为身份在 P01 SQLite 账本预占合成单位，随后才调用注入的传输。没有自动重试、远端查询、取消或模型回退。400/422/429 记录明确失败，401/403 记录拒绝；5xx、超时、断流或无法核验的响应保留 unknown 和原占用。[适配器](../../packages/openai-image/index.mjs)
- 响应只接受一张规范 base64 编码的静态 PNG。限制 JSON、压缩字节、尺寸和像素解压量，校验块 CRC、完整 IEND、像素流及实际规格。真实使用量、模型名与请求 ID 只从确实返回且验证过的字段取值；缺失留空，费用留空。ImageTasks 保存并回读原件后创建 pending 资产。模拟测试验证了拒审、迟到、关闭和切换剧情后的可见性。原演示审阅器同时核对当前与持久记录中的 Provider 身份，避免 I1 结果被历史夹具自动放行。[响应解析](../../packages/openai-image/protocol.mjs) · [任务收件](../../packages/image-tasks/index.mjs)

## 官方协议核查与真实接入缺口

2026-11-22 阅读 OpenAI 官方文档核对生成端点、编辑端点、multipart 文件输入、base64 返回、候选模型与自定义尺寸规则。请求使用 `gpt-image-2.6-sunburst`；可选 complexity、流式输出及 partial images 均省略。该核查只访问公开文档。[生成](https://developers.openai.com/api/reference/resources/images/methods/generate) · [编辑](https://developers.openai.com/api/reference/resources/images/methods/edit) · [图像指南](https://developers.openai.com/api/docs/guides/image-generation)

官方模型页按 token 区分文字输入、图像输入和图像输出。核查时标准价每百万 token 分别为 USD 5、8、30。编辑原图会影响输入用量，现有 P01 预占使用合成整数。真实试点仍需道主明确项目及模型、每类调用次数、质量和尺寸、可外发的合成提示、指定参考原件与处理用途、最坏美元预算及最终确认。还须核实调用当日价格、项目实际访问权，并实现与持久发送边界一致的货币预算预留。[模型](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst) · [计价](https://developers.openai.com/api/docs/pricing)

## 复跑与回退

使用已安装的契约依赖，在仓库根目录编译契约，然后运行测试。回执参数指向一个新文件，已有结果保留。

```powershell
node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
node packages/openai-image/check.mjs (Join-Path $env:TEMP ("i1-" + [guid]::NewGuid() + ".json"))
```

默认宿主仍使用原先配置。离线装配时，给 `OpenAIImageProvider` 注入 mock mode、内存 transport、固定假 credentialsProvider、绑定宿主的 resolve、独立 authorizeOutbound、共享 Reservations。授权查询应返回预先核准的材料与 binding 摘要。同一服务的工作进程和重启都要使用同一持久账本。测试中的文件系统宿主负责原件 fsync，供应商代码始终运行在禁网子进程。[装配和进程测试](../../packages/openai-image/test/tasks.test.mjs)

开发中发现 multipart 会将文本换行规范化，已统一生成和编辑的提示摘要输入。另修正了模拟授权测试、夹具导入，以及将禁网 Provider 和需要 fsync 的原件宿主放在同一受限进程造成的失败。回退可在任务分支撤回本次提交；保留原件、审阅和已占用的账本。原 L1 ACKNOWLEDGED、L4 UNKNOWN_STOP、L5 PARTIAL 均沿用原记录。
