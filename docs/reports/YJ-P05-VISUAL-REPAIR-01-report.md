# 渡口行记 · 变序配图与同档继续

**P05_VISUAL_ROUTE_REPAIR_PASS**。在本轮 Windows 工作副本双击 [Play-P05-Visual.cmd](../../packages/playable-loop/Play-P05-Visual.cmd) 即可继续自己的存档。升级后实际打开的是原第 8 回合，有 5 个原生行动按钮。验收者在个人档提交行动 0 次。关闭页面后重新双击同一入口即可恢复；仍可从 [原回看入口](../../packages/playable-loop/Review-P05-Visual.cmd) 查看 v1 短局。

三张原图均可随当前依据出现。可以先去望气台，也可以先闲谈再察看渡口。读到没有适用画面的正文后，下一次新观察可以重新配图。原生移动受阻或仅返回渡口时，当前图片会收起。当前仍限于两个地点和三张已审素材。[试玩说明](../../packages/playable-loop/visual/README.md)

## 原生操作与画面

使用 Chrome 158.0.8127.38 桌面无头自动化。三个新身份和存档各用独立本机 PG。合计 16 次按钮提交，全部由原生服务 accepted，含 4 次 legal_failure（A2、B1、B3、B6），原生 rejected 请求 0。浏览器实际解码、页面有显示面积、文件 SHA 和宿主展示确认分别取证。五张 B 档截图与逐轮 JSON 存于[证据目录](evidence/YJ-P05-VISUAL-REPAIR-01/)。

| 档 | 实际操作与结果 |
| --- | --- |
| A · 2 回合 | A1 未清障、未领奖即登望气台并显示 I03。A2 尝试返回，实际事件 move.blocked，文字“石堆挡住了路。”。人仍在望气台，当前无图。[A1](evidence/YJ-P05-VISUAL-REPAIR-01/A1.json) · [A2](evidence/YJ-P05-VISUAL-REPAIR-01/A2.json) |
| B · 10 回合 | 闲谈无图 → 察看显示 I01 → 重复察看无新线索，收图 → 移到作业位无图 → 清障显示 I02 → 闲谈保留 I02 → 领奖继续保留 I02。两次“上次所见”都指向 B5。B7 后关图、停宿主和 PG，确认停止再恢复，修订、状态和开关一致。B8 开图登台显示 I03，B9 返渡无图，B10 再登台复用 B8 已显示的原件。第 9 和第 10 回合历史均可读。[B7 截图](evidence/YJ-P05-VISUAL-REPAIR-01/B7.png) · [B10 截图](evidence/YJ-P05-VISUAL-REPAIR-01/B10.png) · [历史和拒绝检查](evidence/YJ-P05-VISUAL-REPAIR-01/history-controls.json) |
| C · 4 回合 | 先到作业位、清障显示 I02、返回父地点收图、首次察看。C4 实际返回与 B2 相同的淤船三句，PG 中 ferryState 为 clear、obstacleState 为 cleared。正文完整保留，当前图为空，折叠诊断记录“清障状态与旧淤船观察正文冲突”。该上游旧线索仍待九霄单独处理。[B2](evidence/YJ-P05-VISUAL-REPAIR-01/B2.json) · [C4](evidence/YJ-P05-VISUAL-REPAIR-01/C4.json) |

八回合限制仅从图文个人模式与本轮测试模式解除。v2 在接受并保存原生行动时取得对应白名单事件字段和受权状态。渡口开场要求首次发现指定线索且未清障；作业位清障要求战斗目标、结果、任务事件、散石和黑水正文均相符；登台图要求抵达事件及完整的南望正文。另核对归属、版本、视野、原件完整性。对白或体力提示只允许经逐句核对的固定上游附加文字，其他附加内容收图。重复察看的 none 固定收起。闲谈、领奖只从同一档相容视野且真实显示过的原观测继承，未经匹配的行动切断这次延续。[策略源码](../../packages/playable-loop/visual/scene-policy.mjs) · [冻结路线和断点](evidence/YJ-P05-VISUAL-REPAIR-01/matrix.json)

三档的 16 份规范化回执与 16 份正文 SHA 全部对上，共 18 条独立 PG 事件。逐回合回读核对时从有权读取的最终状态按独立事件批次逆序还原，逐项比对变更的后值，再恢复前值；使用相应历史修订计算当回合原生正文附加提示。固定上游为 `f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`，沿用 B2 的规则语义批准条件；原普通 JSON 字节顺序限制仍保留。[A 档对账](evidence/YJ-P05-VISUAL-REPAIR-01/pg-a.jsonl) · [B 档对账](evidence/YJ-P05-VISUAL-REPAIR-01/pg-b.jsonl) · [C 档对账](evidence/YJ-P05-VISUAL-REPAIR-01/pg-c.jsonl)

## 个人档升级与兼容

首次向旧宿主读取个人档返回 WinError 10061。旧宿主和 PG 留有 PID 文件，进程均不存在，pg_ctl status 确认无服务器。由 PG 原生启动完成恢复，再以旧宿主读取第 8 回合。正常关停该实例，确认 PG 与宿主均已停止，复制至仅本机当前用户可访问的备份目录，1169 个文件逐一核对字节摘要。备份未入库。新版在同一数据目录恢复，健康响应由 P05 变为 P05-visual/2。脱敏归属、修订、奖励、正文与旧图绑定、展示历史、开关均一致。第八回合有 5 个可用按钮，第九步留给玩家。[升级前](evidence/YJ-P05-VISUAL-REPAIR-01/personal-before.json) · [备份校验](evidence/YJ-P05-VISUAL-REPAIR-01/personal-backup.json) · [升级后](evidence/YJ-P05-VISUAL-REPAIR-01/personal-after.json) · [实际打开](evidence/YJ-P05-VISUAL-REPAIR-01/personal-entry.json)

v1 的旧绑定和实际展示记录原样读取，v2 只用于新提交。结构控制以一个旧版未获图的记录衔接新的有据观测，并核对旧记录字节内容；缺少绑定依据时回退为文字。独立验证错误归属、未来修订、非规范或不安全修订号、迟到图片、未认可附加句与缺失/损坏的原件。最终版本逐条机械回放 16 份现场记录，与原留存结果一致；另外重新打开 A/B/C 最终视图核对折叠诊断与历史，额外原生行动 0 次。旧文字归档、旧视觉结构控制、旧正式图文档八份 PG 回执与五个历史图片读取均通过。[回放与差异](evidence/YJ-P05-VISUAL-REPAIR-01/checks.json) · [旧档读取](evidence/YJ-P05-VISUAL-REPAIR-01/v1-archive.json) · [命令与首次故障](evidence/YJ-P05-VISUAL-REPAIR-01/commands.json)

本轮工具生成/编辑、文本实验或审核、项目模型 API、运行时派图与额外费用均为 0。上轮固定路线的 P05_VISUAL_PLAYABLE_PASS 保留，本轮结论限于已验的变序、恢复与三图条件。道主新版本亲自体验及手机真机待验。

如需恢复升级前状态，先正常停 visual-reader，保留届时的进度，再用本机受限冷备份另行恢复；覆盖已有数据前应由存档所有者决定。旧正式档回看可单独启动，不需要动个人档。
