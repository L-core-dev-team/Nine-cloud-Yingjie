import {useEffect,useRef,useState} from "react";

type Round={revision:number;name:string|null;version:string|null;action:string|null;state:string|null;reason:string|null};
type Medium={kind:string;id:string;revision:number;status:string;generation?:string;review?:string;rejection?:string;readable:boolean;
  reports:{id:string;category:string;status:string}[];changes:{seq:string;prior:string|null;status:string}[]};
type Detail=Round & {choices:{action:string|null;reason:string|null;trigger:string|null}[];task:{id:string;action:string}|null;
  attempts:{id:string;ordinal:number;outcome:string;asset:string|null}[];media:Medium[]};
const names:Record<string,string>={preset:"预设",generate:"生成",edit:"参考编辑",reuse:"复用",skip:"跳过",display:"可显示",
  returned:"已返回",waiting:"等待中",failed:"失败",refused:"已拒绝",unknown:"结果未知",eligible:"可查看",
  invalidated:"经审阅撤下",dismissed:"已审阅，维持原判","pending-review":"待审",accepted:"已接受",rejected:"已拒绝",
  pending:"待审","review-pending":"图片待审","review-rejected":"图片未通过审阅","file-missing":"原件校验失败",
  unavailable:"当前不可读取","no-grant":"授权已撤回","unchanged-visual":"场景未变","visible-facts-changed":"可见事实变化",
  "no-eligible-reference":"没有可用参考","reviewed-preset":"已审预设","same-reviewed-visual":"沿用已审图片",
  "outside-local-provider":"缺少合适素材","people-changed":"人数变化","new-place":"新地点","not-ready":"现场待核实",
  "light-or-time-changed":"时段或光照变化","prior-attempt":"保留原请求","disabled":"生图已关闭"};
const label=(s:string|null|undefined)=>s?(names[s]??s):"未记录";
const fields:Record<string,string>={people:"人数",features:"结构",sceneId:"地点",timeOfDay:"时段",lighting:"光照",viewpoint:"视角",perspective:"观察位置"};
const categories={people:"人数",place:"地点",structure:"结构",light:"时间或光照",view:"视角",secret:"未揭示信息",other:"其他或无法判断"};

type Pending={command:string;fingerprint:string};
async function fingerprint(command:string,m:Medium,category:string,note:string){
  const data=JSON.stringify([command,m.kind,m.id,m.revision,m.generation,category,note]);
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
export function ImageHistory({path,owner,revision,permit}:{path:string;owner:string;revision:number;permit:string}){
  const key="yj-feedback:"+owner+":"+path;
  function pending():Pending[]{
    const entries:unknown=JSON.parse(sessionStorage.getItem(key)??"[]");
    if(!Array.isArray(entries))throw Error("invalid-pending-state");
    return entries.filter(p=>typeof p?.command==="string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(p.command) &&
      typeof p.fingerprint==="string" && /^[0-9a-f]{64}$/.test(p.fingerprint));
  }
  const save=(items:Pending[])=>items.length?sessionStorage.setItem(key,JSON.stringify(items)):sessionStorage.removeItem(key);
  const forget=(command:string)=>save(pending().filter(p=>p.command!==command));
  const identity=owner+"|"+path+"|"+revision+"|"+permit,live=useRef(identity),serial=useRef(0);
  live.current=identity;
  const matches=(r:Response)=>r.headers.get("x-yj-owner")===owner &&
    r.headers.get("x-yj-session")===path.split("/").at(-1) && r.headers.get("x-yj-revision")===String(revision);
  const [recovery,recover]=useState("");
  const [open,setOpen]=useState(false),[cursors,setCursors]=useState<number[]>([]);
  const [list,setList]=useState<Round[]>([]),[next,setNext]=useState<number|null>(null);
  const [selected,select]=useState<number|null>(null),[detail,setDetail]=useState<Detail|null>(null);
  const [preview,show]=useState(""),[feedback,form]=useState<Medium|null>(null),[category,setCategory]=useState("people");
  const [note,setNote]=useState(""),[message,notify]=useState(""),[refresh,update]=useState(0),[busy,setBusy]=useState(false);
  const post=useRef<AbortController|null>(null);
  function clearSelection(){serial.current++;post.current?.abort();setBusy(false);form(null);show("");setDetail(null);notify("");}
  useEffect(()=>()=>{serial.current++;post.current?.abort();},[]);
  useEffect(()=>{
    if(!open)return;
    const seq=++serial.current,valid=()=>serial.current===seq && live.current===identity;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const get=async(url:string,headers:Record<string,string>={})=>{
      const r=await fetch(url,{signal:controller.signal,credentials:"same-origin",cache:"no-store",headers:{"x-jiuxiao-account":owner,...headers}});
      if(!r.ok || !matches(r))throw Error("unavailable");return r.json();
    };
    async function read(){
      try{
        const before=cursors.at(-1);
        const page=await get(path+"/history"+(before?"?before="+before:""));
        const item:Detail|null=selected?await get(path+"/history/"+selected):null;
        if(!valid() || controller.signal.aborted)return;
        const checked:Pending[]=[];let waiting=false;
        for(const p of pending()){
          // A live POST owns its acknowledgement until it succeeds or fails.
          if(post.current && !post.current.signal.aborted)break;
          const receipt=await get(path+"/feedback/"+p.command,{"x-yj-fingerprint":p.fingerprint});
          if(!valid() || controller.signal.aborted)return;
          if(receipt.status==="committed")checked.push(p);else waiting=true;
        }
        const auth=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!auth.ok || (await auth.json()).account?.id!==owner)throw Error("account-changed");
        if(!valid() || controller.signal.aborted)return;
        for(const p of checked)forget(p.command);
        if(waiting)recover("尚未查到回执，可重新填写原反馈后提交。");
        else if(checked.length)recover("已核对原反馈，提交记录已保存。");
        setList(page.items);setNext(page.next);setDetail(item);
        if(item){
          show(id=>item.media.some(m=>m.id===id && m.readable)?id:"");
          form(old=>old && item.media.some(m=>m.id===old.id && m.generation===old.generation)?old:null);
        }
      }catch{
        if(!valid() || controller.signal.aborted)return;
        recover("");setList([]);setNext(null);setDetail(null);show("");form(null);notify("历史暂不可读取。");
      }
      timer=setTimeout(()=>void read(),2500);
    }
    void read();return ()=>{serial.current++;controller.abort();clearTimeout(timer);};
  },[open,identity,cursors,selected,refresh]);
  async function send(){
    if(!feedback || post.current && !post.current.signal.aborted)return;
    const ctl=new AbortController();post.current=ctl;setBusy(true);
    try{
      const entries=pending();let saved:Pending|undefined;
      for(const p of entries)if(await fingerprint(p.command,feedback,category,note)===p.fingerprint){saved=p;break;}
      if(ctl.signal.aborted || live.current!==identity)return;
      if(!saved){
        const id=crypto.randomUUID();
        saved={command:id,fingerprint:await fingerprint(id,feedback,category,note)};
        if(ctl.signal.aborted || live.current!==identity)return;
        save([...pending(),saved]);
      }
      const r=await fetch(path+"/feedback",{method:"POST",credentials:"same-origin",signal:ctl.signal,
        headers:{"Content-Type":"application/json","x-jiuxiao-account":owner},
        body:JSON.stringify({id:feedback.id,kind:feedback.kind,revision:feedback.revision,generation:feedback.generation,
          category,note,command:saved.command})});
      if(!r.ok || !matches(r))throw Error("feedback-failed");
      if(!ctl.signal.aborted && live.current===identity){forget(saved.command);recover("");form(null);notify("反馈已记录，等待审阅。");update(x=>x+1);}
    }catch{if(!ctl.signal.aborted && live.current===identity)notify("反馈未确认，请刷新核对后重试。");}
    finally{if(post.current===ctl){post.current=null;setBusy(false);}}
  }
  return <section className="yj-history" aria-label="本会话图片历史">
    <button type="button" aria-expanded={open} onClick={()=>{clearSelection();select(null);setList([]);setCursors([]);setNext(null);setOpen(!open);}}>本会话图片历史</button>
    {open && <div className="yj-history-body">
      <ol>{list.map(row=><li key={row.revision}><button type="button" aria-pressed={row.revision===selected} onClick={()=>{
        clearSelection();select(row.revision);update(n=>n+1);
      }}>第 {row.revision} 轮 · {row.name??"未定位"} {row.version} · {label(row.action)}{row.state?" · "+label(row.state):""}</button></li>)}</ol>
      {next && <button onClick={()=>{clearSelection();select(null);setCursors([...cursors,next]);}}>更早回合</button>}
      {!!cursors.length && <button onClick={()=>{clearSelection();select(null);setCursors(cursors.slice(0,-1));}}>较新回合</button>}
      {!list.length && <p>暂无可读取的历史回合。</p>}
      {detail && <article aria-label={"第 "+detail.revision+" 轮详情"}>
        <h3>第 {detail.revision} 轮 · {detail.name??"未定位"} {detail.version}</h3>
        <p>{label(detail.action)} · {label(detail.reason)}</p>
        <details><summary>选择记录（{detail.choices.length}）</summary>{detail.choices.map((c,i)=><p key={i}>{label(c.action)} · {label(c.reason)} · 触发依据 {label(c.trigger)}</p>)}</details>
        {detail.attempts.map(a=><p key={a.id}>尝试 {a.ordinal} · {label(a.outcome)}</p>)}
        {detail.media.map(m=><div key={m.id} className="yj-h-item"><p>{m.kind==="preset"?"预设原件":"第 "+m.revision+" 轮原件"} · {label(m.status)}{m.rejection?.startsWith("mismatch:")?" · "+m.rejection.slice(9).split(",").map(k=>fields[k]??k).join("、")+"不符":""}</p>
          {m.readable && <button onClick={()=>show(preview===m.id?"":m.id)}>{preview===m.id?"收起原图":"查看历史原图"}</button>}
          {m.generation && m.status!=="invalidated" && <button onClick={()=>{form(m);setNote("");setCategory("people");notify("");}}>反馈图片问题</button>}
          {preview===m.id && m.readable && <img alt="历史原图" src={path+"/history/"+m.revision+"/"+m.kind+"/"+m.id} onError={()=>{show("");notify("原件已不可读取。");}}/>}
          {m.changes.length>0 && <details><summary>审阅记录（{m.changes.length}）</summary>{m.changes.map(c=><p key={c.seq}>{label(c.prior)} → {label(c.status)}</p>)}</details>}
          {m.reports.map(r=><p key={r.id}>{categories[r.category as keyof typeof categories]}反馈 · {label(r.status)}</p>)}
        </div>)}
      </article>}
      {feedback && <form onSubmit={e=>{e.preventDefault();void send();}}><label>问题类别<select value={category} onChange={e=>{setCategory(e.target.value);}}>
        {Object.entries(categories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        <label>补充说明（选填）<input maxLength={180} value={note} onChange={e=>{setNote(e.target.value);}}/></label>
        <button disabled={busy}>提交图片反馈</button></form>}
      <p role="status">{message}</p>{recovery && <p role="status">{recovery}</p>}
    </div>}
  </section>;
}
