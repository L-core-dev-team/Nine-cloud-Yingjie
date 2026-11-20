# YJ-04 场景身份、变化记录与持久化报告

2026-11-20 · 工程检查已通过。普通角色卡已完成历史可以通过现有鉴权读入独立的 PostgreSQL 投影。酒馆状态在进程退出后可恢复，包括地点别名、五名在场人物、视觉版本与消费修订。

## 提交、基线与复跑

接手时 YJ-03 工作副本干净，HEAD 为 `7d68284`。读取 YJ-04 的实际远端 ref，在本地接续分支依次核对补丁、任务书、02 进度补记的 Git 对象和整树。开始实现时 `codex/yj-04-scene-state` 本地与远端均为 `6cf460e7d4920653c192cf1e3c177145b32d9376`，工作区干净。实现与脱敏回执已快进提交并回读远端：[a8b33d4cfb50dcbea0d1b411008a3360e1810421](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/a8b33d4cfb50dcbea0d1b411008a3360e1810421)。本报告与交接是其后续文档提交。

| 检查命令（映界根目录） | 本轮实际结果 |
| --- | --- |
| `npm ci --prefix packages/contracts` | 退出 0。使用已填充的本地 npm 缓存和原锁文件安装两个包 |
| `npm --prefix packages/contracts test` | 退出 0。0.1.1 编译通过，原 8 组及补丁 2 组全部通过，0 跳过。交换格式 0.1 |
| `python docs/reports/evidence/YJ-02/probe.py verify` | 退出 0。三张原 PNG 的 SHA-256、尺寸与参考链通过，S1、S3A 可复用 |
| `node packages/scene-state/test/verify-local.mjs` | 退出 0。真实 HTTP 与 PostgreSQL 检查、独立合成酒馆检查、合成分页与访问失效检查共 3 组通过，0 失败、0 跳过 |

环境为 Windows、Node 26.13.0、npm 11.20.0、PostgreSQL 18.4。首次分两次 shell 操作启动数据库、运行测试时，沙箱清理了后台 PG 进程，导致登录返回 503；连接诊断为 ECONNREFUSED。最终复跑入口管理同一次测试所需的 PG 生命周期。安装、环境变量、数据库隔离、复跑及回滚详见[模块说明](../../packages/scene-state/README.md)。[脱敏结构化回执](evidence/YJ-04-local-run.json)

## 实际普通角色卡历史

固定九霄为 `L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`。核对其 apps/api/src/card-import/host.ts、router.ts、service.ts、local-runtime.ts，以及 apps/api/src/routes/auth.ts 和 scripts/dev/cards-host.mjs。测试在回环端口运行固定上游构建的 Hono app、EmailAuthService、PostgresEmailAuthRepository 和合成文字适配器，用受限 cards_demo_app 登录原本地测试数据库。上游未新增挂载或修改源码。

1. 调用现有验证码、验证和 Cookie 路由，导入并确认演示卡，创建普通会话。空会话只有修订 0。测试暂停模拟文字返回，确认行动 pending 时历史数组为空，随后放行原模拟文字输出。
2. 通过原 actions 路径完成提交。模块经 `/api/auth/session` 解析 owner，读取会话详情，确认普通模式，再从 `/api/card-import/sessions/:id/history?after=0` 读取 completed 正文。映界独立库中 revision=1，source.key 与提交幂等键一致，正文摘要与已知合成回复相符；再次同步 applied=0。
3. 正文没有可定位事实，结果为 not-ready。两张演示卡建立的真实本地群聊被模式检查拒绝；切换为另一已登录用户后原会话拒绝访问，登出后旧 Cookie 也不能读回缓存。

[真实读取检查代码](../../packages/scene-state/test/live-card.test.mjs) · [受信消费入口](../../packages/scene-state/index.mjs)

## 合成样例与实际 PostgreSQL

| 风险 | 已验证的输入与结果 |
| --- | --- |
| 地点与继承 | 东村青石酒馆初始 3 人为 V1。谈及回忆、远山、计划、玩家未知事实和图片光点均不变。明确新增两人后为 V2，离开清空当前位置，进程重开并明确复访恢复原地点及 5 人。傍晚和点灯在同一事件中只产生 V3 |
| 名称与不确定性 | 改称“老周的店”仍使用 east。西村同名酒馆保留独立 west，缺可见事实时返回 incomplete-visible-facts。仅按旧名查找返回 ambiguous-place；补上东村范围可由原别名找回 east。明确离开一人变为 V4，后续未再次提及仍保留 4 人 |
| 原子性、竞争与迟到 | 子进程在已写事件日志、尚未更新状态和检查点时以 61 退出。数据库回滚整笔事务，检查点仍为 2。两个独立进程竞争修订 3，分别得到 applied、duplicate。新进程从数据库读回修订、快照和别名。旧事件重读不能倒退状态 |
| 身份、原文与冲突 | 同事件同内容仅消费一次。原文只改首尾空格也能识别输入改变。另验同 key 换修订、同修订换 key、跳号和页面不升序，留下冲突或拒绝原因。显式待补标注回滚且可在该修订重试。集合成员来源保留至最后一次明确确认 |
| 100 行边界 | 独立的 102 行模拟普通历史使用 after=0、100 两页处理，存储运行在真实 PG。第 40 行加入非法状态字段时检查点停在 39；修正后从 39 接续。另一组读取在开始时固定上界为 101，返回页中后来增加的行留到下批 |
| 会话切换、删除与撤权 | 真实 HTTP 覆盖错用户和登出。合成来源另验取消读页、会话消失及历史倒退；旧显示目标不返回已保存画面。已提交的事件始终写入其原归属 |

[合成酒馆标注](../../packages/scene-state/test/tavern.mjs) · [数据库与分页检查](../../packages/scene-state/test/persistence.test.mjs) · [故障和重启子进程](../../packages/scene-state/test/worker.mjs)

## 交付边界与接续

- **已交付**：独立 Node ESM 模块、PostgreSQL 初始建表脚本、可信 HTTP 消费入口、可替换的逐事件标注接口和公开契约输出。复用宿主 pg、既有契约与 Node 内建测试器。无新增 npm 依赖、上游迁移或生产挂载。
- **未运行**：任意自由文本的模型提取、生产部署、大规模历史负载、真实供应商图片 API、端到端文字出图和 UI 验收。合成酒馆使用显式标签，真实普通历史使用本地模拟文字；两者分别验证。
- **下游**：YJ-06 可读取 ready / not-ready 和稳定 sceneId、visualVersion；YJ-07 可按地点与归属匹配获准资料。YJ-05 可对接通用画面规划和任务处理，真正发图仍需获准的后端入口与认证。YJ-08 联调需接入实际宿主、正文提取和下游图片链路。02 分支的模拟传输进度沿用交接记录，本轮未复跑。
