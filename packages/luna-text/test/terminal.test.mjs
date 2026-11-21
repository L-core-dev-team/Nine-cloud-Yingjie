import {test} from "node:test";
import assert from "node:assert/strict";
import {PassThrough} from "node:stream";
import {terminal} from "../key-entry/terminal.mjs";

for(const scenario of ["execute","cancel","invalid","multiline","locked","pipe"]){
  test("private terminal "+scenario,async()=>{
    const fixture="terminal-fake-only",input=new PassThrough(),printed=[],raw=[];
    input.isTTY=scenario!=="pipe";input.setRawMode=value=>raw.push(value);
    let calls=0;
    const output={isTTY:true,write(message){
      printed.push(message);
      if(message.includes("请输入 API Key")){
        assert.equal(raw.at(-1),true);
        assert.ok(message.includes("按回车即开始测试"));
        const submission={cancel:fixture+"\x1b",invalid:"\r",multiline:fixture+"\rmore\r"};
        setImmediate(()=>input.write(Buffer.from(submission[scenario]??fixture+"\r")));
      }
    }};
    const run=terminal({input,output,inspect:()=>scenario==="locked"?["APPROVAL_LOCKED"]:[],
      signal:new AbortController().signal,execute:async({takeKey,verified})=>{
        assert.equal(verified,true);assert.equal(takeKey(),fixture);
        assert.throws(takeKey,/KEY_UNAVAILABLE/);calls++;return {status:"FAKE_ONLY"};
      }});
    if(scenario==="cancel")await assert.rejects(run,/CANCELLED/);
    else if(["invalid","multiline"].includes(scenario))await assert.rejects(run,/INVALID_INPUT/);
    else if(scenario==="pipe")await assert.rejects(run,/PRIVATE_TERMINAL_REQUIRED/);
    else await run;
    assert.equal(calls,scenario==="execute"?1:0);
    assert.equal(printed.join("").includes(fixture),false);input.destroy();
  });
}
