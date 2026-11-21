# YJ-11 图片历史与纠错运行报告

2026-11-21（北京时间）。接手续分支 `codex/yj-11-image-history-corrections`，远端准备提交 `98aa0d888f999e0d556c590cc81dd710dc84809c`。本地起初停在 YJ-10，工作树干净。核对准备提交及其树后切换到任务分支。九霄只读上游固定为 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。共用契约仍为 `@yingjie/contracts@0.1.1`。

## 玩家可操作的流程

在九霄普通角色卡页进入映界，展开“本会话图片历史”，选择回合，再查看历史原图或反馈问题。终端验证使用真实本地 PostgreSQL 18.4、HTTP/Cookie、Vite 挂载和 Chrome。11 轮正文由合成文字服务写入普通会话；6 次图片发送来自本地模拟供应商，返回的图片取自已保存的 YJ-02 原件。审核依据是明确的测试样例。页面截图只截取历史面板。[运行回执](evidence/YJ-11/run.json) · [390 × 844 视口截图](evidence/YJ-11/history.jpg)

| 验证 | 实际结果 |
| --- | --- |
| 分页与归属 | 11 个已完成修订分为 8＋3，降序游标无重复无遗漏。同一轮可展开多个选择记录。旧选择缺少 trigger 或 reason 时返回 null。 |
| 预设、生成、复用、编辑 | 预设无 task 或 attempt。五人日间图先失败，显式重试返回，两个 ordinal 留在原任务。普通交谈复用同一 assetId，新增尝试数为 0。 |
| 同 SHA 不同资产 | 五人日间原图、被错用于傍晚的返回、回到日间的新版本共用一份 SHA。三个 assetId 分别核验。撤下错图及当前新版本后，最初日间资产仍可按历史权限下载。 |
| 玩家反馈 | 在真实页面打开原图、键盘展开历史、窄屏选择类别并提交。待审期间当前原图仍可读。14 个并行命令以两种 UUID 大小写重放，均返回相同反馈 ID；修改参数重用命令返回 409。浏览与反馈期间新增任务和发送均为 0。 |
| 受信改判 | 注入 PG 更新失败，判定和活动资格一起回滚。两个独立 Node 进程竞争同一审核代次，仅一项撤下成功，另一项返回 stale-review。重放已完成判定保持同一结果。原始 pending → accepted → rejected 证据仍在。驳回另一项反馈后，获准原件继续返回 200。 |
| 分别核权 | 撤下后当前 URL、历史 URL 均返回 404，原引用的编辑资格返回 invalidated。预设也能独立撤下。篡改临时原件、撤销世界书授权、同账户错会话均拒绝原件。错账户、删除会话返回 403。 |
| 未知、迟到、换页 | 未知请求在刷新及新进程中仍为 unknown，无新发送。迟到回执只落在原 attempt，原件保持待审，新回合没有图片。慢历史响应在切换会话后被丢弃。受控延迟的另一尝试可见 waiting → refused。撤图后的文字行动继续保存。 |

## 数据和权限接口

- 宿主从九霄 Cookie 恢复 owner，再核对普通会话及已保存 revision。历史列表按 `scope + revision` 查事件；详情将真实 source/event_key 连到选择、task、attempt ordinal 和 asset。复用引用原修订。请求键对客户端仅给摘要。世界书源文、反馈私有说明及内部路径不进入列表或原件 URL。
- `GET /api/yingjie/:session/history?before=N`、`GET …/history/:rev` 和 `GET …/history/:rev/:kind/:id` 分别读取列表、详情、原件。原件按当前会话和使用许可重查，再核验文件摘要、有效审核和源事件。响应禁止缓存。读旧图不会设置当前图。撤权后服务端拒绝后续下载，已交付终端的像素无法远程收回。
- `POST …/feedback` 要求同源 Cookie、同源 Origin、有限枚举和限长输入。指令 UUID 在会话内幂等，反馈绑定目标身份、原场景版本、审核 ID/代次及预设来源或资产身份。受信宿主可调用 `ImageHistory.decide`。测试通过受控 fixture 身份执行；玩家 HTTP 接口没有审批权限。
- 新增 `yingjie_history.report / decision / review_event`。同一事务锁定命令、目标及活动资产，记录裁决并更新资格；旧审核保存 before/after 与依据。数据库对这些审计行拒绝更新和删除。现有资产审核也由触发器记录。部署前旧资产从现存有效审核开始，迁移不会补造不可考的历史。
- `replacement.status = blocked`，原因为 `contract-adapter-required`。同一已完成正文只允许一个 `task.event_key`，现契约没有独立的纠错请求身份。替代派发前须增加可鉴权的 correctionId/replacementRequestKey、父资产和目标版本绑定、独立幂等及未知结果核对。原任务成功、明确失败后的显式重试，以及未知后迟到的真实回执均保留原语义。

## 安装、复跑及回退

在仓库根目录运行。先按 [YJ-04 环境说明](YJ-04-scene-state-report.md) 准备锁定的九霄副本、本地角色卡 PostgreSQL、已安装的上游依赖和编译产物。将 `NINE_CLOUD_ROOT`、`CARD_DEMO_POSTGRES_BIN`、`CHROME_PATH` 指向对应路径。已有依赖可直接运行契约测试；新检出先执行安装命令。

```powershell
npm ci --prefix packages/contracts
npm --prefix packages/contracts test
python docs/reports/evidence/YJ-02/probe.py verify
$env:YJ11_EVIDENCE_DIR = 'docs/reports/evidence/YJ-11'
node packages/scene-state/test/verify-local.mjs packages/image-history/test/history.test.mjs
node packages/scene-state/test/verify-local.mjs packages/scene-state/test/live-card.test.mjs packages/scene-state/test/persistence.test.mjs packages/image-tasks/test/recovery.test.mjs packages/ui-shell/test/browser.test.mjs packages/world-assets/test/matching.test.mjs packages/world-assets/test/live.test.mjs packages/first-play/test/extract.test.mjs packages/first-play/test/browser.test.mjs packages/first-play/test/continuity.test.mjs packages/first-play/test/revisit-browser.test.mjs packages/first-play/test/trigger.test.mjs packages/first-play/test/trigger-browser.test.mjs packages/image-history/test/history.test.mjs
```

一轮综合命令由一个验证器管理数据库启停，各测试使用独立的临时库。准备基线通过 19/19，契约 10/10，三张原 PNG 与两条编辑参考链通过。扩展后的三次综合运行各通过 20/20。末次包含 UUID 大小写并发回归。逐组结果见[回归回执](evidence/YJ-11/regression.json)。调试曾在读取 Chrome 网络响应正文时等待超时；测试现通过页面待审状态并从独立 HTTP 详情读取已提交记录。调试进程曾共用数据库生命周期，关库造成一次清理连接重置。随后独占验证器重新运行。YJ-09 原有并行超时原因仍未证实。

本地宿主在 scene、image、world、play 表可用后执行独立 `packages/image-history/schema.sql`，该脚本可重复执行。需要撤回界面时，先关闭历史面板、反馈写入和审核作业，保留审核触发器、账本、原件和活动资格检查。若回退到不识别预设撤下记录的老宿主，应关闭图片展示/发送，待兼容门禁恢复后再启用。审计回放依赖原会话修订与授权快照，备份恢复需同时保留数据库、世界书版本和原件目录。

## YJ-12 接续条件

基于本分支实际最新 HEAD，沿用原会话 Cookie、分页游标、反馈命令 UUID、审核代次及 no-store 原件路由。优先在断网或丢回执后恢复同一反馈指令，再验证真机切换账户、长时间后台恢复、跨终端乱序及数据库/文件共同恢复。生产权限配置、纠错审核者身份接入、移动真机、独立人工审图、自由文本模型、真实图片 API 及计费、供应商查询或撤销本轮均为 **NOT_RUN**。
