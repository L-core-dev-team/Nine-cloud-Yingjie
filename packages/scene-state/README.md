# 场景状态模块

Node ESM 入口为 [index.mjs](index.mjs) 的 `syncCardHistory`。宿主传入独立映界库的 pg.Pool、绑定九霄受信 origin 与当前凭据的 request、选中会话 UUID 和该次呈现的 AbortSignal。函数通过原有 `/api/auth/session` 取得 owner，固定账户提示，核对会话详情的 owner_id/id/revision；只有 group 路由明确返回 409 / NOT_GROUP_SESSION 才读取普通 history。返回前再次检查访问权。宿主在切换账户、会话、关闭视图时取消原 signal，展示时继续检查同一 signal。内部 store 的查询仅供可信服务、运维和测试使用。

```js
import { syncCardHistory } from "./packages/scene-state/index.mjs";

const snapshot = await syncCardHistory({
  pool: scenePool, request: authenticatedNineCloudRequest,
  sessionId, signal: currentView.signal, extract: annotateSavedText
});
if (!currentView.signal.aborted) render(snapshot.result);
```

`result` 为 ready（含已校验的 Scene、Visual、Decision）或 not-ready（含 reason，已定位时可含 Scene）。默认 Decision 为 skip，含义是本模块已保存状态、由后续模块决定出图。首次历史为空时修订为 0。接口返回裸数组，每页最多 100；消费截至首次授权详情给出的修订，成功提交后才推进 after。读取中有新修订时，当前呈现得到 new-history-available，下一次调用接续。出错抛给宿主，宿主应保留原因并停止使用旧视图结果。

## 提取与地点

`extract({source,narrative,action})` 返回按顺序排列的观察，每项是 `{basis, playerKnown, operation}`。action 是玩家输入；提取者须用已保存 narrative 判断行动是否已发生。运行时依照公共事实契约过滤来源类型和玩家可知范围。地点操作包括 create（明确的新 sceneId、name、parentSceneId、fixedFeatures）、visit（明确的 sceneId，或名称/别名和可选父地点）、leave、unknown 和 rename。改名保留旧别名。复访需要明确的状态延续依据 confirmedContinuity，缺少依据或名称有歧义时返回未就绪。sceneId 在来源归属内稳定，同名本身不能创建或合并地点。

可见变化用 set、add、remove。人物、特征集合需要明确基线，删除依赖显式离开或有依据的全量重述。每名仍在场的人、每个特征和各标量保留最后确认来源。地点的 fixedFeatures 是建档时的结构描述，当前画面读取 Visual.features。地点身份和当前位置独立保存。按整条事件最终事实一次性分配该地点的新版本；只改称呼或讲述其他地方不会增加版本。日志保留前一版本和新快照。人物、时间、灯光、视角等信息缺失时可保存部分状态，直到具备输出 Visual 的依据。[可执行的合成标注](test/tavern.mjs)

空数组代表提取器确认没有当前变化。未提供提取器时，模块记录来源并返回未定位，原因是缺少已确认事实。返回 null 或抛错代表尚待处理，事务回滚，补充标注后重新同步同一事件。修正已经消费的历史标注时，在空的独立投影库里以同一可信历史和修订后的提取器重建，核对结果后切换消费者。

## PostgreSQL 安装、重放和回滚

先构建契约包。在专用于映界的 PostgreSQL 数据库内执行 [schema.sql](schema.sql)。测试程序会在本地角色卡开发集群创建随机命名的独立测试库并执行这份 SQL。运行模块的连接池只需该投影 schema 的读写权限。场景模块复用宿主提供的 pg 驱动和契约构建物，没有新增 npm 依赖或修改上游表结构。

stream 按归属存储修订、当前位置与地点集合；event 按修订、eventKey 双重唯一保存脱敏对账摘要、来源、有效操作、视觉版本变化与当次可读结果。每次消费先锁定当前归属的 stream 行，再从数据库已有状态应用事件。在同一个 PostgreSQL 事务中写日志、状态和检查点。冲突单独记录于 conflict。重复输入返回 duplicate，同 key 改内容/修订、修订碰撞、缺口或不升序页面有明确错误。失败后从最后一次成功修订再读，源提供者应先处理矛盾记录。消费重放保留首次已提交的标注。

逻辑摘要为 SHA-256(UTF-8(JSON.stringify([eventKey, revision, 原 action, 原 narrative])))。另存原 narrative 字符串和 trim 后字符串各自的 UTF-8 SHA-256。这两者都基于 JSON 解码后的字段。HTTP 报文字节、私人正文、Cookie 和认证头不写入摘要日志。场景日志包含必要的可见事实，仍须限制服务端访问。画面 requestKey 的公共语义沿用契约包。

回滚应用接入时停用该模块入口即可。保留独立投影库可继续复跑或审计；一次性测试库由创建它的测试进程清理。生产宿主装配、运营数据迁移和删除策略留待联调。当前每个归属锁一行、加载该归属地点集合；大型历史的存储分区和负载尚未实测。

## 复跑

使用 YJ-01 已初始化的本地测试环境，固定九霄提交 `cd25360c7929e10f8b2b0fad342fedd943d4f323`，保留已构建的 apps/api/dist、pg 驱动和 .cards-local 安装。以下命令从映界仓库根运行。已有运行中的该测试集群可省略 CARD_DEMO_POSTGRES_BIN；指定目录时脚本按需启动本机回环 PostgreSQL 并在结束时停止自己启动的实例。

```powershell
npm ci --prefix packages/contracts
npm --prefix packages/contracts test
$env:NINE_CLOUD_ROOT = '<已就绪的固定九霄副本>'
$env:CARD_DEMO_POSTGRES_BIN = '<本地 PostgreSQL bin 目录>'
node packages/scene-state/test/verify-local.mjs
```

真实读取验证使用本地 Hono HTTP 监听和上游现有账号、角色卡、模拟文字服务。它会在九霄测试数据库中创建合成测试账号、卡、会话和一条已完成行动。其他用例用独立的合成事件/分页响应验证状态规则，在实际 PostgreSQL 上运行；子进程间不传递内存快照。[脱敏运行回执](../../docs/reports/evidence/YJ-04-local-run.json)
