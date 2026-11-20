# 图片任务与本地映界入口

需要 Node 24 或更高版本、已编译的契约 0.1.1 和宿主提供的 pg.Pool。演示使用固定的九霄本地开发副本，准备条件见 [YJ-04 说明](../scene-state/README.md)。底层模块入口为 [ImageTasks](index.mjs)，本地装配和浏览器入口见 [withHost](../ui-shell/test/host.mjs) 与 [挂载插件](../ui-shell/mount.mjs)。

## 存储和调度

在映界专用数据库中依次执行 [场景 SQL](../scene-state/schema.sql) 和[任务 SQL](schema.sql)。原件目录放在 Web 静态目录外，由单独的服务身份管理。同一集群上的多个工作进程须连接同一数据库、共享同一原件目录。每个公开入口先向宿主取当前身份和普通会话访问权，再从 YJ-04 读取 ready 快照。内部 review、receive 与数据库接口只供受信服务调用。

1. 用 `new ImageTasks(pool,new Originals(privateDirectory),provider)` 装配。Provider 提供公共 Capability 和异步 send，接收已记录的 attempt、plan、经核对的参考原件。示范 Provider 仅读取三个受控的旧 PNG。
2. 主动视图通过 permit 注册生图选择，单调递增的序号防止过期开关覆盖新选择。submit 消费 Decision，以 eventKey 唯一保存。重复输入复用原记录，冲突保留原件并新增摘要。reuse 和 skip 没有图片尝试。
3. dispatch 重新验证当前上下文，锁许可与任务，复核能力、视觉和参考图，然后提交尝试。sentAt 记录进入可能送达的发送边界。提交完成后才调用 Provider。未获发送资格时 sentAt 为空。进程死于此边界后的任何位置，都不能单凭本地时间戳证明供应商已收到请求。
4. recover 将过期等待移入 unknown。可在宿主启动、定时检查或视图查询时执行。只有明确 failed 或 not-sent 且调用方指定 retry 才新建尝试。未知重放不发请求。当前示范没有远端查询或取消能力。
5. receive 根据原 attemptId 和 requestKey 入账。PNG 有大小、尺寸、签名与块 CRC 检查，先写唯一临时文件、同步文件、改名并回读核对 SHA-256，再在同一数据库事务中写入待审资产和回执。重复一致回执只记一次。冲突记录可按 task/kind/digest 对账。缺失的费用、模型、远端 ID 和用量保持 null。
6. 展示和参考编辑均重新核验归属、审阅、文件与目标。固定样例审阅仅批准 YJ-02 已有摘要和标注目标。关闭生图会停止该视图的等待交付；迟到原件仍可存回原尝试。原件不能反向写入文字或地点事实。

## 运行与回退

在映界仓库根运行。测试宿主仅监听回环随机端口；需要已安装的本地九霄角色卡 PG、已构建的 apps/api/dist、上游 Vite 与 Playwright。CHROME_PATH 可指向本机 Chrome；省略时使用 Playwright 自带 Chromium。合成账号、卡和会话通过九霄已有测试库创建。映界状态使用每次新建的测试数据库和私有临时目录，退出时只清理当次创建的资源。

```powershell
$env:NINE_CLOUD_ROOT = '<固定九霄 cd25360 的完整副本>'
$env:CARD_DEMO_POSTGRES_BIN = '<本地 PostgreSQL bin 目录>'
$env:CHROME_PATH = '<本机 Chrome 可执行文件>'
npm ci --prefix packages/contracts
npm --prefix packages/contracts test
python docs/reports/evidence/YJ-02/probe.py verify
node packages/scene-state/test/verify-local.mjs packages/scene-state/test/live-card.test.mjs packages/scene-state/test/persistence.test.mjs packages/image-tasks/test/recovery.test.mjs packages/ui-shell/test/browser.test.mjs
```

可选环境变量 YJ_EVIDENCE_DIR 指定浏览器截图输出目录。手动体验时先启动相同的本地 PG，然后运行 `node packages/ui-shell/demo.mjs`。浏览器会打开已登录的合成普通会话。点击“进入映界”，按控制台列出的行动游玩。关闭标签页结束该次演示。固定标注以外的正文保留为未就绪。

停用时移除 Vite 插件及宿主 mountDemoRoutes 调用，九霄角色卡继续沿原路径工作。真实业务数据的回退优先停写、保留映界独立库与原件备份。测试库由创建器回收。离线停写后运行 `await files.audit(pool)`，broken 为应从受信备份恢复的资产，unreferenced 包含孤儿及临时文件，核对数据库备份后可隔离。内容相同的资产可能共用磁盘原件，勿按单条任务删除文件。此轮覆盖进程中断；断电、跨主机对象存储、备份演练及生产数据库迁移另行验证。
