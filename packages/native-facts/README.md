# 原生世界地点研究回放

`admission.mjs` 导出 `createNativeFactReplay(reader)`。研究宿主安装本次离线使用的固定规则和按权限、修订索引的仓储，获得进程内 reader，再用 `inspect({save, branch, key, r})` 读取一笔已经完成的合成回合。研究用凭证按对象身份绑定到私有 WeakMap。调用者提供的 JSON、角色卡历史和正文没有签发能力。签发工厂是受信组装代码；对于可任意执行 JavaScript 的同进程插件，此方案不构成进程隔离。当前唯一提供的宿主是测试假对象。

每次查询重新核对读权限，返回 `status`、`reason`、本次新入账数量 `added`、证据列表、`sceneEligible:false` 和 `send:false`。同一请求可再次查看同一事实，`added` 为 0。单回放实例使用内存账本；跨实例从历史资料确定性重建，不设持久发送队列或数据库。

## 离线复跑

从映界仓库根目录执行，Node 26、Python 3、本机已准备好固定 Git 对象和相应的公开依赖。第一条命令使用系统临时工作之外的一个**全新**输出目录，`../Nine-cloud` 替换为已有的九霄本地 Git 仓库。构建读取钉住提交的 Git 对象，不依赖上游当前检出分支，也不执行上游服务。它从该仓库已有的 node_modules 使用 esbuild 和锁定的 zod，不做安装。本次数据版本、工具版本和校验值见[运行次序](../../docs/reports/evidence/YJ-P04-NATIVE-FACT-01/run-order.json)。

```powershell
python -B packages/native-facts/test/prepare.py ../Nine-cloud ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/guards.mjs ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/measure.mjs dev ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/measure.mjs held ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/prefix.mjs ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/extra-controls.mjs ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/examples.mjs ../native-replay-runtime
node --permission --allow-fs-read=* packages/native-facts/test/bench.mjs ../native-replay-runtime 1000
python -B packages/native-facts/test/regression.py ../native-regression-rerun
python -B packages/native-facts/test/accept.py
```

预留组首次正式计分已完成，以上重复计分属于公开回归。性能程序支持 20、100、300 和 1000。历史驱动器还需要映界 contracts 的锁定依赖与现有构建产物。将历史驱动器输出定向到自己的目录；它在临时副本中复现旧门禁，预期的红灯退出码为 1。最后一条命令只读核验本分支正式回执。

## 回退

研究调用者移除 `createNativeFactReplay` 的显式调用并丢弃派生内存缓存即可。既有存档、schema、宿主生产路由与视觉发送均没有迁移或开关要恢复。真实读取仍为 `UPSTREAM_AUTHENTICATED_READER_NOT_VERIFIED`。[运行报告](../../docs/reports/YJ-P04-NATIVE-FACT-01-report.md)
