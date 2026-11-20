# YJ-10 关键事件出图与视觉一致性

九霄原普通角色卡页面完成了 14 轮定向游玩。每轮提交“继续观察”，由本地文字服务提供不同的合成正文，经实际保存、鉴权 HTTP、PostgreSQL 投影、图片任务和 Chrome 面板验证。主流程有五轮具备视觉触发条件，共进入四次本地发送边界。另有一轮四人构图超出供应能力。普通交谈在已有合格图时复用，在缺图时继续文字。[逐轮结果](evidence/YJ-10/run.json) · [拒绝三人错图的界面](evidence/YJ-10/rejected.jpg)

实现和逐轮证据提交 `66a22e89154568071d0c7ffbd629df8f495d8843` 已核对父节点、整树和 GitHub ref。[实现提交](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/66a22e89154568071d0c7ffbd629df8f495d8843)

接手分支 `codex/yj-10-trigger-consistency`，已核实远端准备提交 `675413a62248ee99927eac8fca7b88b7a9338f3c`。接手前本地 YJ-09 工作树干净，保留原分支。上游独立副本固定在 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。契约包 0.1.1，交换格式 0.1。

## 触发与抑制

`visible-change/1` 读取当前已完成事件、提取方法、正文摘要、该事件实际登记的视觉版本以及同地点上一份就绪快照。首个完整地点可以成为候选；人物名单、结构、时段、灯光、机位和观察视角的实际差异可成为候选。重复确认同一名单、改名和无视觉变化的复访均不能单独产生新发送。额外的强调依据只接受已提取的多人到场或亲眼观察到的暮色点灯，并核实相应字段确实变化。其他小说高潮或玩家强调意图记为 unsupported。候选仍须通过开关、权限、素材和供应能力检查。[规则与审计](../../packages/first-play/trigger.mjs) · [选择顺序](../../packages/first-play/planner.mjs)

| 页面与后台实测 | 结果 |
| --- | --- |
| 初次确认三人场景，随后交谈、引语 | 首轮生成 I0，后两轮复用同一已审原件，累计模拟发送 1 次。 |
| 两名客人到场，模拟编辑故意返回 I0 | 五人 V2 的原件审阅写入 rejected / contradicts / mismatch:people。三人图旧地址返回 404。随后两轮交谈跳过，累计发送仍是 2 次。 |
| 明确傍晚点灯 | 五人 V3 选择合法的历史资产作参考，显示已审 I2。相同字节的有效原资产与已拒错的尝试有独立资产 ID，已拒记录没有成为参考。 |
| 撤权、人员离开 | 原件地址返回 404；正文继续，面板记录 no-grant。恢复授权后，四人构图返回 outside-local-provider。 |
| 五人重新到齐，编辑发送结果未知 | 后续普通交谈、刷新和另一 Node 进程按同一 PG 账本选择 hold unknown，无第二笔发送。 |
| 离场指代不明、关闭生成 | 回执为 unknown-visible-state / disabled，均无可见旧图；第 14 轮正文已保存。 |

旧版等待、待审、晚到、错误账户、两个同名地点、删除会话、字节损坏、重复回执、事务中断与多进程竞争，继续运行原有 PG、HTTP 与浏览器用例。08 的原 13 轮脚本明确选用历史策略，其中失败后的下一事件会再次考虑编辑；09 的 25 轮在新触发策略下运行。交互演示默认使用新策略。原提取器和权威文字未改动。

## 审阅、现时使用及可知范围

- 三张 PNG 沿用 YJ-02 原件。[元素清单](../../packages/image-tasks/reviewed-elements.json)单独依据已提交的检查记录和固定样例编写。哈希定位具体原件，再逐项对照其地点、名单、结构、时间、光照和视角。已知矛盾被拒绝，未登记字节等待审阅。已完成审阅不会被迟到的自动初审覆盖。未新增独立人工盲评或机器看图识别。
- [assessUses](../../packages/first-play/consistency.mjs)分别给出资产审阅状态、当前展示资格、针对指定编辑计划的参考资格。旧版本图可返回 display=visual-mismatch、reference=eligible。待审、坏字节、不同账户或会话、撤权、失效、待核实现场或已关闭目标均无法取得相应使用资格。下载和派发入口重新核实，历史上的“曾经可用”只作审计证据。
- 导入的合成世界书在获准地点条目中故意混入密室、未揭示宝物、潜伏角色、未来事件及伪指令，授权标签中另加入秘密标签。真实九霄读取器取得包含这些文字的条目，07 选择器只返回当前已揭示的授权标签。模拟渲染规格只接收地点编号及六类视觉事实。逐轮检查已保存投影、计划、选择回执和面板；显示图片重新下载并比对摘要。第三人称未知旁白、传闻、梦、引语或计划没有新增在场成员。真实私人资料未使用。

## YJ-11 消费接口

1. 从鉴权普通会话得到 scope。按 scope 和 revision 读取 `yingjie_play.choice.record` 的 policy、triggerCandidate、triggerReason、evidence、narrativeEmphasis、selectionReason、suppressedReason、chosenAction 和 frameState。evidence 含来源请求键、正文摘要、提取版本、地点、视觉版本、变化字段及可选强调分句偏移。旧 08/09 行可能没有新增键，须显示“未记录”。一次轮询选择不等于一笔发送。
2. 用该范围内的 `yingjie_image.task.event_key`、attempt.task、asset.id 与 asset.scope 对账。评审 ID、结论、依据、拒绝原因在 asset.record.review；选择记录还可含 evaluatedAsset、displayedAsset、uses。相同 SHA-256 的两次返回可拥有不同目标和审阅结论。历史查看应有独立访问许可；纠错需要保留原尝试及审阅依据。历史陈列不能授予当前展示或编辑权。
3. 再次展示或编辑前，检查当前许可、实时文件摘要、当前 Visual 和具体计划。保留未知请求键并与原尝试对账。拒绝原因可按用户可读类别显示，浏览器无需接触私人原文或用户标识。完整历史界面、纠错版本账和人工改判流程留给 11。

采用现有 JSONB 记录，SQL 表、公共 schema、依赖锁文件和上游源码无需迁移。回退到 09 可重新挂载其原宿主及原策略，保留尝试、原件和审阅账本。真实供应商还需获准入口、认证和额度、生成/参考编辑协议、结果与审阅入口，以及未知发送的核对途径。真实文本模型、图片 API/费用、私人语料、生产挂载及手机真机均为 NOT_RUN。本轮新增生图 0，真实模型调用 0。

## 复跑

Windows 本地 PostgreSQL 18.4、Chrome 157.0.8103.79，环境变量与原始上游准备沿用[本地运行说明](../../packages/image-tasks/README.md)。从映界仓库根执行。

```powershell
npm --prefix packages/contracts test
python docs/reports/evidence/YJ-02/probe.py verify
$env:YJ10_EVIDENCE_DIR='docs/reports/evidence/YJ-10'
node packages/scene-state/test/verify-local.mjs packages/scene-state/test/live-card.test.mjs packages/scene-state/test/persistence.test.mjs packages/image-tasks/test/recovery.test.mjs packages/ui-shell/test/browser.test.mjs packages/world-assets/test/matching.test.mjs packages/world-assets/test/live.test.mjs packages/first-play/test/extract.test.mjs packages/first-play/test/browser.test.mjs packages/first-play/test/continuity.test.mjs packages/first-play/test/revisit-browser.test.mjs packages/first-play/test/trigger.test.mjs packages/first-play/test/trigger-browser.test.mjs
```

[各次运行、命令及超时复查](evidence/YJ-10/regression.json) 收录开工基线、定向检查及最终综合运行。09 曾有一次并行等待 08 面板进入“编辑失败”状态超过原 12 秒阈值。此次保留原阈值，在失败分支加入脱敏的页面状态、修订、任务和尝试诊断。含原 08 失败场景的并行运行共 7 次，同一超时复现 0 次。其中三条原页面脚本同跑 3/3，最终两次全量各 19/19，失败、跳过均为 0。原契约 10/10、PNG 3/3 和两级参考链通过。历史那次超时的根因仍未证实。
