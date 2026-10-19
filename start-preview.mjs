import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const url='http://localhost:4177/';
async function ready(){try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)}),html=await r.text();return r.ok&&html.includes('/app.js')&&(html.includes('蛋仔吃豆岛')||html.includes('蛋仔闯关岛'));}catch{return false;}}
if(!await ready()){
 const output=fs.openSync(path.join(import.meta.dirname,'.preview.log'),'a');
 const child=spawn(process.execPath,[path.join(import.meta.dirname,'server.mjs')],{cwd:import.meta.dirname,detached:true,stdio:['ignore',output,output]});child.unref();fs.closeSync(output);
 for(let i=0;i<30&&!await ready();i++)await new Promise(resolve=>setTimeout(resolve,100));
}
if(!await ready()){console.error('游戏未能启动，请查看项目目录中的 .preview.log。');process.exitCode=1;}
else {console.log(`蛋仔闯关岛已就绪：${url}`);if(!process.argv.includes('--no-open')&&process.platform==='darwin'){const child=spawn('open',[url],{detached:true,stdio:'ignore'});child.unref();}}
