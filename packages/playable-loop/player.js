const el=id=>document.getElementById(id);
let game,selected=null,locked=false;
const renderer=el("frame")?await import("/visual-player.js"):null;
async function request(path,data){
 const r=await fetch(path,data===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 const x=await r.json();if(!r.ok)throw Error(x.error||"读取失败");return x;
}
function button(text,fn){const b=document.createElement("button");b.textContent=text;b.onclick=()=>fn().catch(e=>el("msg").textContent=e.message);return b}
function render(){
 const rev=selected??game.current.revision,entry=game.history.find(h=>h.revision===rev),past=selected!==null;
 el("where").textContent=(past?"历史 · ":"当前 · ")+(rev?"第 "+rev+" 回合":"初至渡口");
 const place=past?entry?.native:game.current;
 el("title").textContent=place?.place??"地点待核";
 if(place?.sub==="subloc_ferry_berm")el("where").textContent+=" · 渡口作业位";
 el("text").textContent=entry?.text??(rev?"本回合正文待恢复。":"请选择行动，开始这段行程。");
 const slots=game.slots.filter(s=>s.rev===rev),timing=slots.find(s=>s.kind==="timing"),state=slots.find(s=>s.kind==="state");
 el("analysis").textContent=timing?.result?.valid?({update:"建议更新画面",defer:"建议等一等","text-only":"建议保留文字","needs-review":"时机待核"}[timing.result.intent]+" · "+timing.result.reason):rev?(timing?.result?"时机判断待核":"分析待回传 · 可继续行动"):"";
 el("diag").textContent=JSON.stringify({地点来源:past?"历史回合记录":"已认证原生当前存档",地点:place?.place,子区域:place?.sub,奖励已领:place?.quest?.rewardClaimed,正文来源:entry?.source,状态:state?.result??"待回传",时机:timing?.result??"待回传",参考图:"无",send:false},null,2);
 if(renderer && game.visual){
   renderer.renderPicture(game,rev,past,refresh,request);
   el("diag").textContent=JSON.stringify({修订:rev,正文来源:entry?.source,地点:place?.place,子区域:place?.sub,奖励已领:place?.quest?.rewardClaimed,画面:game.visual.frames[rev]??"本回合无适用图",配图依据:game.visual.evidence?.[rev]},null,2);
 }
 el("current").hidden=!past;el("choices").replaceChildren();el("history").replaceChildren();
 if(!past && (game.continuing || game.current.revision<8))for(const c of game.current.actions){const b=button(c.label,async()=>{
   if(locked)return;locked=true;b.disabled=true;try{const scope=game.scope,r=game.current.revision;
   const k=scope+"-"+r+"-"+c.id;const key=sessionStorage.getItem(k)??crypto.randomUUID();sessionStorage.setItem(k,key);
   await request("/act",{scope,revision:r,id:c.id,key});el("msg").textContent="";await refresh()}finally{locked=false;b.disabled=false}
 });b.dataset.action=c.id;el("choices").append(b)}
 if(!past && !game.continuing && game.current.revision===8)el("choices").textContent="八回合已完成，可以回看沿途记录。";
 for(const h of game.history){const b=button("R"+h.revision+" "+h.action,async()=>{selected=h.revision;render()});b.dataset.rev=h.revision;b.setAttribute("aria-current",String(rev===h.revision));el("history").append(b)}
}
async function refresh(){game=await request("/game");render()}
el("current").onclick=()=>{selected=null;render()};
el("logout").onclick=async()=>{try{await request("/logout",{});location.reload()}catch(e){el("msg").textContent=e.message}};
try{if(location.hash){const ticket=location.hash.slice(1);history.replaceState(null,"","/");await request("/enter",{ticket})}await refresh();
 setInterval(async()=>{if(!locked)try{const next=await request("/game");if(JSON.stringify(next)!==JSON.stringify(game)){game=next;render()}}catch{}},2500);
}catch(e){el("where").textContent="会话未打开";el("msg").textContent=e.message}
