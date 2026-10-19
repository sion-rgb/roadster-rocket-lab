import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const url=process.env.SIM_URL??'http://127.0.0.1:5188/';
const directory='artifacts/graphics-v2/after';await mkdir(directory,{recursive:true});
const report={status:'RUNNING',url,date:new Date().toISOString(),assetChecks:0,states:[],errors:[]};
for(const kind of ['hdri','surfaces'])for(const source of JSON.parse(await readFile(`public/assets/${kind}/sources.json`,'utf8'))){
  const bytes=await readFile(`public/assets/${kind}/${source.file}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);report.assetChecks++;
}
const browser=await chromium.launch({channel:process.env.PW_CHANNEL??'chrome',headless:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url+'?qa=1');await page.waitForFunction(()=>window.__ROADSTER__,null,{timeout:60000});await page.locator('#loading').waitFor({state:'hidden',timeout:30000});await page.waitForTimeout(1500);
  for(const state of ['showcase','active-flight']){
   if(state!=='showcase')await page.evaluate(s=>window.__THREE_GAME_TEST_HOOKS__.setState(s),state);
   await page.waitForTimeout(800);const snapshot=await page.evaluate(()=>window.__ROADSTER__.snapshot());
   assert.equal(snapshot.asset.source,'licensed-glb');assert(snapshot.graphics.hdr.startsWith('CC0'));assert(snapshot.graphics.reflectionMaterials>=10);assert(snapshot.graphics.planarUpdates>0);
   assert.equal(snapshot.graphics.localReflections,!mobile);assert.equal(snapshot.graphics.wetPadReflection,!mobile);assert.equal(snapshot.graphics.postPasses,mobile?0:2);
   if(!mobile)assert(snapshot.graphics.cubeUpdates>2);else assert.equal(snapshot.graphics.cubeUpdates,0);
   assert(snapshot.graphics.meanCalls>0&&snapshot.graphics.peakCalls>=snapshot.graphics.meanCalls);assert(snapshot.graphics.peakTriangles>=snapshot.renderer.triangles);
   const label=`${mobile?'mobile':'desktop'}-${state}`;await page.screenshot({path:`${directory}/${label}.png`});
   const glError=await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getError());assert.equal(glError,0,'No WebGL errors after reflection and post passes');
   report.states.push({label,snapshot});console.log(JSON.stringify({label,graphics:snapshot.graphics,renderer:snapshot.renderer}));
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}finally{await browser.close();await writeFile('artifacts/graphics-v2/verification.json',JSON.stringify(report,null,2));}
