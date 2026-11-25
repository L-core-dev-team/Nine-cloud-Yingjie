const el=id=>document.getElementById(id);
let rendering=0,lastView=null;
export function renderPicture(game,rev,past,refresh,request) {
  const {enabled,frames}=game.visual,info=frames[rev],mode=past?"history":"current";
  const url=info?"/pictures/"+mode+"/"+rev+"/"+info.key:null;
  const toggle=el("toggle");
  toggle.textContent=enabled?"关闭配图":"开启配图";
  toggle.setAttribute("aria-pressed",String(enabled));
  toggle.onclick=async()=>{toggle.disabled=true;
    try{await request("/pictures/preference",{scope:game.scope,enabled:!enabled});await refresh()}
    catch(e){el("msg").textContent=e.message}finally{toggle.disabled=false}
  };
  const view=JSON.stringify([game.scope,rev,mode,enabled,url]);
  if(lastView===view)return;
  lastView=view;
  const epoch=++rendering,sheet=el("sheet"),frame=el("frame"),caption=el("caption");
  sheet.replaceChildren();frame.hidden=true;caption.textContent="";
  if(!enabled||!info)return;
  const img=new Image();img.alt=info.title;img.src=url;
  async function display(){
    try{
      await img.decode();
      if(epoch!==rendering)return;
      sheet.replaceChildren(img);frame.hidden=false;
      caption.textContent=(past?"历史画面 · ":info.basis==="上次所见"?"上次所见 · ":"")+info.title;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(epoch===rendering && img.isConnected && img.getBoundingClientRect().width>0)
        await request(url,{outcome:"decoded"});
    }catch{
      if(epoch!==rendering)return;
      sheet.replaceChildren();frame.hidden=false;caption.textContent="配图暂不可读，仍可继续行动。";
      await request(url,{outcome:"failed"}).catch(()=>{});
    }
  }
  void display();
}
