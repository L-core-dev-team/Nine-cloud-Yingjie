"use strict";
(async()=>{
  const el=id=>document.getElementById(id);
  const key=el("key"),project=el("project"),check=el("check"),start=el("start"),clear=el("clear"),status=el("status");
  const l4=document.body.dataset.pilot==="l4";
  const offline=document.body.dataset.pilot==="l5-offline";
  let session=location.hash.slice(1),timer,held=false,finished=false,started=false;
  history.replaceState(null,"","/");
  function lock(){for(const control of [key,project,check,start,clear])control.disabled=true;key.value="";}
  function end(message){if(finished)return;finished=true;clearInterval(timer);session="";lock();status.textContent=message;}
  async function post(path,body="",extra={},keepalive=false){
    const r=await fetch(path,{method:"POST",mode:"same-origin",credentials:"omit",cache:"no-store",redirect:"error",
      referrerPolicy:"no-referrer",keepalive,headers:{"Content-Type":"application/octet-stream","X-YJ-Session":session,...extra},body});
    if(path==="/start" && r.ok && r.headers.get("X-YJ-Start")==="accepted" && !finished)
      status.textContent="服务器已接受执行，正在等待回执。";
    if(!r.ok){
      const data=await r.json();
      throw Error(data.status==="START_REJECTED_BEFORE_SEND" || data.status==="INVITE_EXPIRED"?data.status:"REQUEST_REJECTED");
    }
    return r.json();
  }
  const unknown="执行结果未知，无法排除已发送。请只读核对本机阶段记录和账本。";
  const stop=()=>end(started?unknown:"检查会话连接已中断，尚未在本页提交执行。");
  if(!/^[A-Za-z0-9_-]{43}$/.test(session)){end("请从本机的一次性邀请链接进入。");return;}
  try{
    const claim=await post("/claim");session=claim.session;
    const audit=document.createElement("small");audit.textContent="本机核查编号 "+claim.runHash;
    status.after(audit);
  }catch(error){end(error.message==="INVITE_EXPIRED"?"本机邀请已过期。":"一次性邀请无效或服务不可达。");return;}
  key.disabled=project.disabled=check.disabled=clear.disabled=false;
  status.textContent=offline?"离线演练已就绪，仅使用页面内置假凭据。":l4?"可以填写密钥。检查只查询 OpenAI 模型权限。":"可以填写密钥。检查配置只在本机运行。";
  const leave=()=>{if(!finished){void post("/clear","",{},true).catch(()=>{});end(started?unknown:"本次输入已清除。");}};
  addEventListener("pagehide",leave,{once:true});
  addEventListener("pageshow",e=>{if(e.persisted)leave();});
  timer=setInterval(()=>post("/ping").catch(()=>{if(!started && !finished)stop();}),8000);
  project.onchange=()=>{start.disabled=true;check.disabled=false;};
  check.onclick=async()=>{
    check.disabled=start.disabled=project.disabled=key.disabled=true;
    const payload=key.value;key.value="";
    try{
      const r=await post("/check",payload,{"X-YJ-Project":project.checked?"verified":"unconfirmed"});
      if(finished)return;
      held=r.held;key.disabled=held;project.disabled=check.disabled=false;
      start.disabled=r.status!=="READY";
      const reasons={MODEL_VISIBILITY_UNCONFIRMED:"未能核实该 Key 的 Luna 模型可见性。可清除并重新打开本机入口。",PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED:"请先核实并勾选项目权限和费率。",
        API_KEY_NOT_CONFIGURED:"请填写密钥。",APPROVAL_LOCKED:"这笔许可已被占用。",BUDGET_GATE_NOT_VERIFIED:"当日价格尚未通过核查。",
        LEDGER_UNAVAILABLE:"无法读取本机单次账本。",TLS_POLICY_NOT_VERIFIED:"TLS 验证未通过。"};
      status.textContent=start.disabled?r.reasons.map(x=>reasons[x]??"本机条件未就绪。").join(" "):
        (offline?"本机模拟门禁通过。可以确认执行一次离线演练。":l4?"项目可见性与本机门禁通过。点击执行按钮才发送合成文字。":"本机预检通过。项目权限由你确认，实际访问须由首次响应验证。");
    }catch{void post("/clear","",{},true).catch(()=>{});end("检查失败，尚未在本页提交执行。");}
  };
  clear.onclick=async()=>{lock();try{await post("/clear");}finally{end(started?unknown:"本次输入已清除。");}};
  start.onclick=async()=>{
    if(start.disabled || !held || !project.checked)return;
    started=true;lock();
    status.textContent="正在执行单次文字测试，请保持页面打开。";
    try{
      const r=await post("/start","",{"X-YJ-Confirm":"one-luna-text"});
      if(["START_REJECTED_BEFORE_SEND","RECEIPT_WRITE_FAILED_BEFORE_SEND","LEDGER_UNAVAILABLE_BEFORE_SEND"].includes(r.status)){
        end("服务器确认本次执行在发送前失败 · "+r.status);return;
      }
      if(["UNKNOWN_STOP","POSSIBLE_SEND_UNCONFIRMED","RECEIPT_WRITE_FAILED"].includes(r.status)){
        end("测试已停止 · "+r.status+" · "+unknown);return;
      }
      if(r.status==="HISTORY_COMMITTED_SCENE_UNVERIFIED"){end("completed-history 已保存并校验，场景仍待核查。");return;}
      if(r.status==="ACKNOWLEDGED_HISTORY_UNVERIFIED"){
        end("服务端已记录模型回包，completed-history 尚未校验 · "+r.status);return;
      }
      if(r.status==="MOCK_HISTORY_VERIFIED"){
        end("模拟回包，completed-history 已保存并校验 · 修订 "+r.revision+" · scene "+r.scene);return;
      }
      const cost=r.usage?.estimatedNanoUsd;
      end("测试已停止 · "+r.status+(r.scene?" · "+r.scene:"")+(r.revision?" · 修订 "+r.revision:"")+
        (cost!=null?" · 估算 USD "+(cost/1e9):"")+"。");
    }catch(error){if(error.message==="START_REJECTED_BEFORE_SEND")end("服务器确认本次执行在发送前被拒绝。");else if(error.message==="INVITE_EXPIRED")end("服务器确认邀请已过期，本次操作在受理前终止。");else stop();}
  };
})();
