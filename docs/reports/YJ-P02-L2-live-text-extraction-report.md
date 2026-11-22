# YJ-P02-L2 · 首次真实正文的离线回放

2026-11-22（北京时间）。**画面判定为 CORRECT_ABSTENTION，局部事实识别为 EXTRACTOR_GAP_FIXED_OFFLINE。** L1 的正文支持三类现场观察，但首次修订没有可定位的地点和完整视角。原版与新版均保留文字、留空画面。本轮新增真实文字、图片和供应商查询均为 0，新增费用 USD 0。[原件核对与隔离投影回执](evidence/YJ-P02-L2/replay.json)

## 原件和复现

映界任务起点为 `9fd2a523b97bd9ca7f442e464107882602a631d7`，九霄只读上游为 `cd25360c7929e10f8b2b0fad342fedd943d4f323`。按受信用户临时目录的固定前缀和 L1 成功回执时间定位到唯一候选。确认 PostgreSQL 已正常停机，校验物理副本和原目录的内容指纹一致，在副本上启动回环 PostgreSQL。原卡库和原投影的查询均在只读事务内进行。

从只读 SQLite 记录确认唯一许可为 `ACKNOWLEDGED`，按其 owner、session、action key 摘要核对普通会话与事件来源。通过上游 `CardImportService.history` 读到唯一 completed 修订 1，再核对原请求状态、会话修订、事件键、包含行动的输入摘要以及正文 UTF-8 SHA-256。实测正文长 33 个 UTF-16 码元、99 个 UTF-8 字节，完整哈希为 `1c65286041ae74ccae956c08bdca02b3e91f9273411834c83adbd98071e23f98`。

修订 1 之前没有事件、地点或当前场景，L1 的首次同步初始化为空历史。按这个前态重跑 `zh-visible-clause/2`，得到与留存的 extraction 审计、observations、event.result 和 stream.state 完全一致的结果。原正文分为两个句段，UTF-16 的 `(start, length)` 分别为 `(0,17)` 和 `(18,14)`。旧版以整句匹配，第一句没有命中，记录 `rule=unsupported` 后立即返回一项 `unknown / unsupported-clause`。第二句未进入旧版审计。没有证据表明投影丢失或引号、时间范围处理导致了此次结果。

## 真实正文能支持哪些事实

以下为对同一已校验正文的开发者初标。位置指向原正文，公开材料只留位置与类别，未作独立人工盲评。

| UTF-16 起点、长度 | 事实分类 | 可登记的信息 | 仍缺的信息 |
| --- | --- | --- | --- |
| 0，6 | 明确当前可见 | 室内日光与明亮状态 | 具体时段没有单独交代 |
| 7，10 | 明确当前可见 | 两类可辨认的陈设，包括柜台和窗 | 固定性、空间布局、观察位置及观察方向 |
| 18，14 | 明确当前在场 | 三个被指明的人物在场 | 缺少排他性表述，无法确认完整人数或排除其他人 |

两个句段都没有提供可区分同名地点的地点身份或所属位置，也没有显式建立玩家所处视角。未发现过去、转述、猜测或计划主张。无法判定的是全景的完整性。即使能登记局部观察，也不能从玩家行动、合成提示或旧图借回缺失字段。

## 版本差异及回退

`zh-visible-clause/3` 是可选的隔离回放模块。只有在无当前地点、无历史地点且旧版因不支持的句式而弃判时，才尝试解析直接陈述的室内光照、明确可见的陈设及具名在场成员。它对完整分句作锚定匹配；只要混入不支持的主张，就丢弃本轮暂存的局部事实。成员列表只表示已见者。每一项局部事实记录规则、UTF-16 证据范围和对应字段，不生成地点或视觉对象。[版本化实现](../../packages/first-play/initial-survey.mjs)

以同一修订在停库副本内的独立投影数据库执行 `consume`。新版审计记录三项证据，规则为 `observed-indoor-daylight`、`visible-counter-and-windows` 和 `observed-present-members`。画面仍为 `not-ready / incomplete-initial-survey`，重复消费同一事件被去重。新审计带 `replayOnly` 标记。原投影与隔离投影的图片任务、attempt 均为 0。测试结束后删除隔离数据库和临时物理副本，原集群全目录与原许可文件的内容指纹和开始时一致。

默认宿主仍使用原 `/2`，无需迁移或回滚数据库。要复查旧行为，以 `extractContinuity` 回放同一修订即可。当前样本仅一条，新版也没有处理任意小说叙事、完整视角恢复或图片质量。

## 离线验证与复跑

使用已构建的固定上游、Node 26.13、本地 PostgreSQL 和 Chrome。沿用本机运行手册的四个路径变量，无需任何供应商凭据。取证命令只接受已定位的 fixture 目录名，未指定时返回 `SOURCE_UNAVAILABLE`。可加 `--check-staged` 在本机检查暂存差异中是否出现原正文、整句或身份原值。[回放入口](../../packages/first-play/test/luna-replay.mjs) · [运行环境](../local-demo.md)

```powershell
npm --prefix packages/contracts test
node packages/first-play/test/luna-replay.mjs <L1保留的fixture目录名>
node --permission --allow-fs-read=* --test-isolation=none --test packages/first-play/test/initial-survey.test.mjs packages/first-play/test/continuity.test.mjs
node packages/local-demo/check.mjs regression new-regression.json
node packages/provider-readiness/check.mjs new-p01.json
node packages/luna-text/test/check.mjs new-l1.json
```

- 公共契约 10/10；65 条既有合成样本上，`/3` 的观察和规则证据与 `/2` 逐条相同。`/2` 零错误接受，原 reference 批次仍有 1 条不必要弃判。旧 `/1` 的 continuity 批次仍有 1 条错误接受。这里验证的是版本兼容性，不把这些历史差异记为新通过的语义判断。
- 新定向测试覆盖局部证据、非完整名册、否定、梦境、计划、转述、疑问、含糊离场、不同地点同名、秘密与旧图输入。P01 禁网 7/7，L1 禁网 15/15。YJ-13 原回归在两个独立临时集群各通过 22/22，均无跳过或超时，包含旧图授权、隔离回放和宿主链路。[回归汇总](evidence/YJ-P02-L2/regression.json) · [正反例](../../packages/first-play/test/initial-survey.test.mjs)
- 工具联调初次未在服务端工具目录找到 `pg_controldata`，随后从配套客户端目录找到。首次连接副本时联表查询的修订列有歧义，已显式绑定事件修订后复跑成功。这两次均未完成语义审计，未计入通过次数。

后续如另获授权，新的叙事请求可提示模型只说明已经揭示的地点、观察位置和方向、可见成员（有证据时才声称完整）、环境与时段；未知项明确留空。本案例已有原件可供离线验证，无需为解释这次弃判再申请模型费用。
