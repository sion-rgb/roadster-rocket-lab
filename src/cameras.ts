import { PerspectiveCamera, Vector3, Quaternion, Euler } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import type { VehiclePhysics } from './physics';
export type CameraView='cockpit'|'chase'|'spectator';
export class CameraRig {
  view:CameraView='chase';controls:OrbitControls;
  private blend={value:1};private start=new Vector3();private startTarget=new Vector3();private startUp=new Vector3(0,1,0);private desiredUp=new Vector3(0,1,0);private look=new Vector3();private desired=new Vector3();private target=new Vector3();private yaw=new Quaternion();private euler=new Euler();private gaze={x:0,y:0};private drag=false;private last={x:0,y:0};
  reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  get transitioning(){return this.blend.value<1;}
  private upDelta=new Quaternion();private upBlend=new Quaternion();
  constructor(public camera:PerspectiveCamera,public canvas:HTMLCanvasElement,public sim:VehiclePhysics){
    this.controls=new OrbitControls(camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=3.8;this.controls.maxDistance=200;this.controls.maxPolarAngle=Math.PI*.49;this.controls.target.copy(sim.position);this.look.copy(sim.position);camera.position.copy(sim.position).add(innerWidth<761?new Vector3(-10,4,-12):new Vector3(-6.2,2.9,-7.4));this.controls.update();
    canvas.addEventListener('pointerdown',e=>{this.drag=true;this.last={x:e.clientX,y:e.clientY};});
    window.addEventListener('pointerup',()=>this.drag=false);
    canvas.addEventListener('pointercancel',()=>this.drag=false);
    canvas.addEventListener('pointermove',e=>{if(this.view==='cockpit'&&this.drag){this.gaze.x=Math.max(-1.1,Math.min(1.1,this.gaze.x-(e.clientX-this.last.x)*.004));this.gaze.y=Math.max(-.5,Math.min(.5,this.gaze.y-(e.clientY-this.last.y)*.004));}this.last={x:e.clientX,y:e.clientY};});
  }
  set(view:CameraView){
    this.view=view;this.start.copy(this.camera.position);this.startTarget.copy(this.look);this.startUp.copy(this.camera.up);this.blend.value=0;this.gaze={x:0,y:0};this.controls.enabled=false;this.controls.autoRotate=false;
    gsap.to(this.blend,{value:1,duration:this.reduced?.01:1.15,ease:'power2.inOut',overwrite:true,onComplete:()=>{if(view==='spectator'||this.sim.mode==='showcase'&&view==='chase'){this.controls.target.copy(this.look);this.controls.update();this.controls.enabled=true;}}});
  }
  update(dt:number,time:number){
    const {position:p,rotation:r}=this.sim;
    const showcase=this.sim.mode==='showcase'&&this.view==='chase';
    if((this.view==='spectator'||showcase)&&this.blend.value===1){
      this.controls.enabled=true;this.controls.autoRotate=showcase&&!this.reduced;this.controls.autoRotateSpeed=.45;this.controls.enablePan=this.view==='spectator';this.controls.update(dt);this.look.copy(this.controls.target);return;
    }
    this.controls.enabled=false;
    if(this.view==='cockpit'){
      this.desired.set(-.36,.36,-.28).applyQuaternion(r).add(p);
      this.target.set(Math.sin(this.gaze.x)*8,Math.sin(this.gaze.y)*8,-Math.cos(this.gaze.x)*8).applyQuaternion(r).add(this.desired);
      this.desiredUp.set(0,1,0).applyQuaternion(r);
    }else{
      this.desiredUp.set(0,1,0);
      this.euler.setFromQuaternion(r,'YXZ');this.yaw.setFromAxisAngle(new Vector3(0,1,0),this.euler.y);
      const offset=this.view==='spectator'?new Vector3(48,28,48):showcase?(innerWidth<761?new Vector3(-10,4,-12):new Vector3(-6.2,2.9,-7.4)):(innerWidth<761?new Vector3(0,3.8,12.5):new Vector3(0,2.7,8.2));
      this.desired.copy(offset).applyQuaternion(this.yaw).add(p);this.target.copy(p).add(showcase?new Vector3(innerWidth<761?.35:1.7,.15,0):new Vector3(0,.4,0));
    }
    if(this.blend.value<1){this.camera.position.lerpVectors(this.start,this.desired,this.blend.value);this.look.lerpVectors(this.startTarget,this.target,this.blend.value);}
    else{this.camera.position.lerp(this.desired,1-Math.exp(-dt*(this.view==='cockpit'?40:5)));this.look.lerp(this.target,1-Math.exp(-dt*8));}
    if(!this.reduced&&this.sim.thrust>.3&&this.view!=='spectator'){const shake=this.sim.thrust*.012;this.camera.position.x+=Math.sin(time*79)*shake;this.camera.position.y+=Math.cos(time*93)*shake;}
    this.upDelta.setFromUnitVectors(this.startUp,this.desiredUp);this.upBlend.identity().slerp(this.upDelta,this.blend.value);
    this.camera.up.copy(this.startUp).applyQuaternion(this.upBlend);
    this.camera.lookAt(this.look);
    const fov=this.view==='cockpit'?78:45+Math.min(9,this.sim.velocity.length()*.12);this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*3);this.camera.updateProjectionMatrix();
  }
}
