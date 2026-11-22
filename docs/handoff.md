# 映界当前交接

更新：2026-11-22。

## 最新接续 · YJ-P02-L3 场景证据契约任务书已上传

- 经 GitHub 核对 `codex/yj-p02-l2-real-text-extraction@282a76824cfbde7b032a8c4e79dc0c681755ce50` 的[运行报告](reports/YJ-P02-L2-live-text-extraction-report.md)、[受信原文回放脱敏回执](reports/evidence/YJ-P02-L2/replay.json)、[契约/65 样本/回归](reports/evidence/YJ-P02-L2/regression.json)和 /3 实现。原 SHA 及旧 /2 失败均被复现，/3 只补局部证据，旧版与新版都正确 `not-ready`；**本次未在用户本机重新运行测试或读取原文**。
- 从 L2 完成提交创建 `codex/yj-p02-l3-scene-evidence-contract` 并上传[完整 L3 场景证据与合成文字生成契约任务书](task-briefs/YJ-P02-L3-scene-evidence-contract.md)。**本次只准备任务书及交接，L3 代码、PG/Chrome 回归和真实模型请求均 NOT_RUN**。
- 执行重点：先区分“明确在场三人”与“完整名单”，由受信已保存文本确认地点、视角、结构、时段与光照，候选提示模板仅用合成材料验证；缺字段不能强行 ready；新增证据协议不得通过 JSON、世界书秘密或图片倒灌剧情。
- L1 单笔许可已 `ACKNOWLEDGED` 耗尽，`.nine-cloud-yingjie/yj-p02-l1/approval.sqlite`、原停写数据库、旧 SHA 和历史审计不可修改。L3 实际 OpenAI 文字/图片 API 调用预算 **USD 0**。YJ-13 LOCAL_DEMO_PASS、P01 OFFLINE_PASS、两个 main 保留。

## YJ-P02-L2 当前交付

原件、原会话和投影已只读核对。正确留空，`/3` 的局部识别改进仅进入独立审计投影，默认宿主继续用 `/2`。保留原 L1 账本及停机集群。[报告与复跑](reports/YJ-P02-L2-live-text-extraction-report.md)

## 归档 · L2 开工准备

- 已只读核对 `codex/yj-p02-l1-key-entry-ui@7e714c01497b83b1de42069a47862a7d51c9f863` 的真实[脱敏回执](reports/evidence/YJ-P02-L1/live-result.json)、L1 运行报告和 `zh-visible-clause/2` 源码；本轮未在本机重跑或读取真实原正文。L1 只有 1 次 `gpt-6-luna` 真实文字请求、92 输入/39 输出 tokens、估算 $0.0000287，原完成修订 1 的正文 SHA 为 `1c65286041ae74ccae956c08bdca02b3e91f9273411834c83adbd98071e23f98`，提取 `not-ready`，图片调用 0。
- 新建独立分支 `codex/yj-p02-l2-real-text-extraction`，上传[完整 YJ-P02-L2 执行任务书](task-briefs/YJ-P02-L2-live-text-extraction.md)。**本轮仅上传任务和交接，没有读取本地原文、修改提取器、执行新的测试或调用模型。**
- 首先在受信合成 L1 停写 PostgreSQL 副本中找回原 `completed-history`，SHA 必须精确匹配；查明 `/2` 提取失败证据。若正文欠缺当前画面事实，保留 `not-ready`；若事实明确而句式未识别，才以版本化 `/3` 做保守离线修正。找不到原正文则报告 SOURCE_UNAVAILABLE，**不能用另写的模拟文本冒充**。
- **严禁**新一次 OpenAI 文字/图片发送、重置 `.nine-cloud-yingjie/yj-p02-l1/approval.sqlite`、再次输入 Key、上传原正文/数据库凭据或写入旧会话。YJ-13/P01/L1 原成果与 main 保持不变。

**L1 已收口为 LUNA_ONE_CALL_PASS。** 已核对一份真实回执与一行 ACKNOWLEDGED 账本记录。修订 1，映界提取 not-ready，图片调用 0 次。此许可已用完，后续仅核对已有记录与账单。[真实结果](reports/YJ-P02-L1-luna-text-smoke-report.md)

终端可从映界目录运行 `node packages/luna-text/key-entry/terminal.mjs`，本机启动器沿用固定上游、PG 和 Chrome 路径。按道主最新选择，终端在读取密钥前说明项目权限、Standard 费率、合成酒馆范围和最高 USD 0.10。输入单行密钥并按回车即提交这笔试点，Esc 可取消。仍通过原账本预留并写脱敏回执。6 项禁网模拟测试覆盖单次提交、取消、非法输入、多行粘贴、已有占用和管道输入。

## YJ-P02-L1-K 本机入口交付

从 `cd2cd3a9f79e35b7333b21136c7d80457ff14ead` 接续，已完成输入页、假密钥浏览器测试、断网防重和原角色卡回归。Windows 用户桌面的 Edge 已验证回环可达。由本人领取短期邀请、填写并单独确认，真实试点交付时为 LIVE_BLOCKED。邀请过期可在原账户重新启动输入服务；原批准账本仍适用。[报告与启动方式](reports/YJ-P02-L1-key-entry-report.md)

## 归档 · 输入页任务准备

道主不希望手动配置 PowerShell 环境变量，要求 Codex 提供可由本人填写 API Key 的**受保护一次性输入页面**。从 YJ-P02-L1 `ac0ccbec121a5c3238264894cc0c4449de2922e8` 建立独立 `codex/yj-p02-l1-key-entry-ui` 分支；执行[安全输入 UI 任务书](task-briefs/YJ-P02-L1-key-entry-ui.md)。这项工作目前仅上传任务要求，**界面与可访问地址仍未创建**。仅允许在本机可访问受信 loopback 或平台原生安全凭据入口操作，禁止公开无认证 URL、聊天接收 Key 或存盘。填入 Key 本身不触发 $0.10 单次 Luna 付费测试，必须明确点击后再走原持久账本。原 L1 的 OFFLINE_PASS/LIVE_BLOCKED 证据不变。

## YJ-P02-L1 当前交付

从任务提交 `98d2883` 接续。单次适配、当日预算、持久防重及原会话合成回合均已通过。真实调用在检查密钥及项目权限时停止，状态 LIVE_BLOCKED，实际与可能发送均为 0。同机后续预检及账本路径见[报告与回执](reports/YJ-P02-L1-luna-text-smoke-report.md)。

## 归档 · L1 任务准备

- 道主已确认具有 OpenAI API Key，并同意将 **GPT-6 Luna 单次文字测试**的本次预算上限设为 **USD $0.10**。模型固定 `gpt-6-luna`，最高 1 次 Responses API 文本推理，使用**开发自编合成酒馆**，**不批准图片/私人角色卡/万卡阁或世界书原文外发**。成功、失败或结果未知都停止，不自动重试。
- 已在 `codex/yj-p02-openai-adapter@7f0d9d454886c6021a876cd3a8c9bcfda99404e9` 之上建立独立 `codex/yj-p02-l1-luna-text`，交付[完整 YJ-P02-L1 任务书](task-briefs/YJ-P02-L1-luna-text-smoke.md)。本次**只有任务书及交接材料**，业务代码、离线新测试及真实 API 调用均 NOT_RUN。
- 先检查本机受信进程是否有 `OPENAI_API_KEY`（只返回是否可用，不读取/输出其值），核对官方 Standard 价、输入≤8000 tokens 与输出≤1200 tokens，使用 `store:false`、`reasoning.effort:none`、禁 SDK 自动重试、持久化 one-shot 发送额度。无法保障门禁即 LIVE_BLOCKED，不用其他型号顶替。
- 成功必须先由九霄存成 completed-history，再读回映界提取结果；原件与图片 API 请求次数维持 0。YJ-13 LOCAL_DEMO_PASS、P01 OFFLINE_PASS 和已有两个项目 main 不动。P02 图片生成、参考编辑、纠错替代与生产仍未获放行。

## YJ-P02 最新接续：OpenAI API 已选，适配任务书就绪

- 道主已选择**使用自己的 OpenAI API 账户**作为映界文字及图片真实服务供应商；这一决定不等于已授权具体付费调用、参考图外发或供应商留存/审核条款。ChatGPT 订阅与 API 的账单/额度仍须分别检查。
- 已核对 `codex/yj-p01-real-service-readiness@2caab0d92059d77097af5a4e6859f56e51516c99` 的远端 HEAD、[P01 报告](reports/YJ-P01-real-service-readiness-report.md)、离线 7/7、三轮本地 fake 及 YJ-13 原回归 21/22→22/22。本轮未在用户 Windows/PG/Chrome 环境独立重跑测试。
- 从 P01 成果建立 `codex/yj-p02-openai-adapter`，上传[OpenAI 文字/图片专用适配与安全放行任务书](task-briefs/YJ-P02-openai-adapter.md)。候选文字为 `gpt-6.2-sol`，候选图片为 `gpt-image-2.6-sunburst`，均需核对项目访问与费用，**尚未冻结型号**。Images API 的生成、编辑协议依据 2026-11-21 官方文档核查。
- **本轮只创建任务书和交接记录，P02 业务代码、合同/供应商 live 联调及任何真实 API 调用均 NOT_RUN。** 下一名 Codex 可先实现禁网 adapter、PG 发送前门禁和本地 mock HTTP 对照；没有具体外发许可、预算、模型访问与实时请求授权时不得联网请求 OpenAI。
- YJ-13 `LOCAL_DEMO_PASS` 与 P01 `OFFLINE_PASS` 不变；纠错替代 `contract-adapter-required`、独立人工审图、手机真机及生产仍为未验证。

## YJ-P01 当前交付

**YJ-P01 OFFLINE_PASS，真实试点 LIVE_BLOCKED。** 原角色卡在合成数据上完成生成、参考编辑和保守留空；受信授权、预留上限、信息过滤与 unknown 重开防重已通过离线检查。 离线实现提交 `ec0196e`。纠错替代仍为 contract-adapter-required。仅在道主确认供应商、素材用途、上限、审核留存和真实调用授权后另起 P02。[复跑命令及证据](reports/YJ-P01-real-service-readiness-report.md)

## 归档 · P01 开工前准备

- 已核对 YJ-13 远端完成提交 `codex/yj-13-local-demo-closeout@2b54c28e8e587e05311b957c5437024c6ecb4271`，读取[本地报告](reports/YJ-13-local-demo-closeout-report.md)、最终隔离集群回归 22/22 ×2、限流复现记录、35+2 轮合成试玩与[运行手册](local-demo.md)。本轮没有独立在用户 Windows 环境运行这些命令，保留当次执行证据的界限。
- YJ-13 为 **LOCAL_DEMO_PASS**，仅保证现有合成故事、三张原 PNG 和本地 mock 的原型。真实文字服务、图片生成/参考编辑 API 和其费用/审核能力仍为 NOT_RUN；纠错替代请求仍需要独立身份契约；手机真机与生产均未验证。
- 已从固定 YJ-13 提交创建独立分支 `codex/yj-p01-real-service-readiness` 和[完整 P01 离线准备任务书](task-briefs/YJ-P01-real-service-readiness.md)。本轮只做接入面、权限/素材外发/费用门禁的任务准备；**P01 业务实现、测试与真实供应商请求均未执行**。
- 下一执行者在一个 Codex 会话中核对九霄文字模型 `CardModel`、映界 `ImageTasks` Provider 接面与历史 unknown/纠错独立身份；未选供应商、没获用户明确批准时只能运行合成 fixture 和离线适配。不得试探收费 API，不把密钥或私人图文写入 GitHub。

## YJ-13 当前交付

**YJ-13 LOCAL_DEMO_PASS。** 完整隔离回归连续 22/22、22/22；原角色卡 35 轮、第二会话 2 轮，已实测启停、回退和 14 表配对恢复。 [启动与回退](local-demo.md) · [回执索引和未验证条件](reports/YJ-13-local-demo-closeout-report.md)

## YJ-13 开工前的历史复核

- 已核对 `codex/yj-12-recovery-terminal@022d20a0a792ff52b9acfb9fa471c991b5e63755` 的远端 HEAD、[运行报告](reports/YJ-12-recovery-terminal-report.md)、[真实回归记录](reports/evidence/YJ-12/regression.json)与独立恢复代码。**本轮没有在用户 Windows/PG/Chrome 上重新执行测试**。
- 原报告确认断网反馈与撤权后的同 UUID 核对、waiting/unknown 恢复、停写 `pg_dump/pg_restore` 及私有原件核查、Chrome 桌面/移动视口的定向通过。**但同一代码综合先 22/22，随即 18/22，四组在 `/api/auth/code` 返回 429，后续断言未执行。此项不能标记为稳定回归 PASS。**
- 九霄固定上游认证源码有真实的 per-IP 每小时验证码请求配额、per-email 及全局上限；与报告限流现象一致，但**尚未读取本次限流计数证明是哪一层触发**。YJ-13 以隔离合成测试环境为首要任务，禁止关闭生产认证限流或无限重试。
- 已从 YJ-12 完成提交新建 `codex/yj-13-local-demo-closeout`，提交[完整执行任务书](task-briefs/YJ-13-local-demo-closeout.md)；本轮只做任务书与交接，**YJ-13 业务代码、PG/HTTP/Chrome 实机和连续试玩均 NOT_RUN**。
- YJ-13 应先验证完整回归连续可复现，再进行原角色卡 30–50 轮合成连续试玩、可复现演示入口/回退以及恢复复核。即使本地 LOCAL_DEMO_PASS，真实模型、独立图像审核、纠错替代生成、真机及生产仍保持未验证/阻塞。

## YJ-13 接续

已在普通角色卡页验证断网反馈、撤权后的回执核对、未知请求防重，以及停写后的 PostgreSQL 和私有原件恢复。YJ-13 可从本地模拟连续试玩接续。[运行报告、命令与回退](reports/YJ-12-recovery-terminal-report.md)

沿用 `codex/yj-12-recovery-terminal` 的实际最新提交。保留 YJ-11 审阅流水、YJ-12 回执查询和按账户/会话保存的命令摘要。恢复前一并核对授权来源快照、14 张投影表及私有原件，先只读复核 unknown。正式供应商、真机和生产恢复各需独立验收。

## 归档 · YJ-12 开工材料

- 已核对 `codex/yj-11-image-history-corrections@4ea1f354181216a7fcfc7833a898f9e02f2630bf` 与[原运行报告](reports/YJ-11-image-history-corrections-report.md)、[回归回执](reports/evidence/YJ-11/regression.json)。原执行记录有契约 10/10、综合三次 20/20、11 轮合成历史与 6 次本地 mock；本次未在 Windows PG/Chrome 环境重新运行。
- 从 YJ-11 成果创建 `codex/yj-12-recovery-terminal`，已提交[完整 YJ-12 任务书](task-briefs/YJ-12-recovery-terminal.md)。**此轮只创建任务书和接手文档，YJ-12 新代码、断网实验和备份恢复均 NOT_RUN。**
- 定向审阅发现：反馈接口先核验目标再查询已提交同 UUID 命令，浏览器刷新又可能丢失只存在 useRef 的命令。YJ-12 须对“反馈已提交、响应丢失、随后图片撤权”做有权限且不重复的恢复，并防止旧账号/会话借回执取得原件。
- YJ-12 还应验证等待/未知的发送归属，账号切换和迟到、前端离线与窄屏，以及合成测试 PG + 私有原件共同恢复。真实图片 API、独立人工审图、生产和手机真机仍未验证。纠错替代仍 `blocked:contract-adapter-required`；不绕过唯一任务约束。

## YJ-12 接续

使用 `codex/yj-11-image-history-corrections` 的实际最新提交。图片历史按本会话已保存正文修订分页，反馈命令与任务请求分别去重。保留 `yingjie_history`、原任务表及原件目录，也保留预设撤下检查。YJ-12 应验证断网期间的反馈回执恢复、真机切换账户、旧请求乱序与长期备份恢复。仅在扩展受信请求契约后接入纠错替代。真实服务、独立人工审图与正式部署仍为 NOT_RUN。[运行报告及复跑说明](reports/YJ-11-image-history-corrections-report.md)

## 归档 · YJ-11 开工准备

- YJ-10 完成分支 `codex/yj-10-trigger-consistency@95cb7a9145f914c2b72196730891a46e215ed5af` 已核对远端。读取[运行报告](reports/YJ-10-trigger-consistency-report.md)、[14 轮证据](reports/evidence/YJ-10/run.json)、[19 组回归记录](reports/evidence/YJ-10/regression.json)和历史关联/审阅关键源码；**本次没有在 Windows 本机复跑测试或调用模型**。
- YJ-10 执行记录：14 轮内 5 个视觉触发候选、4 次本地 mock 发送；五人场景收到错误三人图后审阅拒绝，两轮交谈未补发；综合回归最终两次 19/19。曾有 09 的一次并行超时，本轮 7 次未复现，原根因仍未证实。真实模型与独立图片 API 均 NOT_RUN。
- 已从 YJ-10 完成提交建立 `codex/yj-11-image-history-corrections`，上传[完整 YJ-11 任务书](task-briefs/YJ-11-image-history-corrections.md)。重点是本会话图片历史、安全浏览、追加式反馈与审阅纠错、保留原任务和资产证据、受控替代图；现有 `task.event_key UNIQUE` 不允许偷偷复用原任务身份派发。
- **YJ-11 业务实现、真实 PG/HTTP/Chrome 新验证均未执行。** 下一执行者使用同一个 Codex，先检查实际 HEAD 和工作区，按任务书编码与实测；不得修改两个项目 main、万卡阁或未经许可调用真实供应商。

## 归档 · YJ-10 交付时的接续条件

YJ-10 本地实现与验证已完成。原普通角色卡 14 轮共 4 次模拟发送，错图被拒后连续两轮交谈均未重发。最终两次综合回归各 19/19，真实模型调用 0。接续分支 `codex/yj-10-trigger-consistency`，实现提交 [66a22e89](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/66a22e89154568071d0c7ffbd629df8f495d8843)。按鉴权 scope 关联 choice、task、attempt、asset。旧行可能没有触发审计；同一 SHA 的两个资产可能有不同目标、审阅和纠错结论。回看历史、用于当前图和用于编辑需要分别核权，未知发送沿用原尝试。真实模型、独立标注、真机和生产挂载保留 NOT_RUN。[详细报告与回退](reports/YJ-10-trigger-consistency-report.md) · [逐轮证据](reports/evidence/YJ-10/run.json)

## 开工时记录 · YJ-10 任务书就绪

- YJ-09 最新远端提交已核验：`codex/yj-09-revisit-continuity@cabd3f1b7229f10c4470c5b847a187143b291026`。本次读取其源码、65 段语料证据、25 轮回执、报告及间歇性超时记录，未独立在 Windows/PG/Chrome 环境复跑。
- 已从该提交创建 `codex/yj-10-trigger-consistency` 并提交[完整执行任务书](task-briefs/YJ-10-trigger-consistency.md)。**YJ-10 业务代码与测试 NOT_RUN**；只完成开工准备和接续文件。YJ-09 原成果分支、映界 `main` 和九霄上游不改。
- 任务优先级：剧情是否值得新图、普通交谈不反复生图、可见画面/编辑参考/审阅资格三层分离；世界书未揭示信息不得进入图片；未知地点、含糊离场、撤权、旧请求等待或结果未知时保守处理。
- 原 YJ-09 65 段合成对照为 39 正确采纳、0 错误采纳、26 放弃判断；最终综合两次 14/14。中途一次并行 YJ-08 等待超时的根因没有证实，YJ-10 应保留并按风险定向复查；真实模型和图片 API 调用仍为 0。
- YJ-11 历史/纠错要消费 YJ-10 的可解释审核理由；真实模型、私人语料独立标注、图片供应商、生产发布及手机真机仍后置。接手 Codex 先核查实际分支 HEAD 和未提交成果，不强制 reset。

## 当前接续点 · YJ-10 可开始本地验证

YJ-09 已完成本地工程交付。原普通角色卡 25 轮同一行动，东/西村同名异地、改名复访、含糊离场后隐藏与完整调查恢复、双版本 PG 重放均有逐轮回执。65 段合成对照中新版正确采纳 39、错采 0、放弃 26。YJ-10 可接入关键事件、当前图片适用性和可知范围审计。[实现与逐轮回执 ebfb5e06](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/ebfb5e06193117feef0ea884bcd99c3ae50a4e5e)。接续分支 `codex/yj-09-revisit-continuity`。部署或供真实用户切换前，需独立语料、素材审阅和历史发送账本对账。真实模型与图片 API、生产和真机保留 NOT_RUN。[报告、命令、回退与证据](reports/YJ-09-revisit-continuity-report.md)

## 开工时记录 · YJ-09 任务书准备完毕

- YJ-08 固定成果分支 `codex/yj-08-first-play-integration` 的远端 HEAD 已只读核对为 `00c42157e4066565eb9d5d5a140b78188ebe0b81`。已读取[工程报告](reports/YJ-08-first-play-integration-report.md)、[逐回合回执](reports/evidence/YJ-08/run.json)、提取器源码及代表性测试；**本轮没有在用户 Windows 环境重跑测试**。
- 原记录显示：13 轮九霄已保存合成正文、规则对照 24/24、额外散文 4/7 一致且 3/7 放弃判断、契约 10/10、综合检查 12/12；图片/文字真实模型调用均为 0。原标签由同一开发会话编写，不是独立盲评，更不能当作真实玩家语义正确率。
- 已从 YJ-08 最终提交新建 `codex/yj-09-revisit-continuity`。[YJ-09 完整任务书](task-briefs/YJ-09-revisit-continuity.md)重点处理含蓄人物离场、只剩某人、间接昼夜灯光、同地点别名和跨地点复访、未知画面资格与版本化安全重放；**本次只准备任务书和交接，YJ-09 业务代码及测试均 NOT_RUN**。
- 02/05 的独立真实后端图片 API 仍 BLOCKED / NOT_RUN；YJ-09 可用已有合成资料、原三张 PNG 和 PG/Chrome mock 先做定向开发。真实文本模型、独立人工语料、生产挂载、移动真机仍需后续单独验证。继续由一个 Codex 使用独立任务分支，勿修改九霄 main、映界 main 或万卡阁。

## 当前接续点 · YJ-08 本地首段游玩已完成

分支 `codex/yj-08-first-play-integration`，基线 `5562e42233cb0d5bcaeb1179eb9aa02bfcd9fa4f`。已从 GitHub 回读并核对实现提交 [c6b7981776e2579e0fe241ecd40dbad0095de995](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/c6b7981776e2579e0fe241ecd40dbad0095de995) 和整树。本次交接提交随后更新报告、看板和入口。后续读取本分支最新 HEAD。

- 原普通角色卡页面使用已保存正文及受限规则，主会话 13 轮同一玩家行动。通过预设、复用、参考编辑、生成、跳过，以及失败、关图、复访、刷新、损坏、撤权、迟到及结果未知验证。[报告与命令](reports/YJ-08-first-play-integration-report.md) · [逐回合回执](reports/evidence/YJ-08/run.json)
- 规则对照 24/24；另外 7 段散文中 4 段一致，3 段放弃判断。本地运行使用合成文字及图片服务。契约 10/10，综合检查 12/12。真实模型和真实图片 API 调用均为 0。
- 下一项 YJ-09 可扩展连续人物变化、别名与重访的人工对照和重放验证。接入真实模型前需要获准语料或模型/认证；真实图片服务另需获准 API、额度、参考编辑与回执协议、审阅入口。生产挂载及真机未验。[提取、选择与回退说明](../packages/first-play/README.md)

## YJ-07 完成本地交付时记录

分支 `codex/yj-07-worldbook-assets`，接手基线 `bd2f552ba0c0480202c4366a92f0d95d4cb117f8`。已核对本地及远端实现提交 [da97633de7c83d0b743d8e5766cb2317867a2cea](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/da97633de7c83d0b743d8e5766cb2317867a2cea)。九霄固定上游工作树干净。此后的报告提交仅增加接续资料，下一次工作从分支最新 HEAD 开始。

- 普通会话三类世界书来源各自可追溯，配图授权固定到当前会话及导入版本。旧会话保留全局世界书快照，受信匹配使用稳定地点与视觉版本。预设通过原件和审阅核验后才可显示，撤权/损坏后旧下载地址返回 404。
- 0.1.1 契约 10/10，PNG 探针 3/3，综合检查 9/9，原 05/06 九步流程通过。07 预设流程无图片任务或供应商调用。全部世界书和剧情为合成样例。[运行报告](reports/YJ-07-worldbook-assets-report.md) · [脱敏回执](reports/evidence/YJ-07/run.json)
- [YJ-08 接续任务书](task-briefs/YJ-08-first-play-integration.md) 已就绪。可先做已完成正文的提取对照和统一画面选择；真实模型、独立图片 API、生产权限和真机仍待验证。

## YJ-07 开工时记录 · 2026-11-20

- 从 YJ-05/06 整合成果 `d9d94833d97568dc25fb55fe8778289bee1e6f0d` 建立 `codex/yj-07-worldbook-assets` 独立分支。本次只编制任务书，**尚未执行 YJ-07 业务代码或测试**。
- [YJ-07 完整任务书](task-briefs/YJ-07-worldbook-assets.md) 要求一个 Codex 在已有文字/图片联合原型上，安全读取当前会话有权使用的世界书、匹配稳定地点与获准预设图片，并验证无匹配/不适用/撤权降级。先保留 YJ-05/06 的九步模拟联调基线，不重复调用真实图片模型。
- YJ-07 完成后由同一执行助手明确 YJ-08 可以执行的子项和受阻项；后端图片 API、真实自由文本提取、正式宿主挂载与手机真机仍为未验证。执行时读取远端实际 HEAD，不用历史固定提交覆盖后续更改。

## YJ-05 + YJ-06 当前接续点 · 2026-11-20

- 分支 `codex/yj-05-06-integrated`。从 YJ-04 完成提交 `ccd50472c424607991e43667ba998129320105a6` 接续，实际实现提交 [59cf8756](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/59cf875649c9b676f59c63280bbc54b602d6b5c3)。两个原任务书分支保留。后续接手请读取整合分支最新 HEAD。
- 05 的持久任务、审阅归属和跨进程恢复已完成本地验证；06 已挂载九霄独立副本的普通角色卡页面。联合浏览器用例以固定文字和三张旧图走通九步，含关闭、失败、刷新、会话切换及迟到。契约 10/10，PG 与浏览器 6/6。原图探针 3/3。[05 报告](reports/YJ-05-image-tasks-report.md) · [06 报告](reports/YJ-06-ui-report.md) · [复跑命令](../packages/image-tasks/README.md)
- YJ-07 对接授权后的地点和视觉版本、获准世界书与可审阅预设资产。YJ-08 对接真实文字提取、画面决策和经批准的供应商、宿主及审阅入口。独立图片 API、费用、真实模型、真机、生产挂载均保留未验。

## 启动时指示

用户已要求开始，创建独立映界仓库并上传现有计划。草案0.1作为工作基线；暂定项和后置事项保持原状态。

## 当前工作

- YJ-01 已在 `codex/yj-01-runtime-baseline` 完成本地工程验证。九霄选用 `cd25360c7929e10f8b2b0fad342fedd943d4f323`，独立角色卡在刷新后继续提交，数据库留存修订 1、2。首批候选接入点为鉴权后的已完成历史。见[运行报告](reports/YJ-01-runtime-baseline-report.md)。

- 已完成需求、任务、并行分工、技术框架和上游核查记录的文件整理。
- 已补充独立仓库边界、启动授权与第一项任务书。
- 远端仓库：[quakhiak34568-lang/Nine-cloud-Yingjie](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie)，私有，默认分支 `main`；已通过GitHub元数据核实。
- 首批15份规划和协作文件已提交，初始化提交为[6ebf0b0](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/6ebf0b0a2c2dd4b3309ed3456dde0648519b2699)，核验回执提交为[8ed270a](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/8ed270ab4219ed9e8eca93d787364886827d1237)。
- 编制开工任务书前已再次读取main，确认其为8ed270a，远端15份文件与本地内容逐一一致。此后增加开工任务书和接手索引；核验方法见[验证记录](verification.md)。
- 开工前已交付[完整开工与接续任务书 YJ-START-01](task-briefs/YJ-START-01-project-kickoff.md)。映界业务实现尚待后续任务。

## 当前断点 · 2026-11-20

YJ-02 成果分支 `codex/yj-02-image-capability` 已核对到 `13ac86a0c4a130780123cb5ed1768db6c5b43603`。它承接 `84394958f4fd0dc0872d52af8dc9879fc3613a28`。Codex 工具真实返回三张酒馆图，人员依次为 3、5、5。复访从磁盘恢复五人图，随后亮灯编辑继续使用该图。调用、原图、参考关系、离线故障记录和复跑方式见[图片能力报告](reports/YJ-02-image-capability-report.md)。

本次已读取记录与脚本，并在 GitHub 固定提交的原图展示页逐张核对人物及主要布局，支持本批工具级样例结论。本次未重新调用图片工具、未重跑 probe.py，也未独立重算 PNG 的 SHA-256。完整范围见[YJ-02 证据复核](reports/YJ-02-evidence-review.md)。

## YJ-03 已完成 · 任务分支交接

- 实现提交 [5463c96](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/5463c96eae5996a69bcc61b5887c6c3d50f8b3e9) 位于 `codex/yj-03-shared-contracts`。接手起点为 `e0b16bc`。继续从任务分支最新 HEAD 取成果。
- [契约 0.1](contracts/visual-contracts-v0.1.md) 和 [包入口](../packages/contracts) 是后续模块的共用格式。[验证报告](reports/YJ-03-shared-contracts-report.md) 给出上游源码映射、命令、正反例和未运行项。
- 原执行报告记录离线冻结安装、编译、8 组 C01–C12 检查和三张原 PNG 校验通过。角色卡历史、合成酒馆及原生回合分别建模；普通对话与无变化复访可复用，傍晚编辑沿用五人图。
- YJ-04 可接角色卡已完成历史与地点持久化；YJ-06、YJ-07 可消费样例与地点身份。YJ-05 可开发通用结果处理，独立后端图片 API 及真实供应商能力仍为 BLOCKED / NOT_RUN。

复核时 `main` 为 `62f3260fc391ea10349bd792c1c77875e76665c7`，尚未包含任务分支的全部成果。本轮不合并 main、不修改九霄上游。YJ-01 的[限定范围复核](reports/YJ-01-evidence-review.md)继续有效。

## YJ-03 复核修补与 YJ-04 接手（开工时记录）· 2026-11-20

当前接续分支为 `codex/yj-04-scene-state`，从 YJ-03 最终提交 `7d68284e95754f06e853123ac3c719788266ae0a` 建立。定向修补提交为 [e5d6cf2](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/e5d6cf2e73dc5131209f9793677e3eebf24a7c73)；本节与任务书会在其后提交。接手时读取远端实际 HEAD，不用固定 SHA 覆盖后续成果。

- 修复编辑入口接受“同视觉版本、不同可见事实”，以及角色卡 UUID 大小写拆分事件/请求身份两个可复现缺口。包升级为 `@yingjie/contracts@0.1.1`，交换格式仍为 `0.1`；原图片和原测试不改。
- 本次独立通过：原锁文件安装、修补前后编译、新增 2 组回归、原来源映射 1 组。原图字节和全量原测试本次 NOT_RUN，不能把原报告的 8 组通过算作本次重跑。见[复核报告](reports/YJ-03-evidence-review.md)。
- [YJ-04 完整任务书](task-briefs/YJ-04-scene-state.md)已准备。先在完整副本复跑全部 10 组契约检查，然后实现真实已保存普通角色卡历史读取、稳定地点身份、变化继承、持久化、分页、重放和重启恢复。
- 地点主键不包含每轮 key/revision；新一轮没有提到旧人物，不自动视为离开。没有足够事实时明确未就绪，不伪造可见状态。
- YJ-04 状态业务实现尚未执行，不需要等待图片供应商入口。
- YJ-02 后端准备使用独立分支 `codex/yj-02-backend-readiness`。本轮交接更新时，远端已推进到 `340c8bfb2cafe01be994b0d0ce77829b6274c7b7`；[补充报告](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/340c8bfb2cafe01be994b0d0ce77829b6274c7b7/docs/reports/YJ-02-backend-readiness-report.md)记录离线请求准备与本地 mock 已完成，真实后端仍 BLOCKED / NOT_RUN。本轮只登记新提交并读取报告，未复核或复跑该批实验。
- 02 补充实现仍消费 0.1.0；如需共用契约修补，可单独接入上述 0.1.1 补丁提交，随后复跑该分支的契约和准备检查。不要将整个 04 分支合入以覆盖 02 的交接记录。

## YJ-04 已完成 · 当时接续点

- 任务分支 `codex/yj-04-scene-state`，起点 `6cf460e`。实现提交 [a8b33d4](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/commit/a8b33d4cfb50dcbea0d1b411008a3360e1810421) 已核对远端。后续取本分支最新 HEAD。
- 在完整副本复跑契约 10/10；状态验证 3/3。已通过真实本地 HTTP 和 PostgreSQL 读取普通角色卡已完成历史，并独立验证合成酒馆五人复访、事务中断、竞争、分页和进程重启。[报告与未验证项](reports/YJ-04-scene-state-report.md)
- YJ-06、07 可从[状态入口](../packages/scene-state/README.md)消费。YJ-05 通用工作可继续；独立后端 API、自由文本提取、生产挂载及端到端出图仍待对应阶段落实。

## 保留未决

费用细节、多人范围、素材准备安排、密钥保存方式、正式验收、具体模型和图片规格继续保留原状态。
