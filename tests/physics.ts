import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {VehiclePhysics,SIM} from '../src/physics';
await RAPIER.init();
const world=new RAPIER.World({x:0,y:-9.81,z:0});
world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,800).setTranslation(0,-.5,0));
const sim=new VehiclePhysics(world,new Vector3(0,.75,8),[new Vector3()]);
const neutral={throttle:0,steer:0,lift:0,pitch:0,roll:0,brake:false,boost:false};
function step(n:number,partial={}){for(let i=0;i<n;i++)sim.step(SIM.fixedStep,{...neutral,...partial});}
step(120);assert(sim.grounded,'suspension must settle on ground');
sim.setMode('drive');step(180,{throttle:1});
assert(sim.velocity.length()>4,'W accelerates the dynamic car');
assert(sim.position.z<0,'W drives local forward -Z');
const initialYaw=sim.attitude.y;step(90,{throttle:1,steer:1});assert(Math.abs(sim.attitude.y-initialYaw)>.1,'steering changes yaw');
sim.reset();sim.setMode('flight');step(180,{lift:1});assert(sim.position.y>12,'thrust overcomes gravity');assert(sim.energy<100,'flight drains energy');
step(45,{roll:1});assert(Math.abs(sim.attitude.z)>.2,'roll applies angular velocity');
sim.land();step(1400);assert.equal(sim.mode,'drive','assist completes landing and returns road mode');assert(sim.grounded,'landed vehicle contacts wheels');assert(!sim.crashed,'assisted landing is gentle');assert.equal(sim.landings,1,'pad landing increments count');
sim.reset();assert.equal(sim.energy,100);assert.equal(sim.crashed,false);
sim.setMode('flight');step(70,{lift:1});step(70,{lift:-1});step(500,{lift:-1});assert.equal(sim.mode,'drive','held manual descent lands gently');
function coast(brake:boolean){sim.reset();sim.setMode('flight');sim.body.setTranslation({x:0,y:10,z:8},true);sim.body.setLinvel({x:10,y:0,z:0},true);step(60,{brake});return Math.abs(sim.velocity.x);}
const unbraked=coast(false),braked=coast(true);assert(braked<unbraked*.5,'flight B brake reduces horizontal velocity');
sim.energy=0;step(1000);assert(sim.grounded&&sim.mode==='drive','energy depletion automatically descends');
sim.reset();step(120);const settledY=sim.position.y;assert(Math.abs(settledY-.658)<.025,'render chassis scale matches wheel contact height');
const obstacle=world.createCollider(RAPIER.ColliderDesc.cuboid(10,4,1).setTranslation(0,4,-10));sim.setMode('drive');step(250,{throttle:1});assert(sim.position.z>-8,'CCD chassis collides with solid wall');world.removeCollider(obstacle,true);
console.log(JSON.stringify({status:'PASS',checks:['wheel suspension and ride height','forward acceleration','steering','takeoff','energy drain','roll','assisted pad landing','manual descent','flight brake','emergency energy descent','solid obstacle collision with CCD','reset'],measurements:{settledY,unbraked,braked},snapshot:sim.snapshot()},null,2));
