# 渡口行记 · 图文试玩

双击 [Play-P05-Visual.cmd](../Play-P05-Visual.cmd) 接续自己的原生存档。个人档可以走过第八回合，三个配图节点按当次正文与规则状态匹配。双击 [Review-P05-Visual.cmd](../Review-P05-Visual.cmd) 可回看原 v1 八回合正式验收档。本机需要已有上游运行目录、Node、Python 和 PostgreSQL。环境路径见 [P05 本机配置](../README.md)。

可以先与岑九闲谈再察看渡口，也可以先前往望气台。走到渡口作业位后清障，后续闲谈与领奖可以保留标为“上次所见”的画面。重复察看没有新线索、移动受阻或正文与清障状态冲突时会收图；新的明确观察仍可取得配图。点历史回合可回看，点“回到当前”继续。[本轮验收与个人档升级记录](../../../docs/reports/YJ-P05-VISUAL-REPAIR-01-report.md)

关闭浏览器可以随时离开。再次双击同一入口继续。要同时关停本机服务，在仓库根目录运行 `python -B packages/playable-loop/session.py stop visual-reader`。正式回看档用 `visual-demo`。关闭服务会保留存档。回看入口仅在已有正式验收档的机器上打开该档，其他机器可从玩家入口自行开始。

## 验收复核

既有验收档可用 `node packages/playable-loop/visual/browser-test.mjs readback`、`node packages/playable-loop/native-check.mjs visual-demo` 只读核对原生修订与回执（浏览器会幂等登记展示）。结构控制为 `node packages/playable-loop/visual/controls.mjs`。完整八回合操作只针对全新独立正式档，阶段依次为 `first`、关停与恢复、`resume`、`readback`。原件的尺寸、校验和、适用条件和逐回合绑定见 [运行报告](../../../docs/reports/YJ-P05-VISUAL-LOOP-01-report.md)。
