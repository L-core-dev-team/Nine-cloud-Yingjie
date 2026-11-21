"use strict";
(async()=>{
  const el=id=>document.getElementById(id);
  const key=el("key"),project=el("project"),check=el("check"),start=el("start"),clear=el("clear"),status=el("status");
  let session=location.hash.slice(1),timer,held=false,finished=false;
  history.replaceState(null,"","/");
  function lock(){for(const control of [key,project,check,start,clear])control.disabled=true;key.value="";}
  function end(message){finished=true;clearInterval(timer);session="";lock();status.textContent=message;}
  async function post(path,body="",extra={},keepalive=false){
    const r=await fetch(path,{method:"POST",mode:"same-origin",credentials:"omit",cache:"no-store",redirect:"error",
      referrerPolicy:"no-referrer",keepalive,headers:{"Content-Type":"application/octet-stream","X-YJ-Session":session,...extra},body});
    if(!r.ok)throw Error("STOP");
    return r.json();
  }
  const stop=()=>end("会话已结束。若已点击开始，请核对本机脱敏回执。");
  if(!/^[A-Za-z0-9_-]{43}$/.test(session)){end("请从本机的一次性邀请链接进入。");return;}
  try{({session}=await post("/claim"));}catch{end("邀请已使用或已过期。");return;}
  key.disabled=project.disabled=check.disabled=clear.disabled=false;
  status.textContent="可以填写密钥。检查配置只在本机运行。";
  const leave=()=>{if(!finished){void post("/clear","",{},true).catch(()=>{});end("本次输入已清除。");}};
  addEventListener("pagehide",leave,{once:true});
  addEventListener("pageshow",e=>{if(e.persisted)leave();});
  timer=setInterval(()=>post("/ping").catch(stop),8000);
  project.onchange=()=>{start.disabled=true;check.disabled=false;};
  check.onclick=async()=>{
    check.disabled=start.disabled=project.disabled=key.disabled=true;
    const payload=key.value;key.value="";
    try{
      const r=await post("/check",payload,{"X-YJ-Project":project.checked?"verified":"unconfirmed"});
      if(finished)return;
      held=r.held;key.disabled=held;project.disabled=check.disabled=false;
      start.disabled=r.status!=="READY";
      const reasons={PROJECT_MODEL_STANDARD_ACCESS_UNCONFIRMED:"请先核实并勾选项目权限和费率。",
        API_KEY_NOT_CONFIGURED:"请填写密钥。",APPROVAL_LOCKED:"这笔许可已被占用。",BUDGET_GATE_NOT_VERIFIED:"当日价格尚未通过核查。",
        LEDGER_UNAVAILABLE:"无法读取本机单次账本。",TLS_POLICY_NOT_VERIFIED:"TLS 验证未通过。"};
      status.textContent=start.disabled?r.reasons.map(x=>reasons[x]??"本机条件未就绪。").join(" "):
        "本机预检通过。项目权限由你确认，实际访问须由首次响应验证。";
    }catch{leave();}
  };
  clear.onclick=async()=>{lock();try{await post("/clear");}finally{end("本次输入已清除。");}};
  start.onclick=async()=>{
    if(start.disabled || !held || !project.checked)return;
    lock();clear.disabled=false;
    status.textContent="正在执行单次文字测试，请保持页面打开。";
    try{
      const r=await post("/start","",{"X-YJ-Confirm":"one-luna-text"});
      const cost=r.usage?.estimatedNanoUsd;
      end("测试已停止 · "+r.status+(r.revision?" · 修订 "+r.revision:"")+
        (cost!=null?" · 估算 USD "+(cost/1e9):"")+"。");
    }catch{stop();}
  };
})();
