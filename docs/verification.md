# 映界验证记录

更新：2026-11-20。

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
