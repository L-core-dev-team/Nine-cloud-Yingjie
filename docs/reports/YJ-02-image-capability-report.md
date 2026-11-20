# YJ-02 · 酒馆图片连续性能力报告

2026-11-20（北京时间） · 起点 `codex/yj-02-image-capability@84394958f4fd0dc0872d52af8dc9879fc3613a28` · 合成样例 `fixture-tavern-01` v1

**本批观察结果为 3 → 5 → 5 人。** 程序通过 Codex 的 `tools.image_gen__imagegen` 发起 3 次真实调用，包含 1 次文生图和 2 次单图参考编辑。三次均返回 PNG，并在逐张审阅后接受。普通交谈和无变化复访各复用一张已保存的图片，额外图像调用为 0。九霄后端直连图片供应商、玩家自带密钥和真实会话正文驱动生图均为 **NOT_RUN**。

| 阶段 | 实际输入与结果 | 观察 | 判定 |
| --- | --- | --- | --- |
| S0 初次进入 | 无参考 → [I0 原图](evidence/YJ-02/I0.png)，66.477 秒 | 左前桌蓝衣客端杯，后桌赭衣客就座，灰发掌柜在右侧柜台后。双窗、三张方桌及横梁可辨。 | PASS |
| S1 普通交谈 | 从已接受记录取 I0，复核文件摘要 | 样例明确只谈到远山，读取相同 PNG。此步使用预先标注的视觉状态，自动理解剧情尚未验证。 | PASS |
| S2 两人到场 | I0 作为唯一文件参考 → [I1 原图](evidence/YJ-02/I1.png)，88.841 秒 | 新增抱布包的绿衣旅人、着紫衣的旅人，分别站在后门过道；三名原有人物仍可辨，双窗、三桌、右柜台位置延续。 | PASS |
| S3A 无变化复访 | 另一进程打开已保存状态，取回 I1 | 读回文件的 SHA-256 与已接受的五人图一致。未发起模型调用。验证范围为实验文件恢复。 | PASS |
| S3B 傍晚亮灯 | I1 作为唯一文件参考 → [I2 原图](evidence/YJ-02/I2.png)，67.922 秒 | 左窗与后门外转蓝，三盏室内吊灯发光。蓝衣、绿衣、紫衣、赭衣四人和右柜台掌柜全部可见，未回退到三人。 | PASS |

三张均为工具返回的 1672 × 941 原始 PNG。尺寸为实测输出。I1 有器皿纹理差异，I2 有表情、桌面细节变化且门外多了小光点。小光点没有进入剧情事实。按座位、衣着和道具可追踪人物，跨图面容的精确同一性无法判定。观察由执行助手目视完成，用户体验验收为 NOT_RUN。全批只有一个固定机位、一个场景、一次连续编辑链。未观察到失败输出，共保留 3 张。[逐次回执及完整提示](evidence/YJ-02-image-runs.json) · [预先固定的剧情和审阅条件](evidence/YJ-02/fixture-v1.json)

## 服务、调用与保存

接手时核实远端分支和父提交，使用继承 YJ-01 成果的干净副本。样例独立于九霄 `cd25360c7929e10f8b2b0fad342fedd943d4f323` 的固定文字回复，本轮没有重跑 YJ-01。样例不含真实 owner、session、saveId 或 branchId。

当前工具接口允许传 `prompt`、`transparent_background` 和编辑用 `referenced_image_paths`。本批首次调用省略参考图，两次编辑分别显式传入本机保存的 I0、I1。每次只传一张。工具直接返回图像数据和本地原始文件位置。上传时逐张核对了 Git blob，回执记录了 PNG 的 SHA-256、尺寸、字节数、实际提示、开始与返回 UTC 时间。记录的是调用端等待时长，下载耗时无法单独取得。

| 能力 | 证据与边界 |
| --- | --- |
| 实际工具调用 | PASS。调用入口为 Codex 会话中的程序化工具接口。三张均为真实输出。人工聊天界面样例、模拟供应商出图均未使用。 |
| 独立应用 API | BLOCKED / NOT_RUN。本次环境未发现可供九霄后端使用且获准本实验的图片 API 凭据或已接入的适配器。已检查当前进程相关配置名称、映界仓库结构以及上游 API、开发启动器和配置示例。 |
| 参数与费用 | 实际设置为固定提示、横向构图、`transparent_background=false`。工具未披露底层模型版本、seed、用量、单价或实际金额，费用未知。 |
| 异步查询与重试 | 本次工具提供返回结果，未暴露可用于供应商查询的任务 ID 或查询方法。生成文件名用于识别文件。超时或结果未知留在原尝试记录中，自动重发关闭。 |
| 错误处理 | 本次真实调用没有拒绝、超时或服务错误。独立离线样例覆盖无服务、失败、拒绝、取消、超时、未知和成功文件保存，仅验证本地记录器行为。[离线结果](evidence/YJ-02/offline-checks.json) |

## 复查与复跑

在映界分支的 `docs/reports/evidence/YJ-02` 目录运行。Python 只使用标准库。核对命令验证三张原始 PNG、参考关系和复用文件，语义需查看图片。

~~~powershell
python probe.py verify
python probe.py reuse S1
python probe.py reuse S3A
~~~

新一批工具级调用可按下列步骤复跑。每次 prepare 都建立独立的尝试目录，先写入提示和实际参考摘要。为防止覆盖前一批结果，运行目录放在新的工作位置。

~~~powershell
python probe.py prepare I0 --run ./new-run
~~~

在有图像工具的 Codex 会话内，可直接运行下面的调用块。将文件路径替换为上一步生成的 request.json 的绝对路径。参考编辑时先打开所选参考图核对内容。

~~~javascript
// @exec: {"yield_time_ms": 120000}
const requestFile = "C:/path/to/new-run/attempt-id/request.json";
const safePath = "'" + requestFile.replaceAll("'", "''") + "'";
const file = await tools.exec_command({cmd: "Get-Content -Raw -Encoding utf8 -LiteralPath " + safePath});
if (file.exit_code !== 0) throw Error("Cannot load recorded request");
const request = JSON.parse(file.output);
const start = new Date();
try {
  const result = await tools.image_gen__imagegen(request.arguments);
  text({startedAt: start.toISOString(), returnedAt: new Date().toISOString(), output: result.output_hint});
  generatedImage(result);
} catch (error) {
  text({startedAt: start.toISOString(), returnedAt: new Date().toISOString(), error: String(error)});
}
~~~

将返回的原始文件登记到对应尝试目录。实际使用时同时保存上一步的时间、工具状态和目视结论。视觉不合格也保留原图，仅以审阅合格的上一张继续编辑。命令中的尖括号表示实际路径。

~~~powershell
python probe.py finish "<I0尝试目录>" returned_image --image "<工具返回的PNG>"
python probe.py prepare I1 --run ./new-run --reference "<已接受I0尝试目录>/original.png"
# 用 I1 的 request.json 运行同一工具调用块，保存并审阅 I1。
python probe.py prepare I2 --run ./new-run --reference "<已接受I1尝试目录>/original.png"
# 用 I2 的 request.json 调用，保存并审阅 I2。
~~~

无可用服务时用 `finish <尝试目录> no_service`。工具明确拒绝、失败或取消时分别记为 `refused`、`failed`、`cancelled`。不能确认是否已出图时登记 `timeout` 或 `unknown`。本批实际调用直接使用同一工具和样例提示，交付脚本的文件核对、参数准备、复用和错误记录已离线运行。[最小入口](evidence/YJ-02/probe.py) · [已接受图恢复记录](evidence/YJ-02/accepted.json)

## 给 YJ-03 的输入

- **参考关系。** 这次两次更新各使用一张已接受图。保留来源事件、地点、独立视觉版本、输入参考摘要和输出摘要。改变光照使用当前五人版本。无变化事件可以继续指向同一图。
- **结果持久化。** 至少保存原图字节、格式、尺寸、摘要、尝试身份与审阅状态。图已返回与图已接受分别记录。遮挡导致人数不可判定时保留输出并登记原因，明显过时的旧图应隐藏，文字可继续。
- **服务差异。** 请求 ID、查询接口、用量、费用字段容许未知。超时与明确失败分别记录。有可查询 ID 的适配器可查原任务，本批只验证本地结果回读。
- **接续范围。** 来源、参考、复用、结果归属与审阅可先形成契约样例。供应商专有字段和异步恢复须等实际适配器验证。九霄后端直连的最小缺口为一个获准本实验的生成及参考编辑入口、对应凭据或既有认证；正式预算、供应商、规格与密钥保存仍待原定阶段决定。
