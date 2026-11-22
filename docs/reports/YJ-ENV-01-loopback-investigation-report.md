# YJ-ENV-01｜Windows 回环排障

**结论：ENVIRONMENT_DIFFERS。** 2026-11-22 16:49 北京时间，Dot 在指定的 Windows 电脑上以普通受管会话运行原探针，未提权、没改变设置。Windows 10.0.26200 / Node v26.13.0 与原记录一致；两次均未启用 Node 权限模式、未检测到预载。但现有证据不能证明 Dot 与原 L5B 使用同一受管沙箱会话或相同有效策略，不能宣布原环境已修复。

| 检查 | 原 L5B | 本次 Dot |
| --- | --- | --- |
| TCP LISTEN，127.0.0.1 临时端口 | PASS | PASS |
| TCP CONNECT | FAIL，connect EACCES | PASS，校验回传内容 |
| HTTP GET | NOT_RUN | PASS，200，校验响应正文 |
| 原生 Chrome / 临时 PG | NOT_RUN | NOT_RUN |

原 [L5B 脱敏证据](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/blob/6d9fa510cb6daa75e50eb9a4ebd4a277a8a70ec5/docs/reports/evidence/YJ-P02-L5B/loopback.json) 将错误定位到 TCP 客户端 connect，不是监听失败，且早于 Chrome、PG 或项目逻辑。微软 [Winsock 错误码](https://learn.microsoft.com/en-us/windows/win32/winsock/windows-sockets-error-codes-2) 支持“套接字访问被拒”，不能据此归因给宿主防火墙或 Codex 沙箱。此次没有新的审批拒绝，也没有策略变更。

OpenAI 的 [Windows 沙箱文档](https://learn.chatgpt.com/docs/windows/windows-sandbox) 与 [配置参考](https://learn.chatgpt.com/docs/config-file/config-reference) 描述的 MXC `allow_local_binding` 影响私网检查，不是只放行回环的最小开关。未证实原沙箱使用 MXC，也未验证该设置可应用于原会话。没有修改此设置。若 EACCES 在原 Codex 会话仍在，交由受管环境管理方核对原会话的有效网络策略，并仅申请允许当前测试进程对 `127.0.0.1` 的临时监听端口发起 TCP connect；后续仅放行 Chrome → 测试 HTTP、Node → 隔离 PG 的同机回环。不要开启全局网络或私网访问。

**交接：让 Codex 在原 L5B 的受管会话，或由管理方确认采用相同有效策略的会话，只复跑原最小探针。** 三项通过后再让 Codex 补 Chrome/临时 PG，若再次拒绝维持 ENV_BLOCKED。此轮不跑集成回归，不关闭 [Issue #1](https://github.com/quakhiak34568-lang/Nine-cloud-Yingjie/issues/1)，不更改 L5 PARTIAL、L1 ACKNOWLEDGED、L4 UNKNOWN_STOP，不触碰主分支、旧许可、私人项目数据或真实 API。

[本次脱敏 JSON](evidence/YJ-ENV-01/loopback.json)。原探针 SHA-256 `8b7022155c9fa967ee3c84105ee68dead386eedd39e7f558aefc4595676f4f80`，运行时间 `2026-11-22T08:49:08.065Z`，退出码 0。新增真实模型请求 0，费用 USD 0。
