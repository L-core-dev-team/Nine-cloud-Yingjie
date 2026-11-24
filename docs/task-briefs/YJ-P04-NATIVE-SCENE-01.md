# YJ-P04-NATIVE-SCENE-01｜可信位置驱动的场景切换与可玩离线预览

- 日期：2026-11-24（北京时间）。
- 执行者：Codex；映界独立分支 `codex/yj-p04-native-scene-01`。
- 接续 `codex/yj-p04-native-reader-b2@0bb6204a90bbc70bdf920fda57f5bc51d44e6af0`；九霄固定 `L-core-dev-team/Nine-cloud@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`。
- **道主批准「那就继续」：直接进入可信原生事实→场景更新→离线视觉预览的最小工程试点，不另开只读审批循环。** 授权映界独立任务分支开发、复用已获准范围内的 B2 隔离合成测试宿主/本地回环及专用测试 PG、离线构建和普通浏览器检查；若环境另需权限，通过官方机制申请并遵守限制。不得访问真实玩家账号、存档或生产服务。无实际图像生成、编辑、付费、模型权限查询/文字/图片 API、外发素材、两个 main 或九霄上游写入。H3-C、D1 正式导演、B3 和生产集成不启动。
- 当前只是任务书及授权登记，工程/测试均 NOT_RUN；本次 GitHub 文档提交不等于 Codex 已开工。
- B2 **PARTIAL（40/42）**，核心历史正例实际认证+PG通过，24 个真实服务行为+16 个受权取数后故障对照；原生 schema 3 单存档归档、删除两项 UPSTREAM_DEPENDENCY / NOT_RUN 保留并转入后续九霄依赖，不重写旧验收、不强行解除生命周期保护。旧合成 NATIVE-FACT-01 PASS、H3-B2/H3-B2S FAIL、角色卡 UPSTREAM_AUTHORITY_GAP、I2 LIVE_BLOCKED_COST_BOUND 不变。

## 0. 目标：给用户一个真正可体验的场景原型

先读[真实 B2 续跑报告](../reports/YJ-P04-NATIVE-READER-B2-report.md)、[最终逐例回执](../reports/evidence/YJ-P04-NATIVE-READER-B2/resume/final.json)、`packages/native-reader-b2/{reader.mjs,history.mjs,README.md}`，及已有 `packages/scene-state/project.mjs`、`packages/first-play/{scene-registry.mjs,visual-consistency.mjs,trigger.mjs}`、`packages/offline-play-preview/{README.md,build.mjs,page.html,preview.js,check.mjs}`，S2/S3 报告。

本轮以芦花渡与望气台为两处主要场景，实现可直接打开的本地 HTML 试玩/回放：当前地点、前后场景、行动进度、可信来源与历史记录、未知视觉字段、待补画面理由。优先复用 S3/UI shell 的布局和互动，不造全新平台；**用户应能够实际点「下一回合」看到地点切换，而不是只收到更多测试指标。** 不接入真实生成模型。可以用两种有辨识度的本地 CSS/SVG 示意卡或抽象地图标记显示已证地点，清楚标「示意 / 尚无已审场景图」，不能把它们宣称为剧情实际画面、凭空绘制人物数量或未证世界结构。不将旧酒馆 PNG 当芦花渡/望气台图。

## 1. Gate A｜明确来源、最小冻结路径

### 已证事实（固定 B2 报告）
- final.json 的 `later-owner-read`：targetRevision=1，from=loc_luhuadu，to=loc_wangqitai，observedThroughRevision=3，learnedThroughRevision=3，source=local-test-pg-history/1，R0/R1 实际全状态对账成功。source 字符串本身不是认证。
- B2 返回 `sceneEligible:false / send:false`；地点确证不等于完整 Visual，更不等于生图许可。
- B2 现有 `read(token,locator)` 与 `knownAt` 需要真实宿主建立 owner/save/root 绑定并重新鉴权。HTTP 返回的精简投影不含完整事实身份或 owner/save；不能让任意 JSON、报告中的 proof 对象、调用方声称可信或 UI 参数直接获得签发能力。
- 已核查九霄 `packages/content/src/prologue/prologue-v1.ts` 的固定地点 ID 与名称；`apps/api/src/services/approved-player-actions.ts` 的 approvedLabel 用同一候选内容目录。可复用 pinned host-authorized ID→名称（芦花渡、望气台；折桂坪非本轮必需）。地点描述只作为标明来源的静态资料，不当当前可见景物证据，更不从完整规则书泄露未获知地点/NPC/任务信息。
- 既有 SceneSchema/VisualSchema 使用严格的 SourceSchema；Visual 需要 people/features/lighting/timeOfDay/viewpoint/perspective 全部已确认。native-turn 的 accepted-archived-text 不等于原生规则历史证明。首版用独立的 versioned partial scene candidate；不伪造旧 SourceSchema，不把未知列表设成空数组（空名单表示确认无人），不破坏旧卡会话投影。

先锁定最少真实路径和预期：R0 芦花渡 → R1 正常到达望气台 → R2 受阻 → R3 子区域/停留 → 重新登录在 R3 获证 R1；随后合法绕行/复访（按真实固定规则行动而非直接改数据库）。额外用已冻结公开 B2 路径作安全对照，测试数量从简，以可体验成果为主。先提交矩阵/预期、记录原 B2 正例/两依赖和首次失败的 SHA，再开发。已公开的历史数据只称回归，不造新独立盲评名义。

## 2. Gate B｜最小可信场景适配与可用预览

实现研究专用入口，建议 `packages/native-scene/`（实际目录可根据仓库调整）；原 B2 与旧 scene-state、S2/S3、图片许可默认入口继续不变。

**分开三个层次：**
1. 可信位置/历史行程：通过受信宿主调用现有 B2 reader，绑定本次 owner、saveId、root、requestKey、targetRevision、observedThroughRevision、learnedThroughRevision、evidenceLearnedAt 和稳定事实身份（可由已核验 scope/key/revision 导出），只接受该宿主实际完成的规则/状态验证。测试专用组装层持有 credential、原始认证和授权边界，不接受外部 wire 中的 proof/source/verified 自报，也不把 B2 报告 JSON 当实时授权。重复查询同一事实不增重复场景/历史记录；每次实际展示重新核对 scope/授权，不缓存跨账号画面。
2. 当前地点：历史到达是行程记录，不能单凭旧 R 的 to 作为现在地点。只有同一受信宿主本次已授权、同 revision/horizon 的实际当前状态快照或完整可核对的位置投影能够确认当前地点；R0 初始位置也必须来自实际创建/读取，不靠默认地图猜测。可在测试包装内读取最小当前 locationId + revision（不外发完整存档或新增生产接口），与最新授权截面绑定；若无法取得则「当前地点待确认」；旧到达仍可作为已知历史展示。若真实发生白名单外 move.bypassed，必须明确其位置事实尚非白名单确证；不能继续显示前地点为现在，若当前受权快照独立证明 B 地点可显示当前地点但不能冒充新白名单到达。被阻、同地点子区域不会制造新顶层场景；子区域本轮不推导具体视角。后到旧事实不会把当前视图倒退。可缓存地点身份，不缓存未经再验证的旧可见字段。跨账号/切存档/撤权即隐藏当前受权画面与证明。
3. 部分视觉场景：固定地点 ID→可信名称、场景身份、位置证据、当前/historical 状态及未知字段；people/features/time/lighting/viewpoint/perspective 除非另有明确、当前、玩家获准来源，否则保持 null/unknown，不从到达、世界目录、旧图或自由正文推断。已有审阅资产只有在当前授权、地点、完整视觉版本、审阅和原件均匹配时才可用；没有合格 native 素材则显示带解释的示意占位。沿用 S2/S3 的“字段就绪 / 画面资格 / 发送许可”分离，**此专项任何输出均 sceneEligible=false、send=false，且无正式 generate/edit 任务。** 不把位置候选状态写成完整 Visual 或导出图片请求。

必须明确区分实际受权研究入口和离线公开演示：实际 B2 本地测试中重跑两个合成身份的有限路径，把已经过认证的结果与获准地点信息导出为脱敏可复跑演示 trace（无真实 token/owner ID/save key/完整存档或 NPC 私有事实）；离线页面只播放这个明示为测试记录的 trace，不声称正在登录、连接真实服务器或验证新输入。必要时有独立标明的合成故障演示，不能混为真实轨迹。若实机环境阻塞，允许交付基于 B2 公开回执的离线预览，但明确来源为历史冻结证据，新的真实接入 NOT_RUN，不用它冒充新端到端通过。

### 用户可实际体验的交付

独立可双击的 `packages/native-scene/dist/index.html`（或等价清晰路径），尽量单文件、零网络、无需 Node/PG/登录或配置密钥即可打开，复用 S3 的相近色彩、双栏、历史与移动端布局。
- 页眉明确「九霄 · 映界｜原生场景离线试玩 / 合成测试记录 / 无真实生图」。
- 左侧行动/实际修订、当前地点标题，右侧场景示意卡（不同地点明显区分）和「画面待确认」；显示确证的位置，其他字段未知，不能造剧情正文冒充已保存叙述；可用已确认动作及规则结果的简短标签。
- 下一/上一回合、时间线、重置；历史查看与当前场景明确区分。R1 确认在 R3 获知，在 R1 的**当时知识**不得出现后获事实；允许另设标明“事后重放核实”的历史行程视图，不能混淆。若当时实际受权当前快照已有地点，可说明其独立来源。
- 受阻、子区域、绕行、复访、旧证据迟到/权限丢失时有自然、可理解的反馈；不能所有回合都空白拒判，至少两个真实受权地点状态能够切换/显示并可交互。
- 关图/预览开关后仍可阅读与推进。可展开来源和事实证据（脱敏摘要、修订、获证时点、明确未知字段）。不展示任何未经授权的旧图或虚假视觉状态。
- CSP 禁止联网（connect-src none），不从外链加载素材、第三方脚本或模型，不写浏览器真实用户数据。确认数据引用/转义，避免不可信标签变 HTML。390px 手机尺寸与桌面尺寸排版；键盘可操作。保留实际截图或浏览器回执，若原浏览器环境仍阻塞记 NOT_RUN，不关闭沙箱或安全策略。
- README 用中文只给实际打开方式、复跑命令、限制与回退；交付完整 dist（可重建）及必要示意素材。不要把用户引到一堆 JSON 或让用户先启动数据库才能看离线页面。

## 3. Gate C｜尽量少而有效的真实与离线验收

目标是体验与正确性，不是继续无限扩张语料。最低完成下面的实测对照：
- 真实 B2 授权范围内的当前 R0→R1 场景变更，与实际 PG 位置证据一致；R3 重读 R1 能出历史行程记录；若此时实际地点已不同，旧 R1 不得造成当前场景回退。
- R2 受阻/同地点子区域不新增顶层地点或人物；bypass 不错标成没移动，且不把旧地点显示为现在；复访不新建重复地点身份。未来/旧事件、重复/乱序、不同 save/owner、错 branch、伪造 proof、会话注销/关闭时的来源拒绝；真实归档删除两依赖继续保持 NOT_RUN，不造测试 SQL。
- 位置已证但视觉不齐，候选可呈现、正式图片资格仍禁止；梦境或演出文字添加人物无效；已知空集合与未知严格区分；不同地点绝不串图。不同视图/as-of、重置及历史获知点不借未来。
- 真正打开离线页面，验证至少一次可见场景切换、受阻保持/复访、历史/当前区分、关图继续推进、桌面/390px 和键盘；检查断网、外部请求和凭据泄露为 0。Node DOM 或静态测试与真实 Chrome/Edge 浏览器实测分开报告。B2 读取只允许官方环境权限与独立测试 PG；不接真实账号，不重复刷旧巨量测试替代可见体验。
- 硬门槛：至少一条受信实际场景更新正例、两个地点能展示，0 伪授权事实/场景、0 当前/历史混淆、0 跨 scope 展示、0 未知填充/串图、0 真实/模拟图片派发（本项连假发送也不需要）。任何安全错误为 FAIL。若实际本地链路或真实浏览器没跑，不宣称完整体验 PASS。

## 4. Gate D｜轻量兼容、交付、结案

- 先固定并核验原 B2 final.json/42 项冻结矩阵、旧 NATIVE-FACT-01 的验收/60 正例与原 298 前缀、S2/S3 旧回执、H3-B2/B2S FAIL、I2 停止线不改。重跑受新入口影响的原生 reader/来源、位置、S2 场景资格、S3 静态预览和图片门禁的相关回归；可复用旧驱动。未运行的全量套件不冒称重跑，不为小型试玩无限延伸范围。
- 输出 `docs/reports/YJ-P04-NATIVE-SCENE-01-report.md` 和脱敏证据，附当前/历史轨迹、场景字段/不准入原因、页面/截图、运行命令和实际退出码、冻结 commit、首次红灯、SHA、回退。若用真实本地 B2 环境，清理仅本次临时资源，保留旧工作区、旧证据和 PG。
- 更新任务索引并提交任务分支；提供 final local/remote SHA、实际变更范围、可打开的 HTML 位置、实机浏览器状态、模型/图片调用数 USD（全为 0）。不修改两个 main，不接生产、不推进 D1/正式图像生成。
- `NATIVE_SCENE_OFFLINE_PREVIEW_PASS` 仅用于受权本地位置→场景候选真实试点、可打开的离线页面及实际浏览器交互和硬门槛均通过；不表示真实图像质量、生产安全、自由角色卡、原生生命周期补齐。若只有历史固定回执回放/静态 DOM 或浏览器未跑：`NATIVE_SCENE_PREVIEW_PARTIAL`，细列 LIVE_LOCAL_SOURCE_NOT_RUN / BROWSER_NOT_VERIFIED 等。环境阻塞如实报告；保留可见交付，不另做无限底层研究。

**本轮优先做可见、可试玩的产品结果。道主已同意继续此有界开发；不要再次只交计划等待开工批准。**
