import {hash} from "../scene-state/store.mjs";

const registered=new WeakSet();
export const isSceneRegistry=directory=>registered.has(directory);

// Host-owned synthetic catalogue. A match supplies identity, never people or visible architecture.
export function createSceneRegistry(entries) {
  const ids=new Set(), index=new Map();
  const label=value=>typeof value==="string" && /^[\p{Script=Han}]{1,24}$/u.test(value);
  const places=entries.map(({sceneId,parentSceneId,name,aliases=[]})=>{
    if(typeof sceneId!=="string" || !/^[a-z][a-z0-9-]{0,63}$/.test(sceneId) || ids.has(sceneId) ||
      !label(parentSceneId) || !label(name) || !Array.isArray(aliases) || !aliases.every(label))
      throw Error("invalid-trusted-directory");
    ids.add(sceneId);
    const place=Object.freeze({sceneId,parentSceneId,name,aliases:Object.freeze([...aliases].sort())});
    for(const term of new Set([name,...aliases])){
      if(!index.has(term))index.set(term,[]);
      index.get(term).push(place);
    }
    return place;
  });
  const directory=Object.freeze({digest:hash(JSON.stringify(places.sort((a,b)=>a.sceneId.localeCompare(b.sceneId,"en")))),
    resolve(name,parent){
      const matches=(index.get(name)??[]).filter(p=>!parent || p.parentSceneId===parent);
      return matches.length===1?{place:matches[0]}:{reason:matches.length?"ambiguous-place":"unknown-place"};
    }});
  registered.add(directory);
  return directory;
}
export const syntheticRegistry=createSceneRegistry([
  {sceneId:"east",parentSceneId:"东村",name:"青石酒馆",aliases:["东村老店"]},
  {sceneId:"west",parentSceneId:"西村",name:"青石酒馆",aliases:["河畔酒肆"]},
  {sceneId:"north-observatory",parentSceneId:"北城",name:"观星楼",aliases:["望星台"]},
  {sceneId:"pine-gate",parentSceneId:"松岭",name:"宗门山门",aliases:["听松门"]},
  {sceneId:"bamboo-lodge",parentSceneId:"竹谷",name:"竹林客舍",aliases:["听竹轩"]},
  {sceneId:"cloud-walk",parentSceneId:"南峰",name:"云海栈道",aliases:["云廊"]}
]);
