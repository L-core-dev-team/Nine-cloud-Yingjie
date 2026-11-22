# YJ-P03-S2 场景图片资格与连续试玩验收

**P03_S2_OFFLINE_PASS · 2026-11-22（北京时间）**。100 条预锁定合成案例中，44 条符合图片资格，56 条按预期阻断。三个地点的 20 个修订中，模拟供应商收到一次生成和一次参考编辑；三次复用均无新请求。原生宿主验收为 `ENV_BLOCKED / NOT_RUN`，真实付费图片为 `LIVE_BLOCKED_COST_BOUND`。

分支 `codex/yj-p03-s2-scene-consistency-slice` 从任务提交 `246e763eccd8f808d5b3e37d5052cfca3c42a2f2` 接续；[语料独立提交](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/91e3525d2b84b2354df5e9f860e5a9a1b241fb33) 先于实现与验收。该提交只添加标注数据。S2 运行宿主和例外规则都在后续实现中。

## 字段与图片资格

[判定模块](../../packages/first-play/visual-consistency.mjs) 从宿主提供的认证账户、会话、登记目录和有序 completed-history 重新运行 S1。每个修订核对来源和正文摘要，再核对当前 Scene/Visual 和字段审计。审计摘要使用 UTF-16 正文区间、SHA-256、字段及继承修订，可从完整历史回查。认证由宿主建立；本轮用合成宿主模拟这一边界。

| 预锁定测量 | 开发 71 | 预留 29 | 合计 |
|---|---:|---:|---:|
| 字面字段正确完整 / 正确弃判 | 55 / 16 | 21 / 8 | 76 / 24 |
| 字面错采 / 不必要弃判 | 0 / 0 | 0 / 0 | 0 / 0 |
| eligible | 33 | 11 | 44 |
| needs-review | 8 | 4 | 12 |
| conflict | 8 | 2 | 10 |
| not-ready（含权限或参考不合格） | 22 | 12 | 34 |
| 危险放行 / 不必要阻断 / 判定或原因不符 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

100 条含 28 个正例、48 个负例、24 个多修订例。内容包含同名异地、别名、朝向、密闭空间、名单不完整、离场、旧图越权和有解释的异常天象。部分案例复用同一末回合以单独改变前情或权限，共 73 种不同末回合文本。九份 JSONL 的合并 SHA-256 为 `ee1575bfb816524503507ec5284bcdc48e7a29f4138120975efe3428f2d18a8d`。各文件摘要、开发和预留分组、逐例结果、抽样证据区间及五项附加检查均可复查。[锁定语料](../../packages/first-play/test/s2-corpus) · [测量回执](evidence/YJ-P03-S2/measurement.json)

S1 原例 P30 夜间日光、P50 正午月光仍有完整字面字段。两者的图片资格均为 `needs-review / temporal-lighting-ambiguity`。新语料的八例有已揭示光源：前一条已保存正文明确写到亲眼所见的阵法、所在结构和持续期限，当前调查再次核实同地点、视角、结构和时间光照。审查将获准的光源写入图片提示并绑定提示摘要。换位置、解释失效、解释与重查不一致，或同一视觉版本却换了光源，都有独立拒绝或复核检查。复用同样经过审查。

规则只识别已实现的表达。前情超出有效期、复杂视角或自由叙事中尚无法绑定的同回合解释，仍可能需要补充调查或暂不出图。开发及预留组由同一开发过程编写，共用合成世界和句式；独立人工盲评为 `INDEPENDENT_HUMAN_REVIEW_NOT_RUN`。

## 20 回合的离线试玩

测试宿主依次保存普通角色卡 completed-history 形状的合成记录。原 `chooseFrame` 负责已有任务、同图复用和待处理约束；原演示图库不支持新地点时，由测试宿主选择通过 S2 资格的候选。I1 默认构造器仍拒绝 S2 输入。显式测试桥只接受无网络权限、mock 模式和 I2 MockImageMoney。ImageTasks 使用真实提交、分派、收件、审阅和展示代码。SQLite 文件替代 PostgreSQL，存储父进程只接受两种已列入清单的测试 PNG。子进程退出后独立重开账本并核对原件字节、摘要、修订和两笔预算占用。[测试入口](../../packages/first-play/test/s2-story-slice.mjs) · [逐回合回执](evidence/YJ-P03-S2/story-slice.json)

| 修订 | 实际观察 |
|---|---|
| 1–3 | 琥洲听雨酒馆从三人首图开始。PNG 先 pending，经模拟审阅 accepted 后展示。闲谈复用同一原件，离场后隐藏。 |
| 4–7 | 芦湾听潮台有首图资格，本轮未分派。无解释的夜间日光和后续闲谈均隐藏。回到酒馆别名并完成无变化调查，恢复原图。 |
| 8–10 | 雾中名单不明，旧图立即隐藏。单纯报出返回地点仍无图，完整重新调查后复用。 |
| 11–12 | 两人依次进入，人数从 3 到 4 再到 5。生成许可用于编辑被拒，sentAt 为空。独立批准编辑并绑定原 PNG、用途；假传输解码 multipart 后核对三名留存者和两名到场者。 |
| 13–16 | 离场并转至沙洲候星庭。迟到响应到达时已是修订 14，只登记在原酒馆修订 12 的 attempt 下，先 pending，随后模拟拒审。新地点无串图；复访及一名人物离场时均排除拒审原件。 |
| 17–20 | 傍晚灯光产生不同画面候选；无解释的异常光照及随后闲谈均隐藏。恢复完整调查后允许重新评估。没有更多发送。 |

修订 2、7、10 各复用一次。跨账户、跨会话展示错误均为 0。两次模拟占用分别为 4,000 和 5,000 微美元，重开仍合计 9,000；真实费用 USD 0。PNG 是能校验原件和区分引用的格式测试件，视觉人物连续性和画质尚未测量。测试为自动回放，15–30 分钟真人计时游玩为 `NOT_RUN`。

## 兼容回归与保留的失败记录

| 实测项目 | 结果 |
|---|---|
| S1 原 102 条及 13 项额外检查 | 正确采纳 36，正确弃判 66，边界检查 13/13。原语料 SHA-256 为 `6a6e15a44cb8d6385e38d0e582b8814233fc7b15607f7e6940950b4034ffe249`。 |
| 公共契约、L3、图片触发 | 10/10、30/30（含旧 65 条）、4/4。原 zh-visible-clause/1 的旧 continuity 有 1 次错采，/2 的旧 reference 有 1 次不必要弃判；详见逐组历史诊断。 |
| I1、I2 | 67/67；40/40，另通过跨进程竞争、强退、重开与丢失 attempt 的防重。 |
| P01、L1/L4 假传输 | 7/7、15/15、15/15。 |
| Windows 原生 HTTP/Chrome、九霄原角色卡与 PostgreSQL、YJ-13 原生 22 项、L4R 原生 23 项 | ENV_BLOCKED / NOT_RUN。沿用 Issue #1，本轮回环探针 0 次。 |
| OpenAI 模型查询、文字请求、图片生成、编辑及外部出图工具 | 各 0 次。 |

开发期间复跑原 P30/P50 一度报 `replay-source-mismatch`。测试宿主接收 S1 目录时仍使用 S2 目录摘要签发回放凭据。修正为使用实际传入目录的摘要后，两条原例通过，语料和原因标签均未调整。[兼容检查命令、退出码及原诊断](evidence/YJ-P03-S2/regression.json)

## 复跑与回退

本次使用 Node v26.13.0 与已有 contracts 锁定依赖，在映界仓库根执行。带回执参数时指定新的输出文件名，测试采用独占创建。逐套兼容命令在 regression.json 的 suites 中。

```powershell
node packages/contracts/node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
node --permission --allow-fs-read=* packages/first-play/test/s2-measure.mjs
node packages/first-play/test/s2-story-slice.mjs
node --permission --allow-fs-read=* packages/first-play/test/s1-measure.mjs
node packages/openai-image/check.mjs
node packages/openai-image/check-money.mjs
```

要复现任务前状态，可在单独工作树检出 `246e763eccd8f808d5b3e37d5052cfca3c42a2f2`；只回退规则可 revert 紧随语料锁定提交的 S2 实现提交。生产仍使用原默认提取器，S1 的 `scene-evidence/2` 限于 replayOnly。L1 ACKNOWLEDGED、L4 UNKNOWN_STOP、L5 PARTIAL、L5B ENV_BLOCKED、I1 IMAGE_ADAPTER_OFFLINE_PASS、I2 I2_GATE_OFFLINE_PASS 沿用既有记录。原生集成、独立玩家语料、生产启用、真实参考图外发及可证明的费用上界各需单独验收。[环境 Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)
