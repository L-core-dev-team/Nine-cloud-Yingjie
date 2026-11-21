# 九霄 · 映界

映界为《九霄》提供随文字剧情变化、能够复访并保留变化的场景画面。

## 当前状态

**YJ-11 图片历史与纠错已在本地角色卡页验证。** 玩家可以逐轮查看图片来源、尝试与审阅状态，并提交问题。受信改判同时撤下当前图、历史原件和编辑参考。安全替代生成等待独立契约身份。下一项为 YJ-12 恢复与终端稳定性。[运行报告、复跑与回退](docs/reports/YJ-11-image-history-corrections-report.md)

**YJ-10 基线。** YJ-10 本地实现与验证已完成。原普通角色卡 14 轮共 4 次模拟发送，错图被拒后连续两轮交谈均未重发。最终两次综合回归各 19/19，真实模型调用 0。[YJ-10 报告与运行命令](docs/reports/YJ-10-trigger-consistency-report.md)

**此前接续**　YJ-09 已完成本地工程交付。原普通角色卡 25 轮同一行动，东/西村同名异地、改名复访、含糊离场后隐藏与完整调查恢复、双版本 PG 重放均有逐轮回执。65 段合成对照中新版正确采纳 39、错采 0、放弃 26。YJ-10 可接入关键事件、当前图片适用性和可知范围审计。[YJ-09 运行报告与命令](docs/reports/YJ-09-revisit-continuity-report.md)

当前分支已接通普通角色卡页面的本地首段游玩。正文经有限规则提取后，可自动选择已审预设、复用、编辑、生成或跳过。真实供应商和通用自由文本理解仍待验证。[YJ-08 运行报告](docs/reports/YJ-08-first-play-integration-report.md) · [可交互演示与复跑](packages/first-play/README.md)

- YJ-01 已完成本地 Node 合成文字基线；YJ-02 工具级真实样例已复核，后端准备独立推进；YJ-03 已交付共用契约，复核后定向修补至 `@yingjie/contracts@0.1.1`（交换格式仍为 0.1）。
- YJ-04 已在 `codex/yj-04-scene-state` 完成普通角色卡历史读取、地点状态持久化与跨进程恢复。下游可从 [模块入口](packages/scene-state) 和[运行报告](docs/reports/YJ-04-scene-state-report.md)接续。

- 项目已获准启动，独立仓库与首批规划文件初始化已完成；远端文件内容核验通过，详见[验证记录](docs/verification.md)。
- 远端仓库：[quakhiak34568-lang/Nine-cloud-Yingjie](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie)，私有，默认分支 `main`。
- 本仓库承载需求、实施任务、决策及本地可运行的映界原型。
- 用户愿意投入 1–2 个月；6–8 周是当前排期建议。
- 原有暂定项和明确后置事项继续保留，不因项目启动被批量改为已确认。
- 开源许可证尚未选定，当前不作新的代码或素材许可承诺。

## 与九霄的关系

独立仓库不自动意味着独立产品、独立部署或微服务拆分。映界仍面向 [Nine-cloud](https://github.com/L-core-dev-team/Nine-cloud) 的视觉游玩能力；集成方式由 YJ-01 至 YJ-03 验证。

初始化时导入规划文档；后续已加入限定范围的运行脚本、三张实验图片、共用契约包与 PostgreSQL 场景状态模块。不复制整个九霄，不导入私人原件或凭据。万卡阁继续严格隔离。

## 按顺序阅读

接手时先读[当前交接](docs/handoff.md)、[YJ-09 报告](docs/reports/YJ-09-revisit-continuity-report.md)和[任务看板](docs/task-sequence.md)。完整规划保存在 [YJ-START-01](docs/task-briefs/YJ-START-01-project-kickoff.md)。

1. [需求与首版范围](docs/requirements.md)
2. [启动决定与未决事项](docs/decisions.md)
3. [实施任务序列](docs/task-sequence.md)
4. [可并行的分项目](docs/parallel-workstreams.md)
5. [技术框架建议](docs/technical-plan.md)
6. [九霄代码核查基线](docs/repository-baseline.md)
7. [验证记录](docs/verification.md)
8. [当前交接与下一步](docs/handoff.md)

YJ-02 的固定机位合成酒馆样例为 3 → 5 → 5 人，无变化阶段复用原图；三张画面已逐张复核。后端独立图片 API 仍为 BLOCKED / NOT_RUN。[图片报告与原图](docs/reports/YJ-02-image-capability-report.md) · [YJ-02 证据复核](docs/reports/YJ-02-evidence-review.md)。YJ-03 原交付位于 `codex/yj-03-shared-contracts`；0.1.1 修补位于当前接续分支的 [packages/contracts](packages/contracts)。YJ-04 在含三张原 PNG 的完整副本按锁文件安装，原 8 组及新增 2 组均已复跑通过；原图字节与参考链也已复核。

成果沿任务分支接续；此前核查时 `main` 为 `62f3260`，本次未合并 main。请按当前交接获取接续分支，不将默认分支误认为已合入全部成果。YJ-01 限定范围的结论见[复核记录](docs/reports/YJ-01-evidence-review.md)。

## 历史资料

- [完整规划草案 0.1](docs/history/plan-v0.1.md)
- [原始需求访谈交接书](docs/history/requirements-handoff-2026-11-19.md)

历史文件保留当时状态；当前授权和任务状态以活动文档为准。
