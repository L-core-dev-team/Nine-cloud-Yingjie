# 剧情高光回放 · H1

在已有 contracts 锁定依赖与编译产物的仓库根运行。示例只加载项目自编合成正文，可指定故事名与截止修订。输出包含事件表、证据边、HighlightCandidate 和截至该修订的三种排名。

```powershell
node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
node --permission --allow-fs-read=* packages/highlights/demo.mjs 两条线 5
node --permission --allow-fs-read=* packages/highlights/evaluate.mjs
node --permission --allow-fs-read=* packages/highlights/benchmark.mjs
```

如需另存评估回执，给 Node 一个已存在输出目录的写权限，并将一个新文件名传给 evaluate.mjs。回放接口 `replayHighlights(ctx)` 供可信宿主在进程内调用。宿主须先取得账户对**整个指定会话前缀**的读取权限，再提供从第 1 条连续到当前修订的已完成历史、对应的独立读取回执和受信地点目录，显式设置 `replayOnly: true`。授权撤回或历史有缺口时停止。客户端自报 authorized 或自算摘要不能充当授权。此原型没有网络端点、数据库写入或模型适配器。

- `events` 记录事件类型、参与者和对象。证据保留原修订、来源 key、正文摘要、原句和 UTF-16 半开区间，按原始正文切片可还原。
- `edges` 通过事件 ID 连接铺垫、选择、后果、兑现、复述及已识别的更正。局部的无主语后果须紧邻同一已知事件。延迟归还须指向唯一尚未完成的已见目标。相同人物或地点本身不足以建立因果。
- `rounds` 给出每修订的分类及判定依据状态。ordinary 中会区分有证据的背景、明确复述、非现场语境和未识别表达。后者可能包含漏判。
- `HighlightCandidate/1` 包含故事线锚点、类型、等级、可解释分数、证据链及视觉导演意见。排名位于 `rankings`，以 candidate.id 关联；分别比较整个已读前缀、最近四个修订和同目标故事线。分数源自已满足的因果条件，未校准为概率。同分先排较早修订，再按证据偏移。
- `visual.status` 为 hold 或 director-review。已见选择、内在关系变化、无法映射到可信可见事实的结果均可保留文字候选。当前版本只让剧情已确认、场景中独立核实的赴约到场进入导演复核；send 恒为 false。同一事件重述有独立审计，可见版本另行去重。回放输出可能含原文，只应在原授权范围内使用。

[结果、误例与局限](../../docs/reports/YJ-P04-H1-highlight-replay-report.md) · [四项开源评估](../../docs/reports/YJ-P04-H1-open-source-assessment.md)
