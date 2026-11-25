# 渡口行记 · 图文试玩

双击 [Play-P05-Visual.cmd](../Play-P05-Visual.cmd) 开始或接续自己的八回合。双击 [Review-P05-Visual.cmd](../Review-P05-Visual.cmd) 回看执行机上的正式验收存档。需要本机已有的上游运行目录、Node、Python 和 PostgreSQL，首次启动会初始化专用数据库。环境路径沿用 [P05 本机配置](../README.md)。图片随仓库交付。

要看全三张图，依次选择 **察看渡口 → 走到渡口作业位 → 赶走灰羽鸦 → 领取任务奖励 → 前往望气台 → 前往芦花渡 → 与岑九闲谈 → 前往望气台**。点历史回合可回看当时的正文与配图，点“回到当前”继续。其他可用按钮同样交给九霄结算，偏离这条路线后继续读文字。

关闭浏览器可以随时离开。再次双击同一入口继续。要同时关停本机服务，在仓库根目录运行 `python -B packages/playable-loop/session.py stop visual-reader`。正式回看档用 `visual-demo`。关闭服务会保留存档。回看入口仅在已有正式验收档的机器上打开该档，其他机器可从玩家入口自行开始。

## 验收复核

既有验收档可用 `node packages/playable-loop/visual/browser-test.mjs readback`、`node packages/playable-loop/native-check.mjs visual-demo` 只读核对原生修订与回执（浏览器会幂等登记展示）。结构控制为 `node packages/playable-loop/visual/controls.mjs`。完整八回合操作只针对全新独立正式档，阶段依次为 `first`、关停与恢复、`resume`、`readback`。原件的尺寸、校验和、适用条件和逐回合绑定见 [运行报告](../../../docs/reports/YJ-P05-VISUAL-LOOP-01-report.md)。
