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

## YJ-03 已完成 · 任务分支交接

- 实现提交 [5463c96](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/5463c96eae5996a69bcc61b5887c6c3d50f8b3e9) 位于 `codex/yj-03-shared-contracts`。接手起点为 `e0b16bc`。继续从任务分支最新 HEAD 取成果。
- [契约 0.1](contracts/visual-contracts-v0.1.md) 和 [包入口](../packages/contracts) 是后续模块的共用格式。[验证报告](reports/YJ-03-shared-contracts-report.md) 给出上游源码映射、命令、正反例和未运行项。
- 原执行报告记录离线冻结安装、编译、8 组 C01–C12 检查和三张原 PNG 校验通过。角色卡历史、合成酒馆及原生回合分别建模；普通对话与无变化复访可复用，傍晚编辑沿用五人图。
- YJ-04 可接角色卡已完成历史与地点持久化；YJ-06、YJ-07 可消费样例与地点身份。YJ-05 可开发通用结果处理，独立后端图片 API 及真实供应商能力仍为 BLOCKED / NOT_RUN。

复核时 `main` 为 `62f3260fc391ea10349bd792c1c77875e76665c7`，尚未包含任务分支的全部成果。本轮不合并 main、不修改九霄上游。YJ-01 的[限定范围复核](reports/YJ-01-evidence-review.md)继续有效。

## YJ-03 复核修补与 YJ-04 接手 · 2026-11-20

当前接续分支为 `codex/yj-04-scene-state`，从 YJ-03 最终提交 `7d68284e95754f06e853123ac3c719788266ae0a` 建立。定向修补提交为 [e5d6cf2](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/e5d6cf2e73dc5131209f9793677e3eebf24a7c73)；本节与任务书会在其后提交。接手时读取远端实际 HEAD，不用固定 SHA 覆盖后续成果。

- 修复编辑入口接受“同视觉版本、不同可见事实”，以及角色卡 UUID 大小写拆分事件/请求身份两个可复现缺口。包升级为 `@yingjie/contracts@0.1.1`，交换格式仍为 `0.1`；原图片和原测试不改。
- 本次独立通过：原锁文件安装、修补前后编译、新增 2 组回归、原来源映射 1 组。原图字节和全量原测试本次 NOT_RUN，不能把原报告的 8 组通过算作本次重跑。见[复核报告](reports/YJ-03-evidence-review.md)。
- [YJ-04 完整任务书](task-briefs/YJ-04-scene-state.md)已准备。先在完整副本复跑全部 10 组契约检查，然后实现真实已保存普通角色卡历史读取、稳定地点身份、变化继承、持久化、分页、重放和重启恢复。
- 地点主键不包含每轮 key/revision；新一轮没有提到旧人物，不自动视为离开。没有足够事实时明确未就绪，不伪造可见状态。
- YJ-04 状态业务实现尚未执行，不需要等待图片供应商入口。
- YJ-02 后端准备继续使用独立分支 `codex/yj-02-backend-readiness`；本次核查其 HEAD 为 `18c7dd9cf82f161024c1bfa3951b9a95d63b80f1`。任务书在[该分支](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/codex/yj-02-backend-readiness/docs/task-briefs/YJ-02-backend-readiness.md)。如需共用契约修补，可单独接入上述补丁提交；不要将整个 04 分支合入以覆盖 02 的交接记录。

## 保留未决

费用细节、多人范围、素材准备安排、密钥保存方式、正式验收、具体模型和图片规格继续保留原状态。
