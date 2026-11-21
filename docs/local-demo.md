# 本机酒馆试玩与回退

从映界仓库根目录在 PowerShell 操作。宿主使用九霄普通角色卡页面、回环 HTTP、真实验证码/会话与 PostgreSQL。文字按回合提供合成回复，图片来自 YJ-02 已审的三张 PNG。输入任何文字都可以推进固定样例。每个演示目录只供当前操作系统账户使用。

## 准备

1. 指定有依赖和构建产物的九霄独立检出。需要 `apps/api/dist/app.js`、上游 Playwright、Vite 与可构建的 `apps/web`。本次固定提交为 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。上游的历史认证库无需启动。
2. 提供本机 Chrome、含 initdb/pg_ctl/postgres 的 PostgreSQL 服务端及兼容的 pg_dump/pg_restore。下列路径换成本机实际路径。实测 Node 26.13、npm 11.20、PG 服务端 18.4、客户端 18.6、Playwright 1.63 与 Chrome 157。使用能运行本机回环 TCP 的账户，临时目录应为当前用户专用。
3. 首次检出按映界契约锁文件安装。已准备离线缓存时可在 npm ci 命令上增加 `--offline --cache <本机缓存>`。

```powershell
$env:NINE_CLOUD_ROOT = 'D:\dev\Nine-cloud'
$env:CARD_DEMO_POSTGRES_BIN = 'D:\tools\postgres\bin'
$env:YJ_PG_CLIENT_BIN = 'D:\tools\pg-client\bin'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
git -C $env:NINE_CLOUD_ROOT rev-parse HEAD
node --version
npm --version
& (Join-Path $env:CARD_DEMO_POSTGRES_BIN 'postgres.exe') --version
& (Join-Path $env:YJ_PG_CLIENT_BIN 'pg_dump.exe') --version
& (Join-Path $env:YJ_PG_CLIENT_BIN 'pg_restore.exe') --version
(Get-Item $env:CHROME_PATH).VersionInfo.FileVersion
npm ci --prefix packages/contracts --no-audit --no-fund
npm --prefix packages/contracts test
python docs/reports/evidence/YJ-02/probe.py verify
```

已有九霄依赖需要重新构建时，在固定九霄副本用其锁定工具执行下列命令，然后回到映界根目录。上游声明 pnpm 11.19.0。此次直接复用了固定提交的安装与构建；全新联网安装可复现性仍待在干净机器上验收。[YJ-01 环境记录](reports/YJ-01-runtime-baseline-report.md)

```powershell
Push-Location $env:NINE_CLOUD_ROOT
pnpm --filter '@jiuxiao/contracts' --filter '@jiuxiao/content' --filter '@jiuxiao/domain' --filter '@jiuxiao/api' -r build
Pop-Location
```

## 开始与恢复原会话

```powershell
$demoDir = node packages/local-demo/demo.mjs init
if ($LASTEXITCODE -ne 0) { throw '初始化失败，请检查上述路径和磁盘空间' }
node packages/local-demo/demo.mjs open "$demoDir"
```

记录 init 返回的私有目录。open 会在回环端口启动九霄 API 和映界页面，创建合成账号，通过普通验证码路由登录，并绑定合成世界书，打开已登录的 Chrome 标签。终端打印本次 URL，重开时端口可能变化。自动进入映界后，在“角色卡行动”里依次提交“推门入场”“询问茶价”“看向后门”“继续交谈”“走出酒馆”“回到原地”“等到傍晚”。核对三人、普通交谈复用、两位到场、离开、复访五人和灯光变化。可打开“本会话图片历史”回看，不另行送图。

关闭演示标签页，等启动进程返回后再运行同一条 open。角色卡、合成会话、授权、原件和历史保存在该目录。以下操作适合停写后使用。诊断文件只包含计数；私有目录含合成登录态、数据库凭据和本地原件，不发布、不上传。

```powershell
node packages/local-demo/demo.mjs open "$demoDir" --diagnose
Get-Content (Join-Path $demoDir 'diagnostic.json')
$checkpoint = node packages/local-demo/demo.mjs snapshot "$demoDir"
if ($LASTEXITCODE -ne 0) { throw '快照失败，保留源目录' }
# 在源目录继续试玩后，关闭标签页。回退时打开独立快照，源目录保留。
node packages/local-demo/demo.mjs open "$checkpoint"
```

快照及源使用同一 PG 端口，只能轮流打开。回退前停写、核对任务/attempt 计数与 unknown，保留审阅流水、共享 SHA 原件和两份目录。恢复时遇到原件异常保持停用。跨机迁移、在线灾备和生产凭据恢复另行验收。结束后可保留两份目录；如需清理，仅在停服且核实完整绝对路径、`demo.json` 及 `state.json` 的 fixture 标识对应后，在文件管理器删除本次 init 或 snapshot 打印的具体目录。其他目录继续保留。

## 复跑与排错

以下命令从仓库根运行。每次 check 新建独立认证集群，结果文件名必须尚不存在。完整回归包括 14 个测试文件与 22 项检查。真实限流探针有界地请求 61 次，故障恢复使用单独的合成库。所有模式使用本地 mock。

```powershell
node packages/local-demo/check.mjs limit limit-new.json
node packages/local-demo/check.mjs regression suite-a.json
node packages/local-demo/check.mjs regression suite-b.json
node packages/local-demo/check.mjs play play-new.json
node packages/local-demo/restart-check.mjs restart-new.json
node packages/local-demo/check.mjs play-restore restore-new.json
node packages/local-demo/check.mjs terminal terminal-new.json
```

| 现象 | 处理 |
| --- | --- |
| 固定提交不符、缺 dist 或找不到 Vite/Playwright | 校对四个路径，在固定上游副本按原构建说明准备依赖和 API。 |
| PG 初始化失败或连回环报 EACCES | 确认本机权限允许启动工具和连接 127.0.0.1。初始化失败的目录不可作为新演示打开。 |
| 端口在用或 demo.lock 存在 | 先关闭同一源或快照的窗口，检查对应目录的 pg_ctl status 和本次启动器进程。进程异常退出时，仅在核对所有者、确认已停服后移除本次目录的陈旧锁。 |
| 登录遇到 429 | 停止本轮，保留响应码、Retry-After 及回执。综合回归通过 check 新建隔离库。原演示须等原限流窗口恢复。 |
| SHA 不符、原件缺失或已撤下 | 检查固定提交中的原 PNG、审批状态和配对目录，使用通过核对的快照。 |
| 私有会话已过期或撤权 | 保留现有目录进行核查。需要从头演示时用 init 新建独立环境。 |
