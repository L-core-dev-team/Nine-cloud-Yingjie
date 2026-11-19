# 九霄代码核查基线

**YJ-01 当次运行基线**为九霄 `main@cd25360c7929e10f8b2b0fad342fedd943d4f323`。已在本地 Node、PostgreSQL 与模拟文字供应商上核验同一角色卡会话的保存、刷新和继续行动。版本差异、复跑步骤和宿主边界见[运行报告](reports/YJ-01-runtime-baseline-report.md)。下文保留开工前的历史核查。

核查日期：2026-11-19。上游：L-core-dev-team/Nine-cloud；分支：main；固定提交：1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc。

本稿以 Nine-cloud 主线提交 [1bd7bb5](https://github.com/L-core-dev-team/Nine-cloud/commit/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc) 为核查基线。源码核查与已有联测回执支持以下结论；当前可运行性仍由 YJ-01 复核。

| 已有基础 | 可以复用什么 | 需要补什么 |
| --- | --- | --- |
| React/Vite、Hono、PostgreSQL | 页面、接口、数据库与既有工程组织 | 映界专有功能及真实接入 |
| 独立角色卡会话 | 世界书、Persona、历史保存、修订号、原请求回读 | 地点视觉状态及生图结果归属 |
| 原生权威回合 | 存档版本、分支、结果提交、状态和记忆的隔离思路 | 与映界的适配边界；不能假定与角色卡会话已经互通 |
| 34 条公开运行时设定 | 修仙背景和检索内容 | 按玩家可知范围形成画面资料 |
| 74 张画卷索引及四类固定场景 | 预设图片、显示方式和视觉参考 | 语义匹配、当前状态适配与动态更新 |
| 已有测试工具 | 类型检查、单元测试和浏览器流程测试 | 映界关键状态转换与连续游玩证据 |

源码依据：[前端依赖](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/apps/web/package.json)、[后端依赖](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/apps/api/package.json)、[角色卡服务](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/apps/api/src/card-import/service.ts)、[存档契约](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/packages/contracts/src/save.ts)、[世界书](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/packages/content/src/canon-runtime.json)、[画卷索引](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/apps/web/src/candidate-atlas.ts)、[根脚本与测试工具](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/package.json)。

角色卡真实模型联测回执记录了四次限定范围真实调用通过，但当前接入仍有本地开发宿主限制。角色卡生成读取最多 50 轮历史，超出预算还会裁剪，所以地点与可见变化必须独立保存。固定场景映射对未知地点默认显示山门，这种兜底不应直接用于映界当前场景。[联测回执](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/docs/CARD-REAL-PLAY-01-RECEIPT.md) · [本地宿主](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/apps/api/src/card-import/local-runtime.ts) · [场景映射](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/packages/content/src/scenes/manifest.ts)

## 已检查与未执行

已完成的是远端源码与历史回执阅读，不是当次应用运行或新的真实模型联测。历史回执中的四次调用属于九霄文字模型限定联测，不证明映界图片生成效果。

本地存在的部分源码文件是只读快照，不是完整Git工作副本。YJ-01应在合适的独立上游工作副本复核基线，保留用户已有工作区和分支。

## 素材状态说明

画卷索引有74项；资产清单共有88项并标记approved。固定场景代码的旧注释仍写待批准，不能据此覆盖较新的资产清单状态。资产存在及原有批准不意味着任意新剧情都适用，也不等于本次已经把素材复制到映界。

参考：[资产清单](https://github.com/L-core-dev-team/Nine-cloud/blob/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc/apps/web/public/scenes/candidate/asset-manifest.json)。
