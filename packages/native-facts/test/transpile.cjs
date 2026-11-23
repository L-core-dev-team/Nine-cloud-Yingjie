const fs = require("node:fs");
const path = require("node:path");
const [repo, out] = process.argv.slice(2).map(value=>path.resolve(value));
const compiler = require(path.join(repo, "node_modules/esbuild/lib/main.js"));
for (const group of ["packages/contracts","packages/domain","packages/content","apps/api"]) {
    const base = path.join(out,group,"src");
    for (const name of fs.readdirSync(base,{recursive:true})) {
        if (!name.endsWith(".ts") || /\.(test|spec|d)\.ts$/.test(name)) continue;
        const code = fs.readFileSync(path.join(base,name),"utf8");
        const dest = path.join(out,group,"dist",name.replace(/\.ts$/,".js"));
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        fs.writeFileSync(dest,compiler.transformSync(code,{loader:"ts",target:"es2022",format:"esm"}).code);
    }
}
// Package redirects target the freshly transpiled files, never an older dist.
for (const [name, entries] of Object.entries({contracts:["index"],domain:["index","nlu/prologue-v1-fixtures"]})) {
    const dir = path.join(out,"node_modules","@jiuxiao",name);
    fs.mkdirSync(dir,{recursive:true});
    const exports = {};
    for (const [i,entry] of entries.entries()) {
        const target=entry==="nlu/prologue-v1-fixtures"?"nlu/prologue-v1-nlu-fixtures":entry;
        fs.writeFileSync(path.join(dir,i+".mjs"),'export * from "../../../packages/'+name+'/dist/'+target+'.js";\n');
        exports[i===0?".":"./"+entry]="./"+i+".mjs";
    }
    fs.writeFileSync(path.join(dir,"package.json"),JSON.stringify({type:"module",exports}));
}
