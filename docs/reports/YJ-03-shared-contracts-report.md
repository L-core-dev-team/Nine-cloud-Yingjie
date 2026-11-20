# YJ-03 共用数据契约与离线验证报告

2026-11-20（北京时间） · 工程检查已通过 · `@yingjie/contracts@0.1.0` · wire `schemaVersion: "0.1"`

## 接手与交付

| 对象 | 实际核查 |
| --- | --- |
| 映界接续分支 | `codex/yj-03-shared-contracts`。接手时 GitHub ref 为 `e0b16bcdb8cd2edce87c64617b87fda1c1e98d60`，与指定任务书提交相同，父提交为 YJ-02 的 `13ac86a0c4a130780123cb5ed1768db6c5b43603` |
| 工作区 | 本次聊天目录起初无 Git 仓库。核对上一轮 YJ-02 副本分支、HEAD 和干净状态，复制为隔离副本；Git CLI HTTPS 凭据助手在沙箱中无法完成克隆。经已连接 GitHub 读取增量文件，按 Git 对象还原任务分支，提交及整树均与远端一致（树 `5901f7e6991c8191a5806ae3e3b609fa729a65c8`），开始实现前工作区干净 |
| 上游 | 只读核查 `L-core-dev-team/Nine-cloud@cd25360c7929e10f8b2b0fad342fedd943d4f323` 的角色卡身份、路由、历史 SQL、提交事务、原生存档/回执/故事归档，以及包配置与锁文件。准确路径与字段见[来源映射](../contracts/visual-contracts-v0.1.md) |
| 实现提交 | [5463c96eae5996a69bcc61b5887c6c3d50f8b3e9](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/5463c96eae5996a69bcc61b5887c6c3d50f8b3e9)，本地整树与远端一致。GitHub Git Data 按原 HEAD 快进更新任务分支并回读 ref；交接记录随后追加到同一分支 |

[契约包](../../packages/contracts)导出 Zod schema、TypeScript 类型和纯函数。构建使用九霄锁文件内已有的 TypeScript 6.0.2（上游 compiler-api 版本），运行时采用同版 Zod 4.6.6。上游主编译器为 TypeScript 7.0.2。此处选择无需平台二进制包的 6.0.2 编译小型独立包，使用 Node 内建测试器。仅在包目录增加 npm 锁文件；未增加仓库根依赖或部署服务。

## 已执行的检查

Windows，Node 26.13.0，npm 11.20.0。首次安装已取得锁定的两个依赖，其 SHA-512 与上游 pnpm 锁相符。随后仅使用已填充的本地 npm 缓存执行冻结安装和离线测试。以下命令在映界仓库根运行。

| 命令 | 结果 |
| --- | --- |
| `npm ci --prefix packages/contracts`（设置 npm 离线缓存） | PASS，退出 0，按锁文件安装 2 个包 |
| `npm --prefix packages/contracts test` | PASS，退出 0。包含严格 TS 编译、生成声明、从包公开入口导入、8 组测试，失败 0、跳过 0 |
| `python docs/reports/evidence/YJ-02/probe.py verify` | PASS，退出 0。独立读取三张原 PNG 的字节、尺寸与 SHA-256，复核两次编辑的参考链及两处复用 |
| `git diff --exit-code 13ac86a0c4a130780123cb5ed1768db6c5b43603 -- docs/reports/evidence` | PASS，退出 0。YJ-01/YJ-02 原证据未改动 |

| 边界 | 离线检查结果 |
| --- | --- |
| C01、C02、版本与必填 | 已完成角色卡投影可用，拒绝 pending 行、空正文、缺修订、伪分支、来源误标和未知 schemaVersion。原生只有结算不能充当已归档正文 |
| C03–C05 | S0 生成 V1/I0；S1 复用 I0；S2 从 I0 编辑到 V2/I1；S3A 复访恢复 I1；S3B 从 I1 编辑到 V3/I2。复用不建立尝试。以 I0 冒充 I1 被拒，即使同时改参考 ID，缺少两名要保留的旅人也会被拒 |
| C06、C07 | 所有者、会话、分支、地点、撤权、三类审阅状态、人数无法判断、失效、缺文件和摘要损坏均有对照。fixture 图片不能进入普通用户历史 |
| C08、C09 | 旧修订在同一可见状态可显示；状态改变、离开会话、关闭呈现或本地停止等待后，迟到结果仍可对账，不能自动占用当前视窗 |
| C10、C11 | 事件重投及结果重传可判重；变更参考或冲突内容可识别。未知结果仅在验证支持查询且有标识时可查原请求；缺标识、unknown、unsupported 均保留未知。模拟本地关闭无法通过远端取消确认 |
| C12 | 显式标注的当前已知正文事实可入选；回忆、计划、传闻、未知信息、图片额外光点及其他事件均被过滤。未运行自动语义识别 |

[正例及证据索引](../../packages/contracts/fixtures/tavern.json)按原事件、调用与复用索引引用 I0/I1/I2；[加载器](../../packages/contracts/fixtures/tavern.mjs)直接读取原文件。图片、摘要、尺寸、调用时间、目视审阅与复用关系来自 YJ-02。V1/V2/V3、场景键、审阅键、本地尝试键、保留集合和计划是 YJ-03 离线映射。[角色卡与边界对照](../../packages/contracts/fixtures/boundaries.json)及[断言](../../packages/contracts/test/contracts.test.mjs)为测试数据。角色卡映射未调用酒馆生成路径。

## 未完成项与接续条件

- **失败**：常规 CLI 克隆因本机凭据助手失败；已通过 GitHub 连接器完成 Git 对象核对和任务分支提交。最终契约检查无失败项。
- **BLOCKED / NOT_RUN**：独立后端图片 API 缺已获准并可验证的入口及认证。供应商查询、取消、计费、幂等和真实故障恢复均待实测。模型、用量、金额及币种未披露。
- **NOT_RUN**：本轮未运行真实文字模型、角色卡会话到图片的联调、数据库事务、队列竞争、重启恢复、生产权限、前端、真机及生产部署；未重复生图。新事实与审阅判断仍需可信来源。
- **后置**：正式产品验收、多人范围、费用细则、密钥保存、素材安排、图片规格与跨尺度地图仍开放。
- **下一步**：YJ-04 可用来源/地点/状态/计划实现真实历史读取与持久化；YJ-06 可消费显示规则和样例；YJ-07 可复用地点身份对接已有获准资料。YJ-05 可消费请求、尝试与资产类型开发通用处理，真实适配仍需供应商入口。上述分项目的业务实现尚待各自阶段执行。
