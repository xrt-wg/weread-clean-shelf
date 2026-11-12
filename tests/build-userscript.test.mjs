import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildUserscript } from '../scripts/build-userscript.mjs';

function startBootstrap(source,{enabled=false}={}) {
  const injected=[],requests=[],intervals=[];
  const context={document:{documentElement:{append:element=>injected.push(element.textContent)},head:null,visibilityState:'visible',createElement:()=>({remove(){}}),addEventListener(){}},
    URL,location:{href:enabled?'https://weread.qq.com/web/shelf?rea-dev=1':'https://weread.qq.com/web/shelf',pathname:'/web/shelf'},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setInterval:(callback,delay)=>intervals.push(delay),GM_xmlhttpRequest:request=>requests.push(request)};
  vm.runInNewContext(source,context);
  return {injected,requests,intervals};
}

test('release builds without server state and contains no local updater or network grants',async()=>{
  const {output,version}=await buildUserscript({write:false});
  assert.ok(output.includes(`// @version      ${version}`));
  assert.ok(output.includes('// @run-at       document-start'));
  assert.ok(output.includes('// @grant        none'));
  assert.doesNotMatch(output,/127\.0\.0\.1|GM_xmlhttpRequest|rea-dev|__WR_REA_[A-Z_]+__/);
  assert.doesNotThrow(()=>new vm.Script(output));
  const page=startBootstrap(output);
  assert.equal(page.injected.length,1);
  assert.ok(page.injected[0].startsWith(`// WeRead REA shelf runtime ${version}`));
  assert.doesNotThrow(()=>new vm.Script(page.injected[0]));
  assert.equal(page.requests.length,0);
  assert.equal(page.intervals.length,0);
});

test('optional preview is disabled until explicitly enabled and embeds its loopback endpoint',async()=>{
  const {output}=await buildUserscript({development:true,endpoint:'http://127.0.0.1:64096',write:false});
  assert.doesNotThrow(()=>new vm.Script(output));
  const disabled=startBootstrap(output);
  assert.equal(disabled.requests.length,0);
  assert.equal(disabled.intervals.length,0);
  const enabled=startBootstrap(output,{enabled:true});
  assert.deepEqual(enabled.intervals,[2500]);
  assert.equal(enabled.requests.length,1);
  assert.equal(enabled.requests[0].url,'http://127.0.0.1:64096/weread-shelf.user.js?development=1');
});

test('preview rejects missing and non-loopback endpoints',async()=>{
  for(const endpoint of [undefined,'https://example.com','http://localhost:64096']) {
    await assert.rejects(buildUserscript({development:true,endpoint,write:false}),/loopback/);
  }
});
