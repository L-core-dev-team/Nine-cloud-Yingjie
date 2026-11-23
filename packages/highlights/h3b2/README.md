# narrative-highlight/3b2 离线回放

**研究验收 FAIL。** 一条跨回合梦境仍被确认为现实事件。入口仅供隔离回放，生产默认路径未导入本包。回退使用 `replayHighlights3B(ctx, provider)` 或 `replayHighlights3A(ctx)`。[研究报告](../../../docs/reports/YJ-P04-H3B2-proposition-grounding-report.md)

`replayHighlights3B2(ctx)` 在已授权的完成历史上运行固定本地提议器。`"none"` 是无提供方对照。`replayHighlights3B2(ctx, "data", tape)` 接收按修订排列的 JSON 字符串数组的序列化文本。每个元素是该修订的一个命题批次。入口不执行提供者代码；外部供应商执行隔离 NOT_VERIFIED。提议器最多读取最近 64 个修订、65,536 个 UTF-16 码元，批次最多 12 项。坏批次整个拒绝。独立核验器可以审阅完整授权前史。

命题包含施事、对方、标的、前态、后态、极性、叙述来源、时间、限定条件与整句引文。审阅记录在 `round.grounding`，依次区分来源合法、后果陈述、整条命题成立、当前生效及因果。新语义事实与边在同一草稿发布；待核文本没有事实写权限。到账只支持账户收到款项，登记或共有不能推出个人份额。新增语义事实只给出文本建议，所有发送标志为 false。

识别到跨回合虚构或转述后，缺少叙述范围身份的旧事务被隔离。明确回到现实后，需本段内的独立前件与结果才可发布新语义事件。无法识别范围声明的风险见研究报告。

## 复跑

使用 Node 26、Python 3 和已编译的公共契约，在仓库根目录执行。新工作树可先创建 `packages/contracts/dist`，用锁文件一致的本地 TypeScript 编译契约。所有预留组现在均已公开。回归会更新修复后回执与计时，独立工作树可以保留原字节。

```powershell
node --permission --allow-fs-read=* packages/highlights/h3b2/safety.mjs
node --permission --allow-fs-read=* packages/highlights/h3b2/discourse-audit.mjs
node --permission --allow-fs-read=* packages/highlights/h3b2/scope-controls.mjs
node --permission --allow-fs-read=* packages/highlights/h3b2/measure.mjs --split=dev > ../repeat-dev.json
node --permission --allow-fs-read=* packages/highlights/h3b2/measure.mjs --split=held > ../repeat-public.json
node --permission --allow-fs-read=* packages/highlights/h3b2/measure.mjs --split=reserve > ../repeat-reserve.json
python -B packages/highlights/h3b2/receipts.py ../repeat-dev.json ../repeat-public.json --reserve ../repeat-reserve.json
python -B packages/highlights/h3b2/regression.py --repair
python -B packages/highlights/h3b2/accept.py
```

最后一条命令在此版如实退出 1。旧 H3-B/H3-A 兼容回归的输出写入临时目录。
