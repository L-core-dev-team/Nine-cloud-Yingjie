# YJ-P04-NATIVE-FACT-01｜原生 `move.arrived` 事件固定源码核查

- 日期：2026-11-23（北京时间）。
- 上游：`L-core-dev-team/Nine-cloud@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`，直接读取已连接 GitHub 固定源码；**未执行本地规则引擎、PostgreSQL、浏览器或 API**。
- 映界基线：`codex/yj-p04-scope-contract-01@eae794fc834142b11cc2aa71ffa668881537cc11`。
- 本说明供 [NATIVE-FACT-01 任务书](../task-briefs/YJ-P04-NATIVE-FACT-01.md) 引用；若新分支/版本改变，应再次查上游并记录差异，而不是宣称所有历史版本通用。

## 1. 实证清单

| 上游文件 | 已静态验证的事实 | 设计约束 |
| --- | --- | --- |
| `packages/contracts/src/turn.ts` | `TurnReceiptSchema` 的 `accepted` 版本检查 save、branch(root)、rulesVersion、event source RULES、revision 与 accepted batch 同步；`decision.status` 可为 accepted/rejected/clarify | 反序列化 schema 通过并不等于来自认证宿主；必须从有权限的上游读回 |
| `packages/contracts/src/event.ts` | `DomainEvent` 类型字符串 + 泛用 JSON payload，source 为 RULES/MIGRATION；afterRevision 大于 beforeRevision；branchId 当前默认/限定 root | 不能直接将任意 JSON payload 视为合法 world fact |
| `packages/contracts/src/state-delta.ts` | `StateDeltaSchema` 支持 `timeChange`、可为 null 的 `locationChange{before,after}` 和有 CAS 的 `factChanges` | `locationChange:null` 不代表事件未发生，只代表顶层位置未变化 |
| `packages/domain/src/state-delta.ts` | `applyStateDelta` 检查 `locationChange.before===state.locationId`，应用 facts compare-and-set，更新 locationId/time | 需要受信前态和可复核 reducer，不能从事件名猜测后态 |
| `packages/domain/src/prologue-v1-rules.ts` | `resolveMove` 有 `move.arrived` 到不同世界地点的情况；也有移动子区域/回到当前位置 `move.arrived` 且 `to===state.locationId`；`move.blocked` 是合法失败不迁移地点；`move.bypassed` 可合法到别处；所有 transition payload 有受规则计算的 `stateDelta` | 本试点只白名单世界地点变化的 `move.arrived`；子区域和 bypass 分别归类 |
| `apps/api/src/services/server-turn.ts` | 上游按版本化 RULES 裁定、commitAcceptedTurn 先提交权威状态，之后才可选叙述 | 模型正文不是 RULES 结果的权威替代物 |
| `apps/api/src/services/story-archive.ts` | `retain` 首先校验 accepted receipt 与保存的提交一致，`read` 经 owner/save 读取相应正文，按修订返回 | “正文与 accepted turn 同属请求”不意味着逐句在叙事现实中为真 |
| `apps/api/src/card-import/service.ts` 与映界 `packages/contracts/src/schema.ts` | card-history 只有 completed 文字字段，映界将其标记 `completed-history` | 卡会话不得调用 native adapter 冒充 RULES event |

## 2. 关键反例：同一 `move.arrived` 事件的两种语义

上游 `resolveMove` 中存在：
- 正常从地点 A 前往地点 B：`transition("move.arrived", {from:A,to:B}, before,after)`，`stateDelta.locationChange={before:A,after:B}`；在 accepted success 和状态一致的条件下，可作为世界地点变化的候选正例。
- 从顶层地点的一个 `currentSublocationId` 前往另一个子区域，或返回同一地点的顶层：事件也可能是 `move.arrived`，但 `from===to===state.locationId`，`locationChange=null`，顶层地点不变。这不能确认“到了不同世界地点”，也不能把子区域信息直接塞进 locationId。

还存在 `move.bypassed`：规则可能允许绕过障碍并改变地点，**但它不是此次白名单事件类型**；不能误写为“没有发生移动”。`move.blocked` 属已接受但合法失败的规则回合，地点不变，即使模型正文写“到达”，也不应据此建立新位置事实。

## 3. 接入前要拿到的受信证据

1. 来源：由受认证上游仓储/宿主根据调用者 owner 权限读回 `saveId / idempotencyKey / resultingRevision / current rulesVersion`，不是来自用户提交的任意 receipt JSON。
2. 状态：与同一存档/规则版本的受信前后快照或已提交事件重放一致；正式适配真实仓储须核对 after snapshot 可用性，不能假定 read endpoint 已存在。
3. 语义：单个 `move.arrived` 不足以证明顶层地点变化；`stateDelta.locationChange` 非空并与 A/B 状态一致；涉及子区域的 `facts.currentSublocationId` 必须由单独类型审核。
4. 可见与时间：只按目前已获许可的玩家可知状态交付；禁 future borrowing、跨账号/存档/branch、旧回合倒写；事件与文本关联展示不能自动扩展为梦境/戏中其它事实。
5. 回归：原生事件测试与角色卡 H3-B2S 的两次 FAIL 彼此独立。试点 PASS 最多证明有限的规则事实白名单，无权宣称已经实现可信叙述范围签发。

## 4. 当前不可验证项

`LIVE_AUTHENTICATED_NATIVE_READER_NOT_VERIFIED`、`REAL_STATE_SNAPSHOT_PAIR_NOT_VERIFIED`、`RULE_VERSION_WHITELIST_IMPLEMENTATION_NOT_RUN`、`REAL_ROLECARD_SCOPE_NOT_VERIFIED`、`INDEPENDENT_HUMAN_BLIND_REVIEW_NOT_RUN`。这次没有新增任务分支的代码、合成评估或离线回归。
