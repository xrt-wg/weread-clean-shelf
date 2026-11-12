import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const runtime=(await readFile(new URL('../src/shelf-gallery.js',import.meta.url),'utf8')).replaceAll('__WR_REA_VERSION__',version);

// Model the parser's earliest stage: html exists, head/body/native shelf do not.
// These tests exercise startup and failure recovery without a loaded website.
function launch(path='/web/shelf',fetch=()=>new Promise(()=>{})) {
  const classes=new Set(),frames=[],timeouts=new Map(),appended=[],observed=[];
  const root={dataset:{},classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}},append:element=>appended.push(element)};
  const context={document:{documentElement:root,head:null,body:null,createElement:()=>({dataset:{},remove(){}}),querySelector:()=>null,getElementById:()=>null},
    location:{pathname:path},localStorage:{getItem:()=>'{"theme":"dark","collapsed":true}',setItem(){}},sessionStorage:{getItem:()=>null,setItem(){}},
    AbortController,fetch,requestAnimationFrame:callback=>frames.push(callback),setInterval:()=>1,clearInterval(){},
    setTimeout:(callback,delay)=>{timeouts.set(delay,callback);return delay;},clearTimeout:id=>timeouts.delete(id),
    MutationObserver:class{observe(target){observed.push(target);}disconnect(){}},addEventListener(){},removeEventListener(){}};
  context.window=context;
  vm.runInNewContext(runtime,context);
  return {root,classes,frames,timeouts,appended,observed};
}

test('document-start installs the paint guard and remembered theme before head/body exist',()=>{
  const page=launch();
  assert.equal(page.root.dataset.wrReaTheme,'dark');
  assert.ok(page.classes.has('wr-rea-collapsed'));
  assert.ok(page.classes.has('wr-rea-pending'));
  assert.equal(page.appended[0].dataset.version,version);
  assert.equal(page.observed[0],page.root);
});

test('catalog requests start before the native shelf exists; failures reveal the native page',async()=>{
  let requests=0;
  const page=launch('/web/shelf',async()=>{requests++;throw new Error('offline');});
  page.frames.shift()();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,2);
  assert.equal(page.root.dataset.wrReaStatus,'data-unavailable');
  assert.ok(!page.classes.has('wr-rea-pending'));
});

test('a hanging request cannot leave the original shelf hidden indefinitely',()=>{
  const page=launch();
  page.frames.shift()();
  page.timeouts.get(6000)();
  assert.ok(!page.classes.has('wr-rea-pending'));
});

test('the reading page never receives the shelf paint guard',()=>{
  const page=launch('/web/reader/example');
  assert.ok(!page.classes.has('wr-rea-pending'));
  assert.ok(!page.classes.has('wr-rea-shelf'));
});
