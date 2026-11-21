# YJ-12 反馈、终端与停写恢复运行报告

2026-11-21（北京时间）。分支 `codex/yj-12-recovery-terminal`。接手时本地 YJ-11 为 `4ea1f354181216a7fcfc7833a898f9e02f2630bf`，工作树干净。核实远端 YJ-12 为 `0db65c35d90ff3b8ac5ca710b5a0b6d6e711c3eb`，保留其两笔任务书/交接提交后开始修改。九霄只读副本固定为 `cd25360c7929e10f8b2b0fad342fedd943d4f323`，公共契约仍为 0.1.1。

## 故障、界面和持久结果

| 注入点 | 黑盒检查和落账结果 |
| --- | --- |
| POST 到达服务前 | 拦截浏览器请求，页面提示反馈未确认。报告、任务、尝试计数都不变。离线、上线并刷新后先核对回执；玩家重新输入原说明并明确提交，使用第一次的同一 UUID。 |
| POST 已提交、回包丢失，之后撤权 | 浏览器代理将请求交给原 HTTP 服务，读到提交 ID 后断开客户端回包。撤销世界书授权，再执行原 POST 及只读回执查询，均核对到原 ID；刷新后历史面板显示提交已保存。当前及历史原件均返回 404。 |
| 双标签重放和内容冲突 | 另一真实标签用大写 UUID 重放相同参数，报告仍只有一条，新增图片发送为 0。修改说明复用旧 UUID 返回 409；另建未获图片授权的命令返回 404。错误指纹返回 409。其他可读会话查询为 unconfirmed；切换账户后访问旧回执返回 403。 |
| 标签开关和旧响应 | 同账户、同会话标签共享 permit，Web Locks 串行更新偏好，服务端继续核对序号。对漏收通知的旧标签注入点击，过时意图只同步当前设置；用旧序号向服务端重放返回 409。账户切换时释放被扣留的历史详情，旧图与详情均未出现在新视图。 |
| 页面生命周期 | 实测 1280×800、390×844、844×390，125% 缩放、触控点击、滚动、键盘焦点、长行动输入和历史导航。回退可能恢复缓存文档，也可能重新加载；两条路径均要求先取得当前修订和授权。缓存路径在真实 Chrome 收到 freeze、resume 及 persisted pageshow。撤权后恢复显示 skip。 |
| 图片任务 | 两个新 Node 进程分别在 waiting 和测试时钟到期后的 unknown 阶段尝试显式重试。均返回 already-claimed；同一 attempt、sentAt 保留，两个进程发送数均为 0，费用和供应商请求 ID 仍为 null。原 YJ-05 的四个进程退出位置、并发发送、晚到、重复/冲突回执及原 YJ-11 的撤下不复活用例继续纳入综合回归。 |

浏览器只在当前标签、账户、会话的 sessionStorage 中暂存命令 UUID 和参数指纹。指纹覆盖命令、目标类型/ID、剧情修订、审阅代次、类别与说明。恢复时不保存或重建原说明，用户可手动输入；改变目标或内容会取得新命令。已提交命令先在当前鉴权 scope 中核对；新命令才进入原来的图片权限、原件和审核检查。只读 `GET /api/yingjie/:session/feedback/:command` 需带 `x-yj-fingerprint`，仅返回提交状态和匹配的反馈 ID。接口不会返回说明、图片路径或重新授权。

画面和历史读取按账户、会话、修订、许可代次及当前请求序号验收响应。网络恢复和后台返回先清除旧视图并读取，失配的修订只读重查。历史列表和原件继续分别鉴权。已送达浏览器的像素无法远程收回。[运行回执](evidence/YJ-12/run.json) · [桌面](evidence/YJ-12/desktop.jpg) · [窄屏](evidence/YJ-12/portrait.jpg) · [横屏](evidence/YJ-12/landscape.jpg)

## PostgreSQL 与私有原件

在本机 PostgreSQL 18.4 上使用 18.6 客户端执行真正的 `pg_dump --format=custom`、`pg_restore --single-transaction`。仅允许回环地址和测试工具新建的随机投影库。关闭测试浏览器，等本地 mock 完成后停写，对投影表取得共享锁。临时私有归档保存数据库 dump、dump 摘要、原件和清单。清单核对 14 张表的完整行内容摘要、序列状态、审阅触发器、PNG 格式/尺寸、SHA-256 和引用次数。源目录有损坏或未入账文件时演练拒绝封包。

全新空库和新目录恢复后，三轮剧情、地点与 V3、授权、三个任务及尝试、两个独立资产、两条反馈、一次受信裁决、五条审核流水均通过核对。一个 SHA 对应两个资产，原日间三人图仍可历史查看，错误五人目标的资产保持失效。第三次请求仍为 unknown。通过完整审计后才构造只读查询，恢复阶段发送数为 0。

故障注入包括截断 dump、只有文件无有效数据库、只有数据库无文件、PNG 损坏、缺世界书授权、缺审核事件。每种不完整组合均在开放读取或派发前被拒绝。删除行和模拟缺流水仅在独立恢复库的回滚事务内进行。账号库和世界书原文未导出；恢复后的授权读取仍依赖同一受信九霄合成会话和其固定版本。这个范围覆盖投影与文件的离线恢复，跨主机、在线写入、任意时间点和生产账户库恢复尚待验证。[可执行演练](../../packages/recovery/test/restore-drill.mjs)

## 复跑和故障记录

使用 [YJ-11 运行环境](YJ-11-image-history-corrections-report.md)，设置 `NINE_CLOUD_ROOT`、`CARD_DEMO_POSTGRES_BIN`、`CHROME_PATH`，并将 `YJ_PG_CLIENT_BIN` 指向含匹配版本 pg_dump/pg_restore 的目录。原件始终使用 YJ-02 固定文件，本轮未生图。示例在仓库根目录执行。

```powershell
npm --prefix packages/contracts test
python docs/reports/evidence/YJ-02/probe.py verify
$env:YJ12_EVIDENCE_DIR = 'docs/reports/evidence/YJ-12'
node packages/scene-state/test/verify-local.mjs packages/recovery/test/terminal.test.mjs
node packages/scene-state/test/verify-local.mjs packages/scene-state/test/live-card.test.mjs packages/scene-state/test/persistence.test.mjs packages/image-tasks/test/recovery.test.mjs packages/ui-shell/test/browser.test.mjs packages/world-assets/test/matching.test.mjs packages/world-assets/test/live.test.mjs packages/first-play/test/extract.test.mjs packages/first-play/test/browser.test.mjs packages/first-play/test/continuity.test.mjs packages/first-play/test/revisit-browser.test.mjs packages/first-play/test/trigger.test.mjs packages/first-play/test/trigger-browser.test.mjs packages/image-history/test/history.test.mjs packages/recovery/test/terminal.test.mjs
```

验证器以集群路径为键独占 pg_ctl 生命周期，第二个验证器在启停服务前返回 `validation-owner-active`。运行中的子测试分别使用独立新库。契约 10/10，三张原件与两条参考链通过，原回归基线 20/20。最终代码一次综合验收通过 22/22。紧接着相同代码复跑为 18/22，四组浏览器用例在合成登录验证码接口收到 HTTP 429，未完成后续断言。保留上游限流，连续反复测试须给本地认证服务留出配额恢复时间。每轮测试的通过数、失败位置、调试处理及最终回归见[运行记录](evidence/YJ-12/regression.json)。本次首个红灯直接复现“已提交却因图片撤权返回 404”。另一处可稳定复现的退化是 YJ-09 注入旧修订后页面停止重查，已补为放弃旧响应后只读重取。以往 YJ-09 偶发超时的根因仍未证实。

## 回退和 YJ-13 接续

本轮没有生产表迁移。需要回退时先保留只读回执接口及 YJ-11 撤权门禁，停止新提交，核对仍待确认的命令后再回退界面。离线恢复失败时保持新库与新目录隔离，继续使用上一次已经成对核验的库和原件；保留共享原件及审计流水。发送恢复需人工复核所有 unknown。纠错替代仍为 `blocked:contract-adapter-required`。

YJ-13 可在此分支进行连续本地试玩，依次验证入场、交谈复用、人物与灯光变化、离开复访、反馈断线、撤权复核、双标签切换、重开和合成备份恢复。真实文字/图片供应商、查询/撤销及计费、独立人工审阅、生产权限/对象存储、灾备 RPO/RTO 均为 NOT_RUN。真实手机没有获准的测试入口，**PHYSICAL_MOBILE: NOT_RUN**。接入这些能力前需分别提供设备、获准账号/素材、受控供应商凭据与费用范围，以及测试部署和恢复环境。
