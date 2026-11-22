# narrative-highlight/2r

隔离、同步、只读的回放入口为 replayHighlights2R(ctx)。沿用 H2 的受信主机约束、逐修订 completed-history 来源校验、规划快照及 S2 画面门禁。新语义候选始终只供文字记录。每轮给出叙事状态、原因、来源证据、截至当时的排名、非发送性的 cadence。资产简称须能唯一解析；未经证实的权益生效不能参加排名。人物代词仅绑定紧邻的单一已核话题，遇到未解析内容即失去该绑定。原文证据以 UTF-16 半开区间定位，库不读语料标签。

具有现有锁定依赖、已编译 packages/contracts/dist 的本地 Node 环境可在根目录运行：

```powershell
node --permission --allow-fs-read=* packages/highlights/h2r/guards.mjs
node --permission --allow-fs-read=* packages/highlights/h2r/evaluate.mjs dev
```

held 使用同一评分器，正式实验在冻结实现提交之后只开启一次。回退时直接调用 packages/highlights/v2/replay.mjs 的 replayHighlightsV2。H2R 没有生产路由、数据库写入或供应商接面。
