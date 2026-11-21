import {readFileSync} from "node:fs";
import {join} from "node:path";

export function yingjiePlugin(webRoot) {
  const dir=join(webRoot,"src","routes").replaceAll("\\","/");
  return {name:"yingjie-card-session",enforce:"pre",
    resolveId(id,importer) {
      if(importer?.replaceAll("\\","/").startsWith(dir+"/") && ["./YingjiePanel","./ImageHistory","./yingjie.css"].includes(id))
        return dir+"/"+(id.endsWith(".css")?"yingjie.css":id.slice(2)+".tsx");
    },
    load(id) {
      for(const name of ["YingjiePanel.tsx","ImageHistory.tsx","yingjie.css"])if(id.replaceAll("\\","/")===dir+"/"+name)
        return readFileSync(new URL(name,import.meta.url),"utf8");
    },
    transform(code,id) {
      if(id.replaceAll("\\","/")!==dir+"/CardSession.tsx")return;
      const edit=(a,b)=>{if(code.split(a).length!==2)throw Error("Upstream CardSession mount changed: "+a);code=code.replace(a,b);};
      edit("type Props =", 'import { YingjiePanel } from "./YingjiePanel";\ntype Props =');
      edit("  const pendingKey=", `  const modeKey="yj-mode:"+owner+":"+sessionId;
  const [yingjie,setYingjie]=useState(()=>{try{return sessionStorage.getItem(modeKey)==="open"}catch{return false}});
  const pendingKey=`);
      edit('<button className="secondary" onClick={back}>',`{session&&!members&&<button type="button" className="secondary" aria-pressed={yingjie} onClick={()=>{
        try{sessionStorage.setItem(modeKey,yingjie?"closed":"open")}catch{} setYingjie(!yingjie);
      }}>{yingjie?"收起映界":"进入映界"}</button>}<button className="secondary" onClick={back}>`);
      edit('<div className="game-workspace card-session">','<div className="game-workspace card-session">{yingjie && session && !members && <YingjiePanel key={modeKey} owner={owner} sessionId={sessionId} revision={session.revision}/>}');
      return {code,map:null};
    }
  };
}
