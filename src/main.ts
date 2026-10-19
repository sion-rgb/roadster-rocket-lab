import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCar } from './car';
import { createWorld } from './world';
import { VehiclePhysics, SIM, type Mode } from './physics';
import { CameraRig, type CameraView } from './cameras';
import { Input } from './input';
import { SynthAudio } from './audio';
import { RocketVFX } from './vfx';
import { mountUI } from './ui';
import './style.css';

mountUI();
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const events:{message:string,time:number}[]=[];
let paused=false,helpWasPaused=false,launchTime=0;
async function init(){
  await RAPIER.init();
  const mobile=matchMedia('(max-width:760px)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',logarithmicDepthBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.75));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  $('#viewport').append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xa3c6d5);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const env=pmrem.fromScene(room,.05);scene.environment=env.texture;scene.environmentIntensity=.75;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc9e5ff,0x7a6252,1.3));
  const sun=new THREE.DirectionalLight(0xffe1b1,2.5);sun.position.set(-80,120,-70);sun.castShadow=true;
  sun.shadow.mapSize.setScalar(mobile?1024:2048);sun.shadow.camera.left=-48;sun.shadow.camera.right=48;sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;sun.shadow.camera.near=1;sun.shadow.camera.far=350;sun.shadow.normalBias=.025;sun.shadow.bias=-.00005;
  scene.add(sun,sun.target);
  const physics=new RAPIER.World({x:0,y:-SIM.gravity,z:0});
  const world=createWorld(scene,physics);
  const sim=new VehiclePhysics(physics,world.spawn,world.landingPads);
  const car=createCar();scene.add(car.group);
  const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.04,3500);
  const rig=new CameraRig(camera,renderer.domElement,sim);
  const audio=new SynthAudio(),vfx=new RocketVFX(scene);
  const notify=(message:string)=>{
    events.push({message,time:performance.now()});if(events.length>30)events.shift();
    $('#toast').textContent=message;gsap.fromTo('#toast',{opacity:.4,y:7},{opacity:1,y:0,duration:.35});
    if(message.includes('完成')||message.includes('著地'))audio.chime();
  };sim.onEvent=notify;
  const chooseCamera=(view:CameraView)=>{rig.set(view);document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>{const active=b.dataset.camera===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});};
  const chooseMode=(mode:Mode)=>{sim.setMode(mode);if(mode==='showcase'){launchTime=0;chooseCamera('chase');}else if(mode==='drive')chooseCamera('chase');};
  const pause=(value:boolean)=>{paused=value;$('#pause-panel').hidden=!value;$('#pause').textContent=value?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',value?'繼續':'暫停');input.clear();};
  const help=(value:boolean)=>{if(value){helpWasPaused=paused;paused=true;input.clear();}else paused=helpWasPaused;$('#help-panel').hidden=!value;};
  const input=new Input(code=>{
    if(code==='KeyH'){help($('#help-panel').hidden);return;}
    if(!$('#help-panel').hidden){if(code==='Escape')help(false);return;}
    if(code==='Escape'){pause(!paused);return;}if(paused)return;
    if(code==='KeyF'){chooseMode(sim.mode==='flight'?'drive':'flight');}
    if(code==='KeyL')sim.land();if(code==='KeyR'){sim.reset();notify('車輛已重置 · 能量充滿');}
    if(code==='Digit1')chooseCamera('cockpit');if(code==='Digit2')chooseCamera('chase');if(code==='Digit3')chooseCamera('spectator');
    if(code==='KeyC'){const views:CameraView[]=['cockpit','chase','spectator'];chooseCamera(views[(views.indexOf(rig.view)+1)%3]);}
  });
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>chooseMode(b.dataset.mode as Mode));
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>b.onclick=()=>chooseCamera(b.dataset.camera as CameraView));
  $('#start').onclick=()=>chooseMode('drive');
  $('#launch').onclick=()=>{if(sim.mode==='flight'&&!sim.grounded){sim.land();return;}chooseMode('flight');launchTime=1.8;notify('垂直起飛 · 推進器運作中');};
  $('#land').onclick=()=>sim.land();$('#reset').onclick=()=>{sim.reset();launchTime=0;notify('車輛已重置 · 按 W 出發');};
  $('#sound').onclick=async()=>{try{const on=await audio.toggle();$('#sound').innerHTML=on?'◖))':'◖))<i class="muted-line"></i>';$('#sound').setAttribute('aria-label',on?'關閉音效':'開啟音效');$('#sound').setAttribute('aria-pressed',String(on));}catch{notify('此瀏覽器無法啟用音訊');}};
  $('#pause').onclick=()=>pause(!paused);$('#resume').onclick=()=>pause(false);
  $('#help').onclick=()=>help(true);$('#help-close').onclick=()=>help(false);$('#help-ready').onclick=()=>help(false);
  window.addEventListener('blur',()=>{if($('#loading').style.display==='none'&&$('#help-panel').hidden)pause(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<761?1.25:1.75));});
  $('#loading-status').textContent='正在載入授權車模及 PBR 材質…';
  const loaded=await car.ready;
  if(!loaded)notify('GLB 載入失敗 · 使用原創備用車模，可繼續試玩');
  // A low-poly shadow proxy avoids rendering the detailed interior and glass into the shadow map.
  car.group.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=false;});
  const shadowParts:THREE.BufferGeometry[]=[new THREE.BoxGeometry(1.82,.36,4.2).translate(0,-.22,0),new THREE.BoxGeometry(1.44,.4,1.8).translate(0,.17,.15)];
  for(const z of [-1.43,1.42])for(const x of [-.9,.9])shadowParts.push(new THREE.CylinderGeometry(.32,.32,.22,12).rotateZ(Math.PI/2).translate(x,-.33,z));
  const proxy=new THREE.Mesh(mergeGeometries(shadowParts),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));
  proxy.name='Lightweight car shadow proxy';proxy.castShadow=true;car.group.add(proxy);shadowParts.forEach(g=>g.dispose());
  // Keep the car centred to the right of the editorial title in the initial showcase.
  car.group.position.copy(sim.position);
  rig.controls.target.copy(sim.position).add(new THREE.Vector3(-2,0,0));
  rig.controls.update();
  gsap.to('#loading',{autoAlpha:0,duration:.65,onComplete:()=>{$('#loading').style.display='none';}});
  gsap.from(['.topbar','.location','.intro','.camera-switch','.telemetry'],{opacity:0,y:15,duration:.9,stagger:.1,ease:'power2.out',delay:.15});
  let prior=performance.now(),accumulator=0,time=0,hudClock=0,wheelSpin=0,frames=0,fps=60,frameClock=0,shadowClock=0;
  let lastMode:Mode|'none'='none';
  const updateHUD=()=>{
    const data=sim.snapshot();$('#speed').textContent=Math.round(data.speed).toString().padStart(3,'0');$('#speed-label').textContent=sim.mode==='flight'?'AIR SPEED · SIM':'GROUND SPEED';
    $('#altitude').textContent=data.altitude.toFixed(1);$('#vertical').textContent=(sim.velocity.y>=0?'+':'')+sim.velocity.y.toFixed(1);
    $('#energy').textContent=Math.ceil(sim.energy).toString();$('#energy-fill').style.transform=`scaleX(${sim.energy/100})`;
    $('.energy-track').classList.toggle('low',sim.energy<20);
    $('#pitch').textContent=Math.round(THREE.MathUtils.radToDeg(sim.attitude.x))+'°';$('#roll').textContent=Math.round(THREE.MathUtils.radToDeg(sim.attitude.z))+'°';$('#heading').textContent=((Math.round(-THREE.MathUtils.radToDeg(sim.attitude.y))+360)%360).toString().padStart(3,'0');
    $('#contact').textContent=sim.grounded?'● GROUND':'◇ AIRBORNE';
    $('#horizon').style.transform=`rotate(${-THREE.MathUtils.radToDeg(sim.attitude.z)}deg) translateY(${sim.attitude.x*35}px)`;
    $('#performance').textContent=`${fps} FPS${input.gamepad?' · PAD':''}`;
    $('#system').innerHTML=`<i class="tiny-dot"></i>${sim.crashed?'HARD LANDING':sim.assist?'LANDING ASSIST':sim.energy<20?'ENERGY LOW':sim.grounded?'SYSTEM READY':'THRUST ACTIVE'}`;
    $('#launch').innerHTML=sim.mode==='flight'&&!sim.grounded?'降落輔助 <span>↓</span>':'啟動 ROCKET <span>↑</span>';
    $('#land').classList.toggle('active',sim.assist);$('#land').setAttribute('aria-pressed',String(sim.assist));
    document.querySelectorAll('#speed-ticks i').forEach((e,i)=>e.classList.toggle('on',i<data.speed/10));
    if(lastMode!==sim.mode){
      $('#sim').classList.toggle('driving',sim.mode==='drive');$('#sim').classList.toggle('flight',sim.mode==='flight');
      gsap.to('#intro',{autoAlpha:sim.mode==='showcase'?1:0,duration:.4});
      document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>{const active=b.dataset.mode===sim.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      lastMode=sim.mode;
    }
  };
  const diagnostics=()=>({vehicle:sim.snapshot(),camera:rig.view,cameraPosition:camera.position.toArray(),cameraTarget:rig.controls.target.toArray(),transition:rig.transitioning,paused,events:events.slice(),asset:car.diagnostics,renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,dpr:renderer.getPixelRatio(),fps,shadowMap:mobile?1024:2048},physics:{bodies:physics.bodies.len(),colliders:physics.colliders.len(),fixedStep:SIM.fixedStep},audio:{enabled:audio.enabled,state:audio.context?.state}});
  if(new URLSearchParams(location.search).has('qa')){
    Object.assign(window,{__ROADSTER__:{snapshot:diagnostics},__THREE_GAME_DIAGNOSTICS__:{get renderer(){return diagnostics().renderer;}},__THREE_GAME_TEST_HOOKS__:{
      async setState(state:string){
        if(!['active-driving','active-flight','cockpit','spectator'].includes(state))throw new Error('Unknown capture state: '+state);
        paused=false;sim.reset();chooseMode(state==='active-driving'?'drive':'flight');
        if(state==='active-driving')input.keys.add('KeyW');else launchTime=1.8;
        await new Promise(resolve=>setTimeout(resolve,2100));input.keys.delete('KeyW');
        chooseCamera(state==='cockpit'?'cockpit':state==='spectator'?'spectator':'chase');
        await new Promise(resolve=>setTimeout(resolve,1250));return {state};
      },setPausedForScreenshot(value:boolean){paused=value;input.clear();}
    }});
  }
  renderer.setAnimationLoop(()=>{
    const now=performance.now(),dt=Math.min((now-prior)/1000,.1);prior=now;
    if(!paused){
      time+=dt;accumulator=Math.min(.1,accumulator+dt);
      while(accumulator>=SIM.fixedStep){const intent=input.read();if(launchTime>0){intent.lift=1;launchTime-=SIM.fixedStep;}sim.step(SIM.fixedStep,intent);accumulator-=SIM.fixedStep;}
      car.group.position.copy(sim.position);car.group.quaternion.copy(sim.rotation);
      const localForward=new THREE.Vector3(0,0,-1).applyQuaternion(sim.rotation);wheelSpin-=sim.velocity.dot(localForward)*dt/SIM.wheelRadius;
      car.wheels.forEach((w,i)=>{w.position.y=SIM.wheelConnectionY-(sim.vehicle.wheelSuspensionLength(i)??.3);w.rotation.x=wheelSpin;w.rotation.y=i<2?-sim.steer:0;});
      world.update(dt,time);vfx.update(dt,sim.thrust,car.thrusters);
    }else accumulator=0;
    rig.update(paused?0:dt,time);
    shadowClock+=dt;if(shadowClock>.4){sun.target.position.copy(sim.position);sun.position.copy(sim.position).add(new THREE.Vector3(-80,120,-70));shadowClock=0;}
    audio.update(sim.velocity.length(),sim.thrust,paused);
    renderer.render(scene,camera);
    frames++;frameClock+=dt;if(frameClock>1){fps=Math.round(frames/frameClock);frameClock=0;frames=0;}
    hudClock+=dt;if(hudClock>.08){updateHUD();hudClock=0;}
  });
  updateHUD();
}
init().catch(error=>{console.error(error);$('#loading-status').textContent='無法初始化 3D 模擬器。請使用支援 WebGL2 的瀏覽器，或重新整理。';});
