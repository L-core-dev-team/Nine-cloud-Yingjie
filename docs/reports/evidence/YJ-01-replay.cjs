const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
if (!process.argv[2]) throw Error('Provide the pinned Nine-cloud checkout path');
const root = path.resolve(process.argv[2]);
const head = require('node:child_process').execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
if (head !== 'cd25360c7929e10f8b2b0fad342fedd943d4f323') throw Error('Use the upstream commit recorded in YJ-01');
const filename = path.join(root, 'tests/e2e/cards-dev-demo.cjs');
const upstream = fs.readFileSync(filename, 'utf8');
const anchor = "await input.fill('焦点切换后应保留的草稿');";
if (upstream.split(anchor).length !== 2) throw Error('Unexpected upstream test version');
const extra = `
    const second = 'YJ-01 刷新后继续行动';
    await input.fill(second);
    const committed = page.waitForResponse(r => r.request().method()==='POST' && /\\/sessions\\/[^/]+\\/actions$/.test(r.url()));
    await page.getByRole('button',{name:'提交行动'}).click();
    const accepted = await committed;
    assert.equal(accepted.status(), 200);
    const sessionId = new URL(accepted.url()).pathname.split('/').at(-2);
    await page.getByText('本地合成回复（非真实模型）',{exact:true}).nth(1).waitFor();
    await page.reload();
    await page.getByText('本地合成回复（非真实模型）',{exact:true}).nth(1).waitFor();
    await page.getByText(second,{exact:true}).first().waitFor();
    const {Pool}=require('node:module').createRequire(path.join(root,'apps/api/package.json'))('pg');
    const pool=new Pool({host:'127.0.0.1',database:'jiuxiao_test_cards_demo',user:'cards_local',password:state.password,port:state.port});
    try {
      const rows=(await pool.query("SELECT r.action,r.narrative,r.status,r.resulting_revision,s.revision FROM card_import.requests r JOIN card_import.sessions s ON s.owner_id=r.owner_id AND s.id=r.session_id WHERE r.session_id=$1 ORDER BY r.resulting_revision", [sessionId])).rows;
      assert.deepEqual(rows.map(r=>r.action),['本地验证',second]);
      assert.deepEqual(rows.map(r=>Number(r.resulting_revision)),[1,2]);
      assert(rows.every(r=>r.status==='completed' && Number(r.revision)===2 && r.narrative==='本地合成回复（非真实模型）'));
      console.log(JSON.stringify({status:'PASS',entry:'/lobby',provider:'synthetic',session:sessionId,viewport:[360,800],returnedAfterReload:true,continuedHttpStatus:accepted.status(),secondReload:true,postgres:{database:'jiuxiao_test_cards_demo',revisions:[1,2],sessionRevision:2,completedRows:2,actionsAndNarrativesMatched:true}}));
    } finally {await pool.end();}
    `;
const test = new Module(filename, module);
test.filename = filename;
test.paths = Module._nodeModulePaths(path.dirname(filename));
test._compile(upstream.replace(anchor, extra + anchor), filename);
