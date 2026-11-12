import http from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildUserscript } from './build-userscript.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }
  if (url.pathname === '/weread-shelf.user.js') {
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}`;
      const {output:source} = await buildUserscript({development:true,endpoint,write:false});
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : source);
    } catch {
      response.writeHead(500).end('Unable to read the local userscript.');
    }
    return;
  }
  if (url.pathname !== '/') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>微信读书 · 清爽书架</title>
    <style>body{max-width:620px;margin:14vh auto;padding:24px;color:#20242a;font:16px/1.9 "Microsoft YaHei",sans-serif}small{color:#758095}h1{font-size:30px}a{display:inline-block;background:#2776ed;color:#fff;padding:10px 24px;border-radius:7px;text-decoration:none}li{margin:7px 0}</style>
    <small>WeRead REA · 可选开发预览</small><h1>让书架回到阅读本身。</h1>
    <p>支持分组排序、主题切换和纯封面书架。日常更新请复制正式脚本；此服务仅用于主动启用的自动预览。</p>
    <ul><li>只在微信读书书架生效。</li><li>不修改书籍归属，不上传阅读数据。</li><li>可以随时在 Tampermonkey 中关闭。</li></ul>
    <p><a href="/weread-shelf.user.js">安装或更新体验版</a></p>
    <small>安装后刷新微信读书书架。此页面由本机临时服务提供。</small>
  </html>`);
});

server.listen(0, '127.0.0.1', async () => {
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  await buildUserscript({development:true,endpoint});
  const info = { pid: process.pid, endpoint, installUrl: `${endpoint}/weread-shelf.user.js` };
  await mkdir(path.join(root, 'analysis'), { recursive: true });
  await writeFile(path.join(root, 'analysis', 'userscript-server.json'), JSON.stringify(info, null, 2));
  console.log(JSON.stringify(info));
});
