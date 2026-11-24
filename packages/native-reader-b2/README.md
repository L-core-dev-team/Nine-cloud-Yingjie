# B2 测试宿主

入口在独立工作目录使用九霄 Git 对象、现有锁定依赖和新建的临时 PG。规则构建需要九霄本机依赖中的 esbuild、zod、js-tiktoken 和 base64-js，以及 TypeScript 6.0.2 编译器 API。下例使用映界 contracts 已安装的锁定版本。构建目录必须是新目录。命令从映界仓库根目录执行。

```powershell
python -B packages/native-reader-b2/test/prepare.py ../Nine-cloud packages/contracts/node_modules/typescript ../b2-runtime-new
$env:NODE_ENV='test'
node packages/native-reader-b2/test/rule-gate.mjs ../b2-runtime-new
node packages/native-reader-b2/test/imports.mjs ../b2-runtime-new
python -B packages/native-facts/test/prepare.py ../Nine-cloud ../b2-regression-new
node --permission --allow-fs-read=* packages/native-reader-b2/test/verifier.mjs ../b2-regression-new
```

在受管会话中经官方机制获准本机回环连接后，从同一目录运行下列命令。最后一个参数指向本机 PostgreSQL 原生工具目录。启动器会复查原探针，随后创建新集群。读证与知识截点使用仅在测试期间监听的本机 HTTP 端口；认证、存档创建及原生规则提交调用固定版本上游服务。退出 0 表示矩阵全部通过，退出 2 表示已运行但仍有上游依赖，失败断言退出 1。本次 40 项通过、2 项依赖，详见[逐例回执](../../docs/reports/evidence/YJ-P04-NATIVE-READER-B2/resume/final.json)。

```powershell
python -B packages/native-reader-b2/test/launch.py ../Nine-cloud ../b2-runtime-new "C:/path/to/postgresql/bin"
```

启动器独立初始化临时集群，使用固定提交普通迁移 journal、新随机库名、受限应用角色及本地验证码收件器。它只向刚创建的集群注入内部生成的连接参数。结束时关闭连接和独立实例，核对路径后清理本次临时目录。原生历史正例经实际认证和上游服务方法执行。驱动保留原有认证冷却时间，脚本的正例输出不等于完整矩阵通过。当前可实际复现的结果见[运行报告](../../docs/reports/YJ-P04-NATIVE-READER-B2-report.md)。

宿主把新建的两个 owner/save 绑定到进程内只追加捕获表。R0 与正常创建结果比对；后续每次提交后读取独立 PG 快照和批次端点。读请求只含 saveId、root、请求键和目标修订。认证服务解析会话；历史重放在一个 REPEATABLE READ READ ONLY 事务中进行。通过后再用新的 SQL 语句同时检查实际 session、有效期、owner、账号关闭与存档回收状态，权限截点是这条语句的快照。重复读取也经过此过程。完整正文、状态、邮箱和凭据均留在宿主内。返回的位置事实带首次学到的时间及修订，只能追加至那个时点。工厂及捕获方法只给受信测试代码，无生产路由或持久化缓存。

回退时停用测试启动器并丢弃进程内证据。测试机上仍有进程时，只能停止本轮创建且已核实数据目录的实例。已验收之前的玩家存档、原生游戏或角色卡均不经过此入口。
