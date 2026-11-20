# 映界共用画面契约 0.1

维护与导入位置为 [packages/contracts](../../packages/contracts)。私有包名为 `@yingjie/contracts`，包版本 0.1.0。每个可独立交换的来源、地点、视觉快照、决策、能力、尝试和资产都带 `schemaVersion: "0.1"`。严格对象拒绝未知版本、多余字段和缺少的必填字段。仅下表注明的位置用 null 表示未知或不适用。破坏字段、枚举或语义兼容性的改动须发布新格式，双方显式转换后再交换。集合顺序不影响人物、固定特征及保留要求的比较。

## 消费入口

在仓库根目录运行。首次安装从 npm 取得锁定包；已有相同包缓存可用 `npm ci --offline`。构建导出 ESM 和 .d.ts，源码与声明从同一套 Zod schema 推导。

```sh
npm ci --prefix packages/contracts
npm --prefix packages/contracts test
```

将本仓库的 packages/contracts 作为本地包依赖，先构建它。以下示例可在包内或消费工程运行。

```js
import { DecisionSchema, requestKey } from "@yingjie/contracts";

export function identifyDecision(input) {
  const plan = DecisionSchema.parse(input);
  return { action: plan.action, requestKey: requestKey(plan) };
}
```

用 `safeParse` 读取不可信 JSON，错误的 issues 给出字段路径；规则函数接收校验后的对象。公开 schema 为 Source、Scene、Fact、Visual、Decision、Capability、Attempt、Asset 加 Schema 后缀。主要公开类型为 Source、Visual、Decision、Capability、Attempt、Asset、Access。其余结构可直接用 `z.infer`。可运行的消费示例见[酒馆样例](../../packages/contracts/fixtures/tavern.mjs)。

## 来源映射

上游固定为 `L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323`。下列路径均按该提交核读。

| 来源 | 实际读取与定位 | 归属、完成条件及证据 |
| --- | --- | --- |
| synthetic-fixture | fixtureId + eventId 定位原样例中的阶段，对应酒馆 fixture 的 id 与 stages 首列 | 使用独立测试命名空间；不能进入普通用户历史。工具真实返回图片与剧情合成来源可同时成立 |
| card-history | `GET /api/card-import/sessions/:id/history?after=<revision>` 返回行数组，字段只有 key、action、narrative、resulting_revision。fromCardHistory 用已鉴权 ownerId 和路由 sessionId，加上行 key 与 resulting_revision → revision，返回来源及已保存 narrative | host.resolveOwnerId 从 auth.resolve(sessionToken(request)) 取 ownerId。router 取 c.get('owner')、校验 UUID 和 after。service.history 先校验会话，再按 owner_id、session_id、completed、resulting_revision > after 排序分页，最多 100 行。act 在事务内保存正文、完成状态与递增修订。completed-history 是读取路径给出的证据标签，响应行本身没有 status。无需 saveId / branchId |
| native-turn | 上游 receipt.saveId、idempotencyKey → key、resultingRevision → revision；由授权存档 V3 提供 branchId、parentBranchId、forkRevision。已接受回执还需关联可读取的归档正文。组合键定位原记录 | 仅定义 accepted-archived-text 的扩展输入。归档对照已提交回执，read 限定存档归属；只有结算或尚无正文时等待。root 的父分支为空且 forkRevision 为 0，子分支不能自指，分叉修订不能晚于当前修订。旧版无分支资料、发布正文路径如何接入均留待适配 |

角色卡源码为 [host.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/host.ts)、[router.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/router.ts)、[service.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/card-import/service.ts)。原生路径见 [save.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/packages/contracts/src/save.ts)、[server-turn.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/services/server-turn.ts)、[story-archive.ts](https://github.com/L-core-dev-team/Nine-cloud/blob/cd25360c7929e10f8b2b0fad342fedd943d4f323/apps/api/src/services/story-archive.ts)。

YJ-01 回执公开了 session 与修订 1、2，未给出真实 owner 或 key。离线角色卡对照从该回执取 session，用明确的测试 owner、key 及示意正文验证投影。酒馆从头到尾使用 synthetic-fixture。

## 数据字典

| 记录 | 字段及读取规则 |
| --- | --- |
| Scene | source、sceneId 联合限定稳定地点；name、aliases、parentSceneId（可空）、fixedFeatures 描述地点。别名由维护方指向同一 sceneId，层级只表达关联 |
| Fact | source、value、basis、playerKnown。currentFacts 只接受同一来源事件和修订的 current-story 且玩家已知条目。回忆、计划、传闻、图中细节留在候选层；标注由人或未来提取器提供 |
| Visual | source 与 sceneId、visualVersion 定位快照。people、features 为可见标识集合，timeOfDay、lighting、viewpoint、perspective 记录时间、灯光、视野和人称限制。后续写入方按实质可见变化分配版本，普通对话和复访可重用已有版本 |
| Decision | target 为完整目标快照，reason 为可解释理由。reuse 指定 assetId；generate 无参考；edit 的 reference 固定 assetId、sha256、原 visualVersion、reviewId，change 描述变化，preservePeople / preserveFeatures 明示须保留集合；skip 说明跳过理由。目标版本来自 target |
| Capability | origin 区分 codex-tool、backend、mock、offline；entry 为实际能力入口，verifiedAt 是核查时间，全部未知可为空。generate、referenceEdit、query、cancel、idempotency 均用 supported / unsupported / unknown。样例标记已观察到的生成和单参考编辑，未推断最大参考数量 |
| Attempt | 本地 attemptId 唯一，requestKey 绑定逻辑输入，多次尝试各有独立 ID。capability 固定所用入口，sentAt 为空表示未发出，observedAt 为本地记录时间，localWait 区分 active / stopped。providerRequestId 可空，存在时带 value 和来源。model、seed、usage、cost 均可空。usage 带数量和单位，cost 带 actual / estimate、数额与币种。调用端时间差仅表明观察耗时，模型处理与下载分项未知 |
| Outcome | not-sent（附原因），waiting，unknown（附原因），returned（assetId、摘要），failed 或 refused（附确定原因），cancelled（有能力及远端确认依据）。远端未披露的计费不得填零。记录脱敏摘要与简短原因，不写凭据、带签名的链接或原始响应 |
| Asset | assetId、target 指明归属与来源事件；requestKey、attemptId 可追溯到生成入口。reference 可空，编辑时与计划精确对账。sha256、width、height、format 描述返回内容；storageKey 是持久相对键，尚未保存为 null；invalidated 单独记录失效。review 含 id、status、assessment、basis、reason。人数无法判断用 indeterminate 并保留 pending 或 rejected |
| Access | 由宿主即时提供已授权的来源、authorized 与 observedSha256，文件缺失为 null。执行授权方须查询账户、会话、分支、删除和撤权状态以及存储实际字节。目标是否仍活动由当前视窗的有效呈现许可提供；关闭后重开须核对旧许可是否已经失效 |

## 规则与接入顺序

1. 用 eventKey 在所属 fixture、用户会话或存档分支下定位原事件。classifyDelivery 对照该事件已存的计划。首次 generate / edit 得到 new-request；reuse / skip 为 no-call。同事件规范化输入相同为 duplicate，发生矛盾为 event-conflict。requestKey 编码来源、剧情位置、目标事实/视角与版本、动作及参考内容和保留/变化要求；原因文案不影响出图身份。该键只供本地关联。跨进程唯一约束和人工新尝试由后续实现。
2. 复用先用 reuseEligibility 核对指定资产，再按 displayEligibility 比对归属、文件、审阅、有效目标及可见状态。旧事件产生的图仍可匹配当前视觉；同版本号与不同事实并存会拒绝。编辑改用 referenceEligibility，核对精确参考、审阅记录和两侧须保留特征；原图与目标版本可不同。
3. 发出后超时用 stopWaiting 保留发出时间及未知结果。停止安排由 schedulingEnabled 表达，停止本地等待由 localWait 表达。nextAttemptAction 在未知且查询已获验证并有真实任务标识时允许查询原请求，否则 hold-unknown；没有自动重发分支。明确失败或根本未发出至多进入策略评估；拒绝、确认取消及已返回均终止该尝试。回调、对账、重试上限和退避由真实适配器补证。
4. 迟到回执仍归原尝试。先用 resultLink 和 classifyResult 核对请求、目标、输出摘要、参考链。按 requestKey 和 attemptId 找原收件记录；同一结果只记一次，矛盾回传保留冲突。宿主负责原子提交。deliveryEligibility 再结合 localWait 和当前呈现许可判断能否自动显示。主动复访使用新的访问上下文单独检查已保存资产。
5. historyEligibility 针对**原**归属和当前访问权限单独判断普通历史资格。已失效目标不能抢占视窗；仍在原归属且可读、已接受的资产可以进入原历史。审计保留尝试独立于普通历史。预设跨会话资产须另有获准资产来源和授权范围，本版未开放私人图片跨会话匹配。

契约校验数据形状；关联规则比较记录和宿主提供的访问结果。事实提取、语义审阅、正文真伪、权限真实性、持久化和原子更新需要各自的数据来源或实际运行。实现不读取网络、数据库或图片供应商。
