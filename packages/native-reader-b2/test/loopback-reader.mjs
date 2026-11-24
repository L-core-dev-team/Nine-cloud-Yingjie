import {createServer} from "node:http";
import {once} from "node:events";

export async function openLoopbackReader(reader) {
    let requests = 0;
    const server = createServer(async (req,res) => {
        let status = 403, value = {status:"DENIED",added:0,send:false,sceneEligible:false};
        try {
            if (req.method !== "POST" || req.headers.host !== "127.0.0.1:"+server.address().port ||
                req.headers.origin || req.headers["x-jiuxiao-account"] || req.headers["content-type"] !== "application/json")
                throw Error("bad-envelope");
            let size = 0;
            const parts = [];
            for await (const part of req) {
                size += part.length;
                if (size > 4096) throw Error("body-too-large");
                parts.push(part);
            }
            const body = JSON.parse(Buffer.concat(parts).toString());
            const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? "")?.[1] ?? null;
            if (req.url === "/history") value = await reader.read(token,body);
            else if (req.url === "/known") value = await reader.knownAt(token,body.locator,body.asOf);
            status = value.status === "DENIED" ? 403 : 200;
        } catch { /* Uniform denial; never log a header or raw body. */ }
        requests++;
        res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});
        res.end(JSON.stringify(value));
    });
    server.listen(0,"127.0.0.1");
    await once(server,"listening");
    const url = "http://127.0.0.1:"+server.address().port;
    async function post(path,token,body,headers={}) {
        const response = await fetch(url+path,{method:"POST",redirect:"error",
            headers:{"content-type":"application/json",...(token?{authorization:"Bearer "+token}:{}),...headers},
            body:JSON.stringify(body)});
        return response.json();
    }
    return {read:(token,ref,headers)=>post("/history",token,ref,headers),
        knownAt:(token,locator,asOf)=>post("/known",token,{locator,asOf}), count:()=>requests,
        close:()=>new Promise((done,reject)=>server.close(error=>error?reject(error):done()))};
}
