# YJ-P02-L4｜真实 Luna 场景叙事试点：离线预备与独立授权关口

- 日期：2026-11-22（北京时间）
- 状态：**任务书已创建；L4 代码/测试尚未执行；新真实 API 请求尚未授权**
- 仓库：`quakhiak34568-lang/Nine-cloud-Yingjie`
- 分支：`codex/yj-p02-l4-luna-scene-pilot`
- 接续完成 SHA：`codex/yj-p02-l3-scene-evidence-contract@7c5c68dbc27d20317c2668d19eb222f2a5010041`
- 九霄固定只读上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- **本任务书只授权编写适配、独立预检、安全门禁及离线测试；不授权产生第二笔真实 API 费用。**
- 任何真实模型请求必须在后续获得道主明确的**新一笔**模型/文本范围/美元预算/调用次数授权，且由本人在受保护的页面独立点击执行。没有新授权时应交付 `READY_FOR_APPROVAL` 或 `LIVE_BLOCKED`，请求 0 次。

## 一、为什么现在推进真实叙事试点

L1 一次 `gpt-6-luna` 真实调用已经成功，九霄保存 completed-history，但仅 39 输出 tokens 的正文缺少确定的地点、视角及完整人物名单，映界正确地返回 not-ready。L2 只读核对正文 SHA，改进了局部事实识别但仍正确留空。

L3 完成：`scene-evidence/1` 在隔离投影中追溯七项初始场景证据：地点、viewpoint、perspective、完整 people 名单、features、timeOfDay、lighting；32 个合成 Chrome/PG/原角色卡回合，三个地点可 ready，23 个信息不充分案例 not-ready，酒馆 V1 三人→V2 五人及确认复访可保持连续；契约 10/10、提取综合 30/30、P01 7/7、L1 15/15，YJ-13 先 21/22（原预设标签超时）后两次 22/22。**L3 只有合成语料、固定地点词表和严格句式；真实模型遵循提示和图片生成能力均未验证**。

资料入口：
- [L1 真实文字报告](../reports/YJ-P02-L1-luna-text-smoke-report.md)与其脱敏回执
- [L2 原文只读回放报告](../reports/YJ-P02-L2-live-text-extraction-report.md)
- [L3 工程报告](../reports/YJ-P02-L3-scene-evidence-report.md)和[回归](../reports/evidence/YJ-P02-L3/regression.json)
- [候选场景叙事提示](../../packages/first-play/scene-survey-prompt.md)
- `packages/first-play/scene-evidence.mjs`、`test/scene-evidence-fixtures.mjs`
- `packages/luna-text/adapter.mjs`、`ledger.mjs`、`ui-pilot.mjs`、`key-entry/`
- `docs/requirements.md`、`docs/decisions.md`、`docs/handoff.md`、`AGENTS.md`

**真实目标：**用一条由用户自己批准的全新 Luna 自然叙事，判断是否可以从九霄已保存的正文建立完整场景，或准确指出不足。**绝不可为制造 ready 而让解析器照着隐藏提示、玩家行动或旧图补数据。**

## 二、本轮可立即做的工作（全部零网络）

### A. 独立下一笔请求，不复用 L1 授权

- 在 L3 代码之上实现可注入的 **L4 单次文本请求**配置与测试流程，固定 OpenAI 官方 `POST /v1/responses`、仅候选 `gpt-6-luna`。模型在执行当日重新核对官方文档和真实 API Project 权限；不以历史 L1 成功保证当前可调用。
- 原 L1 approval `~/.nine-cloud-yingjie/yj-p02-l1/approval.sqlite` 已 `ACKNOWLEDGED`，**只读保留，禁止重置、挪作新批次、删除或更换许可 ID 绕过限制**。L4 若以后获批准，必须使用**全新且显式标识的批准对象**与独立持久账本，例如 `YJ-P02-L4-single-luna-scene`，其创建前有新授权证据和输入摘要、模型、预算、有效期及合成数据用途；不允许在没有新授权时抢先创建可用的真钱 permit。
- 继承 L1 对 HTTPS 目标、DNS/TLS、非官方重定向、无 SDK 自动重试、unknown 保守停止、并发进程单次 claim、无敏感日志、`store:false`、无 tools/图片/后台调用的保护。任何请求可能送达即不重发。
- 使用 L1-K 的**安全一次性输入 UI**（或平台原生可信秘密输入）作为未来选项，绝不要求道主把 Key 发在聊天、GitHub、任务文件或普通无认证的公网表单。填入密钥、预检和点击真正“开始调用”是三个分开的动作。页面不可达或不可信则禁用 real。
- 初期全部采用 fake transport，无真实 OpenAI 文字或图片调用。

### B. 候选的自然叙事输入与可见场景事实

- 用已经受信的**合成场景基础事实**准备新一次候选请求，例如东村青石酒馆、玩家站在正门朝北观察、柜台/双窗、正午日光、现场确实经过完整环视并确认只有掌柜、蓝衣客和赭衣客。全部由测试人员合成且本次明确设定，**不读取私人世界书、Discord/万卡阁、旧真实历史或客户隐私数据**。
- 将这些基础事实作为将来可发的**明确合成测试材料**，用 [候选模板](../../packages/first-play/scene-survey-prompt.md)帮助模型以自然中文叙述；建议约 150–300 汉字，不能强制列 JSON 或输出隐藏推理，也不能强迫不存在的剧情事实成立。普通会话和不知道的内容允许留白，不能把完整视野调查变成每轮固定问卷。
- 明确区分“测试输入里已设定的事实”和“模型**真正写在已保存正文中**的事实”。后者才是映界视觉依据。模型若省略某个字段，最终就不 ready；模型若捏造改变已设定人数或地点，应记录矛盾、保守拒绝，不能将其当作成功。
- 现在的 `scene-evidence/1` 只支持少量固定中文句式和登记地点，**不可在测试前为未来未知的模型输出硬编码答案**。先离线准备语义等价的正反例、标点/语序变体和一个不同题材地点，标清模型自然表述即便事实充分也可能导致不必要弃判。
- 若需要另起 extractor，采用版本化独立投影和可回退对照；**默认 /2 与 /3 replayOnly 不变**。不应以自动默默宽松规则替代独立审阅/语义验证。测试不仅统计 ready，还要统计 false accept 与 abstain。

### C. 跑完本地完整链路

- 用真实 Chrome/九霄普通角色卡页面/鉴权 HTTP/PostgreSQL 保存至少一条**合成模型返回文本**，读取权威 completed-history，然后交由 L3 scene-evidence 旁路在新 PG 投影审计，保持图像 task/attempt/send = 0。
- 预先设计下一次真实响应分析脚本（无密钥、只读历史）：核对请求/响应 ID 摘要、`source`、正文 SHA、字段级 evidence span、当前性与 complete/partial/unknown、`ready/not-ready`、失败理由、是否与合成固定条件冲突。**不能以 SHA 匹配替代语义正确性的检查**。
- 在新的隔离本地环境重跑：契约 10、L3 30、旧 65 样本 /2 /3 兼容、P01 7、L1 15、YJ-13 完整 22；保留原 YJ-07 偶发超时，必要时只做独立根因定位，不随意提高全部等待时间掩盖。
- 提交开发代码、合成 fixture 和脱敏离线回执，报告 `REAL_TEXT_CALLS_THIS_STAGE=0`、`REAL_IMAGE_CALLS=0`、`NEW_COST_USD=0`。不要用本地模拟结果写“真实 L4 已通过”。

## 三、后续真正发一笔 Luna 请求的放行条件（**目前没有授权**）

仅当道主新明确确认以下全部内容、并在受信 UI 单独点击“执行”后，才允许一个全新真实调用：

1. **模型**：`gpt-6-luna`，固定 Responses 文本生成端点；不得回退其他模型。
2. **数据**：仅本文件的开发者合成酒馆初始事实/最小玩家行动/已获准模板；不向 API 发送私人卡、世界书原件、万卡阁资料、照片或真实存档。
3. **次数**：建议**最多 1 次**全新的文字推理（不是沿用 L1）。
4. **费用**：**新的美元预算尚待道主同意**。可将 `USD $0.10` 作为推荐的待确认上限，**不是当前授权额**。调用当日核对 Standard 价格、项目计费、输入/输出 token 上限及估算上界。费用上限无法受信约束则不发送。
5. **凭据与体验**：用户亲自通过经过验证的受信本机输入页输入 Key，明确检查数据范围、预算、调用次数后独立确认。不能仅靠“Key 已经存在”或“用户上次同意过 $0.10”自动启用。
6. **结果**：若这一次成功，先由九霄作为唯一权威保存 completed-history；从保存正文导出证据，再判断 ready/not-ready。若未生成完整现场，保留留空，返回具体缺失字段。出现 401/403/429、响应未知或超时都停止，不重试，不改 UUID 换账本补发。
7. **没有图像授权**：即使 ready，也保持图像生成、参考编辑、图片 task/attempt/send 实发 0；图片专用模型与费用须之后另行明确批准。

若授权未获得或网关条件不满足，则以 `READY_FOR_APPROVAL / LIVE_BLOCKED` 收口，不得编造实发回执。

## 四、收口标准与报告

- `PREP_OFFLINE_PASS`：离线文字请求准备、独立批准和单次防重设计、合成九霄/映界回环、正反例、回归与秘密输入 UI 均完成；**真实 API 调用 0**，说明下次明确授权必须填什么。
- `PARTIAL / BLOCKED`：若有任何预算、权限、语义审查/安全控制不足，保留代码但保持真调用关停。
- `ONE_CALL_PASS`：**未来**另获批准并真实发送 1 次后，模型响应、费用、九霄已保存正文和场景提取均有可核对回执；结果为 not-ready 也应如实记录，不能把单次失败强行转成 PASS。
- `UNKNOWN_STOP`：请求可能已送达，但缺回执；保留新一笔独立账本和供核对的证据，不补发。

应交付：
- `docs/reports/YJ-P02-L4-luna-scene-pilot-report.md`、`docs/reports/evidence/YJ-P02-L4/` 脱敏离线回执；
- 受信 L4 试点 adapter 与无网测试、候选模板与受限场景数据；输入 UI/复跑和回退说明；
- 更新 README、handoff、task-sequence、verification 与必要的 decision；不改旧 L1/L2/L3 源证据；
- 远端完成 HEAD、本地/远端一致性与非网络门禁证据；
- **严格分别汇报**源代码完成、模拟可用、真实模型已调用与否、独立语义准确率未知项。

## 五、Codex 最终汇报模板

```text
道主，YJ-P02-L4：PREP_OFFLINE_PASS / PARTIAL / BLOCKED / ONE_CALL_PASS / UNKNOWN_STOP

当前分支、本地与远端 HEAD：
与 L3 完成提交的关系，是否改动 main：
合成的已知测试场景与申请外发范围：
未来新 Luna 请求的 prompt 及 input bound / max_output_tokens：
独立授权/账本（不得复用 L1）和安全 UI 现状：
合成 Chrome → 九霄 completed-history → 映界 scene-evidence 完整回执：
正反例、L3 30、旧 65、YJ-13 22、P01 7、L1 15 的实际结果：
本阶段新增真实文字/图片 API 请求（当前必须 0）与费用：
真实模型自然叙事遵循率是否测过（未发实请求写 NOT_RUN）：
费用上限/次数/素材范围是否已获道主**新的**明确批准：
工程报告、证据、GitHub 提交、回退与下一次明确授权所需动作：
```
