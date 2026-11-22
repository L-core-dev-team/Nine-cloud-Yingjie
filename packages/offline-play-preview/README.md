# 映界离线试玩

在文件资源管理器中双击 [dist/index.html](dist/index.html)。搬到另一台电脑时，请复制整个 dist 文件夹，或把交付压缩包完整解压后再双击 index.html。阅读无需安装 Node、连接网络、启动服务或填写密钥。

- 「剧情回放」从听雨酒馆的三人场景开始。用「下一回合」推进，用「地点筛选」限定行程，或从「选择已保存行动」直接跳到某个修订。打开「事实来源与判定」可核对原文区间对应的句子和继承来源。
- 第 1 回合可切换「收到原件 · 待审」与「审阅完成」。第 8 回合人物去留无法确认，旧图隐藏。第 12 回合记录五人编辑，第 14 回合在另一地点收到它，随后拒审。历史只列当前修订之前及当下已发生的事件。
- 生图开关只控制本地显示。回合选择、只读历史和复位均在内存完成。刷新或重置从初始状态开始。
- 「旧图档案」单独回放 YJ-02 的三张原图和两次复用。S2 主页面里的空白 PNG 只用于验证格式。
- 关闭标签页即可退出。390 像素排版及键盘焦点已在样式中实现，原生浏览器验证状态见[运行报告](../../docs/reports/YJ-P03-S3-offline-play-preview-report.md)。

## 从源码复跑

在仓库根、已有锁定的 packages/contracts 依赖与编译产物的环境中执行：

```powershell
node packages/offline-play-preview/build.mjs
node --permission --allow-fs-read=* packages/offline-play-preview/check.mjs
```

新检出可以直接打开已提交的 dist。开发者若需重建 contracts，请先准备其锁文件依赖，再执行 `node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json`。构建核对 S2 正文、审阅回执、图源摘要及实际 PNG；全套文件可由相同输入确定性复建。浏览器自检使用已安装的 Playwright 和本机 Chrome，可通过 PLAYWRIGHT_PATH 和 CHROME_PATH 指定位置，再运行 `node packages/offline-play-preview/browser-check.mjs`。增加一个可写目录参数即可保存两种视口截图。
