import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function buildUserscript({ development=false, endpoint, write=true } = {}) {
  if (development && !/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint || '')) throw new Error('Development endpoint must be literal-port loopback HTTP.');
  const [source, bootstrap, model, manifest, updater] = await Promise.all([
    readFile(path.join(root, 'src/shelf-gallery.js'), 'utf8'),
    readFile(path.join(root, 'src/userscript-bootstrap.js'), 'utf8'),
    readFile(path.join(root, 'src/shelf-model.mjs'), 'utf8'),
    readFile(path.join(root, 'package.json'), 'utf8'),
    development ? readFile(path.join(root, 'src/development-updater.js'), 'utf8') : '',
  ]);
  const {version}=JSON.parse(manifest);
  if(!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Version must use major.minor.patch.');
  const runtime=source.replaceAll('__WR_REA_VERSION__',version).replace('/* WR_REA_MODEL */',()=>model.replace(/^export /gm,''));
  const output=bootstrap
    .replace('__WR_REA_GRANTS__',()=>development?'// @grant        GM_xmlhttpRequest\n// @connect      127.0.0.1':'// @grant        none')
    .replace('__WR_REA_SOURCE__',()=>JSON.stringify(runtime))
    .replace('/* WR_REA_DEVELOPMENT */',()=>development?updater.replace('__WR_REA_ORIGIN__',()=>JSON.stringify(endpoint)):'')
    .replaceAll('__WR_REA_VERSION__',version);
  const outputPath=path.join(root,'src',development?'weread-shelf.dev.user.js':'weread-shelf.user.js');
  if(write) await writeFile(outputPath,output);
  return {output,outputPath,version};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await buildUserscript();
  console.log(`Built standalone userscript v${result.version}: ${result.outputPath}`);
}
