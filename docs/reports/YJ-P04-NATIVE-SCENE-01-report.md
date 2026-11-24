# 可信位置驱动的原生场景试玩

2026-11-24 · **NATIVE_SCENE_PREVIEW_PARTIAL**。本轮两次通过真实隔离认证和 PostgreSQL 场景链路。单文件试玩已构建并经过离线交互验收。实机浏览器在加载文件前受阻，桌面及 390 像素视觉效果待验。

双击 [试玩 index.html](../../packages/native-scene/dist/index.html)。[打开与复跑说明](../../packages/native-scene/README.md)。

## Gate A 与取证边界

从映界授权提交 `2713938a5ab4e03b32628a9bcb77b26b3654a265` 接续。先在独立分支提交 [路径预期和 12 份历史证据的 SHA-256](evidence/YJ-P04-NATIVE-SCENE-01/freeze.json)，冻结提交为 `19353e725f570b0c3dbacc5087592c4ca71b6b1c`。源九霄规则固定在 `f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。两个测试账号经九霄 EmailAuthService 正常认证，验证码仅在隔离进程中传递。两份存档通过原生创建流程建立。回环 TCP 的监听、连接及 HTTP 200 均有实际回执。

## Gate B 与 C 的实测结果

每次运行执行 7 次获准的原生回合提交，保存 R0 至 R7 共 8 个检查点。第二次运行逐节点将九霄读回的完整存档摘要与相同修订的独立捕获比对。播放器采用该次导出的 11 个节点。[首次宿主回执](evidence/YJ-P04-NATIVE-SCENE-01/host-first.json) · [交付版本宿主回执](evidence/YJ-P04-NATIVE-SCENE-01/host.json) · [脱敏轨迹](../../packages/native-scene/trace.json)。

| 回放节点 | 当前受权快照 | 当时可查的历史 |
|---|---|---|
| 01，R0 | 芦花渡 | 无 |
| 02，R1 | 望气台 | 仍无独立核验的历史到达 |
| 03–04，R2–R3 | 望气台 | 受阻、移至子区域均未增加顶层到达 |
| 05，R3 | 望气台 | 重新登录首次核实 R1 芦花渡 → 望气台 |
| 06–07，R4–R5 | 望气台 | 返回子区域上层、调查都未增加历史 |
| 08–09，R6 | 芦花渡 | 绕行在白名单外；旧 R1 记录仍指向望气台 |
| 10，R7 | 望气台 | 复访沿用原地点身份，新增独立 R7 到达 |
| 11，账号关闭 | 隐藏 | 隐藏 |

当前位置来自绑定测试账号、新存档、root、规则版本与当前修订的授权数据库查询。历史由 B2 使用目标修订前后状态及事件前缀核验，带有首次获证时点。返回视图前再查权限与当前位置。乱序重读、重复读取不倒退当前地点。退出或关闭账号、跨账号、错存档、错分支、未来修订、错误请求键、冒充 proof 和夹带梦境文字均未展示越权位置或历史。两个合成地点均有真实正例。人物、结构、时间、光照、观察位置和朝向在每个可见节点均为 null。

第二次运行 R1 的存档 SHA-256 为 `c35de4e480395c7ebb918d380e60141e4b324de136181e0783210689af4f8fad`，R6 为 `b8972d3b5ef0be1466cb8e6f53de2dce0d14448de1589a4252b78d24addf25a3`。两次临时 PG 均已停止并移除专用目录。

## 页面和实机限制

页面复用映界 UI shell 和既有场景注册模块。地点印记由内嵌 CSS/SVG 构成。页面只有地点与行动标签，没有原始凭据、完整存档、人物描述或图片素材。单文件声明 `connect-src 'none'`，可执行脚本由哈希限定。使用相同轨迹重建两次，HTML SHA-256 均为 `4921c8a596d5be803c43e7c64e099024613deed2e19ddbee6f5c2fb11f451714`。

首次浏览器红灯发生在 Chrome 创建页面前。Crashpad 报 `TransactNamedPipe 0x6D` 并退出。Edge 复核在同一阶段报 0x6D。桌面浏览器连接器没有可用的 Chrome，应用内浏览器的 URL 策略拒绝本地文件协议。浏览器内的请求计数、实际布局、截图与真实键盘操作均为 **NOT_RUN / BROWSER_NOT_VERIFIED**。保留了两个视口的浏览器验收脚本及[脱敏结果](evidence/YJ-P04-NATIVE-SCENE-01/checks.json)。

## Gate D 与复跑回执

| 命令或检查 | 结果 | 退出码 |
|---|---|---|
| `python -B packages/native-reader-b2/test/launch.py ../Nine-cloud ../b2-upstream-final <PG-bin> native-scene` | 两次独立真实宿主成功，第二次加验读回摘要 | 0、0 |
| `python -B packages/native-scene/test/import-trace.py <local-log>`、`node packages/native-scene/build.mjs` | 导出、构建及交付副本摘要一致 | 0 |
| `packages/native-scene/test/offline.mjs` | 双向逐节点回放、历史获知点、隐藏、开关、键盘处理与重置通过；12 份历史证据摘要一致，I2 拒绝真实派发 | 0 |
| B2 纯前缀验证器 | 21 个规则/损坏对照通过 | 0 |
| S2 画面资格 | 100 条，错误放行 0，不必要阻断 0 | 0 |
| 场景触发与许可 | 4 项通过 | 0 |
| S3 原静态试玩 | 20 回合、16 项断言通过 | 0 |
| `node packages/native-scene/test/browser.mjs ../native-scene-screens` | Chrome、Edge 的进程启动后退出，页面检查均未运行 | 1、1 |

[各离线命令、逐项输出及浏览器诊断](evidence/YJ-P04-NATIVE-SCENE-01/checks.json)。上述 JS 回归在 Node 无网络权限下执行。此次没有复跑旧全量套件。B2 历史基线为 40/42，单存档归档和删除仍属上游依赖。原 NATIVE-FACT-01 离线 PASS、H3-B2/H3-B2S 历史 FAIL、角色卡权威来源缺口均已保留。全部节点均为 `sceneEligible=false`、`send=false`，真实模型/图片调用、模拟图片派发均为 0，费用 USD 0。I2 仍为 `LIVE_BLOCKED_COST_BOUND`。

## 回退

交付只接入研究包与 B2 测试启动器的显式 `native-scene` 模式。关闭 HTML 即结束试玩。在单独工作树检出 Gate A 提交可复核旧状态；如需撤销功能，在任务分支上 revert 冻结之后的交付提交即可。生产默认入口、两个 main 和上游数据库均不需要迁移或回退。
