# 九霄 · 映界

映界为《九霄》提供随文字剧情变化、能够复访并保留变化的场景画面。

## 当前状态

- YJ-01 已完成本地 Node 合成文字基线；YJ-02 工具级真实样例已复核；YJ-03 已交付 [0.1 共用契约与来源映射](docs/contracts/visual-contracts-v0.1.md)，C01–C12 离线检查通过。

- 项目已获准启动，独立仓库与首批规划文件初始化已完成；远端文件内容核验通过，详见[验证记录](docs/verification.md)。
- 远端仓库：[quakhiak34568-lang/Nine-cloud-Yingjie](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie)，私有，默认分支 `main`。
- 本仓库承载需求、实施任务、决策和后续实现；当前尚无可运行的映界应用。
- 用户愿意投入 1–2 个月；6–8 周是当前排期建议。
- 原有暂定项和明确后置事项继续保留，不因项目启动被批量改为已确认。
- 开源许可证尚未选定，当前不作新的代码或素材许可承诺。

## 与九霄的关系

独立仓库不自动意味着独立产品、独立部署或微服务拆分。映界仍面向 [Nine-cloud](https://github.com/L-core-dev-team/Nine-cloud) 的视觉游玩能力；集成方式由 YJ-01 至 YJ-03 验证。

初始化时导入规划文档；后续已加入限定范围的运行脚本与三张实验图片，尚无映界业务实现。不复制整个九霄，不导入私人原件或凭据。万卡阁继续严格隔离。

## 按顺序阅读

接手时先读[当前交接](docs/handoff.md)，随后按 [YJ-03 验证报告](docs/reports/YJ-03-shared-contracts-report.md) 的消费入口接续 YJ-04 至 YJ-07。[完整开工与接续任务书 YJ-START-01](docs/task-briefs/YJ-START-01-project-kickoff.md)保留项目全貌与历史启动安排，不能据其早期状态重复执行已完成任务。

1. [需求与首版范围](docs/requirements.md)
2. [启动决定与未决事项](docs/decisions.md)
3. [实施任务序列](docs/task-sequence.md)
4. [可并行的分项目](docs/parallel-workstreams.md)
5. [技术框架建议](docs/technical-plan.md)
6. [九霄代码核查基线](docs/repository-baseline.md)
7. [验证记录](docs/verification.md)
8. [当前交接与下一步](docs/handoff.md)

YJ-02 的固定机位合成酒馆样例为 3 → 5 → 5 人，无变化阶段复用原图；三张画面已逐张复核。后端独立图片 API 仍为 BLOCKED / NOT_RUN。[图片报告与原图](docs/reports/YJ-02-image-capability-report.md) · [YJ-02 证据复核](docs/reports/YJ-02-evidence-review.md)。YJ-03 实现位于 `codex/yj-03-shared-contracts` 的 [packages/contracts](packages/contracts)。从仓库根执行 `npm ci --prefix packages/contracts` 后，使用 `npm --prefix packages/contracts test` 编译和复跑离线检查。

成果沿任务分支接续；复核时 `main` 仍为 `62f3260`。请按当前交接获取接续分支，不将默认分支误认为已合入全部成果。YJ-01 限定范围的结论见[复核记录](docs/reports/YJ-01-evidence-review.md)。

## 历史资料

- [完整规划草案 0.1](docs/history/plan-v0.1.md)
- [原始需求访谈交接书](docs/history/requirements-handoff-2026-11-19.md)

历史文件保留当时状态；当前授权和任务状态以活动文档为准。
