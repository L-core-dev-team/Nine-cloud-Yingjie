# YJ-P04-NATIVE-READER-01｜上游历史状态读取源码审查

2026-11-24（北京时间）。固定九霄 `L-core-dev-team/Nine-cloud@f1fe6ea561c5ef4d1ec670b7a406625ce5df774c`；映界 `5952a079ef7472f846a160954ca942df8fe69d71`。通过已连接 GitHub 阅读源码和回执；**没有连接实际游戏 API、数据库、账号或玩家存档。**

## 已核查的能力

| 源码路径及位置 | 可以确认的事实 | 限制 |
| --- | --- | --- |
| `apps/api/src/routes/games.ts` L19–61、L179–184；app/index 的 mountGames/readReceipt 组装 | 条件性挂载按 owner/save/key 的 receipt GET，当前 save GET、story 分页；owner 来自宿主认证 | 外层 revision 是当前读取修订；confirmed 不等于 accepted/success；不是已证历史状态对接口 |
| `apps/api/src/services/npc-memory-turn-transaction.ts` L124–141 | getReceiptForOwner join turn_requests 与 game_saves，按 owner、save、key 并排除 trash | 只读回执，未提供完整历史状态 |
| `apps/api/src/services/authoritative-game.ts` L21–31；`postgres-cloud-save-repository.ts` L162–177、L289–300 | 当前 SaveEnvelope 与最近 accepted receipt，拒绝 local-untrusted-v1；latest receipt 超当前 revision 报错 | 分离查询不等于同一一致性截面，当前 save 不等于旧 R-1/R |
| `packages/db/src/schema.ts` L66–119、L150–179 | game_saves 每个 ID 一条当前 revision/snapshot；turn_requests 保存原回执；turn_events 保存 sequence、save/branch/key、source/version、前后 revision、payload、哈希链 | 已检查表定义中未发现任意 revision 的完整历史状态快照；初态/检查点可用性仍需核查 |
| `apps/api/src/services/npc-memory-turn-transaction.ts` L275–430 | accepted turn 锁定存档后在同一事务保存回执、完整有序事件、可见记忆投影并更新当前 snapshot | 不能据此断言旧完整前态仍被持久化 |
| `packages/db/drizzle/0013_event_integrity_ownership.sql` L5–49；`apps/api/src/services/postgres-server-turn.ts` L25–26 | append-only 事件、previous_hash/event_hash 链、原生 loadSave 校验链 | 链不证明读权限/世界事实/独立目标态，且自洽链不保证尾部完整；必须核对实际回执、序列、目标修订，不可自造链 |
| `packages/domain/src/event-log.ts` L29–70 及 state-delta | replayEvents 从给定受信 SaveEnvelope 按保存顺序重放批次，规则 reducer 检查差量前置条件 | 没有受信初态就不能证明历史；不能从当前 save 和任意旧 receipt 直接制造历史 R-1/R |
| `apps/api/src/services/story-archive.ts` L19–45 | owner/save 的 accepted receipt 和可空正文，按 before 游标分页，有数量和字节限制 | 非独立 turn_events 批次读取与完整历史状态接口 |
| `apps/api/src/services/account-export.ts` L3–12 | 已有 REPEATABLE READ READ ONLY 的多表一致性读取实现，可参考锁/超时/owner 边界 | 包含账号全部数据，非映界最小事实接口；本轮不使用或调用真实导出 |
| `packages/db/pending/0027_narrative_publication.sql` L1–12、L80–92；`apps/api/src/services/narrative-ownership-v2.ts` L10 | pending 叙述上下文方案中有 context/receipt/hints/rendererVersion 的受约束记录 | pending/REVIEW DRAFT 非已部署；context snapshot 不等于完整历史 WorldState；未经授权禁止安装 |

## 映界既有 PASS 的范围

`packages/native-facts/reader.mjs` 用进程内 WeakMap 绑定合成仓储与 owner/save/through；只接受 root 和已授权修订，不信 JSON 自称凭证。它不是跨服务认证或任意同进程插件隔离。

`admission.mjs` 核对完整已接受事件批次、固定 reducer 和 R-1/R 状态；上一专项的 32 条路径、298 修订、60/60 白名单世界地点正例、0 FP/FN 和 138 异常拒绝保持 `NATIVE_FACT_OFFLINE_RULE_ADAPTER_PASS`。验收明确 authority 为 SYNTHETIC_AUTHORITY_FIXTURE，真实 reader NOT_VERIFIED。不能以 100% 合成试点替代真实服务接入。

## 最小下一步建议

- 优先核实真正可读的历史 checkpoint、完整事件与受信目标态，复用现有认证、持久化和重放。
- 若缺历史锚点，优先规划另行批准的新隔离测试存档：实际本地认证、PG 和规则提交，记录创建时可信 checkpoint 及后续提交证据，先证明一个旧回合可受权复读。新测试存档的证据不能补造旧存档。
- 当前状态逆推只是一种待论证设计。delta 有前后值不等于已证历史；需要完整连续日志、固定版本、可逆变更、无旁路写入/迁移和独立核对证据。禁止倒填历史 as-of。
- 必要时提出最小服务端原子前后态证明或 checkpoint 与只读投影，不默认导出完整私人状态；改动与迁移必须另获授权。
- 当前仍 `UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`、`HISTORICAL_STATE_PAIR_NOT_VERIFIED`、PG/Chrome ENV_BLOCKED / NOT_RUN、角色卡 UPSTREAM_AUTHORITY_GAP。旧 PASS/FAIL 与 I2 停止线不变。

以上为固定源静态核对，不宣称全部其他分支或部署均无历史证明能力。本轮仅完成审查和任务准备；没有新的工程测试、实际数据读取或生产接入。
