import { useEffect, useState } from "react";
import "./yingjie.css";

const automatic=import.meta.env.YJ_AUTOMATIC === true;
type Props = {owner:string; sessionId:string; revision:number};
type Frame = {decision?:string; source?:"preset"|"tasks"|undefined; reason?:string; tags?:string[]; state:string; revision:number; scene:string|null; version:string|null; people:number|null; assetId:string|null};
const messages:Record<string,string>={
  "no-match":"没有可用的预设图。",ambiguous:"地点或素材有歧义，暂不展示。",
  "not-ready":"暂无线索，尚未定位当前场景。",unscheduled:"等待画面计划",queued:"图片任务已准备",waiting:"正在等待图片返回",
  failed:"生成失败，文字行动可继续。",refused:"图片请求被拒绝。",unknown:"结果未知，保留原请求等待核实。",
  disabled:"已停止安排新图，文字行动可继续。",skip:"本轮跳过画面更新。","review-pending":"图片已保存，等待审阅。",
  "review-rejected":"图片未通过审阅。","review-inconclusive":"画面事实尚待核实。","file-missing":"原图缺失或校验失败。",
  "not-sent":"参考图未通过检查，请求尚未发出。","target-inactive":"原显示目标已关闭。",unavailable:"当前画面暂不可用。"
};
const automaticLabels:Record<string,string>={preset:"已审阅预设 · YJ-02",reuse:"复用已审阅图片",edit:"参考编辑 · 本地模拟",generate:"生成 · 本地模拟",skip:"自动选择"};
const presetReasons:Record<string,string>={
  "no-worldbook":"当前会话没有关联世界书。","no-grant":"当前会话没有获准用于配图的世界书条目。",
  "book-version":"世界书版本与授权记录不符。","invalid-book":"世界书暂不可读。","empty-book":"世界书没有可用条目。",
  "unsupported-rule":"该世界书的规则尚未支持配图。","entry-inactive":"已批准的地点条目当前不可用。",
  "different-place":"资料对应其他地点。","structure-mismatch":"地点结构不符。","no-preset":"当前地点没有获准的预设图。",
  "visual-mismatch":"预设图与当前版本或可见事实不符。","asset-rights":"当前素材使用权不足。",
  "review-ineligible":"预设图审阅未通过或已失效。","invalid-original":"预设原件校验失败。","missing-original":"预设原件缺失。"
};
function readPreference(key:string) {
  try { const saved=JSON.parse(sessionStorage.getItem(key)||"null");
    if(saved && typeof saved.id==="string" && Number.isSafeInteger(saved.serial) && typeof saved.enabled==="boolean")return saved;
  } catch { /* Private browsing can disable local storage. */ }
  return {id:crypto.randomUUID(),serial:0,enabled:true,preset:false};
}
export function YingjiePanel({owner,sessionId,revision}:Props) {
  const key="yj-demo-view:"+owner+":"+sessionId;
  const [pref,setPref]=useState<{id:string;serial:number;enabled:boolean;preset?:boolean}>(()=>readPreference(key));
  const [frame,setFrame]=useState<Frame|null>(null);
  const [broken,setBroken]=useState("");
  const path="/api/yingjie/"+encodeURIComponent(sessionId);
  const query="?view="+encodeURIComponent(pref.id)+"&seq="+pref.serial+(pref.preset?"&source=preset":"");
  useEffect(()=>{
    const ctl=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    try {sessionStorage.setItem(key,JSON.stringify(pref));}catch{}
    async function refresh(first:boolean) {
      try {
        const r=await fetch(path+query,{method:first?"POST":"GET",credentials:"same-origin",cache:"no-store",
          signal:ctl.signal,headers:{"x-jiuxiao-account":owner,"content-type":"application/json"},
          ...(first?{body:JSON.stringify({enabled:pref.enabled})}:{})});
        if(!r.ok)throw Error("view-unavailable");
        const next=await r.json();
        if(!ctl.signal.aborted){
          setFrame(next);
          if(next.revision===revision && pref.enabled)
            timer=setTimeout(()=>void refresh(automatic && next.state==="unscheduled"),["queued","waiting","review-pending","unscheduled"].includes(next.state)?300:1800);
        }
      } catch { if(!ctl.signal.aborted)setFrame({source:pref.preset?"preset":undefined,revision,state:"unavailable",scene:null,version:null,people:null,assetId:null}); }
    }
    void refresh(true);
    return ()=>{ctl.abort();clearTimeout(timer);};
  },[path,query,owner,revision,key,pref]);
  const current=frame?.revision===revision && (automatic || (frame.source==="preset")===Boolean(pref.preset))?frame:null;
  const state=!pref.enabled?"disabled":current?.state??"queued";
  const src=state==="display" && current?.assetId ? path+(current.source==="preset"?"/preset/":"/original/")+current.assetId+query : "";
  const show=src && broken!==src;
  return <section className="yj-panel" aria-label="映界场景">
    <div className="yj-panel-head"><div><span className="yj-mode">映界 · 固定样例</span><h2>{current?.scene??"场景画面"}</h2></div>
      <button className="yj-toggle" role="switch" aria-checked={pref.enabled} aria-label="生成图片"
        onClick={()=>{setFrame(null);setBroken("");setPref(p=>({...p,serial:p.serial+1,enabled:!p.enabled}));}}>
        <span aria-hidden="true" className="yj-track"/>{pref.enabled?"生图已开":"生图已关"}</button></div>
    {!automatic && <label className="yj-source">画面来源 <select aria-label="画面来源" value={pref.preset?"preset":"tasks"} onChange={e=>{
      const preset=e.target.value==="preset";setFrame(null);setBroken("");setPref(p=>({...p,preset,serial:p.serial+1}));
    }}><option value="tasks">本地模拟图片任务</option><option value="preset">世界书预设</option></select></label>}
    <figure className="yj-figure" data-decision={current?.decision??""} data-state={state} data-reason={current?.reason??""} data-version={current?.version??""}>
      {show?<img alt={current?.scene+"，"+current?.people+"人在场"} src={src} onError={()=>setBroken(src)}/>:
        <div className="yj-empty" role="status">{src && broken===src?"原图加载失败。":((state==="no-match" || automatic && state==="skip") && current?.reason?presetReasons[current.reason]:undefined)??messages[state]??"当前图片不适用。"}</div>}
      <figcaption><span>{automatic?(automaticLabels[current?.decision??"skip"]??"自动选择"):pref.preset?(show?"已审阅预设 · YJ-02 酒馆样例":"世界书预设"):(show?"YJ-02 酒馆原图 · 本地模拟":"本地模拟图片任务")}</span>
      {show && current?.tags?.length ? <span>{current.tags.join(" · ")}</span>:null}
      {current?.version&&<span>{current.version} · {current.people} 人</span>}</figcaption>
    </figure>
  </section>;
}
