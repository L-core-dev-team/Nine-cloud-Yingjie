# YJ-P02-I1｜交给 Codex：OpenAI Images 首图与参考编辑的离线供应商适配

- 日期：2026-11-22（北京时间）
- 负责人：Codex（**图片适配器开发**；不得继续调查 Dot 负责的 Windows TCP EACCES）
- 隔离分支：`codex/yj-p02-i1-image-adapter-offline`
- 固定基线：`codex/yj-p02-l5b-loopback-closeout@6d9fa510cb6daa75e50eb9a4ebd4a277a8a70ec5`
- 九霄只读上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- 目标：完成**映界后端图片生成 generate 与保留人物/结构的参考编辑 edit 的 OpenAI API 适配器**，让已有 YJ-05 ImageTasks/审阅/原件体系可接入真实供应商协议。当前先做零成本、可离线验收的业务代码。
- **本阶段真实 OpenAI 模型 GET/文字 POST/图片生成与编辑 POST 全部 0 次；严禁索要、读取或保存真实 API Key；用户尚未授权任何新的图片 API 支出。**
- 与 Dot 任务 [YJ-ENV-01](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/7d2badc6284174053ed3012766a79edd1346124f/docs/task-briefs/YJ-ENV-01-dot-loopback.md) 完全并行；任何本机 TCP 环境阻塞单列 ENV_BLOCKED，不要让该阻塞吞掉可独立完成的离线源码工作。

## 一、仓库内已有能力，绝对不要从零重建

开工先读取：

- `AGENTS.md`、`README.md`、`docs/handoff.md`、`docs/requirements.md`、`docs/decisions.md`、本任务书；
- `docs/reports/YJ-02-image-capability-report.md`、`docs/reports/evidence/YJ-02/accepted.json`：实际用过 Codex 图像工具得到 I0 → I1 → I2（3 人→5 人→5 人）和复用，**不是九霄后端 OpenAI Images API 调用**；
- `docs/reports/YJ-05-image-tasks-report.md`、`packages/image-tasks/{README.md,index.mjs,files.mjs,schema.sql,reviewed-elements.json}`：已实现逻辑 task、attempt、PG 发送前边界、参考资产资格、PNG 原件 CRC/SHA/尺寸检查、审阅 pending 与保守 unknown；
- `packages/first-play/{planner.mjs,consistency.mjs,view.mjs}`、`packages/scene-state/project.mjs`：从已保存 completed-history 取得可知 scene/visual；不以玩家 action、模型自报 JSON 或图片细节填充剧情；
- `packages/world-assets/`、`packages/image-history/`：世界书已揭示标签与参考素材审阅、历史和撤权；
- `packages/provider-readiness/{offline.mjs,reservations.mjs}` 和 [P01 报告](../reports/YJ-P01-real-service-readiness-report.md)：fake 适配、授权、预算与 unknown 防重先例；原 P01 只有合成单位，不能冒充 USD 计费；
- [已存在的 P02 供应商综合任务书](YJ-P02-openai-adapter.md)：本 I1 **只聚焦 Images API**，不重复开发文字 Luna 接口或改变旧 L1/L4 的账本；
- `packages/contracts/src/schema.ts` 与 `ImageTasks.dispatch/receive` 的真实接口。尽可能复用 0.1.1 交换契约，禁止扩散新 schema。

已知 [L5B 回环阻塞](../reports/YJ-P02-L5B-loopback-closeout-report.md) 为环境本机 `connect EACCES`；Codex 不负责绕过，也不要因为无法用 localhost 运行 PG/Chrome 而反复浪费任务轮次。

## 二、当前官方协议（开发时再次核对，模型访问权限仍未知）

截至本任务日期核对 OpenAI 官方文档：

- [Image generation 与编辑指南](https://developers.openai.com/api/docs/guides/image-generation)
- [Image generation API](https://developers.openai.com/api/reference/resources/images/methods/generate)：`POST https://api.openai.com/v1/images/generations`。
- [Image edit API](https://developers.openai.com/api/reference/resources/images/methods/edit)：`POST https://api.openai.com/v1/images/edits`，可使用受信 multipart 单图输入（官方也支持带 `images` 的 JSON 请求）。
- [GPT-Image-2.6 Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst) 与 [Pricing](https://developers.openai.com/api/docs/pricing)。本轮优先用 `gpt-image-2.6-sunburst` 设计，适合对构图/人物保留较精确的实验；`gpt-image-2.6-flare` 仅作后续速度候选，未经新授权不得自动切换。
- 图片模型生成/编辑返回通常包含 `data[0].b64_json`，实际 `usage` 字段是否出现须按真实回包判断。**不要把每张费用当常数；图像输入、输出按模型与 token 计价。**
- 官方图片接口的生成/编辑与 Codex 的 image_gen 工具是两条不同路径；不能把 YJ-02 工具实验当作本适配器的真实 API 证明。

建议的**离线默认请求**：单张横向静态图、`n=1`、`output_format="png"`、`size="1536x864"`（16:9，尺寸为 16 的倍数）、`quality="medium"`、可选 `complexity="medium"`，不启用 GIF/SVG/stream/partial_images。具体参数支持性必须以当前官方接口为准，出现不支持的参数时**失败并报告**，不可静默切换模型或出多张。此配置只是候选而非用户已批准的付费规格。

## 三、工作包 A：受信 OpenAIImageProvider 两条通路

在 `packages/openai-image/` 或与现有 packages 命名兼容的独立目录，实现可测试模块，构造函数显式接收：
`{ transport, credentialsProvider, modelConfig, authorizeOutbound, budgetGate }`（可根据仓库代码做小幅调整）。**默认 LIVE_DISABLED**，所有测试将 fake `transport` 注入，不能硬编码自动使用 global fetch 或环境中的 OPENAI_API_KEY。

### A1. 生成初图

- 仅从已经保存并成功抽取的 `Visual` 与 `Scene`、合法 `Decision(generate)` 获取人物、结构、时间、光照、观察位置与方向，以及明确已揭示并获准的世界书可见标签。
- 人数与完整性由当前正文和契约判断；如果 `status=not-ready`、只有“至少三人”而无完整名单、跨场景歧义、旧图撤权，则不得构造可发送请求。
- 图片 prompt 目标是静态世界的一帧：当前视角、准确人数与位置、环境结构、场景风格与故事时段；明确不允许补造玩家尚未揭示的人物、隐秘建筑、世界书秘密和与剧情矛盾的装饰。不要把原私人完整故事、角色卡或世界书原件直接发送给图片模型。
- 绑定 `sceneId`、`visualVersion`、`eventKey`、`requestKey` 与规范化 prompt 摘要。模型不能自行修改剧情/人数/场景状态。

### A2. 参考编辑

- 只接受 `Decision(edit)` 和 `ImageTasks.reference` 已复核的**同一 scope/scene**、SHA-256 对应字节、审阅 accepted 且外发用途被单独允许的原始 PNG；缺失任一资格拒绝。
- 再验证参考图的大小/格式/尺寸、原件所有权与明确允许外部图像处理的授权。对“本地允许显示”与“供应商允许接收原图”分别设门禁，不能混为一谈。
- 优先构造官方 `images/edits` multipart 单张 PNG 上传。描述保留原图的固定结构、角色服饰/身份与可见位置，仅实施本回合真实新增/退出的角色、光照变化等；不得自动增加原剧情未涉及的物件。
- 若参考图未经明确**外发**批准，可在离线 fake 中用受控 YJ-02 样例验证，但不能在真实模式中上传。

## 四、工作包 B：请求/响应契约与不重复扣费

- 将请求固定到官方 HTTPS 主机/路径；模型固定候选白名单；明确响应上限/超时/最大 JSON bytes，禁重定向、非官方 URL、SDK 自动重试、模型回退及任何 tool 的间接生图。
- 原生 JSON generate 与 multipart edit 分别断言 Content-Type、字段、图像字节 SHA、prompt hash，Authorization 在离线测试只能用非真实假 token。日志不得出现 token/原始私密提示/私图。
- 接收模拟 `data[0].b64_json`，仅允许合理最大数量 n=1，严格 base64 解码，检查 PNG 签名、CRC、尺寸、原件落盘、SHA 与字节上限；超长、损坏、空数组、意外格式、多张、远程 URL 替代、畸形 JSON 都必须拒绝/不展示。
- 真实 API 的 `usage` / provider response ID / token cost **只有官方确实返回才登记**，未返回记 null；离线响应模拟仅记 `origin=mock`，不得标真实 Provider capability 已验。
- **不要为了测试方便自动审阅通过图片**。YJ-05 receive 先创建待审资产；人工/受信审查必须确认图片人物、固定结构、视角、时段及连续性后，才能展示、复用或再次参考编辑。对修复图“文字故事不变、坏图不展示”必须保留。
- 映界现有 `ImageTasks.dispatch` 在 PG 中将 attempt 记为待发送后调用 `provider.send`；真实**货币预算预留、图像外发权利、单次 grant 与持久 send-ahead 状态必须在可能出站边界前完成**。如果当前系统没有足以原子保障的 USD 费用上界/跨进程授权逻辑，**真实发送永远 LIVE_BLOCKED**，不能把现有 P01 合成整数预算视为美元 cap。
- 5xx、timeout、客户端断线、进程崩溃或返回无法对账统一为 unknown 并保持占用，不能通过新 attemptId、替换 requestKey 或重开工作区自动补发。401/403/429 等明确拒绝与可能已送达要按可验证证据区分，不假设供应商支持查询/取消/服务端幂等。

## 五、工作包 C：在当前 TCP EACCES 条件下仍应完成的测试

**可立即执行、不依赖 Node/Chrome/PG TCP 的必做项：**

1. 测试纯请求构造：生成/编辑正确方法/路径、模型/尺寸/格式/n=1、不同 `Visual` 不同 prompt/摘要、错误来源拒绝，**不得调用真实 OpenAI**。
2. 测试注入式内存 fake transport：正常 PNG `b64_json`、无 usage、附 usage、错误模型/返回数、API 错误 400/401/403/429/500、超时、断流、损坏 base64、无 PNG IEND、超大文件/尺寸，状态有明确分类；没有自动重试。
3. 使用 YJ-02 现成已允许的本地 PNG fixture，校验 reference byte SHA、edits multipart 编码与人物/结构保留文字，确认**不会把未审核私有素材出站**。
4. 接入 `ImageTasks` 的假 provider，使用可注入/临时数据库替身模拟 task/attempt/receive/review 关键接口；不要把全内存测试冒充原九霄真实 PG 成功。现有完整测试如果依赖 TCP，在已拒绝环境应记 `ENV_BLOCKED / NOT_RUN`。
5. 负向边界：`not-ready`、三人仅局部在场、不同账户、错误 scene/version、撤权/审阅不合格/过时图片、重复逻辑任务、两进程竞争、可能已发送后恢复、剧情变化而图像迟到、用户关图、预设图合法复用和 skip，都不得误发或显示错误图。
6. 继续运行当前环境可执行的契约 10/10、L3 30/30、P01 7/7、旧 L1/L4 mock 15/15、已有 image-tasks 不需要 TCP 的纯测试。保留真实 PASS/FAIL/SKIP，不要用历史 YJ-13 22/22 代替当前重跑。
7. 真正的 PG/Chrome 原会话端到端、授权 UI 与后续真实供应商联调，明确列为 `ENV_BLOCKED` 和 `NOT_RUN`，由 Dot 的 YJ-ENV-01 合法修好 loopback 后再补齐。**不可通过管理员权限、代理隧道、开放公网或换未授权工具来绕过。**

## 六、交付与验收

最小交付：

- `packages/openai-image/` 适配器实现、请求构造、fake transport、完整无网正反例和统一 model/response/usage 解析器；
- 受信 prompt builder、reference licensing/sha 验证、单次发送保护与审核返回路径（若货币发送前门禁不完整，必须 LIVE_DISABLED）；
- `docs/reports/YJ-P02-I1-image-adapter-offline-report.md`、`docs/reports/evidence/YJ-P02-I1/` 的脱敏 JSON；
- 官方 API/模型/计费核查日期、能力是否实际验证、后续真实试点的素材外发与美元预算待批准列表；
- README、handoff、task-sequence、verification 和必要 decisions 更新；固定 GitHub 完整 SHA、本地干净工作区、可复跑命令、回退说明。
- **不可修改**旧 L1/L4 许可、旧 L4 UNKNOWN_STOP、L5 PARTIAL、Dot 的 ENV 分支或映界/九霄 main，不读取万卡阁/私人 Discord/真实世界书。

**成功状态应分层：**

- `IMAGE_ADAPTER_OFFLINE_PASS`：纯适配器、格式解析、权限/图像质量审查边界、假传输与禁网防重均通过；原生 PG/Chrome 若仍受 EACCES 阻塞须单列 `ENV_BLOCKED`，**不可宣称真实图片 API 成功**。
- `PARTIAL`：代码或无网负例仍未通过，需要实质修复。
- `BLOCKED`：未解决预算/权限或安全必需门禁，真实发送仍锁定。
- 真正的 `REAL_IMAGE_GENERATION_PASS` 和 `REAL_IMAGE_EDIT_PASS` **不属于本轮**，必须后续另获明确 API Project 访问、参考图外发许可、模型和质量/尺寸规格、最坏预算、每类调用次数及本人最终授权，并在实际真实网络回执与原件审阅通过后分别判定。

## 七、Codex 汇报格式

```text
道主，YJ-P02-I1：IMAGE_ADAPTER_OFFLINE_PASS / PARTIAL / BLOCKED

当前分支、实际提交/远端 SHA、未提交工作树：
官方 Images API generate/edit 和候选模型/参数如何核验：
OpenAIImageProvider.generate、.edit 的代码与注入 transport：
与 ImageTasks / Scene / Visual / referenceEligibility 的接线与权限：
源文本完整名单、场景、视角的事实边界与合成提示：
参考图是否仅来自合格 PNG，是否仍禁真实外发：
base64 响应/PNG 验签/尺寸/原件保存及待审 review：
原生 JSON / multipart edit / 错误码/unknown/防重模拟实际通过数：
货币预算/发送前许可是否达标；真实 LIVE_DISABLED 是否保持：
当前 EACCES 是否令 PG/Chrome 实测未运行，具体未验证项：
本轮真实模型 GET、Responses/Images 请求均为 0、费用 USD 0：
旧 L1/L4/L5 状态及 main 是否保持：
后续一次真正受控生图须道主另外批准的模型、尺寸、质量、原图外发、次数和美元上限：
报告、脱敏证据、源码及回退链接：
```
