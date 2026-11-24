# 原生场景离线试玩

在文件管理器中双击 [dist/index.html](dist/index.html)。整个试玩在这一个文件里，复制它到其他目录也可以打开。无需登录、联网或启动数据库。

点一次「下一回合」从芦花渡到望气台。点时间线 **08** 看绕行返回芦花渡，点 **09** 重读早先的望气台行程。左边是当时的当前位置，下面的「已知行程」只列出截至该节点已经取得的历史证据。「查看证据与未知字段」可展开获证时点与快照摘要。左右方向键和重置按钮也可操作。

两个地点使用不同的抽象印记。人物、结构、时间、光照、观察位置及朝向均未知。关闭右侧预览仍可继续回放。页面只保存了获准公开的合成测试轨迹，关号节点演示当时的撤权行为；静态文件自身不提供在线访问控制。

## 复跑

在映界仓库根目录执行。重建和离线检查只需要 Node 及项目已有的契约构建产物。

```sh
node packages/native-scene/build.mjs
node --permission --allow-fs-read=* packages/native-scene/test/offline.mjs
```

如需重新取证，按 [B2 宿主说明](../native-reader-b2/README.md) 准备固定源码、构建好的 B2 运行时及本机 PostgreSQL。下列 PowerShell 命令中的三个变量分别指向上述目录。输出使用新的本地文件名。先确认启动器退出码为 0、记录最后为清理完成，再导出。

```powershell
python -B packages/native-reader-b2/test/launch.py $upstreamRepo $b2Runtime $pgBin native-scene > scene-local.log
if ($LASTEXITCODE -ne 0) { throw '隔离宿主未成功完成' }
python -B packages/native-scene/test/import-trace.py scene-local.log
node packages/native-scene/build.mjs
node --permission --allow-fs-read=* packages/native-scene/test/offline.mjs
```

原始日志留本机。新认证运行会产生新的测试标识、提交时间和快照摘要。使用仓库中相同的脱敏轨迹重建，页面摘要应一致。

在允许启动浏览器与读取本地文件的测试环境，令 `PLAYWRIGHT_PATH` 指向已安装的 Playwright，`CHROME_PATH` 指向 Chrome 或 Edge 的可执行文件，运行 `node packages/native-scene/test/browser.mjs`。它以离线浏览器上下文检查 1280 和 390 像素视口；可追加一个输出目录保存截图。

## 回退

关闭页面即可结束试玩。单独检出冻结提交 `19353e725f570b0c3dbacc5087592c4ca71b6b1c` 可复核实现前基线。需要撤销任务分支的实现时，用 Git revert 撤销冻结提交之后的交付提交，保留原始记录。真实宿主每次创建与清理自己的临时数据库目录。
