# 会话世界书与已审阅预设图

[WorldAssets](index.mjs) 在 Node 宿主内运行。宿主传入九霄的只读查询能力、映界投影连接池，以及同一九霄版本的 selectWorldbookEntries。调用 resolve 时传入已经过身份、普通会话与历史权限核验的 YJ-04 上下文。浏览器只向同源宿主提交视图选择，不提供 owner、importId、文件路径或授权行。

## 资料来源和授权

[readSources](sources.mjs) 从会话固定的 card_id 追溯三类关系：该卡导入的 character_book、该卡 links 的世界书、会话创建时已写入 session_worldbooks 的全局书。SQL 限制 owner、session、当前修订及普通卡模式。与同一导入存在多条关系时保留各自的来源依据。上游维护的全局开关及其他卡的导入列表不参与读取。

在映界数据库应用 [schema.sql](schema.sql)。由受信宿主为已核准来源写入 binding；公开宿主没有建授权、改授权或审阅路由。每行固定会话 scope、卡版本 ID、导入 ID/原件摘要、解析后世界书及条目摘要、稳定地点及父区域、素材目录、经审阅的标签/固定结构提示和授权依据。来源关系与授权须同时成立；数据库只将获准卡和导入版本的书体传回适配器。九霄的导入确认记录用于导入流程，单独的映界授权决定能否用于配图。删除授权行后，下一次读视图和原件都会重查。原件响应使用 private, no-store。

摘要对解析后文档按键排序、保留数组次序计算 SHA-256。它标识该版本的内容；不会把上游选择结果的序号作为条目 ID。本地适配仅支持常量文字描述，可使用空键列表和 enabled。遇到条件、递归、概率、未知扩展或上游校验失败，返回 unsupported-rule。普通文字会话仍使用上游原有选择器及规则。标注过的地点与父区域、受信条目摘要和已确认的结构共同决定匹配；改名沿用稳定 ID，同名不构成地点关联。前端只接收经授权的标签。世界书原文和传闻不写入 Visual。

## 图片与接口

固定目录 yj02-reviewed-tavern-v1 只允许在明确授权的合成酒馆会话中使用。每一项关联 YJ-02 的运行/审阅记录和独立固定的审阅摘要。使用 0.1.1 的 sameVisual 对照人员、特征、时间、灯光、视角及版本；按文件名白名单、大小、格式、尺寸、块 CRC 和 SHA-256 回读原件。每次显示句柄绑定当前归属、地点、版本、来源和原件。预设资源没有图片供应商 attempt，不写入 05 的任务或生成资产表。没有匹配或没有权利时，预设模式留空。

在 06 面板“画面来源”中选择“世界书预设”。视图接口在原路径附加 source=preset，原件走同一会话的 /preset/<handle>，两者沿用已有 view/seq 许可。响应状态包括 matched 对应的 display、no-match、not-ready、ambiguous 和 disabled；reason 区分 no-worldbook、no-grant、book-version、entry-inactive、不同地点、画面不符、未通过审阅、缺图与损坏等。客户端用异步视图的来源和修订核对响应。该演示的开关关闭时隐藏图片并停止调度。用户明确切换到本地模拟图片任务后，沿用 05 的原有演练；预设模式不会自动转发请求。

## 运行与回退

使用 [05 环境准备](../image-tasks/README.md) 中固定的上游副本和本地测试集群。契约包先构建。从映界根运行：

```powershell
node --test packages/world-assets/test/matching.test.mjs
node packages/scene-state/test/verify-local.mjs packages/world-assets/test/live.test.mjs
```

可选环境变量 YJ07_EVIDENCE_DIR 指定预设截图目录。手动体验时，在相同 PG 已运行的环境执行 `node packages/ui-shell/demo.mjs`。演示为新建的合成账号导入三类测试书并设置本会话配图授权，默认选择预设，可切换到本地图片任务。一次性映界数据库和临时原件由测试工具清理。九霄原有测试账号与导入按原本地宿主管理。

回退时移除预设模式的宿主装配和面板选项，或在独立工作副本切回 05/06 交接提交 d9d9483。现场停用某项权利只需撤销对应 binding，保留原图和既有文字存档。生产身份与数据库最小权限配置、授权管理、正式素材审阅和批量匹配仍待集成。
