import {chromium} from '@playwright/test';
import {Vector3,Quaternion} from 'three';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';

const url=process.env.SIM_URL??'http://127.0.0.1:5188/';
const out=process.env.CAMERA_ARTIFACT_DIR??'artifacts/camera-fix';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.PW_CHANNEL??'chrome',headless:true});
const report={date:new Date().toISOString(),url,checks:[],measurements:{},errors:[],failedRequests:[]};
const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:out,size:{width:1280,height:800}}});
const page=await context.newPage();
const monitor=p=>{
  p.on('pageerror',e=>report.errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  p.on('response',r=>{if(r.status()>=400)report.failedRequests.push({url:r.url(),status:r.status()});});
};
const ready=async p=>{
  monitor(p);await p.goto(url+(url.includes('?')?'&':'?')+'qa=1');
  await p.waitForFunction(()=>window.__ROADSTER__,null,{timeout:60000});
  await p.locator('#loading').waitFor({state:'hidden',timeout:30000});
};
const read=p=>p.evaluate(()=>window.__ROADSTER__.snapshot());
const frames=(p,count=120)=>p.evaluate(count=>new Promise(resolve=>{
  const samples=[];
  function tick(t){const s=window.__ROADSTER__.snapshot();samples.push({t,c:s.cameraPosition,q:s.cameraQuaternion,p:s.renderPose.position,r:s.renderPose.rotation,transition:s.transition});if(samples.length<count)requestAnimationFrame(tick);else resolve(samples);}
  requestAnimationFrame(tick);
}),count);
function measure(samples,expectForward=true){
  const seat=new Vector3(-.36,.36,-.28),identity=new Quaternion();
  let maxSeatError=0,maxViewError=0,maxRelativeViewChange=0;
  const first=new Quaternion().fromArray(samples[0].r).invert().multiply(new Quaternion().fromArray(samples[0].q));
  for(const f of samples){
    assert(!f.transition,'sample after the camera transition');
    const inverse=new Quaternion().fromArray(f.r).invert();
    const local=new Vector3().fromArray(f.c).sub(new Vector3().fromArray(f.p)).applyQuaternion(inverse);
    maxSeatError=Math.max(maxSeatError,local.distanceTo(seat));
    const relative=inverse.multiply(new Quaternion().fromArray(f.q));
    maxViewError=Math.max(maxViewError,relative.angleTo(identity));
    maxRelativeViewChange=Math.max(maxRelativeViewChange,relative.angleTo(first));
  }
  assert(maxSeatError<1e-6,`cockpit drift ${maxSeatError} m`);
  if(expectForward)assert(maxViewError<1e-5,`uncommanded view rotation ${maxViewError} rad`);
  else assert(maxRelativeViewChange<1e-5,'mouse gaze must remain stable relative to the cabin');
  return {frames:samples.length,maxSeatErrorMm:maxSeatError*1000,maxViewErrorDegrees:maxViewError*180/Math.PI,maxRelativeViewChangeDegrees:maxRelativeViewChange*180/Math.PI};
}
try{
  await ready(page);
  await page.getByRole('button',{name:'進入駕駛席'}).click();
  await page.keyboard.press('Digit1');await page.waitForTimeout(1400);
  await page.keyboard.down('KeyW');report.measurements.road=measure(await frames(page));await page.keyboard.up('KeyW');
  assert((await read(page)).vehicle.speed>15);report.checks.push('first-person road acceleration stays anchored');
  await page.keyboard.down('KeyD');report.measurements.steering=measure(await frames(page,45));await page.keyboard.up('KeyD');
  report.checks.push('steering has no mismatched position/aim lag');
  await page.screenshot({path:out+'/cockpit-road.png'});
  await page.keyboard.press('KeyR');await page.locator('#launch').click();await page.waitForTimeout(2500);
  const airborne=await read(page);assert(airborne.vehicle.altitude>8&&!airborne.vehicle.grounded);
  report.measurements.hover=measure(await frames(page));report.checks.push('first-person takeoff and hover have no artificial thrust shake');
  await page.keyboard.down('KeyW');report.measurements.forwardFlight=measure(await frames(page));await page.keyboard.up('KeyW');
  report.checks.push('forward flight has no seat drift');
  await page.keyboard.down('KeyE');report.measurements.roll=measure(await frames(page,40));await page.keyboard.up('KeyE');
  assert(Math.abs((await read(page)).vehicle.attitude[2])>.15);
  await page.keyboard.down('KeyI');report.measurements.pitch=measure(await frames(page,30));await page.keyboard.up('KeyI');
  assert(Math.abs((await read(page)).vehicle.attitude[0])>.1);report.checks.push('intentional roll and pitch remain visible');
  await page.screenshot({path:out+'/cockpit-banked.png'});
  await page.mouse.move(600,380);await page.mouse.down();await page.mouse.move(685,405,{steps:12});await page.mouse.up();
  report.measurements.mouseGaze=measure(await frames(page,45),false);
  assert(report.measurements.mouseGaze.maxViewErrorDegrees>10);report.checks.push('mouse look works and holds a stable cabin-relative gaze');
  await page.keyboard.press('Escape');const frozen=await read(page);await page.waitForTimeout(400);const afterPause=await read(page);
  assert.deepEqual(afterPause.cameraPosition,frozen.cameraPosition);assert.deepEqual(afterPause.cameraQuaternion,frozen.cameraQuaternion);
  await page.keyboard.press('Escape');report.checks.push('paused cockpit cannot accumulate shake');
  for(const [key,view] of [['Digit2','chase'],['Digit3','spectator'],['Digit1','cockpit']]){
    await page.keyboard.press(key);await page.waitForTimeout(150);assert((await read(page)).transition);
    await page.waitForTimeout(1200);const s=await read(page);assert.equal(s.camera,view);assert(!s.transition);assert(s.cameraPosition.every(Number.isFinite));
  }
  report.checks.push('three camera transitions stay smooth and finite');
  await page.keyboard.press('KeyL');await page.waitForFunction(()=>window.__ROADSTER__.snapshot().vehicle.mode==='drive',null,{timeout:22000});
  const landed=await read(page);assert(landed.vehicle.grounded&&!landed.vehicle.crashed);assert.equal(landed.camera,'cockpit');
  report.measurements.landed=measure(await frames(page,45));report.checks.push('first-person assisted touchdown stays stable');
  await page.keyboard.press('KeyR');await page.waitForTimeout(150);report.measurements.reset=measure(await frames(page,30));
  report.checks.push('reset snaps car and camera together');
  await context.close();await rename(await page.video().path(),out+'/cockpit-playthrough.webm');

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const phone=await mobile.newPage();await ready(phone);
  await phone.getByRole('button',{name:'進入駕駛席'}).tap();
  await phone.getByRole('button',{name:'駕駛艙第一身'}).tap();await phone.waitForTimeout(1400);
  await phone.locator('#launch').tap();await phone.waitForTimeout(2500);
  report.measurements.mobileHover=measure(await frames(phone,90));
  assert((await read(phone)).vehicle.altitude>8);report.checks.push('390px touch-browser cockpit takeoff and hover stay anchored');
  await phone.screenshot({path:out+'/cockpit-mobile.png'});await mobile.close();
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error);throw error;}
finally{
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();
  console.log(JSON.stringify(report,null,2));
}
