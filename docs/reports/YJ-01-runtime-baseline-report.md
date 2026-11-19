# YJ-01 · 九霄文字运行基线与映界接入结论

2026-11-19（北京时间） · 工程验证 · 本地 Node / PostgreSQL / 模拟文字供应商

**同一角色卡会话可以在刷新后继续行动。** 浏览器从九霄大厅导入示例卡、建立会话、提交行动、刷新、继续提交、再次刷新。独立 SQL 查询确认两次行动各保存一条完整正文，会话修订从 0 推进到 2。首批映界验证建议挂在独立角色卡会话的已提交历史上。此项为工程建议，产品选型仍按现有决策台账管理。

## 版本与副本

| 对象 | 实测基线与状态 |
| --- | --- |
| 映界 | 私有库 [quakhiak34568-lang/Nine-cloud-Yingjie](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie)，起点 `main@62f3260fc391ea10349bd792c1c77875e76665c7`。本地独立浅检出，16 个文件 blob、整树和提交对象均与远端匹配。检出时干净。交付分支 `codex/yj-01-runtime-baseline`。 |
| 九霄 | [L-core-dev-team/Nine-cloud](https://github.com/L-core-dev-team/Nine-cloud)，采用当次远端 `main@cd25360c7929e10f8b2b0fad342fedd943d4f323`。独立 Git worktree，detached HEAD。启动前源码干净，使用单独的回环测试库。 |
| 本机位置 | 两个副本位于 `C:/Users/11954/Documents/Codex/2026-11-19/files-mentioned-by-the-user-yj/work/` 下，分别名为 `Yingjie` 和 `Nine-cloud`。 |
| 旧基线 | `1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc` 至本次 HEAD 有 51 个文件变化。#111 合入角色卡模型适配、数据库安装与 ACL、恢复及原生叙事发布相关改动。本次按新提交的启动器、迁移和服务核查。历史文字联测单独保留。[上游差异](https://github.com/L-core-dev-team/Nine-cloud/compare/1bd7bb5ff6e6221378a7cb1292e559fb19bfbfbc...cd25360c7929e10f8b2b0fad342fedd943d4f323) |

活动文档包括映界根 AGENTS、README、需求、决定、任务、交接、技术建议、基线、验证及 YJ-01 任务书。九霄采用根 AGENTS 和 Windows 本地角色卡运行说明。映界仓库此时仅有规划、报告与验证材料，运行入口在九霄。[上游运行说明](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/docs/integration/main-integration-20261111/LOCAL-CARDS-DEMO.md)

本机上游起初为稀疏检出。按固定提交补齐 Git 对象并关闭稀疏检出后，再次运行随报告交付的脚本。最终核对 5,013 个跟踪文件全部在盘，跳过数为 0。回执记录这一次运行。验后恢复临时 pnpm 配置，九霄隔离副本及两个来源工作区的 `git status --short` 均为空。

## 当次运行证据

| 环节 | 观察和断言 | 结果 |
| --- | --- | --- |
| 建立会话 | 实际 Hono 验证码路由和 HttpOnly Cookie，浏览器从 `/lobby` 上传 `docs/examples/cards-demo.json`、确认版本，创建会话并读到开场白 | PASS |
| 行动与保存 | 提交“本地验证”，页面显示“本地合成回复（非真实模型）”；SQL 按对应会话查到该行动、同文回复、completed、修订 1 | PASS |
| 刷新与恢复 | Playwright 执行整页 reload，等到历史回复和“会话已读取”后继续操作 | PASS |
| 继续行动 | 在恢复的页面提交“YJ-01 刷新后继续行动”；同一会话的 actions POST 返回 HTTP 200 | PASS |
| 再次打开与对账 | 第二次 reload 后可见两条回复和第二次行动。以该 POST 的会话 ID 联结 requests 和 sessions，两条记录的正文、行动、修订 [1, 2] 全部匹配，最终修订为 2 | PASS |
| 其他覆盖 | 上游脚本另验 360×800 视窗无横向溢出、焦点切回时草稿保留、登出后历史消失、重复启动器被拒绝 | PASS |
| 原生权威回合 / Worker | 阅读现行源码；本次没有在这两个入口运行回合 | 静态已核查，运行 NOT_RUN |
| 模型与体验 | 当次真实文字、真实生图、参考图编辑、手机真机、用户连续试玩、生产部署 | NOT_RUN |

[当次可机读回执](evidence/YJ-01-local-run.json) · [复跑脚本](evidence/YJ-01-replay.cjs)。脚本沿用固定提交的上游浏览器用例，增加第二次提交、第二次刷新和数据库断言。原用例单独执行时只在刷新后填写草稿。合成回复为固定文本，无法据此评价剧情质量或酒馆复访效果。

## 环境与复现

Windows，Node 26.13.0（项目要求 ≥24），pnpm 11.19.0（与 packageManager 匹配），PostgreSQL 18.4，Playwright 使用已安装的 Chrome。Docker 未使用。启动器自建 `jiuxiao_test_cards_demo`，使用随机本地端口、隔离认证与数据库角色。迁移读取 `packages/db/drizzle` 的有序 SQL 以及 `packages/db/permissions/card-access.sql`、`card-local-auth.sql`。真实模式的 `CARD_LOCAL_CONFIG` 和 `NARRATIVE_KEY_CARD_LOCAL` 本次均未传入；合成模式无需模型凭据。

在空的九霄工作副本执行下列命令。PowerShell 中的路径按本机安装位置替换。初始化打印 `LOCAL_CARDS_READY` 后输入 `stop`，在同一副本运行复跑脚本。

~~~powershell
git switch --detach cd25360c7929e10f8b2b0fad342fedd943d4f323
pnpm install --frozen-lockfile
pnpm dev:cards --check
$env:CARD_DEMO_POSTGRES_BIN = '<含 initdb、pg_ctl、postgres 的目录>'
pnpm dev:cards --init --postgres-bin $env:CARD_DEMO_POSTGRES_BIN
$env:npm_execpath = '<pnpm 11.19.0 的 bin/pnpm.cjs 绝对路径>'
$env:CHROME_PATH = '<chrome.exe 绝对路径>'
node '<映界副本>/docs/reports/evidence/YJ-01-replay.cjs' (Get-Location).Path
~~~

本机实际先用固定 pnpm 运行 `install --offline --frozen-lockfile`。系统缓存不可写，另一份缓存安装又在创建 Windows 目录链接时返回 EPERM。使用同源码树的本地已安装依赖作物理复制，检查两侧锁文件逐字节一致，重建 contracts、content、domain、api，并刷新本副本的工作区包构建物。仅在隔离副本的 pnpm 工作区配置临时加入 `verifyDepsBeforeRun: false`，以便 pnpm 构建时复用这些依赖。启动器、数据库初始化、服务、页面及测试断言均按固定源码执行。此次验证覆盖该依赖副本上的运行；全新冻结安装在本机未取得 PASS。

实际启动命令为 `node scripts/dev/cards.mjs --check`、`node scripts/dev/cards.mjs --init --postgres-bin <本机PG目录>`，其中 `npm_execpath` 指向固定 pnpm。浏览器脚本自行拉起同一启动器并关闭应用。首次启动曾在依赖复制完成前报缺包，依赖齐备后使用原测试库继续；创建库和迁移由启动器依据本地状态管理。只把去除凭据的回执纳入交接。

若直接在上述本机已准备好的副本复跑，pnpm 11.19.0 位于 `C:/Users/11954/Documents/Codex/p3-test-tools/pnpm-11-19/node_modules/pnpm/bin/pnpm.cjs`，PG 位于同级工具目录的 `package/native/bin`。该副本使用物理复制的依赖，运行前临时在其 `pnpm-workspace.yaml` 末尾增加 `verifyDepsBeforeRun: false`，运行后移除这一行。普通全新检出并成功完成冻结安装时，可直接使用上面的标准命令。

## 两条剧情路径

| 问题 | 独立角色卡会话（运行及源码） | 原生权威回合（源码） |
| --- | --- | --- |
| 身份与边界 | 现有认证服务从 Cookie 解析 ownerId。每次读取校验 owner、sessionId。请求 key 标识一次行动，resulting_revision 给出提交顺序。该会话无原生 saveId、branchId。 | 现有身份解析 owner，按 owner 与 saveId 取档。V3 SaveEnvelope 保存 branchId、parentBranchId、forkRevision 和修订；V1/V2 保留缺省分支信息；receipt 带行动幂等键及结果修订。 |
| 世界书与 Persona | 建局绑定 Persona 版本，并复制全局世界书关联。行动读取卡内世界书、关联资料和当前 Persona，再依据预算组装上下文；历史最多读取最近 50 轮。 | 存档与规则包带 Canon 版本和运行资料身份。规则插件、已提交事件、授权记忆参与叙事。该回合接口未绑定角色卡的 session_personas。 |
| 产生与保存文字 | CardImportService.act 先登记 pending，生成成功后在同一事务里写入 requests.narrative、completed、resulting_revision 并递增 sessions.revision。history 只返回该 owner、该会话的已完成记录。 | ServerTurnService 先提交 accepted 回执、存档与事件，再处理叙事。启用故事归档时，StoryArchive.retain 对照已提交回执，保存正文并回读首次成功值。未生成或归档关闭时，回执仍可能只有结算。另有按宿主挂载的发布读取接口。 |
| 冲突及恢复 | expectedRevision 与请求指纹防止旧请求误提交。可按原 key 查询、恢复超时 pending；错误请求不在已完成历史内。 | 校验存档修订与幂等键，冲突返回当前修订。可按原键回读回执、按修订读故事；启用发布链路时可查询 presentation/source 的发布状态。 |
| 建议接入位置 | 由已鉴权的 Node 适配器分页读 history，按 owner、sessionId 和原 key 去重。首次打开与刷新都能从同一份已保存文字重建输入。 | 如后续接入，先关联已接受回执与已归档或已发布正文，再保留存档和真实分支身份。正文尚缺时等待，不用图片填补结算或剧情。 |

[角色卡宿主与身份](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/host.ts) · [角色卡事务与历史](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/service.ts) · [角色卡 HTTP 路由](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/router.ts) · [存档契约](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/packages/contracts/src/save.ts) · [权威结算](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/services/server-turn.ts) · [故事归档](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/services/story-archive.ts) · [叙事发布读取](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/routes/narrative-publications.ts)

## 宿主、集成和下一项

先在映界维护读取已保存剧情的适配器，固定对应的九霄提交。联调时由九霄 Node 宿主挂入候选模块，复用既有登录、会话列表和 `GET /api/card-import/sessions/:id/history?after=<revision>`。图片工作放在文字提交之后，失败可从历史重读。需要改上游时，最小接面是 Node 装配及现有角色卡页面的显示入口。YJ-01 无业务源码修复。模块打包、图库表和任务队列在 YJ-03 再确定。

实测启动器通过 cards-host.mjs 将角色卡服务和认证注入 createApp。Worker 为每个请求建立短生命周期 pg Pool，连接地址来自 Hyperdrive，认证和路由装配另行配置。该 Worker 入口未装配本次验证的本地角色卡模型宿主。本轮证据支持本地 Node 接入；Worker 适配、本地文件存储替代、Sharp 和队列兼容性尚待对应阶段验证。[本地宿主](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/scripts/dev/cards-host.mjs) · [Worker 入口](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/worker.ts)

**YJ-02 的可用输入**是已验证的 owner / session / request / revision 关联和可回读的正文。演示卡的实际回复没有描述酒馆。连续性实验需另备明确标记的剧情样例，逐段写出同一酒馆的稳定特征、已确认到场的人和复访时的变化。对同一地点保留初图，在参考图上增加人物，再验证复访保留了哪些特征。真实实验还需要可用且获准的参考图编辑服务；记录各次输入、结果、失败及人工观察。供应商、预算、图像规格和验收阈值仍按原决定等级处理。
