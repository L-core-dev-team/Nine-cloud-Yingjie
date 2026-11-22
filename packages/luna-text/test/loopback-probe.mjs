import net from "node:net";
import http from "node:http";
import {once} from "node:events";
import {createHash, randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {release} from "node:os";

const host = "127.0.0.1";
const observations = {};
const receipt = {
  runId: randomUUID(), utc: new Date().toISOString(),
  sourceSha256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"),
  platform: process.platform, osRelease: release(), node: process.version,
  nodePermissionModel: Boolean(process.permission),
  nodeNetPermission: process.permission ? process.permission.has("net") : null,
  preloadConfigured: /(?:--require|--import|(?:^|\s)-r(?:\s|=))/.test([process.env.NODE_OPTIONS, ...process.execArgv].join(" ")),
  target: host, portSelection: "OS-assigned", observations
};
let stage;
async function listen(server) {
  const ready = once(server, "listening");
  server.listen({host, port: 0, exclusive: true});
  await ready;
  observations[stage] = {status: "PASS"};
  return server.address().port;
}
async function close(server) {
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
async function probe() {
  const server = net.createServer(peer => peer.end("loopback-ok"));
  let socket;
  try {
    stage = "tcpListen";
    const port = await listen(server);
    stage = "tcpConnect";
    socket = net.connect({host, port});
    socket.setTimeout(4000, () => socket.destroy(Object.assign(new Error(), {code: "ETIMEDOUT"})));
    let data = "";
    socket.setEncoding("utf8").on("data", chunk => { data += chunk; });
    await once(socket, "end");
    if (data !== "loopback-ok") throw Object.assign(new Error(), {code: "PAYLOAD_MISMATCH"});
    observations[stage] = {status: "PASS", peerPayloadVerified: true};
  } finally {
    socket?.destroy();
    await close(server);
  }
  const web = http.createServer((req,res) => {
    res.writeHead(req.method === "GET" && req.url === "/probe" ? 200 : 404);
    res.end("http-ok");
  });
  try {
    stage = "httpListen";
    const port = await listen(web);
    stage = "httpGet";
    await new Promise((resolve, reject) => {
      const req = http.get({host, port, path: "/probe", agent: false}, res => {
        let text = "";
        res.setEncoding("utf8").on("data", chunk => { text += chunk; });
        res.once("error", reject);
        res.once("end", () => res.statusCode === 200 && text === "http-ok" ? resolve() : reject(Object.assign(new Error(), {code:"HTTP_MISMATCH"})));
      });
      req.once("error", reject);
      req.setTimeout(4000, () => req.destroy(Object.assign(new Error(), {code: "ETIMEDOUT"})));
    });
    observations[stage] = {status: "PASS", httpStatus: 200, bodyVerified: true};
  } finally { await close(web); }
}
try {
  await probe();
  receipt.status = "LOOPBACK_PASS";
} catch (error) {
  const code = error.code ?? "UNCLASSIFIED";
  observations[stage] = {status: "FAIL", code, syscall: error.syscall ?? null};
  receipt.status = ["EACCES","EPERM","ERR_ACCESS_DENIED"].includes(code) ? "ENV_BLOCKED" : "PROBE_FAILED";
  process.exitCode = 1;
} finally {
  for (const key of ["tcpListen","tcpConnect","httpListen","httpGet"]) observations[key] ??= {status: "NOT_RUN"};
  console.log(JSON.stringify(receipt));
}
