# YJ-07 世界书与预设图片运行报告

2026-11-20。在九霄本地普通角色卡会话中，通过已有 HTTP 鉴权、PostgreSQL 来源关系和显式配图许可，实际显示了东村酒馆 V1、V2、V3 的三张已审阅预设图。测试资料由本次合成账号创建。没有使用私人实际世界书、万卡阁素材或图片供应商。

实现提交 [da97633de7c83d0b743d8e5766cb2317867a2cea](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/da97633de7c83d0b743d8e5766cb2317867a2cea)。已回读远端 ref、提交父节点和整树，均与本地 Git 一致。本报告与 08 接续任务书随其后的交接提交交付。

## 工作副本与接入

接手时本地工作树干净，位于 05/06 交接提交 `d9d94833d97568dc25fb55fe8778289bee1e6f0d`。远端 YJ-07 起点为 `bd2f552ba0c0480202c4366a92f0d95d4cb117f8`。逐个核对其三个后继文档提交相对 05/06 的 Git 对象和树后，在本地建立跟踪分支 `codex/yj-07-worldbook-assets`。九霄独立副本保持 `cd25360c7929e10f8b2b0fad342fedd943d4f323`，原件和上游源码未改动。

[来源适配](../../packages/world-assets/sources.mjs) 按照上游 service.ts 的普通卡路径联结角色卡内嵌书、当前卡关联书和创建会话时固定的全局书。宿主先通过原有认证和历史路径校验身份及会话。映界的独立授权行再固定卡/导入版本、书体与条目摘要、地点与父区域、已确认结构、可用素材目录。其他会话即使引用相同导入也需自己的许可。编辑卡产生新版本，已存在会话仍指向自己的卡。挂载点、接口和回退步骤见[模块说明](../../packages/world-assets/README.md)。

[预设目录及匹配器](../../packages/world-assets/index.mjs) 读取仓库内三份 YJ-02 原件。文件大小、PNG 块校验、格式、尺寸、实际 SHA-256 与独立审阅摘要均需相符。sameVisual 核对稳定地点、人数、可见结构、光照、视角及版本。已接受的条目仅提供经审核的地点标签和结构提示，即使同一本书写了未来人物和秘密，也不写回 YJ-04 的场景状态。预设使用会话限定句柄和受限下载路径，无需创建生成任务或伪造供应商记录。

## 当次运行

| 检查 | 结果 |
| --- | --- |
| 改动前九步基线 | 固定 05/06 浏览器用例 1/1；三人、交谈、五人、复访、点灯、关图、失败、恢复、切会话及乱序交付通过 |
| 共享格式与素材 | `npm --prefix packages/contracts test` 编译并通过 10/10；`python docs/reports/evidence/YJ-02/probe.py verify` 通过 3 张原图、2 级参考和 2 个复用阶段 |
| 地点/世界书规则 | 名称变化后仍按 east/东村匹配；同名异地、歧义映射、错误卡导入版本、错误条目、结构不同、无书/无权、空书、未知扩展或有条件条目均有定向断言 |
| 图片资格 | 旧版或错误视角、人物、光照、特征都无法选中。缺图、同大小但摘要损坏、未审、拒绝、失效、使用权不足及目录冲突均有拒绝结果 |
| PostgreSQL 与鉴权 HTTP | 实际通过原宿主导入固定资料并创建会话。所属三类来源可追溯；不相关导入即使误配一条授权也不进入候选。替换全局书后旧会话保持旧快照，新会话读新版。同账号其他会话在单独获准前读不到书体；获准后其句柄与原会话不同 |
| 原件、删除与撤权 | 对临时副本破坏一个字节，旧 URL 返回 404，Chrome 出现校验失败；恢复可信字节后重新显示。撤销授权后旧 URL 返回 404，删除会话或换其他账号返回 403。文字仍能在无授权时提交 |
| 实际页面 | 入店 I0，普通交谈复用 I0；两人到场 I1，离开留空，复访继续 I1，傍晚 I2。核对页面下载的原始字节。页面刷新及独立 Node 进程重开后得到同一合格资源。关图可继续提交文字，开启后重新核验。[浏览器截图](evidence/YJ-07/preset.jpg) |
| 整体回归 | 同一模块组合中 YJ-04 三组、YJ-05 两组、YJ-05/06 原浏览器一组、YJ-07 三组，共 9/9，0 失败、0 跳过。05/06 浏览器仍有 16 个决策、9 次本地模拟发送。07 预设流程图片任务 0、发送 0。真实文字/图片模型调用均为 0 |

## 复跑与证据

环境为 Windows、Node 26.13.0、PostgreSQL 18.4、Chrome 157.0.8103.79。使用固定九霄副本的已构建 API、Vite、Playwright、本地角色卡演示库。准备 NINE_CLOUD_ROOT、CARD_DEMO_POSTGRES_BIN、CHROME_PATH 的步骤见[运行说明](../../packages/image-tasks/README.md)。从映界根目录运行：

```powershell
npm --prefix packages/contracts test
python docs/reports/evidence/YJ-02/probe.py verify
node packages/scene-state/test/verify-local.mjs packages/scene-state/test/live-card.test.mjs packages/scene-state/test/persistence.test.mjs packages/image-tasks/test/recovery.test.mjs packages/ui-shell/test/browser.test.mjs packages/world-assets/test/matching.test.mjs packages/world-assets/test/live.test.mjs
```

[定向断言](../../packages/world-assets/test/matching.test.mjs) · [鉴权与浏览器链路](../../packages/world-assets/test/live.test.mjs) · [新进程恢复探针](../../packages/world-assets/test/restart.mjs) · [脱敏运行回执](evidence/YJ-07/run.json)

## 验证边界与下一步

普通会话的来源关联和鉴权是在真正的本地九霄宿主上验证的。书体、正文、授予的地点映射和素材许可均限定于合成演示。上游完整世界书触发器继续服务文字；本轮仅允许确定性常量条目用于地点资料。未测试私人真实世界书、复杂规则视觉映射、群聊、原生存档、手机真机、生产授权配置或真实图片服务。

[下一阶段接续任务书](../task-briefs/YJ-08-first-play-integration.md) 给出可独立执行的正文标注/提取对照、预设与动态选择、回环宿主整合断言，并单列真实供应商测试所需的 API 授权、额度、协议和审阅条件。
