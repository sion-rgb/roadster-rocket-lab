import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion, Euler } from 'three';
import type { Intent } from './input';
export type Mode='showcase'|'drive'|'flight';
export const SIM={mass:1800,gravity:9.81,topSpeed:60,boostSpeed:85,maxAltitude:250,energyDrain:3.2,recharge:12,softLanding:4,fixedStep:1/60,wheelConnectionY:-.1,wheelRadius:.32};
export class VehiclePhysics {
  body:RAPIER.RigidBody;
  vehicle:RAPIER.DynamicRayCastVehicleController;
  mode:Mode='showcase'; energy=100; assist=false; grounded=true; crashed=false;
  landings=0; lastImpact=0; thrust=0; steer=0; flightTime=0; resetCount=0;
  position=new Vector3(); rotation=new Quaternion(); velocity=new Vector3(); attitude=new Euler(0,0,0,'YXZ');
  private forward=new Vector3(); private q=new Quaternion(); private euler=new Euler(0,0,0,'YXZ');
  private priorVy=0; private airborne=false; private lastGrounded=true; private stable=0;
  onEvent:(message:string)=>void=()=>{};
  constructor(public world:RAPIER.World,public spawn:Vector3,public pads:Vector3[]){
    this.body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x,spawn.y,spawn.z).setLinearDamping(.1).setAngularDamping(2.8).setCcdEnabled(true).setCanSleep(false));
    world.createCollider(RAPIER.ColliderDesc.cuboid(.88,.24,2.02).setMass(SIM.mass).setFriction(.4).setRestitution(.05),this.body);
    this.vehicle=world.createVehicleController(this.body);this.vehicle.indexUpAxis=1;
    for(const z of [-1.45,1.45])for(const x of [-.91,.91]){
      const i=this.vehicle.numWheels();
      this.vehicle.addWheel({x,y:SIM.wheelConnectionY,z},{x:0,y:-1,z:0},{x:1,y:0,z:0},.3,SIM.wheelRadius);
      this.vehicle.setWheelSuspensionStiffness(i,35);
      this.vehicle.setWheelSuspensionCompression(i,4.5);this.vehicle.setWheelSuspensionRelaxation(i,5);
      this.vehicle.setWheelMaxSuspensionTravel(i,.22);this.vehicle.setWheelMaxSuspensionForce(i,30000);
      this.vehicle.setWheelFrictionSlip(i,2);this.vehicle.setWheelSideFrictionStiffness(i,1.4);
    }
    this.sync();
  }
  setMode(mode:Mode){
    if(this.crashed)this.reset();
    if(mode==='showcase'){this.reset();this.mode=mode;this.onEvent('展示模式 · 拖曳旋轉，滾輪縮放');return;}
    if(mode==='drive'&&!this.grounded&&this.position.y>1.4){this.assist=true;this.onEvent('降落輔助已啟動 · 著地後轉入道路模式');return;}
    this.mode=mode;this.assist=false;this.stable=0;
    this.onEvent(mode==='flight'?'Rocket 系統就緒 · 按住空白鍵起飛':'道路模式 · W 加速，A / D 轉向');
  }
  reset(){
    this.resetCount++;
    this.body.setTranslation(this.spawn,true);this.body.setRotation({x:0,y:0,z:0,w:1},true);
    this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);
    this.body.resetForces(true);this.body.resetTorques(true);this.energy=100;this.assist=false;this.crashed=false;this.airborne=false;this.flightTime=0;this.stable=0;this.lastImpact=0;this.priorVy=0;this.sync();
  }
  land(){if(this.mode==='flight'){this.assist=!this.assist;this.onEvent(this.assist?'降落輔助 · 制動、回正並緩慢下降':'降落輔助已解除');}}
  step(dt:number,input:Intent){
    const p=this.body.translation(),v=this.body.linvel(),r=this.body.rotation();
    this.q.set(r.x,r.y,r.z,r.w);this.forward.set(0,0,-1).applyQuaternion(this.q);
    this.euler.setFromQuaternion(this.q,'YXZ');
    this.body.resetForces(true);this.body.resetTorques(true);
    const speed=Math.hypot(v.x,v.z),groundMode=this.mode!=='flight'||this.grounded&&input.lift<=0&&!this.airborne;
    this.steer+=(input.steer*.38/(1+speed*.025)-this.steer)*Math.min(1,dt*9);
    for(let i=0;i<4;i++){
      this.vehicle.setWheelSteering(i,i<2?-this.steer:0);
      this.vehicle.setWheelBrake(i,this.mode==='showcase'||this.crashed?200:input.brake?130:input.throttle===0&&groundMode?5:0);
      const force=this.mode!=='showcase'&&!this.crashed&&groundMode?input.throttle*(input.boost?6500:4000):0;
      this.vehicle.setWheelEngineForce(i,speed>(input.boost?SIM.boostSpeed:SIM.topSpeed)?0:force);
    }
    this.vehicle.updateVehicle(dt,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,c=>c.parent()?.handle!==this.body.handle);
    this.grounded=Array.from({length:4},(_,i)=>this.vehicle.wheelIsInContact(i)).filter(Boolean).length>=2;
    if(this.mode==='flight'&&!this.crashed){
      if(this.energy<1)this.assist=true;
      const powered=this.energy>0;
      let desiredVy=this.assist?-Math.min(3,Math.max(.65,(p.y-.6)*.7)):input.lift*(input.boost?15:9);
      // Ground proximity cushion makes a held manual descent land gently at an upright attitude.
      if(input.lift<0&&!this.assist)desiredVy=-Math.min(Math.abs(desiredVy),Math.max(.6,(p.y-.6)*.7));
      if(p.y>SIM.maxAltitude){desiredVy=Math.min(desiredVy,-2);}
      const airborne=!this.grounded||input.lift>0||this.airborne;
      this.thrust=airborne?Math.max(.12,Math.min(1,(desiredVy-v.y)*.12+.5)):0;
      if(airborne){
        // Arcade world-up lift and rate-limited attitude control; all gains are fictional.
        const ay=SIM.gravity+(desiredVy-v.y)*3.5;
        this.body.addForce({x:0,y:SIM.mass*ay,z:0},true);
        if(powered)this.energy=Math.max(0,this.energy-dt*(SIM.energyDrain+(input.boost?6:0)+Math.abs(input.lift)*1.1));
        const thrust=this.assist||!powered||input.brake?0:input.throttle*(input.boost?14:7);
        const drag=this.assist||input.brake?1.8:.22;
        this.body.addForce({x:this.forward.x*thrust*SIM.mass-v.x*SIM.mass*drag,y:0,z:this.forward.z*thrust*SIM.mass-v.z*SIM.mass*drag},true);
        const pitch=this.assist?-this.euler.x*3:input.pitch*1.1-(input.pitch===0?this.euler.x*.8:0);
        const roll=this.assist?-this.euler.z*3:input.roll*1.6-(input.roll===0?this.euler.z*.9:0);
        const a=this.body.angvel(),alpha=Math.min(1,dt*6);
        const local=new Vector3(pitch,-input.steer*.9,roll).applyQuaternion(this.q);
        this.body.setAngvel({x:a.x+(local.x-a.x)*alpha,y:a.y+(local.y-a.y)*alpha,z:a.z+(local.z-a.z)*alpha},true);
        this.flightTime+=dt;
      }
      if(p.y>2)this.airborne=true;
      if(this.grounded&&this.airborne&&!this.lastGrounded){
        this.lastImpact=Math.abs(this.priorVy);
        if(this.lastImpact>SIM.softLanding||Math.abs(this.euler.z)>.7||Math.abs(this.euler.x)>.7){this.crashed=true;this.onEvent(`接地衝擊 ${this.lastImpact.toFixed(1)} m/s · 按 R 重置`);}
      }
      if(this.grounded&&this.airborne&&!this.crashed&&Math.abs(v.y)<1){
        this.stable+=dt;
        if(this.stable>.35){
          this.mode='drive';this.assist=false;this.airborne=false;
          const pad=this.pads.some(pad=>Math.hypot(p.x-pad.x,p.z-pad.z)<11);
          if(pad)this.landings++;
          this.onEvent(pad?'精準降落完成 · 停機區已確認':'平穩著地 · 已切換道路模式');
        }
      }else this.stable=0;
    }else this.thrust=0;
    if(this.grounded&&this.mode!=='flight')this.energy=Math.min(100,this.energy+SIM.recharge*dt);
    if(this.mode!=='flight'&&this.grounded){
      // Upright assist keeps this accessible road sandbox stable at high steering rates.
      const a=this.body.angvel();this.body.setAngvel({x:a.x*.85-this.euler.x*dt*8,y:a.y,z:a.z*.85-this.euler.z*dt*8},true);
    }
    this.lastGrounded=this.grounded;this.priorVy=v.y;
    this.world.timestep=dt;this.world.step();this.sync();
    if(this.position.y<-8||Math.abs(this.position.x)>580||Math.abs(this.position.z)>740){this.reset();this.mode='drive';this.onEvent('已返回測試區 · 海面及場景邊界會安全重置');}
  }
  sync(){const p=this.body.translation(),r=this.body.rotation(),v=this.body.linvel();this.position.set(p.x,p.y,p.z);this.rotation.set(r.x,r.y,r.z,r.w);this.velocity.set(v.x,v.y,v.z);this.attitude.setFromQuaternion(this.rotation,'YXZ');}
  snapshot(){return {mode:this.mode,position:this.position.toArray(),velocity:this.velocity.toArray(),speed:this.velocity.length()*3.6,altitude:Math.max(0,this.position.y-.65),energy:this.energy,grounded:this.grounded,assist:this.assist,crashed:this.crashed,landings:this.landings,attitude:[this.attitude.x,this.attitude.y,this.attitude.z],wheels:Array.from({length:4},(_,i)=>({contact:this.vehicle.wheelIsInContact(i),suspension:this.vehicle.wheelSuspensionLength(i)}))};}
}
