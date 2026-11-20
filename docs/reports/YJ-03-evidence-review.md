# YJ-03 复核与定向修补记录

日期：2026-11-20（北京时间）。

## 结论与接续

YJ-03 已交付共用契约，原报告记录 8 组测试通过。独立复核确认主要来源映射和规则实现存在，并发现两个原测试未覆盖、能够在公开入口复现的边界缺口。两处已在独立接续分支修补，包版本为 `@yingjie/contracts@0.1.1`，交换格式仍为 `schemaVersion: "0.1"`。

- 原成果：`7d68284e95754f06e853123ac3c719788266ae0a`，实现父提交 `5463c96eae5996a69bcc61b5887c6c3d50f8b3e9`。
- 定向修补：`e5d6cf2e73dc5131209f9793677e3eebf24a7c73`。
- 接续分支：`codex/yj-04-scene-state`。
- 原 YJ-03 分支与 YJ-02 后端准备分支没有被本次修补改写。
- 接续任务：[YJ-04 场景身份与变化持久化](../task-briefs/YJ-04-scene-state.md)。

本次通过的是源码复核、编译与有针对性的规则检查。完整原图相关测试未在本工作环境重跑；接手 YJ-04 时，应先在完整工作副本执行现有全部测试（原 8 组加新增 2 组），通过后继续实现。此检查不要求重新生图。

## 实际读取与运行范围

读取了原提交的 `src/index.ts`、`src/schema.ts`、原测试、fixtures、package.json、包内锁文件及契约文档；下载到隔离文本工作副本的 14 份源码/元数据与远端 Git blob 一致。

另按九霄固定提交 `cd25360c7929e10f8b2b0fad342fedd943d4f323` 核读角色卡 host、router、service 和 schema.sql。没有修改或启动九霄，没有调用文字或图片模型。

本次环境为 Linux、Node 24.22.3、npm 11.19.1。首次离线安装因本环境没有 Zod 缓存而失败，随后正常按原锁文件安装 2 个依赖成功；这与原执行者在已填充缓存的 Windows 环境离线安装通过不矛盾。依赖版本及 integrity 未更改。

## 发现一：编辑入口允许同版本不同事实

在原公开契约入口中，把 S2 增人计划的目标视觉版本从 V2 改成参考图的 V1，其余保持不变：

- 参考图：V1，3 人。
- 目标：V1，5 人。
- DecisionSchema 接受输入。
- referenceEligibility 返回 `eligible`。
- 合法的 V1 → V2 对照也返回 `eligible`。

同一地点的同一视觉版本不应同时代表三人和五人。原测试在显示入口验证了此类冲突，没有覆盖编辑参考入口。后续按视觉版本持久化时，这个缺口可能使状态发生混淆。

**修补：**精确参考匹配之后，若目标与参考视觉版本相同而可见事实不同，返回既有的 `visual-mismatch`。跨版本编辑仍允许；同版本、同事实的修图也仍允许。没有强制每次编辑都更换视觉版本。

## 发现二：UUID 大小写会拆分同一身份

在原入口中，将合法角色卡 sessionId、key 改为大写，两份 Source 均可通过解析，但 eventKey 和 requestKey 不同；classifyDelivery 把同一事件判为 `new-request`。

上游路由 UUID 校验不区分大小写，并将原参数传入服务；session 与 key 使用 PostgreSQL uuid 列。契约不应仅因同一 UUID 的表示大小写不同而拆分归属和去重身份。

**修补：**在 SourceSchema 和 historyRow 入口将角色卡 sessionId / key 校验后规范化为小写。先规范化来源，再生成关联与去重键。ownerId、fixtureId、原生来源等不透明标识不做无依据的小写转换。

## 本次实际检查

| 对象 | 命令或方法 | 结果 |
| --- | --- | --- |
| 原源码与元数据 | 14 份本地文件对照 Git blob | PASS |
| 原锁定依赖离线安装 | `npm ci --offline --ignore-scripts --no-audit --no-fund` | ENOTCACHED；本环境未预存 Zod |
| 原锁定依赖安装 | `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` | PASS，2 个包 |
| 原 0.1.0 编译 | `npm run build` | PASS |
| 两个反例 | 原包公开导出与原 fixture 元数据，独立 Node 调用 | 均复现上述缺口 |
| 修补后 0.1.1 编译 | `npm run build` | PASS |
| 新增定向回归 | `node --test test/review-boundaries.test.mjs` | 2 组通过，0 失败 |
| 原来源映射检查 | `node --test --test-name-pattern='^C01 ' test/contracts.test.mjs` | 选中 1 组通过；不代表原 8 组全量重跑 |
| 原图字节与完整原测试 | 本工作副本未取得 PNG 字节 | NOT_RUN，沿用原报告的已提交证据；下次完整副本复跑 |
| 模型、数据库、队列、前端与生产 | 本轮未执行 | NOT_RUN |

新增回归使用记录中的摘要作为规则函数的宿主输入，不检查原图字节、不冒充图片生成。它覆盖两项反例，以及正常跨版本编辑、同版本同事实修图、相同 UUID 规范化后去重和真正不同会话仍被拒绝等合法/非法对照。[测试源码](../../packages/contracts/test/review-boundaries.test.mjs) · [结构化复核记录](evidence/YJ-03-review.json)

没有改变原 YJ-01/YJ-02 图片、调用记录、YJ-03 原 fixtures 或原测试。补丁只改两处规则、包补丁版本与锁文件根版本，增加独立回归测试并澄清契约文档。

## 对 YJ-04 的必要提醒

- 地点主键使用稳定归属与 sceneId，不能包含每轮变化的事件 key / revision。
- 历史接口是按修订升序、最多 100 行的裸数组，没有 nextCursor 或 hasMore。游标以成功提交的修订推进。
- `completed-history` 来自可信服务查询，不是行中带有 status，也不是 fromCardHistory 自带鉴权。
- greeting 位于会话详情，初始修订 0；不能伪造正修订事件。群聊也有不同历史结构，本轮先限定已验证的普通角色卡路径。
- currentFacts 只筛选当前事件的已标注事实。持久化恢复必须继承此前仍有效的状态，新一轮不提某个人不代表他离开。
- fromCardHistory 会 trim 正文首尾空白。若记录原始正文摘要，应基于明确保存的原始响应，不能把规范化正文说成原始字节完全一致。

上游依据：[host.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/host.ts) · [router.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/router.ts) · [service.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/service.ts) · [schema.sql](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/schema.sql)。

## 并行协调

YJ-02 后端准备仍从自己的分支推进。其执行者需要共用契约修补时，可在核查工作区后单独接入上述修补提交；不要合并整条 YJ-04 任务分支来覆盖自己的交接文件。原图效果和真实供应商接入状态均未因此变化。

