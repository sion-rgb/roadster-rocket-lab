import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]??'after',url=process.env.SIM_URL??'http://127.0.0.1:5188/';
const directory=`artifacts/graphics-v2/${phase}`;await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:process.env.PW_CHANNEL??'chrome',headless:true});
const reports=[];
for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 for(const state of mobile?['showcase','active-flight']:['showcase','active-driving','active-flight','cockpit','spectator']){
  const page=await context.newPage(),errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url+'?qa=1');await page.waitForFunction(()=>window.__ROADSTER__,null,{timeout:60000});await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
  if(state!=='showcase')await page.evaluate(s=>window.__THREE_GAME_TEST_HOOKS__.setState(s),state);else await page.waitForTimeout(1500);
  await page.waitForTimeout(700);await page.evaluate(()=>window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(true));await page.waitForTimeout(250);
  const snapshot=await page.evaluate(()=>window.__ROADSTER__.snapshot());
  const label=`${mobile?'mobile':'desktop'}-${state}`;await page.screenshot({path:`${directory}/${label}.png`});
  reports.push({phase,label,errors,warnings,snapshot});console.log(JSON.stringify({phase,label,errors,renderer:snapshot.renderer,graphics:snapshot.graphics}));await page.close();
 }
 await context.close();
}
await browser.close();await writeFile(`${directory}/report.json`,JSON.stringify(reports,null,2));
if(reports.some(r=>r.errors.length))process.exitCode=1;
