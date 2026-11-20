import manifest from "./reviewed-elements.json" with {type:"json"};

const byDigest=new Map(manifest.assets.map(item=>[item.sha256,item]));
const fields=["sceneId","people","features","timeOfDay","lighting","viewpoint","perspective"];
const comparable=value=>Array.isArray(value)?JSON.stringify([...value].sort()):value;

// The review describes the original's own target. Later display/reference rights are checked separately.
export function assessFixture(digest,visual){
  const known=byDigest.get(digest);
  if(!known)return {status:"pending",assessment:"indeterminate",basis:"unlisted-fixture",reason:"no-reviewed-elements"};
  const differences=fields.filter(field=>comparable(known[field])!==comparable(visual[field]));
  return {status:differences.length?"rejected":"accepted",assessment:differences.length?"contradicts":"matches",
    basis:"reviewed-elements.json#"+known.id,reason:differences.length?"mismatch:"+differences.join(","):"reviewed-elements-match"};
}
