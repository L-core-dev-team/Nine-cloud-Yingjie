# narrative-highlight/3a

从 replay.mjs 导入 replayHighlights3A(ctx)。宿主必须提供 replayOnly、已授权的 owner/session/scope、连续的九霄 completed-history、逐修订来源回执和受信场景注册表。视觉建议沿用绑定具体修订的 H2R/S2 规划快照。调用只返回内存数据，不写原始历史或调用供应商。

每个 round 对应一个 as-of 修订。audit.assertions 是原文陈述；observations 含事实形态、适用范围及限定；registered 独立表示登记陈述。judgments 分列 documentValidity、registryState、substantiveRight、causalSupport、support 和 against。validity 为 signed 仅说明文本中出现相符署名。全文核验还要通过前态、权益种类、处置对象、受让方、代词及反证检查，才提交有效权益。财政入账须保留完整账户，账户不能作为已识别的受益人物。

每个证据含会话、scope、sourceKey、正文 SHA-256、修订和 UTF-16 半开引文区间。audit.changes 返回本回合各表的 before / after。没有变化的表省略。edges 记录取得证据的 learnedAt。candidates 记录历史上曾经发出的判断，查询“截至现在仍成立”时使用最后一回合的 ranking 和撤销边。已有的非权益高光沿用旧候选身份，只有原门禁核准的视觉候选才可能进入 director-review，每条 cadence 都有 send:false。

从仓库根运行 `python -B packages/highlights/h3a/record.py` 可重建定向、公开前缀、兼容和 CPU 回执。需已安装锁定依赖、已编译 packages/contracts/dist 及支持权限模式的 Node。仅回退调用时，将入口替换为 packages/highlights/h2r/replay.mjs 的 replayHighlights2R。没有数据库迁移。
