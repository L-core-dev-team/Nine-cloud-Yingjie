# 芦花渡 · 本地短局

在本次 Windows 执行机上，双击 **Play-P05.cmd**。它首次创建专用的 reader 局并打开页面，以后会恢复同一局。**Review-P05.cmd** 打开本次正式验收留存的 demo 局，可以查看八回合正文和已导入的研究建议。两个入口都只允许本机访问。页面关闭不删除进度。独立试玩的分析会显示“待回传”，可以继续行动；本次授权的十六个实验槽仅用于正式演示档。

### 运行依赖

Python 3、Node 26、Windows 本机 PostgreSQL 的 initdb/pg_ctl、固定 Nine-cloud Git 对象及其既有 pg 依赖，以及 B2 准备的规则运行目录。新的工作站按 [B2 准备说明](../native-reader-b2/README.md) 生成固定运行时，准备本机 PG。将 P05_UPSTREAM、P05_RUNTIME、P05_PG_BIN 分别指向工程、构建目录、PG bin 后再启动。当前执行机可从已存在的专用配置自动发现这三条路径。

在仓库根目录可执行：

```powershell
python -B packages/playable-loop/play.py reader
python -B packages/playable-loop/session.py stop reader
python -B packages/playable-loop/session.py resume reader
python -B packages/playable-loop/session.py open reader
```

`stop` 同时停止该局宿主和专用 PG，保留数据。仅在明确要丢弃该局时使用 `session.py cleanup reader`。该命令验证专用目录与标记再清理。本机启动页包含进入合成局的私密能力，只在本机打开。运行材料位于当前用户的本地应用数据目录 NineCloud-P05，不要复制该目录或启动页到仓库。登出会撤销原生会话；短时间再次登录会受原生频率限制。

### 试玩路线与中继

依次察看渡口、到作业位、赶走水羽鸦、领奖、前往望气台、返回芦花渡、与岑九闲谈、再访望气台。页面同时列出当前规则开放的其他操作。正文来自原生确定性叙述。主界面显示一条时机建议，诊断区列出状态和未知；历史节点只读，用“回到当前”继续。

程序先保存规则回执绑定及正文，再在独立 SQLite 侧车准备当轮状态题包。CODEX_RELAY 操作员保留单槽后，把题包交给新的独立订阅对话，原样导入首答。时机题包取程序实际保存的结果，回传后页面自动读到状态。任何阶段无须访问模型 API。仅在有**新的明确实验授权**时，操作员才对新局执行这些独立对话。本次验收回执可直接离线复核。

```text
node relay.mjs <该局专用目录> reserve <修订> state <新题包文件>
node relay.mjs <该局专用目录> import <修订> state <首答文件>
node relay.mjs <该局专用目录> reserve <修订> timing <新题包文件>
node relay.mjs <该局专用目录> import <修订> timing <首答文件>
```

这些命令在本目录运行。原答无效也占槽；无法确认送达时以 `unknown` 完成已保留的槽，不重发。侧车独立绑定账号、存档、root 分支、原生修订和请求键。正文保存中断时按授权回执及匹配快照重建，否则显示待恢复。重开后当前态来自真实 PG，历史条目是当时绑定的记录；这里没有重建一般的 B2 历史确证。原实验的后验对齐标注不参与本入口。
