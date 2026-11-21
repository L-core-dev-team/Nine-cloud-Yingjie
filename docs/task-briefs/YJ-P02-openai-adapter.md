# YJ-P02｜OpenAI API 专用适配与受控真实试点关口（第一阶段）

- 编制日期：2026-11-21（北京时间）
- 状态：**供应商已由道主选定为 OpenAI API；本任务书已上传，业务实现尚未执行，真实付费/外发请求尚未获完整授权**
- 仓库：`quakhiak34568-lang/Nine-cloud-Yingjie`
- 工作分支：`codex/yj-p02-openai-adapter`
- 接续起点：`codex/yj-p01-real-service-readiness@2caab0d92059d77097af5a4e6859f56e51516c99`
- 上游九霄只读基线：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 公共契约：`@yingjie/contracts@0.1.1`，交换格式 `schemaVersion: "0.1"`
- **本次仅允许实际开发、官方协议核对、本地零网络模拟、必要的本地 PostgreSQL/HTTP/Chrome 联调。未经用户对费用、数据与素材外发及具体真实调用的明确批准，不发送任何真实 OpenAI API 请求。**

## 一、确定的供应商与未确定事项

道主已经决定使用**自己的 OpenAI API 账户**。这只是供应商选择，不自动意味着：

- ChatGPT Plus/Pro 的聊天额度可以当作 API 使用量；
- 当前 API Project 有足够的计费额度、组织验证、对应模型访问和速率限制；
- 允许把任何私人角色卡、世界书、真实玩家剧情、Discord/万卡阁资产外发；
- 允许实际付费请求、未知费用时继续发送或自动重试；
- 已确定模型 ID、最终质量/分辨率、留存及审核方案。

官方文档参考（开发时仍需验证调用当日最新版本和实际 API Project 可用情况）：

- 模型目录： https://developers.openai.com/api/docs/models
- 官方图片生成/编辑说明： https://developers.openai.com/api/docs/guides/image-generation
- 图片生成接口： https://developers.openai.com/api/reference/resources/images/methods/generate
- 图片编辑接口： https://developers.openai.com/api/reference/resources/images/methods/edit
- 开发者快速开始与安全配置： https://developers.openai.com/api/docs/quickstart
- API 计费： https://developers.openai.com/api/docs/pricing
- ChatGPT 与 API 分别计费： https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform

**初始候选**（不是账户已批准的最终绑定）：

| 路线 | 候选 | 目标 |
| --- | --- | --- |
| 文字 | `gpt-6.2-sol`，通过受信 Responses API 接口或核实现有九霄文字网关后选择兼容入口 | 生成剧情文字，再由九霄保存 completed-history，映界只读正文 |
| 图片首图与参考编辑 | `gpt-image-2.6-sunburst`，优先核对 Images API | 严格检验人数、结构和环境连续性 |
| 性能候选 | `gpt-image-2.6-flare` | 将来比较速度、修改精度与实际成本 |

官方支持的图片生成 `POST /v1/images/generations` 和编辑 `POST /v1/images/edits`，编辑需要明确的参考图及指令。输出可能以 base64 原始图片字节表示。**不能拿 YJ-02 图像工具实验替代真实 API；不能预设远端 job 查询、取消与服务端幂等已经存在。** 只在实际请求中验证并据实记录。

## 二、开工必读与基线保护

先核对远端 HEAD、本地工作区及未提交成果，禁止强制 reset，保留 YJ-13 的 `LOCAL_DEMO_PASS` 与 P01 的 `OFFLINE_PASS`。在隔离副本中完整阅读：

1. `AGENTS.md`、`README.md`、`docs/handoff.md`、`docs/decisions.md`、`docs/requirements.md`、本任务书。
2. `docs/reports/YJ-P01-real-service-readiness-report.md`、`docs/reports/evidence/YJ-P01/offline-final.json`、`local-card-final.json` 和 P01 本地 adapter：`packages/provider-readiness/offline.mjs`、`reservations.mjs`。
3. `packages/image-tasks/index.mjs`、`schema.sql`、`files.mjs`、`packages/first-play/planner.mjs` 与 `consistency.mjs`。
4. `packages/image-history/history.mjs` 的追加审阅与纠错限制；`packages/local-demo/` 及 22 项基线回归。
5. 固定九霄的 `apps/api/src/card-import/service.ts`、`model-access.ts`、`local-provider.ts`、`card-provider-runtime.ts` 和真正采用的 `CardModel` 注入点。
6. 官方 OpenAI 文字、Images API、认证、模型访问、当前价格和错误返回文档；核对当前日期，不调用不明或已经停用的旧图片模型。

本轮不得修改九霄或映界的 main、原完成分支、私人库/万卡阁数据，也不得把 OpenAI key 放进聊天、Git commit、浏览器、请求日志或测试 fixture。

## 三、工作包 A：OpenAI 文字模型的受信适配

最小实现一个可插拔 OpenAI 文字 adapter（可基于现有九霄受信 transport，不重复造账户体系）。

- 只用服务端受信配置指定固定的官方 OpenAI API host、可允许的模型 ID 与请求参数；拒绝角色卡/世界书/前端传入 endpoint、API key、权限或自定义模型。
- 身份与来源必须来自九霄 owner、session、pending action key 和 existing CardModelAccess；保持超时、中止、完成/失败/修订冲突的原事务语义。
- P01 的合成内容 allowlist 与受信权限先于任何外发请求。P01 fake 发送仅获准行动，不等于真实故事上下文足够生成高质量剧情；实现时须明确所需且允许出站的消息范围，由未来使用者批准。
- 原文字一旦真实生成，**先由九霄作为 authoritative completed-history 保存**，映界读取成功保存的正文进行可见事实提取，不让模型图片返回修改剧情或世界书。
- 为无网络测试提供可控 HTTP transport/recorded fixture。测试请求序列、错误码、timeout、streaming 非预期值、过长输出和权限中止。默认任何实际真实网络请求均被开关禁止。
- 输出内容缺少确定的人物/场景时保持 `not-ready`；不可把有限正则 65 条合成语料声称通用中文语义通过。

## 四、工作包 B：OpenAI 图片生成与编辑的受信适配

实作独立 `OpenAIImageProvider` 或等效可注入模块，将 YJ-05 的 `provider.send({attempt,plan,referenceBytes})` 转换为官方 Images API 生成与编辑调用的请求材料，包含两个操作：

1. **generate**：只使用已保存 completed-history 对应的可信 `Visual`，当前 scene、人物、结构、时间、光照、视点、视角和已获准的已揭示世界书标签组织图片提示。
2. **edit**：在以上现时 `Visual` 外，绑定上一张经允许用于 reference/edit 的 PNG，记录 assetId、SHA-256、真实尺寸、允许编辑用途。请求保留应保留的人物和结构，并准确描述本次新增/移除的目标；没有外发许可则必须在本地拒绝。
3. 未来实际执行的请求必须显式填充经确认的 model、质量、分辨率、输出格式 `png`、输出张数 `n=1`；若模型/账户不支持这些参数，应失败并停止，而不是静默改用其他昂贵模型。
4. 本次离线测试校验 HTTP 方法、官方路径、Authorization 只存在服务端、Content-Type、输入体结构、参考字节摘要以及返回 base64 图像解码、PNG/尺寸/摘要校验。严格限制响应大小与内容类型，拒绝不符合预期的服务端结果、非官方重定向、错误域名或异地下载链接。
5. 严禁把完整世界书、隐藏设定、未经审核的秘密或用户私人角色卡直接串进提示。参考图字节外发必须单独取得明确许可，不因素材在本地可显示就默认同意外传。
6. 未返回/无法确认是否被服务端接受时保持 `unknown`，保留原 requestKey / attempt，不自动重试同一逻辑付费请求。只有经过协议确认、用户授权与原账本对账，才能安排新尝试。
7. 保持 YJ-05 原件保存与 pending 审阅，拒绝的图不能展示或用于后续编辑；使用固定三张图片的 fixture 可验证规则，但不等于真实输出已人工/模型审核。
8. 明确先验中不支持 `providerRequestId`、查询、取消、独立幂等和用量计费的数据，不允许凭猜测生成这些字段。

**本轮禁止网络实发。** 使用本地 fake HTTP server 或注入的 transport 返回不含真实调用的合成官方协议响应，覆盖生成、参考编辑、400/401/403/429、timeout、撤权、坏图、结果未知与多进程防重。

## 五、工作包 C：真正的收费发送门禁与审阅

P01 的预算预留是在 SQLite 中用**合成整数单位**验证，不能直接当作货币预算或现有 PG 跨进程队列的生产门禁。

- 对未来真实调用实现或提出最小 PG 适配：同一事务内核对 `scope`、获准模型/端点、时效/次数/预算、参考图外发权利、当前视觉状态，登记预留、请求身份与发送状态。若需要跨库/事务协调，写明确的竞态和补救，而不是假装事务原子覆盖远程服务。
- **必须先于发送边界区分 `not-sent` 与 `unknown`：** 没有资格/限额时不能将未发送虚构成可能已发生的收费调用；进入可能送达区间后崩溃则保守记为 unknown。
- 对货币预算：只有账户已核对模型定价、币种、输入与输出 token/图片质量、最坏请求金额和供应商侧硬限制后才可能设置真实 cap。无法确定最坏计费时 STOP，不允许假设“每张固定多少钱”。
- 服务端 API key 只在受信环境变量/秘密管理器中取得，支持密钥缺失、失效、轮换和禁止外发密钥日志。不要在任何 GitHub 文件或本地截图中复制密钥；前端不能读密钥。
- 单次生成、参考编辑的全量日志仅写匿名结构化元数据：审批 ID、任务/attempt、scope 的不可逆摘要、官方可证的响应字段、时间、返回字节 SHA、实际 usage/cost（若供应商没有返回就 `null`）。不记录原始受保护的剧情或图片输入。
- 保持审核人与出图请求不同权利；不能让脚本因为图像摘要正确便自动宣称人数、角色、时间准确。
- 对纠错替代单独保留 `blocked:contract-adapter-required`，不要在此 OpenAI 接口实施中混入尚未批准的替代收费请求。

## 六、实际测试及完成范围

本轮要求在不发真实请求的前提下完成：

| 层级 | 必验范围 |
| --- | --- |
| 静态官方协议 | 官方模型/接口/参数与真实账户可用状态分别标记；未验证账户功能不写为已开通 |
| 离线 HTTP 协议 | 文字和 Images 生成/编辑的实际请求成形、输入最小化、响应验收、错误和 timeout |
| 发送前门禁 | 未配置真实 key、无审批、授权不符、素材缺外发许可、预算不确定时，发往外网次数必须为 0 |
| YJ-05 集成 | 本地 fake 响应接入真实 ImageTasks 写原件、pending review、合法参考与编辑；错误归属/撤权/未知不重发 |
| PG/Chrome | 在原九霄普通角色卡使用合成故事及图片，真实本地浏览器、鉴权、数据库经过完整链路；真实 OpenAI 调用次数 0 |
| 基线回归 | YJ-13 的 22 项全量回归至少两次（环境允许时）和 P01 的 7 项禁网，记录实际 PASS/FAIL/SKIP，任何复发超时需保留 |
| 移动/生产 | 只做必要兼容，不将模拟视口/本机 mock 标为真机与真实供应商通过 |

建议交付：

- `packages/openai-adapter/`（或合理名称）的受信适配模块与离线 request/response 测试；
- 独立配置模板（无密钥）、最小 PG/发送前门禁逻辑和受控启用开关，默认禁网；
- 测试用合成正文/图片与输出审核数据、脱敏 JSON 回执；
- `docs/reports/YJ-P02-openai-adapter-report.md`、官方文档/模型核查日期、环境安装、复跑和回退方式；
- 更新交接、任务状态和必要决策台账，保存 YJ-13/P01 既有证据、旧分支和两个项目 main；
- 明确下一阶段仅在**新的一次授权**后才能执行 1 文字+1 生成+1 编辑的最小真实试点。

如果无法在原有 0.1.1 契约和 YJ-05 队列里安全建立费用门禁，可把真实发送入口保持 hard-disabled，交付独立 PG 模拟保护与明确的 BLOCKED。**不能为通过测试偷偷发一笔真钱请求。**

## 七、真实试点放行条件（后续单独确认，当前不执行）

用户目前只选定 **OpenAI API 供应商**，没有提供明确的 API Project 可用证明、预算与素材外发范围。应向道主分轮确认，不发密钥到聊天：

1. 他是否已有 `platform.openai.com` 下可用的 API Project Key，以及是否具备文字和目标图片模型调用额度/可用权限。ChatGPT 订阅和 API 计费分开；部分符合条件订阅可能有 API credits。
2. 预定要发送的仅为当前项目的合成酒馆正文与哪张 **明确允许外发** 的 YJ-02 原件。禁止默认读取私人世界书、万卡阁或真实角色卡。
3. 用户明确批准具体模型、生成/编辑的请求上限、币种与单笔/总预算、unknown 立即停止条件，付款途径与审阅归属。
4. 数据保留、审阅、删除与输出使用权限，允许首次真实网络调用的明确动作。
5. 在服务器受信环境配置密钥并验证访问能力（本项目仓库不能保存密钥），再启用开关；按顺序单笔批准、一笔成功确认后才进入下一笔。
6. 真实模型的响应格式、用量/费用、限制、图片 SHA/构图与连续性结果应真实回填。若没有官方实证，字段保持 UNKNOWN/null。
7. 即便真实试点成功，也仍不能把有限中文规则理解或三张图的编辑成功率推广到任意题材、真实手机或生产部署。

## 八、Codex 最终汇报格式

```text
道主，YJ-P02 OpenAI 专用适配：OFFLINE_PASS / PARTIAL / BLOCKED。

当前分支、本地/远端完整 SHA、工作区：
实际锁定的官方 API/模型文档版本：
文字模型 adapter、图片生成和参考编辑 adapter 的代码及范围：
真实调用开关状态、禁网与授权阻断条件：
SQLite→PG 预算/发送前状态的实际结果与未解决竞态：
HTTP 合成请求、PNG、PG、浏览器、原基线回归测试数：
权限、素材外发、提示过滤、费用/unknown 规则：
真实 OpenAI 文字/图片 API 调用实际次数（预期 0）：
纠错替代仍阻塞的原因：
待道主授权的预算、许可、API Project 模型访问：
代码、报告、证据、回退链接与最小试点放行条件：
```
