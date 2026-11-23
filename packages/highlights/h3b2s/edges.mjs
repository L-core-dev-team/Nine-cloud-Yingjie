// Check source-referenced edges against already observed receipts and frames.
// This verifies internal lineage, independently of the frozen semantic truth labels.
export function inspectEdges(result,ctx){
    const issues=[],catalog=new Map(result.events.map(e=>[e.id,e]));
    let count=0;
    for(const edge of result.edges){
        const bindings=[];
        for(const endpoint of [edge.from,edge.to]){
            if(catalog.has(endpoint)){
                const e=catalog.get(endpoint);
                bindings.push({r:e.learnedAt,frameId:e.frameId,epochs:[e.epoch]});continue;
            }
            let revision,start,end;
            if(typeof endpoint==="string"){
                const m=/^(\d+)@(\d+)$/.exec(endpoint);
                if(m){revision=Number(m[1]);start=Number(m[2]);end=start+1;}
            }else if(endpoint){({revision,start,end}=endpoint);
                const receipt=ctx.receipts[revision-1];
                if(!receipt||endpoint.sourceKey!==receipt.source.key||endpoint.narrativeSha256!==receipt.narrativeSha256)
                    issues.push({edge,reason:"wrong-edge-receipt"});
            }
            const spans=result.rounds[revision-1]?.scope.spans.filter(s=>s.start<end&&start<s.end);
            if(spans?.length&&spans.every(s=>s.world==="current-reality"&&!s.control&&s.frameId===edge.frameId))
                bindings.push({r:revision,frameId:spans[0].frameId,epochs:spans.map(s=>s.epoch)});
        }
        if(bindings.length!==2||bindings.some(b=>b.r>edge.learnedAt||b.frameId!==edge.frameId))
            issues.push({edge,reason:"edge target missing, nonreal or future"});
        if(edge.relation==="effective-under"&&new Set(bindings.flatMap(b=>b.epochs)).size!==1)
            issues.push({edge,reason:"causal support crossed epoch"});
        count++;
    }
    return {count,issues};
}
