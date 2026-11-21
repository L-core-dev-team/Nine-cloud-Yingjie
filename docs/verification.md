# 映界验证记录

更新：2026-11-21。

## YJ-P02-L1 真实执行

本机账本与回执一致，真实文字请求 1 次，HTTP 200。输入 92、输出 39 tokens，原会话与映界核对同一正文摘要，提取 not-ready，图片调用 0 次。[真实回执](reports/evidence/YJ-P02-L1/live-result.json)

## YJ-P02-L1 离线执行记录

契约 10/10，15 个禁网 fake 场景通过，两个进程仅一次取得发送权。Chrome 经原会话保存修订 1，PG 与映界事件正文摘要一致，提取 ready，图片任务和 attempt 均为 0。真实项目凭据或权限尚未就绪，文字真实调用 0 次。[脱敏回执与命令](reports/YJ-P02-L1-luna-text-smoke-report.md)

## 归档 · L1 任务书准备

已读 GitHub 的原 P02 适配任务书与 P01 报告，核对现有 P02 接续分支 `7f0d9d454886c6021a876cd3a8c9bcfda99404e9`。官方文档列明 `gpt-6-luna` 支持 Responses API、Standard 短上下文文字价格为输入 $0.10/百万 tokens、输出 $0.50/百万 tokens；当前试点拟限制输入≤8000、输出≤1200，单笔估计成本约 $0.0014（非供应商账单保证）。官方模型、响应数据留存和输出上限资料见任务书。道主已同意本次最多一笔 Luna 文字请求、USD $0.10 总预算，资料仅限开发自编合成酒馆。

本轮**只创建 [YJ-P02-L1 完整任务书](task-briefs/YJ-P02-L1-luna-text-smoke.md)与接续分支**；当前并未配置或读取 Key，也未独立执行任何 Luna 请求、PG/HTTP/Chrome 实验或费用门禁测试。真实 API 调用：0，业务实现 NOT_RUN。先离线验收，未配置密钥/无法确认硬门禁则保持 LIVE_BLOCKED。图片生成/参考编辑并未获得本次授权。

## YJ-P01 交付证据复核与 YJ-P02 OpenAI 适配任务准备（本轮）

只读核对 `codex/yj-p01-real-service-readiness@2caab0d92059d77097af5a4e6859f56e51516c99`、[P01 运行报告](reports/YJ-P01-real-service-readiness-report.md)、[禁网 7/7](reports/evidence/YJ-P01/offline-final.json)、[原角色卡 3 轮 fake 回执](reports/evidence/YJ-P01/local-card-final.json)及[回归 21/22→22/22](reports/evidence/YJ-P01/yj13-regression.json)。这些是源执行证据，本轮未在 Windows / PG / Chrome 实地重跑；P01 首轮预设标签超时根因仍未确定。

已通过官方 OpenAI 开发者文档确认文字 API、图片生成 `v1/images/generations` 与图片编辑 `v1/images/edits` 可作为候选接口；型号 `gpt-6.2-sol`、`gpt-image-2.6-sunburst` 仅是待用户/项目访问与预算核实的候选，不代表项目模型权限已经开通。用户选择使用自己的 OpenAI API 账户，真实调用的费用/素材外发范围仍未获批准。

本轮从 P01 成果创建 [YJ-P02 完整任务书](task-briefs/YJ-P02-openai-adapter.md)及独立分支；P02 业务实现、禁网测试、付费调用、原件外发与真实数据审核均 NOT_RUN。严禁把本次文档创建写成 OpenAI live 接入完成。

## YJ-P01 当次验证

**YJ-P01 OFFLINE_PASS，真实试点 LIVE_BLOCKED。** 原角色卡在合成数据上完成生成、参考编辑和保守留空；受信授权、预留上限、信息过滤与 unknown 重开防重已通过离线检查。 Node 禁网子进程 7/7，丢失确认后第二个进程零重发；回环 PG、Cookie HTTP 与真实 Chrome 检查三条 completed-history，fake 文字 3 次、图片 2 次。真实 API、供应商计费和独立图审 NOT_RUN。[分类证据与回归记录](reports/YJ-P01-real-service-readiness-report.md)

## 归档 · YJ-13 完成证据核对与 P01 任务准备

经 GitHub 核对 `codex/yj-13-local-demo-closeout@2b54c28e8e587e05311b957c5437024c6ecb4271`，读取[工程报告](reports/YJ-13-local-demo-closeout-report.md)、[最终回归1](reports/evidence/YJ-13/release-1.json)、[最终回归2](reports/evidence/YJ-13/release-2.json)、[限流回执](reports/evidence/YJ-13/limit-fixed.json)、[试玩与恢复记录](reports/evidence/YJ-13/)和实际启动脚本。源记录分别为 22/22、22/22，合成剧情 35+2 轮，图片任务 10、mock 发送 4，真实供应商调用 0。历史 YJ-12 22/22、18/22 仍保留；新集群限流可复现但原四次 429 的瞬时计数未能倒推。

**本轮只是只读源码/证据核查及文档准备，没有独立重跑本机命令。** [YJ-P01 接入准备任务书](task-briefs/YJ-P01-real-service-readiness.md)与独立分支已创建，P01 实际代码、PG/HTTP/Chrome 测试、真实文字或图片 API 均 NOT_RUN。任何真实端点、凭据、预算和参考图外发范围须用户另行明确授权。

## YJ-13 当前交付

**YJ-13 LOCAL_DEMO_PASS。** 完整隔离回归连续 22/22、22/22；原角色卡 35 轮、第二会话 2 轮，已实测启停、回退和 14 表配对恢复。 [启动与回退](local-demo.md) · [回执索引和未验证条件](reports/YJ-13-local-demo-closeout-report.md)

## YJ-13 开工前的历史复核

只读核对 `codex/yj-12-recovery-terminal@022d20a0a792ff52b9acfb9fa471c991b5e63755`、[运行报告](reports/YJ-12-recovery-terminal-report.md)和[每次回归的原始记录](reports/evidence/YJ-12/regression.json)。原执行者记录契约 10/10、原 PNG 3/3、YJ-11 基线 20/20。YJ-12 定向测试与停写 PostgreSQL 14 表+图片文件隔离恢复通过；综合一次 22/22，随后的同代码一次 18/22，四组浏览器用例因 `/api/auth/code` HTTP 429 未继续验证。**本轮没有独立重跑这些检查；429 的具体配额来源未证实，不能写稳定全绿。**

九霄固定上游认证服务具备 per-IP、per-email 和全局验证码发送限流，已读取相关源码。此次新增[完整 YJ-13 任务书](task-briefs/YJ-13-local-demo-closeout.md)和独立分支；YJ-13 实际代码、连续原页面试玩、重复回归、真机和真实图片/文字模型均 NOT_RUN。首要关口为验证/隔离合成测试限流，不破坏生产认证安全逻辑。

## YJ-12 当次运行

已在普通角色卡页验证断网反馈、撤权后的回执核对、未知请求防重，以及停写后的 PostgreSQL 和私有原件恢复。YJ-13 可从本地模拟连续试玩接续。[运行报告、命令与回退](reports/YJ-12-recovery-terminal-report.md) [脱敏回执](reports/evidence/YJ-12/run.json) · [各轮通过与失败](reports/evidence/YJ-12/regression.json)

## 归档 · YJ-11 已有证据核对与 YJ-12 开工准备

通过 GitHub 核对 `codex/yj-11-image-history-corrections@4ea1f354181216a7fcfc7833a898f9e02f2630bf`，阅读[工程报告](reports/YJ-11-image-history-corrections-report.md)、[回归](reports/evidence/YJ-11/regression.json)和反馈/鉴权/历史/原件核心源码。YJ-11 原报告记录契约 10/10、原 PNG 三张及两条参考链通过、综合回归三次 20/20；真实模型调用 0。本轮未重新跑 Windows、PostgreSQL、HTTP、Chrome 测试，因此不将其写为新执行结果。

本轮只新建 [YJ-12 完整任务书](task-briefs/YJ-12-recovery-terminal.md)及独立接续分支，并核对源代码中的反馈丢回执边界；YJ-12 新代码、故障注入、PG+私有原件恢复、真实手机和真实模型 API 均 NOT_RUN。任务书要求分别提交实际运行与阻塞结果，不允许用旧报告冒充新验收。

## YJ-11 本地验收

普通角色卡页保存 11 轮合成剧情，历史分页 8＋3。验收覆盖真实 Cookie、PG 事务、跨进程审阅竞争、故障回滚、同摘要资产隔离、未知回执和迟到。浏览器及原件均在本机运行，图片发送使用 mock。[脱敏回执](reports/evidence/YJ-11/run.json) · [回归与复跑说明](reports/YJ-11-image-history-corrections-report.md)

## YJ-10 提交证据复核与 YJ-11 准备（归档）

已只读核对 `codex/yj-10-trigger-consistency@95cb7a9145f914c2b72196730891a46e215ed5af`，读取[实现报告](reports/YJ-10-trigger-consistency-report.md)、[14 轮回执](reports/evidence/YJ-10/run.json)、[回归记录](reports/evidence/YJ-10/regression.json)与现有 PG/选择/审阅代码。原报告记录契约 10/10、原 PNG 3/3、综合两次 19/19；错三人图用于五人目标时审阅拒绝，相关资产没有成为当前图或参考图。09 的历史并行超时在 10 的七次并行运行中未复现，但根因未查清。**这都是源报告证据，本轮未在原运行环境复跑。**

已建立 [YJ-11 完整任务书](task-briefs/YJ-11-image-history-corrections.md)及独立接续分支，明确图片历史/纠错账本、授权下载与新请求身份。此次只提交文档与接续索引，YJ-11 实际代码、PG/HTTP/Chrome 测试均 NOT_RUN。真实文本模型、独立图片供应商、用户正式素材及生产发布仍 NOT_RUN。

## YJ-10 本地验证

YJ-10 本地实现与验证已完成。原普通角色卡 14 轮共 4 次模拟发送，错图被拒后连续两轮交谈均未重发。最终两次综合回归各 19/19，真实模型调用 0。契约 10/10，原件 3/3。在包含旧 08 编辑失败场景的七次并行运行中未复现历史超时，原等待阈值为 12 秒，根因仍未证实。[各次命令与退出结果](reports/evidence/YJ-10/regression.json) · [场景、发送和拒绝依据](reports/YJ-10-trigger-consistency-report.md)

## YJ-09 提交证据复核与 YJ-10 任务书准备（本轮）

只读核对 `codex/yj-09-revisit-continuity@cabd3f1b7229f10c4470c5b847a187143b291026`，读取[报告](reports/YJ-09-revisit-continuity-report.md)、[65 段对照](reports/evidence/YJ-09/corpus.json)、[25 轮回执](reports/evidence/YJ-09/journey.json)、[完整回归记录](reports/evidence/YJ-09/regression.json)及核心源码。原执行者的结果为契约 10/10、最终回归连续两次 14/14；同批合成语料 /2 为 39 正确采纳、0 错误采纳、26 放弃判断。原回归一次并行等待超时具体根因未证实。本轮未重新运行这些测试或模型调用。

已创建 [YJ-10 完整任务书](task-briefs/YJ-10-trigger-consistency.md)，只记录准备完成，**YJ-10 实际代码、PG/HTTP/Chrome 新测试均 NOT_RUN**。没有真实图片 API、文字模型、正式语料独立人工审核、生产部署、真机的本轮新验证。

## YJ-09 本机运行

契约 10/10，三张原图及两级参考链通过，综合回归 14/14。原角色卡已保存的 25 段合成正文经两版独立重建，注入失败后从修订 8 并发续读，重放无图片任务。YJ-08 脚本一次并发等待超时的记录和后续复查一并保留。[运行报告](reports/YJ-09-revisit-continuity-report.md) · [逐轮回执](reports/evidence/YJ-09/journey.json)

## YJ-08 成果读取与 YJ-09 开工准备（历史，只读+文档）

2026-11-20 核对远端 `codex/yj-08-first-play-integration@00c42157e4066565eb9d5d5a140b78188ebe0b81`；读取原报告、13 轮 JSON 回执、`zh-visible-clause/1` 规则实现和提取对照。原执行报告记录契约 10/10、综合 12/12、合成规则 24/24、额外散文 4 段一致/3 段保守放弃；这些是**提交证据，不是本轮独立实机复跑**。真实文字/图片服务调用均为 0。详见 [YJ-08 原运行报告](reports/YJ-08-first-play-integration-report.md)。

本轮仅创建 [YJ-09 任务书](task-briefs/YJ-09-revisit-continuity.md) 与接续分支、更新索引。YJ-09 实际代码、测试、数据库联调均 NOT_RUN。提取器新版本应单独重放并记录样例来源，未取得独立人工盲评不得宣称真实玩家准确率。真实图像后端、生产挂载、手机真机仍 BLOCKED / NOT_RUN。

## YJ-04 场景状态与恢复

完整契约 10/10，通过 Node、回环 HTTP 及真实 PostgreSQL 的状态检查 3/3。真实普通历史写入一条修订；独立合成样例验证 102 行分页、事务中断、两个子进程竞争、地点别名与五人复访。命令、证据边界、未运行项见[工程报告](reports/YJ-04-scene-state-report.md)和[脱敏回执](reports/evidence/YJ-04-local-run.json)。

## YJ-03 独立复核、定向修补与 YJ-04 任务书

2026-11-20，复核原提交 `7d68284e95754f06e853123ac3c719788266ae0a`，14 份本地源码/元数据与远端 Git blob 一致，并核对九霄固定提交的鉴权、历史查询与保存代码。实际复现编辑入口同版本不同事实、UUID 大小写拆分身份两项缺口，在独立接续分支修补至包 0.1.1（交换格式仍 0.1）。修补提交 [e5d6cf2](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/e5d6cf2e73dc5131209f9793677e3eebf24a7c73)。

本次 Linux 环境首次离线安装因缓存缺失返回 ENOTCACHED，随后正常按原锁文件安装成功；修补前后 TypeScript 编译通过。新增 2 组回归及原来源映射 1 组实际通过。没有取得原 PNG 字节，完整原有 8 组与更新后的全部 10 组本次 NOT_RUN，不借用原执行报告冒称本轮全量通过。接手 04 时在完整工作副本补跑，不重新生图。详见[复核报告](reports/YJ-03-evidence-review.md)和[结构化记录](reports/evidence/YJ-03-review.json)。

[YJ-04 任务书](task-briefs/YJ-04-scene-state.md)已准备；场景状态业务实现、实际数据库/历史接入和图片供应商验证本轮均 NOT_RUN。02 后端准备继续独立并行；本轮不改原 02/03 成果分支或九霄上游。

## YJ-03 离线工程检查（原执行报告）

实现提交 `5463c96eae5996a69bcc61b5887c6c3d50f8b3e9`。离线冻结安装、TypeScript 编译、8 组 C01–C12 正反例、原图摘要与编辑/复用链检查均退出 0。后端供应商、数据库并发、生产鉴权及真实会话驱动生图仍未运行。详见[实际检查命令和结果](reports/YJ-03-shared-contracts-report.md)。

## YJ-02 提交证据复核与 YJ-03 准备（历史）

2026-11-20，独立读取 `codex/yj-02-image-capability`，HEAD 为 `13ac86a0c4a130780123cb5ed1768db6c5b43603`。递归 tree 未截断，共 30 个文件。读取报告、调用记录、fixture、accepted 索引、离线检查与 probe.py，并在固定提交的 GitHub 原图展示页逐张检查 I0/I1/I2，人物数量为 3→5→5，主要空间与新增人物延续。

本次核对记录之间的摘要链与脚本逻辑，没有重新生图、没有重跑原环境或 probe.py，也没有独立重算三张 PNG 的 SHA-256。支持工具级样例评估完成；独立后端图片 API 仍 BLOCKED / NOT_RUN。见[YJ-02 证据复核](reports/YJ-02-evidence-review.md)。

[YJ-03 完整任务书](task-briefs/YJ-03-shared-contracts.md)已准备，要求实现通用契约、样例与离线检查；当前尚未执行契约代码或测试。后端接口条件不阻塞该任务通用部分，也不能因此被视为验证通过。

### 本轮文档检查

- 固定成果中的 27 份文本文件已拉取或复用，并逐份以 Git blob SHA-1 对照远端确认一致。
- 在其上新增 2 份文档、更新 8 份活动文档；另外 19 份文本保持原内容。3 张 PNG 由远端基线树保留，不以截图或替代图片覆盖。
- 本地 29 份文本均可按 UTF-8 读取；文档相对链接按本地文件与远端基线清单核对，无断链；代码围栏闭合。
- 任务书与复核文档经过独立只读审阅；修正“无任务查询即不可自动恢复”的过宽表述，保留未来已验证回调等其他核对方式。
- 本轮检查仅针对文档和证据解释，不是 YJ-03 契约测试、应用构建或真实生图复跑。

## YJ-02 · 工具级真实生图与复用

同一合成酒馆实际执行初图、单参考增人、以五人图为参考改灯光，三张原图逐张审阅通过。无变化交谈与复访在离线进程中校验了已接受图片摘要。真实请求 3 次，返回原图 3 张，图像不合格 0 张。独立供应商 API、真实剧情联调和用户体验验收为 NOT_RUN。错误分类仅离线演练。[运行与能力报告](reports/YJ-02-image-capability-report.md) · [逐次记录](reports/evidence/YJ-02-image-runs.json)

## YJ-01 · 当次运行

2026-11-19，九霄 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。本地 Node、实际浏览器和 PostgreSQL、模拟文字供应商。建局、行动、整页刷新、同会话继续、再刷新及两条已完成正文对账均为 PASS。原生权威回合和 Worker 仅静态核查。真实文字模型、参考图生成、真机和用户试玩均为 NOT_RUN。[运行报告](reports/YJ-01-runtime-baseline-report.md) · [回执](reports/evidence/YJ-01-local-run.json)

## YJ-01提交证据复核与YJ-02准备

2026-11-19，独立读取YJ-01任务分支HEAD、报告、JSON回执、复跑脚本与固定上游用例。证据支持本地合成文字基线完成；未独立重跑Windows环境。见[复核记录](reports/YJ-01-evidence-review.md)。当时 YJ-02 任务书已准备，真实图片实验仍为 NOT_RUN；后续工具级结果见本页上方 YJ-02 记录。

## 规划文档检查

- 已整理原36项需求，保留确认等级与来源。
- 已检查15项任务的前置依赖，无循环依赖。
- 已区分独立仓库与独立产品、独立部署。
- 已保留第2–5项后置事项、正式验收细则和Q055/Q056编号歧义。
- 本地15份文件可按UTF-8读取；36项需求编号与15项任务编号已核对。
- 文档相对链接检查通过，没有断链；任务依赖检查通过，没有循环。

## 仓库创建检查

- 仓库：[quakhiak34568-lang/Nine-cloud-Yingjie](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie)。
- GitHub元数据核实：私有仓库，所有者为quakhiak34568-lang，默认分支为main。
- GitHub初始提交：`61ad0a685748a1a510d610cdb231e1e286c632ef`。

## 规划文件上传核验

2026-11-19，已完成以下实际检查：

| 检查对象 | 执行方式 | 结果 |
| --- | --- | --- |
| 初始化提交 | GitHub读取main分支 | PASS：`6ebf0b0a2c2dd4b3309ed3456dde0648519b2699` |
| 完整文件清单 | 递归读取提交对应Git tree | PASS：15份文件，返回未截断，无遗漏或意外新增 |
| 文件内容一致性 | 将本地UTF-8文件的Git blob SHA-1逐个与远端树记录比较 | PASS：15/15一致 |
| README可读取性 | 按固定提交读取README正文 | PASS：仓库信息、文档索引、当前阶段正确 |
| 相对链接与编号 | 本地文档检查 | PASS：无断链，36项需求、15项任务 |

证据提交：[6ebf0b0](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/6ebf0b0a2c2dd4b3309ed3456dde0648519b2699)。其Git tree为`c9e32b692ffc29f2030e37921d38f178f038b815`。本记录由后续文档提交追加，不将该上传核验解释为应用运行或产品验收通过。

## 开工任务书检查：YJ-START-01

2026-11-19，编制完整开工与接续任务书时，先核实main为`8ed270ab4219ed9e8eca93d787364886827d1237`，其15份远端文件与本地逐文件Git blob哈希一致。

- 新增[开工任务书](task-briefs/YJ-START-01-project-kickoff.md)后，本地共16份文件，均可按UTF-8读取。
- 相对文档链接检查通过，无断链。
- 附录中的36项需求与原需求台账逐字一致，确认等级和来源均保留。
- 原15项开发任务编号和前置依赖保持一致；YJ-START-01仅为交接文档编号。
- 完整正文经独立只读复核：未将后置选项冻结，未混淆历史与本次运行，YJ-01完成判定与既有任务书一致。
- 本轮为文档交付，YJ-01仍待开始；未运行应用构建、真实模型调用或生产部署。

## 当前尚未执行或受限的运行检查

- 本仓库映界应用构建与运行：NOT_RUN（共用契约包已编译，已有文档、实验脚本和证据，尚无场景状态等业务应用）。
- 建仓阶段的上游文字流程：当时 NOT_RUN；后续结果见上方 YJ-01。
- Codex 工具级真实生图及参考图修改：YJ-02 已完成本批限定样例，见上方记录。
- 独立后端图片 API、真实会话驱动图片及生产恢复流程：NOT_RUN；后端入口与认证存在缺口。
- 手机和电脑端实际游玩：NOT_RUN。
- 公开发布与生产部署：NOT_RUN。

## YJ-05 + YJ-06 本地联合运行 · 2026-11-20

固定实现 [59cf8756](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/59cf875649c9b676f59c63280bbc54b602d6b5c3)。本次重新编译 0.1.1，共用契约 10/10，通过三张原图和参考链探针。PostgreSQL、原普通角色卡宿主及 Chrome 本次共 6/6 通过，其中 3 组为 YJ-04 回归，2 组为任务恢复和安全边界，1 组为实际页面联合流程。截图为桌面及移动视口。分层证据与覆盖缺口见 [05 报告](reports/YJ-05-image-tasks-report.md)、[06 报告](reports/YJ-06-ui-report.md)、[结构化回执](reports/evidence/YJ-05-06/run.json)。真实供应商和真机 NOT_RUN。

## YJ-07 世界书与获准预设 · 2026-11-20

[da97633de7c83d0b743d8e5766cb2317867a2cea](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/da97633de7c83d0b743d8e5766cb2317867a2cea) 的远端树与本地一致。Windows、固定九霄运行时、PostgreSQL 18.4 及 Chrome 的本次 9 组综合检查全部通过；独立契约测试 10 组通过，原图探针 3 张通过。原 05/06 用例发送 9 次本地 mock，07 预设用例发送 0 次。获准合成世界书经过真实导入、关联和权限路由；原件损坏、授权撤销、会话删除均有实际拒绝回执。私人资料、真实模型、生产与真机 NOT_RUN。[完整报告](reports/YJ-07-worldbook-assets-report.md) · [运行回执](reports/evidence/YJ-07/run.json)

## YJ-08 首段游玩 · 本地自动选择

实现提交 [c6b7981776e2579e0fe241ecd40dbad0095de995](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/c6b7981776e2579e0fe241ecd40dbad0095de995)。以同一玩家行动在九霄普通角色卡页面驱动多段已保存的合成剧情，PG 事件正文摘要、来源 key、规则依据、视觉版本与预设/任务结果完成对账。通过契约 10 组、原图 3 张、综合检查 12 组。08 浏览器用例 6 次模拟发送，真实图片服务 0 次。24 段规则参考均通过，另外 7 段中 4 段语义一致、3 段放弃判断。独立人工盲评、通用自由文本、真实供应商及生产部署待验证。[运行报告](reports/YJ-08-first-play-integration-report.md) · [逐回合证据](reports/evidence/YJ-08/run.json)

## 后续记录格式

每条记录应包括日期、仓库与提交、检查对象、执行方式、实际结果、证据位置及未覆盖部分。不能把历史记录、静态检查和当次真实运行混写为同一项PASS。
