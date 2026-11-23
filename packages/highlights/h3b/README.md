# narrative-highlight/3b 离线回放

调用 `replayHighlights3B(ctx, suggestNarrativeCandidates)`。省略第二个参数即可只跑证据事务。宿主必须提供可访问、已完成的卡会话正文、逐修订来源和摘要，`replayOnly` 必须为真。回退时直接调用 `../h3a/replay.mjs` 中的 `replayHighlights3A(ctx)`。

## 输入和权限

同步提供方接收冻结的前缀数组，每项仅含 scope、session、revision、sourceKey、narrativeSha256 和 text。当前实现信任执行提供方的本地程序，按不可信数据处理它返回的 JSON 字符串；进程内函数隔离不能保护宿主免受任意恶意 JavaScript。默认不安装或调用任何提供方。生产、网络和持久授权均没有入口。

批次最多 16 项、65,536 个 UTF-16 码元，每项最多 8 个整句引文。类型、字段、ID、时间、来源和边界必须精确匹配。最后一个引文在当前修订。跨修订引文至少共享一个当前原文中的具名实体。该条件只允许把前文带进文本复核；认定事实另需主体角色、客体、证据事务以及双向精确覆盖的来源链。单纯共现和同名不能增加事实权重。任一项无效即整批拒绝，原因可从 `round.proposals.rejection` 读取。

`round.proposals.suggestions` 单列文本假设。可追溯的 `fact` 只能指向同一回合已经独立确认的事实。每条都包含原句、UTF-16 区间和修订。假设没有投票、排名、结算、图像或去重已确认事实的权限。排名、撤销、关系图由宿主根据证据事务生成。视觉建议仅沿用 H3-A 现有证据和已授权的宿主快照，发送标志始终为 false。

## 本地复跑

在仓库根目录，使用已构建的公共契约和 Node 26（含 permission 模式），执行以下命令。Python 记录器将本轮测量写回 H3-B 证据目录；旧版回归使用临时目录。CPU 计时会随机器和负载变化。

```powershell
python packages/highlights/test/h3b/freeze.py
node --permission --allow-fs-read=* packages/highlights/h3b/safety.mjs
node --permission --allow-fs-read=* packages/highlights/h3b/evaluate.mjs dev
node --permission --allow-fs-read=* packages/highlights/h3b/evaluate.mjs held
python -B packages/highlights/h3b/record.py C
python -B packages/highlights/h3b/record.py D
```

历史回放和基准的独立入口为 `historical.mjs` 和 `benchmark.mjs`。冻结语料、协议目录和 oracle 只存在于测试或计分路径。测量中的 oracle 只知道应路由到复核的修订，不能提供独立事实证据。
