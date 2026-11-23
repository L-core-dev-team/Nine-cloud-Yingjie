# 叙述作用域隔离回放

入口为 `replayHighlights3B2S(ctx, wire = null)`。需要已有的有权读取的合成 completed-history 上下文以及 `replayOnly:true`。默认在进程内发现候选。可选 wire 是按修订排列的 JSON 字符串数组的序列化文本。宿主核对来源后，回放器独立解释作用域。调用者不能设置可信叙述层。返回的候选、现实账本变更、排名及范围过渡仅供研究。当前验收为 **FAIL**。

从仓库根目录运行。使用本仓库锁定版本已构建的 contracts 及其已有依赖。在 Windows 使用 PowerShell 7，在其他平台用普通终端也可以逐项执行。

```powershell
node --permission --allow-fs-read=* packages/highlights/h3b2s/safety.mjs
node --permission --allow-fs-read=* packages/highlights/h3b2s/measure.mjs --split=dev
node --permission --allow-fs-read=* packages/highlights/h3b2s/measure.mjs --split=held
node --permission --allow-fs-read=* packages/highlights/h3b2s/prefix.mjs
node --permission --allow-fs-read=* packages/highlights/h3b2s/diagnostic.mjs
node --permission --allow-fs-read=* packages/highlights/h3b2s/bench.mjs
python -B packages/highlights/h3b2s/compat.py ../h3b2s-compat-rerun
```

`diagnostic.mjs` 预期输出一条错误入账并退出 1。其余上述命令本次退出 0。旧 H2R 和 H3-B2 的预期红灯单独记录在兼容回执。评分快照已公开，此后复跑只能算公开回归。原始证据目录请留存，常规复跑将标准输出另存到自己的临时目录即可。兼容脚本会将历史验收工件复制到临时位置，再运行原验收程序。

[冻结协议](../test/h3b2s/README.md) · [运行报告](../../../docs/reports/YJ-P04-H3B2S-narrative-scope-safety-report.md)

回退时让离线研究调用者重新导入 `../h3b/replay.mjs` 中的 `replayHighlights3B`，或 `../h3a/replay.mjs` 中的 `replayHighlights3A`。重建所选版本的内存回放结果。无需更改数据库或恢复任何模型许可。旧 `../h3b2/replay.mjs` 可用于复现已记录的 FAIL。

只读核验本次正式结果可运行 `python -B packages/highlights/h3b2s/verify.py`。完整性核对成功后会打印 `Evidence integrity verified`，随后按安全门禁返回退出码 1。[审计提交](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/5be57215df9c9b53d3915f413f64cad2895d8846)
