# 变更记录

## 2026-11-23 · H3-B2 任务书与接续索引准备

- 核对 H3-B 固定提交 `4db0787`、新语料 216 修订（开发发现 15/22、预留 4/21，事实确认 0/19）、H3-A 12+52 安全历史、H3-B 30 项防护和真实跨文风能力未验证的边界。
- 在独立新分支上传[H3-B2 命题核验任务书](docs/task-briefs/YJ-P04-H3B2-proposition-grounding.md)：先冻结新样本，分隔不可信候选、可溯源命题、支持/反证和事务确证；错误确证仍为硬门槛。
- **当前仅任务书和文档，未修改代码、未执行测试/外部模型/图片、未启动 Codex。** 两个 main、原付费授权、生产默认保持原状态；H3-C/D1 继续后置。

## 2026-11-23 · H3-B 离线实测交付

新增独立 narrative-highlight/3b 回放、合成语料、逐例测量与失败记录。接口离线安全通过，语义泛化未验证。 真实模型调用及费用为零。[运行报告与回退](docs/reports/YJ-P04-H3B-semantic-candidates-report.md)

## 2026-11-23 · H3-B 语义候选与因果安全融合任务立项

- 核验 H3-A 完成提交 `69e3cc8`、941 前缀、12+52 因果安全与公开 10 项新增错拒；确认新 H3-B 基于该提交独立分支。
- 上传 [H3-B 完整任务书](docs/task-briefs/YJ-P04-H3B-semantic-candidates-evidence-gate.md)。重点区分候选提出与权属/因果确认，保留整修订原子审查、S2 图像事实及 I1/I2 授权；必须先冻结并严格区分 fake/oracle 与真实 NLP 泛化测量。
- 道主批准的仅为 H3-B 离线范围，**本轮创建分支和文档，新代码、新语料和本机运行尚未实施**。无真实模型 API、图片、私有素材外发或付费、无生产切换，两项目 main 不变。H3-C/D1/Q1 后置。

## 2026-11-23 · H3-A 离线因果安全验收

**H3A_OFFLINE_CAUSAL_SAFETY_PASS**。新增 narrative-highlight/3a 离线事务性审核入口、冻结语料及逐修订状态差异。原 H2R 仍为 PARTIAL。 生产默认入口沿用原版，新增真实模型费用为 USD 0。[运行报告与回退](docs/reports/YJ-P04-H3A-causal-safety-report.md)

## 2026-11-23 · YJ-P04-H3A 任务准备

- 从 H2R 的 `e99fb10` 只读核验报告、`causal-audit.json` 两条失败和现有逐句状态提交代码；建立独立 `codex/yj-p04-h3a-causal-safety` 分支。
- 上传[完整任务书](docs/task-briefs/YJ-P04-H3A-causal-safety.md)，要求整回合收集/冲突审核/事务性提交，区分登记事实、实际权益和因果归属；保留旧失败与回归、先冻结新对照再修改规则。
- **本轮只修改文档**，新代码、真实离线测试、供应商/图片请求均 NOT_RUN；H2R PARTIAL、H3-B/H3-C/D1 待后续单独安排，旧付费门禁及两个 main 不变。

## 2026-11-22 · YJ-P04-H2R 质量强化结果

**H2R_PARTIAL**。交付 H2R 语义记忆、双轴评价集、原 12 项视觉审计、一次性预留评估与失败回执。付费门禁维持原状态。 生产默认沿用原版，本轮真实请求和费用均为零。[运行报告与回退](docs/reports/YJ-P04-H2R-semantic-generalization-report.md)

## 2026-11-22 · H2R 质量强化专项立项（仅文档）

- 从 H2 完成提交 `c352f86` 派生独立 H2R 任务分支；创建[执行任务书](docs/task-briefs/YJ-P04-H2R-semantic-generalization.md)。
- 明确语义确认/叙事重要性/视觉资格分层、旧四漏判和十二视觉候选保留、独立语料先冻结后改算法、严禁为刷分改金标或越权生图。
- **本轮业务代码、模型训练、真实出图、回归执行均 NOT_RUN。** H2 `PARTIAL`，旧许可、I2 付费门禁、两个 main 均不变。

## 2026-11-22 · YJ-P04-H2 离线研究交付

新增 `narrative-highlight/2`、`highlight-ranker/2` 与 `highlight-cadence/1` 的离线研究入口、实现前冻结的评价集和逐回合回执。YJ-P04-H2 为 **PARTIAL**。 生产默认入口沿用原版，H1 可直接回放。新增真实模型请求和费用均为 0。[运行报告与复跑方法](docs/reports/YJ-P04-H2-arc-payoff-cadence-report.md)

## 2026-11-22 H1 研究交付核验与 H2 长线高潮/出图时机任务准备

- GitHub 独立核对 H1 `74ea580` 完成提交、锁定 14 条故事/66 修订、15/16 关键高潮、0/50 普通误报、10/11 top-1 与原三条中途错误；唯一最终漏判“渡船”权利变化未被掩盖，旧语料 Git blob 不变。
- H1 直接导演候选仅在完整可见事实另获核实时才可能产生；原锁定高光中的 15 条都未获得可独立出图的完整现场条件。H1 只是有限中文规则的零模型离线原型，非通用高潮审美验收。
- 自 H1 已验收 SHA 独立创建 `codex/yj-p04-h2-arc-payoff-cadence`，提交 [完整 H2 任务书](docs/task-briefs/YJ-P04-H2-arc-payoff-cadence.md)，准备通用权益转移、跨回合/多线兑现、相对峰值和导演候选去重。**本次仅任务文档，H2 代码和新测试未执行**；旧 L1/L4、I2 LIVE_BLOCKED、Issue #1/#2、两个 main 未变。

## YJ-P04-H1 剧情关键事件与高潮研究

H1 已在独立离线回放中完成研究原型。14 条合成故事线的 66 个修订中，16 个标注关键时刻检出 15 个，50 个普通回合误报 0。漏判为渡船所有权变更。真实模型调用和费用均为 0。 [运行报告与回放入口](docs/reports/YJ-P04-H1-highlight-replay-report.md)

## 2026-11-22 S3 静态预览交付

**YJ-P03-S3 · S3_PREVIEW_PARTIAL。** 已交付固定 20 回合离线试玩。打开 [index.html](packages/offline-play-preview/dist/index.html) 即可体验；携带 media 文件夹可查看独立的旧酒馆图册。20 回合与 16 项交互检查通过，当前 Windows 的原生浏览器在导航前退出，状态为 BROWSER_NOT_VERIFIED。[运行报告](docs/reports/YJ-P03-S3-offline-play-preview-report.md)

## 2026-11-22 S2 离线验收核查与 S3 用户可操作预览任务准备

- GitHub 核实 S2 完成提交、100 条锁定语料的 44 eligible / 12 needs-review / 10 conflict / 34 not-ready，以及 20 修订的模拟生成/编辑、复用、迟到归属和拒审。真实 OpenAI/原生 PG/Chrome 均 NOT_RUN。
- 对照现有 YJ-06 的原角色卡映界 UI，在 S2 完成提交之上独立建立 `codex/yj-p03-s3-offline-playable-preview`，上传 [静态无 TCP、可打开/可点击的 S3 完整任务书](docs/task-briefs/YJ-P03-S3-offline-playable-preview.md)。本轮仅任务与交接，未生成 S3 页面或运行新的测试。
- 强制区分抽象格式测试 PNG、YJ-02 旧工具真图、真实 Images API 尚未发送，保留 ENV_BLOCKED、LIVE_BLOCKED_COST_BOUND、旧许可、原分支和两个 main。

## 2026-11-22 S2 隔离回放验收

**YJ-P03-S2 · P03_S2_OFFLINE_PASS。** 100 条预锁定合成案例中，44 条可入画，12 条需复核，10 条冲突，34 条条件不足。危险放行和不必要阻断均为 0。20 个连续修订经过三个地点，模拟生成与编辑各一次，实际费用 USD 0。 [运行报告与复跑](docs/reports/YJ-P03-S2-scene-consistency-slice-report.md)

[逐例判定](docs/reports/evidence/YJ-P03-S2/measurement.json) · [逐回合图片与账本](docs/reports/evidence/YJ-P03-S2/story-slice.json) · [兼容回归](docs/reports/evidence/YJ-P03-S2/regression.json)

## 2026-11-22 S1 核验与 P03-S2 场景审查、离线连续试玩任务准备

- GitHub 核对 S1 `6ed8d2b` 及源回执：102 个锁定合成案例，36 正确采纳、66 留空，0 错采/多余弃判；新版 `scene-evidence/2 replayOnly`，真实图片和原生 PG/Chrome 未运行，本轮并未重跑 Windows 测试。
- 原语料 `P30` 夜间+日光、`P50` 正午+月光反映字面事实与画面语义自洽的独立验证需求，不修改已归档 S1 语料。自 S1 完成提交创建 `codex/yj-p03-s2-scene-consistency-slice`，上传[完整 S2 独立语料、视觉一致性与 15+ 修订模拟游玩任务书](docs/task-briefs/YJ-P03-S2-scene-consistency-slice.md)。
- 本轮仅 GitHub 文档准备，S2 代码和样本尚未实施；没有任何新 OpenAI 实际请求/费用，I2 付费和 Issue #1 回环阻塞继续，两个 main、旧许可和旧投影不动。

## 2026-11-22 S1 场景证据离线验收

**YJ-P03-S1 · P03_S1_OFFLINE_PASS。** 六个登记地点、102 条预先标注回放，正确采纳 36 条、正确留空 66 条，错误采纳与不必要弃判均为 0。三个新地点已构造离线首图请求。 [运行报告、回执与复跑](docs/reports/YJ-P03-S1-generalized-scene-evidence-report.md)

## 2026-11-22 I2 验收及 P03-S1 多场景可信证据任务准备

- GitHub 核对 I2 完成分支、40 项模拟货币门禁、强退防重和 148/148 兼容回归；确认真钱持续 `LIVE_BLOCKED_COST_BOUND`，原生 PG/Chrome 与真实模型仍 NOT_RUN。
- 核实 `scene-evidence/1` 在三处合成地点及有限中文表达内可用，但不支持任意世界；从 I2 最新完成提交新建 `codex/yj-p03-s1-generic-scene-evidence`，上传 [完整 P03-S1 版本化场景泛化任务书](docs/task-briefs/YJ-P03-S1-generalized-scene-evidence.md)。
- 本轮只改任务、交接与决策文档；新 parser/测试未执行，不更改旧默认 /2/审批/项目 main，新增 OpenAI 真实请求和费用 0。

## 2026-11-22 I2 离线验收

**YJ-P02-I2 · I2_GATE_OFFLINE_PASS。** 生成与参考编辑分别批准并从同一美元总额预留。40 个定向场景、跨进程竞争与崩溃恢复、148 项兼容回归通过。真实付款为 LIVE_BLOCKED_COST_BOUND。 [运行报告与回执](docs/reports/YJ-P02-I2-image-money-gate-report.md)

## 2026-11-22 I1 完成证据核对与 I2 图片预算门禁任务准备

- 经 GitHub 核对 I1 已完成离线适配：60/60 API 形状/权限/响应测试及 7/7 ImageTasks/原件/恢复测试；最终重复回执哈希一致，旧开发失败历史保留。真实图片与原生 PG/Chrome NOT_RUN，不能将 mock 原件冒充真实供应商输出。
- 新建 `codex/yj-p02-i2-image-monetary-gate`，上传[独立图片 USD 授权、发送前状态与成本上界任务书](docs/task-briefs/YJ-P02-I2-image-money-gate.md)，同步项目交接/决策/验证/任务序列。
- 本轮仅任务书，I2 代码和本机回归 NOT_RUN；旧 L1/L4 许可、L5 状态、Dot 环境 Issue、两个 main 不变；没有新真实 API 调用与收费。

## I1 图片供应商离线交付

**YJ-P02-I1 · IMAGE_ADAPTER_OFFLINE_PASS。** Images 首图与参考编辑已完成离线适配。协议、权限与响应检查 60/60，ImageTasks 与进程恢复 7/7。输出进入待审，真实发送关闭。本机原生 PG/Chrome 验收由 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1) 跟踪。[报告与复跑](docs/reports/YJ-P02-I1-image-adapter-offline-report.md)

## 归档 · 2026-11-22 YJ-ENV-01 / YJ-P02-I1 两线并行任务准备

- 道主安排 Dot 独立处理 L5B 的 Windows `127.0.0.1` CONNECT EACCES；已为其准备独立 [ENV-01 任务书](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/7d2badc6284174053ed3012766a79edd1346124f/docs/task-briefs/YJ-ENV-01-dot-loopback.md)，禁止绕过自动审批或关闭系统安全策略。
- Codex 从同一固定 L5B 完成提交另建 `codex/yj-p02-i1-image-adapter-offline`，交付 [Images 生成/编辑离线协议适配完整任务书](docs/task-briefs/YJ-P02-I1-openai-image-offline.md)，直接复用 YJ-05 ImageTasks 与 YJ-02 旧图，先做无网假传输。
- 本轮仅任务文档和 GitHub 分支准备；I1/ENV-01 新源码、测试与收费请求未执行，L1/L4/L5 状态、两个 main、万卡阁不动。

## L5B 本机回环实测

**YJ-P02-L5B · ENV_BLOCKED。** 当前 Windows 环境允许 Node 监听本机随机端口，连接同一端口时返回 `connect EACCES`。HTTP、原生 Chrome、临时 PG、L4R 与 YJ-13 本轮未运行；L5 维持 PARTIAL。[实测与脱敏回执](docs/reports/YJ-P02-L5B-loopback-closeout-report.md)

## 归档 · 2026-11-22 L5 PARTIAL 核查与 L5B 原生 loopback 验收任务准备

- 远端核对 L5 提交和脱敏证据：模型与持久防重模拟通过，内存 HTTP 12/12、Chrome 全拦截脚本 7/7；原生 Windows loopback 因 `ERR_NETWORK_ACCESS_DENIED`、PG `EACCES` 阻塞，L4R 23 和 YJ-13 22 项均未执行。
- 从 L5 完成 HEAD 建立隔离 `codex/yj-p02-l5b-loopback-closeout`，上传[限定回环环境诊断和整链路补测任务书](docs/task-briefs/YJ-P02-L5B-loopback-closeout.md)，更新入口及台账。
- 本轮仅文档准备，不以外部环境/管理员工具绕过已拒绝的沙箱审批；无新真实 API 授权，L1/L4 原状态不变。

## L5 离线交付与剩余验收

**YJ-P02-L5 · PARTIAL。** 独立零预算账本、崩溃防重、12 项内存处理测试和 7 项真实 Chrome 页面测试已通过。Windows 沙箱阻止本机 TCP，原角色卡／PostgreSQL、L4R 与 YJ-13 整链路尚待验收。真实服务调用 0，L4 继续 UNKNOWN_STOP。[报告、回执与复跑](docs/reports/YJ-P02-L5-one-shot-recovery-report.md)

## 归档 · 2026-11-22 L4R 验收核对与 L5 独立试点准备

- GitHub 核对 L4R 的 23 项定向假 Key 复现、页面分阶段审计、并发/中断防重和 YJ-13 首次 15/22 后 22/22 的实证范围；本轮未在 Windows 上独立重跑。
- 旧 L4 一直 UNKNOWN_STOP，不知道是否真实发送/收费，已经停用。已新建 `codex/yj-p02-l5-one-shot-recovery` 并上传[完整 L5 零网络安全接续任务书](docs/task-briefs/YJ-P02-L5-one-shot-recovery.md)，同步交接与任务看板。
- L5 业务代码与新测试尚未运行，未获新的真实文字调用授权，不读取或重置 L1/L4 任何账本；本次仅文档准备，不产生 API 请求与费用。

## L4R 本机取证与离线验收

**YJ-P02-L4R 已完成离线复现与修复。** 本机未找回原进程、真实账本或收据，原 L4 继续 UNKNOWN_STOP。旧页面在两条不同失败路径上给出相同提示；新页面区分服务端受理、发送前拒绝和送达未知。[取证报告与复跑](docs/reports/YJ-P02-L4R-trigger-forensics-report.md)

## 归档 · 2026-11-22 YJ-P02-L4 UNKNOWN_STOP 证据复核与 L4R 排障任务准备

- 源码核对原最终点击 `UNKNOWN_STOP` 的 GitHub 回执、标准账本/回执缺失及页面统一“会话已结束”错误处理。基于发送前账本顺序推断有可能是前发送失败，但原用户运行时机器/用户/路径没有独立确认，**不能宣称 OpenAI 0 送达或已扣费**。
- 自 L4 核查提交新建 `codex/yj-p02-l4r-trigger-forensics`，上传[只读溯源与零网络页面状态修复完整任务书](docs/task-briefs/YJ-P02-L4R-trigger-forensics.md)，同步最新交接与任务序列。
- 本轮仅文档准备，L4R 代码与本地调查 NOT_RUN；不重新打开旧 L4 Key 输入页、不发送真实 API、不重置 L1/L4 任何批准。

## 2026-11-22 L4 独立的一次真实 Luna 文字试点获得限定授权

- 道主已批准 **`gpt-6-luna` 最多 1 次新文本请求、仅开发自编合成酒馆资料、总预算上限 USD $0.10**。图片 API、私人角色卡和其他资料禁止外发。
- 仅更新 L4 任务书、决策 D021、交接和验证文档；当前 L4 代码与新增测试未执行，真实 API 调用 0，未产生新增费用。
- Codex 须先经过离线、安全预算及模型权限门禁，再由用户在受保护的一次性 Key 输入页面亲自触发；不复用、更改或删除 L1 账本。

## 2026-11-22 L3 证据核对与 L4 单次真实叙事准备

- GitHub 核验 L3 完成 HEAD、Chrome 32 个合成回合、23 个缺证据首回合留空、V1/V2 连续性和 21/22 后两轮 22/22 证据；未在 Windows/PG/Chrome 实地重跑。
- 新建 `codex/yj-p02-l4-luna-scene-pilot` 隔离分支并上传[真实 Luna 自然场景试点的安全准备和新授权任务书](docs/task-briefs/YJ-P02-L4-luna-scene-pilot.md)，同步 README、交接、任务、验证与决策台账。
- 本次仅文档准备，新业务代码和模型请求未执行。旧 L1 许可已使用完毕，新的文字模型请求、预算和外发资料**尚未重新获准**，图片仍禁用。

## 2026-11-22 YJ-P02-L2 核验与 L3 场景证据任务准备

- 只读核验 L2 固定远端 HEAD、真实正文 SHA 匹配后的原审计、版本化 /3 的局部事实证据及 65 条/完整 22 组回归；未在原 Windows 环境独立复测。
- 从 L2 完成 SHA 建立 `codex/yj-p02-l3-scene-evidence-contract`，上传[首回合视觉事实契约和合成数据离线测试完整任务书](docs/task-briefs/YJ-P02-L3-scene-evidence-contract.md)，同步交接、验证、入口和任务序列。
- 本次仅任务准备，L3 业务实现及测试尚未执行；L1 已用尽的许可、原存档和两套 main 保留，不产生新的真实 API 费用。

## 2026-11-21 YJ-P02-L2 真实剧情提取根因排查准备

- 核对首次 `gpt-6-luna` 已保存正文的脱敏 SHA、真实调用数和 `not-ready` 结论，并阅读有限中文规则源码；未访问用户本地原正文、未运行新测试。
- 从 L1 完成提交创建 `codex/yj-p02-l2-real-text-extraction`，上传[只读诊断与保守离线修正完整任务书](docs/task-briefs/YJ-P02-L2-live-text-extraction.md)，更新 README、交接、任务顺序及验证状态。
- 本次仅文档准备；L2 业务实现和根因验收尚未开始，禁止新增真实 OpenAI 请求，旧 L1 一次性账本保持原样。

## 2026-11-21 P02 OpenAI API 供应商确认与适配准备

- 道主已选择使用自己的 OpenAI API 账户作为映界下一阶段的文字及图片供应商；具体模型、外发素材、预算/次数和真实发送授权尚未确认。
- 自 P01 完成提交新建 `codex/yj-p02-openai-adapter`，上传[OpenAI 文字/图片官方协议与离线门禁完整任务书](docs/task-briefs/YJ-P02-openai-adapter.md)，更新 README、决策、任务看板与交接。
- 本次仅为离线开发任务准备，P02 业务适配代码和测试 NOT_RUN，真实文字/图片请求 0。P01、YJ-13 与 main 均不改。

## 2026-11-21 YJ-P01

**YJ-P01 OFFLINE_PASS，真实试点 LIVE_BLOCKED。** 原角色卡在合成数据上完成生成、参考编辑和保守留空；受信授权、预留上限、信息过滤与 unknown 重开防重已通过离线检查。 [报告](docs/reports/YJ-P01-real-service-readiness-report.md)

## 2026-11-21 YJ-13 收口核对与 P01 离线接入准备

- 只读核对 YJ-13 的 LOCAL_DEMO_PASS 证据、两次 22/22、35+2 轮、14 表恢复与开关/账本范围；本轮未独立重跑原 Windows/PG/Chrome。
- 在 `codex/yj-p01-real-service-readiness` 独立分支上传[文字/图片服务接入前置核查完整任务书](docs/task-briefs/YJ-P01-real-service-readiness.md)，更新交接和任务入口。
- P01 只有任务与文档准备；未选择真实供应商，未请求密钥或预算，**没有真实模型发送**。原 YJ-13、main 与上游九霄不改。

## 2026-11-21 YJ-13 本地演示

**YJ-13 LOCAL_DEMO_PASS。** 完整隔离回归连续 22/22、22/22；原角色卡 35 轮、第二会话 2 轮，已实测启停、回退和 14 表配对恢复。 [运行报告](docs/reports/YJ-13-local-demo-closeout-report.md)

## 2026-11-21 YJ-12 证据复核与 YJ-13 本地试玩准备

- 核对 YJ-12 固定远端 HEAD、恢复报告、22/22 和随后的 18/22 回归记录，后者四组停在本地 `/api/auth/code` 429；本轮未独立执行运行测试。
- 从 YJ-12 完成提交创建 `codex/yj-13-local-demo-closeout`，上传[本地连续试玩/稳定回归/交接任务书](docs/task-briefs/YJ-13-local-demo-closeout.md)，更新接手、看板、首页及验证。
- 仅文档与任务准备，YJ-13 业务实现和试玩 NOT_RUN；要求保留认证限流，不把合成 demo 说成真实模型上线。

## 2026-11-21 YJ-12 恢复与终端稳定性

已在普通角色卡页验证断网反馈、撤权后的回执核对、未知请求防重，以及停写后的 PostgreSQL 和私有原件恢复。YJ-13 可从本地模拟连续试玩接续。[运行报告、命令与回退](docs/reports/YJ-12-recovery-terminal-report.md)

## 2026-11-21 YJ-11 证据核对与 YJ-12 开工准备

- 确认 YJ-11 完成分支 HEAD，阅读原运行报告、三次 20/20 回归及反馈、原件、会话鉴权代码；没有在用户 Windows 环境重跑。
- 创建 `codex/yj-12-recovery-terminal`，提交[断网、重启、乱序与终端稳定性任务书](docs/task-briefs/YJ-12-recovery-terminal.md)，更新接手、看板、验证与首页。
- 明确反馈已提交但回执丢失、原件撤权时的幂等核对边界；PG 与原件的隔离恢复、真机与真实供应商尚未执行。YJ-12 业务实现仍 NOT_RUN。

## 2026-11-21 YJ-11 图片历史与审阅纠错

原角色卡新增逐轮历史、受保护原件预览与问题反馈。PG 追加记录审阅和撤下，当前画面及编辑参考随之重新核验。历史替代请求在契约适配前返回 `contract-adapter-required`。[运行证据](docs/reports/YJ-11-image-history-corrections-report.md)

## 2026-11-20 YJ-10 成果复核与 YJ-11 开工准备

- 核对 YJ-10 固定分支提交、14 轮逐项回执、综合 19/19 运行证据及既有图片任务/审阅结构；此轮未在原 Windows 环境独立复测。
- 新建 `codex/yj-11-image-history-corrections`，提交[完整图片历史与安全纠错任务书](docs/task-briefs/YJ-11-image-history-corrections.md)，更新 README、任务看板、验证与交接。
- 本次为任务书及文档交付，YJ-11 业务代码/测试未运行；真实模型、供应商、生图费用与生产接入保持 NOT_RUN。

## 2026-11-20 YJ-10 出图触发与视觉一致性

普通交谈复用或跳过，可见状态确有变化时才考虑模拟编辑或生成。新增可回放的触发依据、原件审阅对照及受信标签过滤。[运行与交接](docs/reports/YJ-10-trigger-consistency-report.md)

## 2026-11-20 YJ-09 证据复核与 YJ-10 准备

- 核对 YJ-09 完成提交、65 段合成语料、25 轮回执与完整回归，保留并行测试历史超时的未明根因；此次未在运行环境独立复测。
- 建立独立 YJ-10 接续分支，上传[关键出图触发、视觉一致性及可知范围完整任务书](docs/task-briefs/YJ-10-trigger-consistency.md)，更新接手索引和任务状态。
- 仅文档交付，YJ-10 业务实现、独立真实模型/图片 API、生产部署仍 NOT_RUN。

## 2026-11-20 YJ-09 地点复访与安全重放

新增版本化正文提取、每个地点的画面待核实状态、完整调查恢复和独立 PG 重放。原角色卡页面通过 25 轮持续性及历史图片请求保护验证。[YJ-09 报告](docs/reports/YJ-09-revisit-continuity-report.md)

## 2026-11-20 YJ-08 证据复核与 YJ-09 接续任务书

- 核对 YJ-08 固定远端 HEAD、运行报告和逐回合回执；规则提取和离场歧义的源码边界已审阅。此轮未独立重跑本地测试、没有调用模型。
- 新建 `codex/yj-09-revisit-continuity`，新增完整 YJ-09 任务书并更新交接、验证、任务看板和 README；YJ-09 业务实现仍 NOT_RUN。
- 真实图片 API 和生产集成保持未验证；继续使用已有合成资料与独立工作分支。

## 2026-11-20 YJ-04 场景状态与恢复

- 新增普通角色卡已完成历史读取、地点及别名、视觉快照和 PostgreSQL 事务消费。真实读取、合成状态继承、跨进程恢复及冲突检查已执行。[报告](docs/reports/YJ-04-scene-state-report.md)

## 2026-11-20 YJ-03 复核修补与 YJ-04 接续

- 从 YJ-03 最终成果新建 `codex/yj-04-scene-state`，以单独提交修复编辑同版本不同事实、UUID 大小写拆分身份两个可复现缺口；包版本升为 0.1.1，交换格式仍为 0.1，未新增依赖。
- 编译、新增 2 组回归和原来源映射 1 组通过；全量原测试与 PNG 字节本次未重跑，完整副本须先补跑。
- 新增 YJ-03 复核报告、结构化记录及 YJ-04 完整任务书；更新接手索引、任务状态与决策。
- YJ-04 场景状态业务实现尚未执行。02 后端准备可独立并行；原图片、原 02/03 分支与九霄上游不改，没有新模型调用。

## 2026-11-20 YJ-03 共用数据契约

- 交付 0.1 来源、视觉状态、参考、尝试、资产和适用性规则。编译、8 组离线检查及原有图片摘要核对通过。见[工程报告](docs/reports/YJ-03-shared-contracts-report.md)。

## 2026-11-20 YJ-02 证据复核与 YJ-03 接续任务书

- 基于 13ac86a 读取报告、调用、fixture、复用与离线脚本；逐张查看三张原图展示页，确认本批 3→5→5 人与主要布局延续。
- 新增 YJ-02 限定范围复核；未重跑图片模型、未独立重算 PNG 摘要，后端独立 API 仍 BLOCKED / NOT_RUN。
- 新增完整 YJ-03 任务书，明确来源、视觉版本、参考资格、审阅、未知结果及离线正反例。
- 更新当前交接、任务状态、决策台账、验证记录与并行边界，修正历史“全部真实生图未运行”的歧义。
- 本轮为文档交付，YJ-03 契约实现仍待执行；没有新增模型调用或生产部署。

## 2026-11-19 YJ-01证据复核与YJ-02任务书

- 基于YJ-01成果2a2800c核查浏览器、数据库断言及模拟供应商范围；未独立重跑本机环境。
- 新增YJ-02完整任务书，明确酒馆初图、人物到场、复访和连续参考更新的最小实验。
- 修正README与任务序列的下一任务入口，保留历史任务书与原始运行证据。
- 本次仅文档交付；YJ-02实验、真实模型和生图均未执行。

## 2026-11-19 完整开工任务书

- 新增YJ-START-01，汇总项目现状、完整36项需求、首次YJ-01工作包、15项开发任务、并行边界、工程完成检查和交接模板。
- 将仓库首页、任务序列和交接记录连接到统一接手入口。
- 修正并行流程图中仍要求草案审核的历史节点，保持已确认启动状态。
- 本轮仅交付文档，未执行YJ-01或后续业务开发，未新增模型调用。

## 2026-11-19 规划基线初始化

- 整理需求台账、任务序列、并行分项目与候选技术框架。
- 记录用户启动与独立建仓指示，保留未决事项。
- 归档草案0.1及原始交接书。
- 补充上游核查记录、验证状态和YJ-01任务书。
- 当前未新增映界业务实现，未运行真实生图或生产部署。
