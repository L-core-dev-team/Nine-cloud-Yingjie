# YJ-P03-S3 离线试玩交付

**S3_PREVIEW_PARTIAL · BROWSER_NOT_VERIFIED · 2026-11-22**。已交付可直接双击的 [index.html](../../packages/offline-play-preview/dist/index.html) 及随附 media。20 回合与 16 项交互、异常断言在禁网的 Node DOM 测试宿主通过。受管 Windows 上 Chrome 和 Edge 均在读取页面前退出，尚无真实浏览器打开成功的证据。

## 打开与体验

检出或下载 `codex/yj-p03-s3-offline-playable-preview`，解压后进入 `packages/offline-play-preview/dist`，用浏览器打开 index.html。已有锁定依赖和编译好的 contracts 时，在仓库根执行 `node packages/offline-play-preview/build.mjs` 即可重建。预览只读本地文件，关闭标签即可退出；回退代码可在独立工作树检出任务起点 `2858ccc250d401f08775c9cace268bbd0c1ab7b9`。[操作和复跑说明](../../packages/offline-play-preview/README.md)

主模式以 S2 的固定合成正文为唯一剧情。查看首图待审与接受后，切到修订 8 核对名单不确定时旧图隐藏，再切修订 12 与 14，查看参考编辑的发送、迟到、原地点归属和拒审。回退时，历史随修订回退，后续审阅不会提前出现。关闭生图后仍可推进文字和查看记录。另设「旧图档案」，按原 YJ-02 酒馆样例回放 3→5→5、闲谈及复访复用。三张旧图逐一核对原审阅回执中的 SHA-256，只用于这个独立模式。

## 来源与产物

- 源 S2 提交 `c5f75abf53d278a2f00e0ee9581bbc45ec224141`。20 条合成正文从 S2 切片源提取；构建逐条检查原回执的正文摘要、场景身份、Visual 版本、人数和资格判定。构建重新运行隔离回放以导出名单、光照、观察位置和字段来源；证据不足的字段留空。原回执 SHA-256 为 `65ccd55cf5ebef6922a08eb48e9e8330799251b5b763a58b0a3fbc36f263a3fb`。
- S2 返回结果依来源修订关联原请求、地点、显示资格和审阅时间；页面中只有通过审阅的格式原件可呈现。修订 14 的迟到编辑可回放待审和拒审，拒审字节未进入展示包。正文和图片状态均从本地只读数据读取。
- 本页内嵌原 ui-shell/yingjie.css，使用 YingjiePanel 的色彩、双栏、开关和状态，以及 ImageHistory 的审阅术语。合成数据适配器独立于受鉴权生产 React 组件。普通角色卡、默认提取器、两个 main 和旧许可账本不涉及迁移。
- 发布入口 SHA-256 为 `bf62b94bb5538a11dc293c70dc6fff0452cbc6bfb38509d773fb0b32d9776fb8`。HTML 内含脚本、样式、fixture 和合格 mock PNG；只有旧图档案使用三个相对路径的本地 PNG。构建和完整性检查均在本地完成。[构建回执](evidence/YJ-P03-S3/build.json)

## 本轮实测

| 项目 | 结果 |
|---|---|
| S3 静态产物、媒体和交互 | 20/20 修订、16/16 交互及异常断言。覆盖回退、筛选、跳转、关闭后继续文字、证据和历史状态、待审、复用、未知、跨地点、迟到、拒审、原件损坏及复位。逐回合核对实际脚本渲染的状态、正文摘要、原件可见性和资格。 |
| 零网络 | Node 测试宿主 net 权限为 false。构建产物包含 connect-src 'none'，扫描无网络接口、远程 URL、存储或账号凭据。真实浏览器请求监听尚未运行。 |
| 来源回归 | S1 原 102 条 + 13 边界；S2 锁定 100 条、20 回合、2 次假发送。原件和两笔模拟占用重开检查通过。 |
| 兼容回归 | 公共契约 10/10、L3 30/30（含旧 65 条）、图片触发 4/4、I1 67/67、I2 40/40 及竞争与崩溃重开、P01 7/7、L1/L4 假传输各 15/15。 |
| 原生浏览器 | Chrome 和 Edge 使用本机普通沙箱和管道启动时均报告 Crashpad TransactNamedPipe 0x6D。在导航之前退出。1280×800、390×844、纯键盘、真实浏览器离线加载与截图为 NOT_RUN。 |
| 手机、原九霄与数据库 | 手机真机及 15–30 分钟真人体验 NOT_RUN。原角色卡、PG、YJ-13/L4R 原生回归仍 ENV_BLOCKED / NOT_RUN，沿用 Issue #1，TCP 探针 0 次。 |

初次给 Node 仅授予尚不存在的 dist 目录写入权限，递归创建子目录时报 ERR_ACCESS_DENIED。预建目标目录后在相同路径授权内完成构建并复建。浏览器启动失败单独保留，未放宽安全参数。

本轮 OpenAI 项目查询、文字、图片、外部图像工具调用各 0 次，费用 USD 0。I2 为 LIVE_BLOCKED_COST_BOUND，L1 为 ACKNOWLEDGED，L4 为 UNKNOWN_STOP。[逐回合与操作回执](evidence/YJ-P03-S3/preview.json) · [当轮回归](evidence/YJ-P03-S3/regression.json) · [浏览器诊断](evidence/YJ-P03-S3/browser.json)
