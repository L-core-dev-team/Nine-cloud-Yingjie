import assert from "node:assert/strict";
import {readCorpus,verifyFreeze} from "./measure.mjs";
import {loadRules,simulate,makeReader} from "./host.mjs";
import {createNativeFactReplay,digest} from "../admission.mjs";
const core=await loadRules(process.argv[2]);verifyFreeze();
const results=[],failures=[];let checked=0,deniedFuture=0;
for(const part of ["dev","held"])for(const s of readCorpus(part,"input")){
    const all=await simulate(core,s),full=createNativeFactReplay(makeReader(all));
    const expected=all.refs.map(ref=>full.inspect(ref)),prefixes=[];
    for(let n=1;n<=s.turns.length;n++){
        try{
            const cut=await simulate(core,{...s,turns:s.turns.slice(0,n)});
            const v=createNativeFactReplay(makeReader(cut)),again=cut.refs.map(ref=>v.inspect(ref));
            assert.deepEqual(again,expected.slice(0,n));
            assert.deepEqual(cut.records.map(r=>r.receiptSha),all.records.slice(0,n).map(r=>r.receiptSha));
            assert.deepEqual(cut.records.at(-1).after,all.records[n-1].after);
            if(n<all.refs.length){
                const limited=createNativeFactReplay(makeReader(all,{through:n}));
                assert.equal(limited.inspect(all.refs[n]).status,"UNVERIFIED");deniedFuture++;
            }
            prefixes.push(digest(again));checked++;
        }catch(e){failures.push({id:s.id,n,error:String(e.message).slice(0,500)});}
    }
    results.push({id:s.id,checked:prefixes.length,orderedPrefixDigest:digest(prefixes)});
}
console.log(JSON.stringify({checked,deniedFuture,results,failures}));if(failures.length)process.exitCode=1;
