// Public replay proofs. These are not additional holdout scores.
import {loadRules,simulate,makeReader} from "./host.mjs";
import {readCorpus} from "./measure.mjs";
import {createNativeFactReplay} from "../admission.mjs";
const core=await loadRules(process.argv[2]),examples={};
for(const part of ["dev","held"]){
    const s=readCorpus(part,"input")[0],repo=await simulate(core,s);
    const api=createNativeFactReplay(makeReader(repo));
    for(const [i,ref] of repo.refs.entries()){
        const v=api.inspect(ref);if(examples[v.reason])continue;
        const r=repo.records[i];
        examples[v.reason]={story:s.id,ref,owner:r.owner,actualReadRevision:repo.through,
            before:r.before,receipt:r.receipt,persistedEventOrder:r.batch.map(e=>e.event.id),after:r.after,
            verdict:v,prose:s.turns[i].plain};
    }
}
console.log(JSON.stringify(examples));
