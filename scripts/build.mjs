import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(resolve(root,'dist'),{recursive:true});
await cp(resolve(root,'public'),resolve(root,'dist'),{recursive:true});
console.log('Built static app in dist. Local API server: npm start.');
