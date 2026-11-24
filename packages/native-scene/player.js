"use strict";
const frames=JSON.parse(document.querySelector("#trace").textContent).frames;
const el=id=>document.getElementById(id);
const copy=(id,text)=>{el(id).textContent=text;};
const notes={
    create:["建立序章存档","首次读取存档时，已能确认当前地点。"],
    move:["从芦花渡前往望气台","当前快照已经更新。这一刻尚未单独核验 R1 的历史行程。"],
    blocked:["返回芦花渡受阻","本次行动没有改变顶层地点，继续使用望气台的地点印记。"],
    sub:["移至同地点的子区域","世界地点仍为望气台。具体视角尚未确认。"],
    learn:["重新登录，查证早先的移动","在 R3 取得 R1 的行程证据。此前的回放节点仍保留当时所知。"],
    back:["从子区域返回","活动范围改变，顶层地点仍为望气台。"],
    observe:["完成一次调查","这一回合没有新增能用于画面的可见事实。"],
    bypass:["从望气台绕行返回芦花渡","当前地点由新的存档快照确认。绕行本身没有列入已核验的常规到达记录。"],
    late:["在芦花渡重读 R1","旧记录的目的地是望气台。当前地点仍由 R6 快照决定。"],
    revisit:["从芦花渡再次到达望气台","复访沿用同一地点身份。这次移动在已知行程中另记一笔。"],
    closed:["测试账号已关闭","读取权限已失效，当前地点和先前的行程证据均已隐藏。"]
};
let position=0, preview=true;
function paragraph(parent,text,cls) {
    const p=document.createElement("p");
    p.textContent=text;
    if(cls)p.className=cls;
    parent.append(p);
}
const steps=frames.map((_,i)=>{
    const button=document.createElement("button");
    button.className="step";button.textContent=String(i+1).padStart(2,"0");
    button.setAttribute("aria-label","跳到回放节点 "+(i+1));
    button.onclick=()=>go(i);
    el("steps").append(button);
    return button;
});
function go(i) {position=Math.min(frames.length-1,Math.max(0,i));render();}
function render(){
    const f=frames[position],loc=f.current;
    copy("place",loc?.name??"地点待确认");
    copy("revision",f.revision===null?"权限已失效":"存档 R"+f.revision);
    const [action,note]=notes[f.action];
    copy("action",action);copy("note",note);
    copy("source",loc?"受权存档快照 · R"+f.revision:"当前无可展示的受权快照");
    el("plate").hidden=!preview||!loc;
    el("plate").dataset.id=loc?.id??"";
    copy("glyph",loc?.id==="loc_luhuadu"?"渡":loc?.id==="loc_wangqitai"?"台":"");
    copy("plate-name",loc?.name??"");
    el("no-plate").hidden=preview&&!!loc;
    copy("no-plate",!loc?"位置证据已隐藏":"地点预览已关闭");
    el("toggle").setAttribute("aria-checked",String(preview));
    el("prev").disabled=position===0;el("next").disabled=position===frames.length-1;
    copy("counter","节点 "+(position+1)+" / "+frames.length);
    steps.forEach((button,i)=>{
        button.classList.toggle("visited",i<position);
        if(i===position)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
    });
    el("entries").replaceChildren();
    copy("history-count",f.history.length+" 笔");
    if(!f.history.length)paragraph(el("entries"),loc?"此时尚无已核验的历史到达记录。":"行程已隐藏。");
    for(const h of f.history){
        paragraph(el("entries"),"历史 R"+h.revision+"　"+h.from.name+" → "+h.to.name+"　·　R"+h.learnedRevision+" 获证","event");
    }
    el("fields").replaceChildren();
    if(loc){
        paragraph(el("fields"),"当前位置来自本回放节点的 R"+f.revision+" 已提交快照。完整状态摘要见下。");
        paragraph(el("fields"),f.snapshotSHA256,"checksum");
        for(const h of f.history)paragraph(el("fields"),"历史 R"+h.revision+" · 核验截面 R"+h.observedThroughRevision+" · 首次获证 "+new Date(h.learnedAt).toISOString().replace("T"," ").replace("Z"," UTC"));
        paragraph(el("fields"),"尚未确认：人物名单、场景结构、时间、光照、观察位置与朝向。地点印记只用于区分地点。");
    }else paragraph(el("fields"),"此节点没有可披露的位置或视觉证据。");
}
el("next").onclick=()=>go(position+1);el("prev").onclick=()=>go(position-1);
el("toggle").onclick=()=>{preview=!preview;render();};
el("reset").onclick=()=>{preview=true;el("history").open=true;el("evidence").open=false;go(0);};
document.addEventListener("keydown",event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==="ArrowRight"||event.key==="ArrowLeft"){
        event.preventDefault();go(position+(event.key==="ArrowRight"?1:-1));
    }
});
render();
