# YJ-P03-S3｜可打开、可点击的离线映界试玩预览（不依赖 localhost）

- 编制：2026-11-22 北京时间
- 状态：**仅任务书已提交；S3 的页面、导出脚本和验证尚未执行**
- 执行者：Codex。开发分支：`codex/yj-p03-s3-offline-playable-preview`
- 接续固定 SHA：`codex/yj-p03-s2-scene-consistency-slice@c5f75abf53d278a2f00e0ee9581bbc45ec224141`
- 只读九霄上游：`L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`
- **本阶段目标：结束“只有测试报告、没有可体验结果”的状态，让道主可以在本机打开一个实际可操作的映界交互预览，亲自检视剧情与画面状态是否协调。它仍是受信合成数据的演示，不是正式可自由输入的 AI 角色卡游戏。**
- 所有新 OpenAI 模型权限查询、Responses 文字生成、Images 生成/编辑、外部图像工具请求均 **0 次**，费用 USD 0。禁止读取或输入真实 API Key，也不允许外传私人角色卡、世界书及旧项目数据。
- Windows Codex 原受管沙箱 `127.0.0.1 connect EACCES` 仍由 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1) 跟踪；本任务**不得通过代理、隧道、管理员权限、换执行环境、关闭安全策略来绕过**。不能借旧 L1/L4 许可或取消 I2 `LIVE_BLOCKED_COST_BOUND`。

## 一、为什么不是再增加一轮纯解析样本

S1 已对六个合成地点、102 条锁定语料给出正确事实证据；S2 [报告](../reports/YJ-P03-S2-scene-consistency-slice-report.md)在 100 条自编样本上把 44 个可入画、12 个需要复核、10 个冲突和 34 个不就绪分开，20 个合成 completed-history 修订中真实运行了 ImageTasks、原件磁盘、SQLite 替身和内存 mock transport；二次引用、迟到归属、拒审及未知隐藏获得离线证据。

但普通人**还没有亲自操作这 20 回合并看到结果**：目前只有脚本和结构化回执。早期 YJ-06 [UI 报告](../reports/YJ-06-ui-report.md)曾在 localhost Chrome + PostgreSQL 中把映界挂载到九霄普通角色卡；现有 `packages/ui-shell/YingjiePanel.tsx` 与 `ImageHistory.tsx` 却依赖受鉴权 HTTP/PG，无法直接在本次被拒的本机回环环境复跑。S3 应交付一个**无服务器、无 Key、无需数据库**的直接可打开预览，既让道主看到初代体验，也暴露现有体验、信息架构或连贯性的问题。

核心原则：**交互展示不能谎称使用了真实九霄 backend、PG、文字模型或图片 API；不能因为 demo 好看就升级以前的 OFFLINE_PASS 为生产通过。**

## 二、必须复用的源码与素材

先核对远端 HEAD、本地源状态、旧证据，重点阅读：

1. `AGENTS.md`、`docs/requirements.md`、`docs/handoff.md`、`docs/decisions.md`；
2. `packages/ui-shell/{YingjiePanel.tsx,ImageHistory.tsx,yingjie.css,mount.mjs,demo.mjs}`；不要从头再建一套不兼容的视觉模式和术语；
3. S2 的 [20 回合脱敏回执](../reports/evidence/YJ-P03-S2/story-slice.json)、[100 条证据与审核](../reports/evidence/YJ-P03-S2/measurement.json)、`packages/first-play/test/{s2-story-slice.mjs,s2-host.mjs}`，及 `packages/first-play/visual-consistency.mjs`；
4. S1 `packages/first-play/scene-evidence-v2.mjs`、`scene-registry.mjs`、固定 102 条语料及 replayOnly 约束；
5. `packages/image-tasks/`、`packages/image-history/`、`packages/openai-image/` 中的请求、图片审阅、复用/编辑与状态语义；
6. YJ-02 的[三张已验收的真实工具图片](../reports/YJ-02-image-capability-report.md) `docs/reports/evidence/YJ-02/{I0,I1,I2}.png`，分别仅适用于**其原固定合成酒馆故事**，且原 SHA 需要与 YJ-02 的审阅回执一致。不可把酒馆图片伪装成 S2 的“琥洲听雨酒馆”或其它未核准地点的真实 AI 场景。

本次演示可以有两个明确模式：

- **模式 A｜场景流程预览（主模式）**：以 S2 的 20 修订为唯一事实，展示地点、人数、文字、Visual 版本、图片决定、审阅、历史、迟到回包归属。S2 的抽象 mock PNG 只能作为**格式测试图**显示并显著标记“不是剧情实际出图”；不一致时优先用“暂无经审阅的对应画面”占位，不得借其它地点图片充数。
- **模式 B｜已有图像连续性参考**：单独回放 YJ-02 的 I0→I1→I2 固定合成酒馆场景、3→5→5 人、亮灯和复用。仅展示它作为**旧工具级真实图片实验**的实际素材，不能标成 S2 或 OpenAI Images API 当前生成结果。

不一定必须增加模式 B；如果资源有限，优先让模式 A 可用且没有假图误导。

## 三、产物：用户能打开并实际操作的静态网页

建议新增 `packages/offline-play-preview/`，将 **静态已构建内容**与源代码、生成脚本分开存放。方案由 Codex 依据现有 React/Vite 包和依赖做最小选择，但必须满足：

1. 在项目根目录有**一条清楚的本地构建命令**，输出本机可打开的 `dist/index.html` 及相对资源（或者单 HTML 加本地资源目录），无需监听 127.0.0.1、Vite dev server、PostgreSQL、CDN、外网请求、service worker 或本地代理。
2. 初次打开展示醒目的中性提示“固定合成数据离线演示 · 不是实时 AI 游戏 · 未发生付费 API 调用”。不要有可误认成真实 Key 输入或“执行付费生成”的按钮。
3. 至少允许：上一回合、下一回合、选择固定的已保存行动、回到第 1 回合、按地点筛选回合、展开本轮事实来源和原因。**所有操作直接由用户点击驱动**，按钮不得是摆设。
4. 在 S2 的 20 个回合中，明确呈现修订、地点及稳定 sceneId、人物完整名单/人数、光照、视角与 Visual V#、`eligible/needs-review/conflict/not-ready`，以及当前是否适合展示图片；对待审、拒审、迟到、未知必须有可读中文说明。
5. 图片状态不能混淆：`generated-mock`（格式测试）、`pending-review`、`accepted`、`rejected`、`reuse`、`hidden`、`unknown` 等状态从受信 fixture 的具体事件与审核导出；**等待中不可假装后台真的正在生成**；没有合适画面就留空。
6. UI 需要给用户说明“画面为什么显示/为什么不显示”，最好能看到：当前修订、原修订归属、参考图是否来自被审阅接受的原件、编辑是否晚到、旧图为何被隐藏。图片中未证明的人物/灯光不应成为正文事实。
7. 有明显的“关闭生图”开关（离线演示只影响显示/后续模拟图片事件，不改源时间线；文字回合照常可切换）、“重置到第一回合”、只读的历史图片/反馈入口。需要适配桌面与 390 像素移动视口，可读、键盘可操作，focus 明确，图片 `object-fit:contain`，无横向溢出。
8. 要让用户容易区分**预设剧情的“推进按钮”**与未来真实游戏的“自由输入行动”；若提供输入框，必须标明它不是自由自然语言模型，非预设行动不得生成虚构剧情，而应提示“演示模式只支持固定行动”。
9. 无任何网络请求：静态预览不调用 `fetch`、XHR、WebSocket、EventSource、远程字体、第三方统计或图片 CDN；本地媒体必须包含在导出包内或使用仓库相对路径且可验证。也不应将真实游戏身份、cookie 或私密项目目录写入导出内容。
10. 刷新/切换离线模式只影响页面 UI 本地状态，不得变更持久 I2 mock ledgers、S2 原始回执或原始图片；需要时可用带显式版本的纯客户端状态（无用户隐私），但不能伪装为真实九霄存档恢复。

优先保留原 `YingjiePanel` 的色彩/层级、角色卡阅读与图片区布局，并通过**只读 fixture adapter**呈现，不把原生产 `YingjiePanel` 悄悄改造成脱离鉴权后能操作任务的入口。若实现一个小型独立演示组件，明确与生产分离及复用的视觉 token。

## 四、固定素材导出、数据一致性与安全测试

- 实现构建前的 `export-fixtures` 或等价纯本地脚本。**只读输入**来源为已提交的 S2 合成剧情和回执；输出少量不含密钥的 JSON 包，拥有 schemaVersion、演示源 SHA、回合号、文字/视觉与图片资格结果；跨文件链接按 revision/scene/attempt 匹配，不能重新编造 S2 不存在的图、审阅结果、费用或真实调用 ID。
- 不得将整份 S2 私人素材误打包；这次只有开发者自编固定场景。生成 fixture 时核对回执事实与源码版本，缺字段时留空并标示不确定，不能通过硬编码 UI 强行将 `not-ready` 改成 `eligible`。
- 对图片引用必须记录来源：S2 的两张 mock PNG 可以做格式示意但不可标“AI 绘制酒馆”；YJ-02 的 I0/I1/I2 必须按原固定故事和 SHA 匹配。
- 使用受信固定输入的 hash 对照验证构建产物；输出不含明文密钥、真实账号、私人路径、聊天记录及网络端点凭据。不要把历史 I2/旧 L4 的批准嵌入演示页。
- 通过至少 **20 回合 UI 状态断言**和至少 **12 项交互/异常场景**：倒退、快进、按地点跳转、开关、重置、复用不新增发送、未知留空、迟到归原任务、拒审不可显示、不同地点无串图、参考资格缺失留空、图像文件损坏显示占位。
- 如果当前受管 Windows 禁止原生浏览器访问 `file://`，可先进行 Node 纯组件/静态产物检查；浏览器真实检验标 `NOT_RUN` 而不是虚构截图。**不要为打开静态预览改沙箱或开放 TCP**。若本机 Chrome 可合法访问 `file://`，用真实页面自动化验证 1280×800、390×844 及至少一个纯键盘导航；截图要显示测试数据/日期/模拟标签。**实际手机真机仍 NOT_RUN**，除非真机已独立验证。
- 不允许创建或部署公网托管网址，亦不默认使用第三方 GitHub Pages（仓库是私有的），不做付款/联网账户系统。

## 五、原功能回归与必须保持的边界

- 原 S1 102 + 13 边界、S2 100 + 20 回合离线源、L3 30/30、公共契约 10/10、I1 67/67、I2 40/40、P01 7/7、L1/L4 mock 各 15/15 及 ImageTasks 原件/审阅等，在当前离线环境能运行的部分做本轮实测，标明当次执行还是引用原提交证据。
- `scene-evidence/2` `replayOnly:true`、`visual-consistency/1` 和旧宿主默认路径不能因为演示改动而升级为正式业务；I1/I2 生产发送依然关闭。L1 `ACKNOWLEDGED`，旧 L4 `UNKNOWN_STOP`，L5 `PARTIAL`，L5B `ENV_BLOCKED`。
- 本轮原生 CardImportService↔PostgreSQL↔映界和 YJ-13/L4R 原生回归继续取决于 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)；静态网页成功**不意味着**目标沙箱网络、真九霄集成或手机真机可用。
- 不允许为“演示成功”跳过图片待审阅，或将 S2 中拒审的参考图重新启用。
- 不更改两个 main、旧分支、旧回执和任何真实审批账本。

## 六、交付与验收

**最小交付**：

- `packages/offline-play-preview/` 可构建和浏览的前端实现、source fixture 导出/校验脚本、用户使用说明；**离线交付必须能找到实际 `index.html` 与所有必要媒体**，不得只给工程源代码或一段启动命令。
- 项目 README 中清楚给出“下载/检出对应分支 → 执行构建 → 打开本地输出”的步骤；如仓库不适宜提交构建产物，给出独立可复核的构建文件摘要和本地相对路径，但不能谎称用户已获得可下载附件。
- `docs/reports/YJ-P03-S3-offline-play-preview-report.md`、`docs/reports/evidence/YJ-P03-S3/` 包含数据来源摘要、20 回合真实可见结果、交互断言与截图/无法截图说明、浏览器和移动宽度检查、禁外网检查、复跑和回退。
- 更新 `README.md`、`docs/handoff.md`、`docs/task-sequence.md`、`docs/verification.md`、`docs/decisions.md`、`CHANGELOG.md`，最终提交到本独立分支。需核对本地和远端 HEAD 一致、工作树状态清楚。

**`S3_OFFLINE_PREVIEW_PASS`**：只有真正完成静态构建、可从本机无服务器打开、20 回合和核心交互正确、资源不串场、零网络及安全文本边界可复核时才能使用。若有代码与自动测试但未证明浏览器能够无服务器加载，按 `S3_PREVIEW_PARTIAL` / `BROWSER_NOT_VERIFIED` 汇报，不能伪造用户体验通过。

本阶段**不是**生产版、没有自由 AI 互动、没有真实图片 API、没有云端部署，也不是 15–30 分钟真人试玩达标。交付给道主后应允许他先主观体验：故事/画面位置、等待提示、历史和隐藏旧图是否自然，收集原始反馈再决定是否进入真实宿主接入，而不是继续无限添加规则用例。

### Codex 交付报告模板

```text
道主，YJ-P03-S3：S3_OFFLINE_PREVIEW_PASS / S3_PREVIEW_PARTIAL

分支、本地/远端 SHA、工作树：
真正可打开的 index.html/静态目录、构建命令与校验摘要：
使用了 S2 哪 20 个修订/哪些素材，fixture 来源与锁定 SHA：
是否明确区分 S2 mock PNG 和 YJ-02 工具级旧真图，错误图像展示 0：
可点击控件（上一回合/下一回合/地点/历史/开关/重置）真实演示：
20 回合状态、12+ 负例/交互、零外网：
真实浏览器 file:// 检查与 390/1280 两种视口、截图；未运行要解释：
是否有可直接给道主查看的页面/具体打开路径，而非只有单测：
I1/I2/S1/S2 等当轮回归真实结果和历史参考分界：
原 L4 UNKNOWN_STOP、I2 LIVE_BLOCKED_COST_BOUND 与 Issue #1 状态：
本轮 OpenAI 文字/图片/模型 GET、其它图像工具真实调用 0 与费用 0：
报告、脱敏回执、源代码、退出/回退步骤和完整链接：
```
