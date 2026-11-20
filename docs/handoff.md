# 映界当前交接

更新：2026-11-20。

## 最新指示

用户已要求开始，创建独立映界仓库并上传现有计划。草案0.1作为工作基线；暂定项和后置事项保持原状态。

## 当前工作

- YJ-01 已在 `codex/yj-01-runtime-baseline` 完成本地工程验证。九霄选用 `cd25360c7929e10f8b2b0fad342fedd943d4f323`，独立角色卡在刷新后继续提交，数据库留存修订 1、2。首批候选接入点为鉴权后的已完成历史。见[运行报告](reports/YJ-01-runtime-baseline-report.md)。

- 已完成需求、任务、并行分工、技术框架和上游核查记录的文件整理。
- 已补充独立仓库边界、启动授权与第一项任务书。
- 远端仓库：[quakhiak34568-lang/Nine-cloud-Yingjie](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie)，私有，默认分支 `main`；已通过GitHub元数据核实。
- 首批15份规划和协作文件已提交，初始化提交为[6ebf0b0](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/6ebf0b0a2c2dd4b3309ed3456dde0648519b2699)，核验回执提交为[8ed270a](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/8ed270ab4219ed9e8eca93d787364886827d1237)。
- 编制开工任务书前已再次读取main，确认其为8ed270a，远端15份文件与本地内容逐一一致。此后增加开工任务书和接手索引；核验方法见[验证记录](verification.md)。
- 开工前已交付[完整开工与接续任务书 YJ-START-01](task-briefs/YJ-START-01-project-kickoff.md)。映界业务实现尚待后续任务。

## 当前断点 · 2026-11-20

YJ-02 成果分支 `codex/yj-02-image-capability` 已核对到 `13ac86a0c4a130780123cb5ed1768db6c5b43603`。它承接 `84394958f4fd0dc0872d52af8dc9879fc3613a28`。Codex 工具真实返回三张酒馆图，人员依次为 3、5、5。复访从磁盘恢复五人图，随后亮灯编辑继续使用该图。调用、原图、参考关系、离线故障记录和复跑方式见[图片能力报告](reports/YJ-02-image-capability-report.md)。

本次已读取记录与脚本，并在 GitHub 固定提交的原图展示页逐张核对人物及主要布局，支持本批工具级样例结论。本次未重新调用图片工具、未重跑 probe.py，也未独立重算 PNG 的 SHA-256。完整范围见[YJ-02 证据复核](reports/YJ-02-evidence-review.md)。

## 现在执行 YJ-03

- 接续分支：`codex/yj-03-shared-contracts`，从 YJ-02 成果接续；先读取实际 HEAD，不从落后的 main 重做。
- 任务入口：[YJ-03 共用数据格式与离线契约验证](task-briefs/YJ-03-shared-contracts.md)。任务书已准备，契约实现尚未执行。
- 目标：最小类型/schema、来源映射、视觉版本、参考资格、结果与审阅语义、正反例及实际离线检查。
- 重点：剧情修订不同不必然使旧图失效；已接受不等于当前可显示；编辑参考可来自旧视觉版本，但必须满足该计划的保留要求。
- 不需要新增生图调用。独立后端 API 仍需获准入口及认证，供应商查询、取消、费用与真实会话联调仍待验证。
- YJ-03 收口后，YJ-04、YJ-06、YJ-07 可按共享契约开展；YJ-05 通用部分可推进，真实适配与调用仍受后端条件约束。

复核时 `main` 为 `62f3260fc391ea10349bd792c1c77875e76665c7`，尚未包含任务分支的全部成果。本轮不合并 main、不修改九霄上游。YJ-01 的[限定范围复核](reports/YJ-01-evidence-review.md)继续有效。

## 保留未决

费用细节、多人范围、素材准备安排、密钥保存方式、正式验收、具体模型和图片规格继续保留原状态。
