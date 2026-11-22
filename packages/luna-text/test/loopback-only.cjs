// Test preload for the native PostgreSQL/Chrome suites. Permit Windows IPC and local TCP only.
const net=require("node:net");
const cp=require("node:child_process");
const local=new Set(["localhost","127.0.0.1","::1"]);
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
  const a=Array.isArray(args[0])?args[0]:args;
  const opts=a[0];
  const host=typeof opts==="object"?opts?.host:(Number.isFinite(Number(opts)) && typeof a[1]==="string"?a[1]:null);
  if(host && !local.has(host))throw Error("TEST_EXTERNAL_CONNECTION_DENIED");
  return connect.apply(this,args);
};
const spawn=cp.spawn;
cp.spawn=function(file,args,...rest){
  if(/(?:^|[\\/])(?:chrome|chromium)(?:\.exe)?$/i.test(file)){
    args=[...args,"--disable-background-networking","--proxy-server=http://127.0.0.1:9",
      "--proxy-bypass-list=localhost;127.0.0.1;[::1]","--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE [::1]"];
  }
  return spawn.call(this,file,args,...rest);
};
require("node:module").syncBuiltinESMExports();
