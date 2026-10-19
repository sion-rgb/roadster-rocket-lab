import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { VehicleRenderPose } from '../src/render-pose';

const step=1/60;
for(const hz of [30,75,144]){
  const source={position:new Vector3(),rotation:new Quaternion(),resetCount:0};
  const pose=new VehicleRenderPose(source);
  let accumulator=0,tick=0;
  for(let frame=1;frame<=hz*2;frame++){
    accumulator+=1/hz;
    while(accumulator>=step){
      tick++;source.position.set(tick*step*24,0,0);
      source.rotation.setFromAxisAngle(new Vector3(0,1,0),tick*step*.7);
      pose.push();accumulator-=step;
    }
    pose.sample(accumulator/step);
    const renderedTime=Math.max(0,frame/hz-step);
    assert(Math.abs(pose.position.x-renderedTime*24)<1e-9,`${hz} Hz translation must advance smoothly between fixed ticks`);
    const expected=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),renderedTime*.7);
    assert(pose.rotation.angleTo(expected)<1e-7,`${hz} Hz attitude must use the same interpolated time`);
  }
  // Reset between ticks must never sweep the cabin through the world.
  source.resetCount++;source.position.set(100,2,-10);source.rotation.identity();pose.sample(.2);
  assert(pose.position.equals(source.position));assert(pose.rotation.equals(source.rotation));
  const frozen=pose.position.clone();pose.sample(.2);assert(pose.position.equals(frozen));
}
const source={position:new Vector3(),rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI-.02),resetCount:0};
const pose=new VehicleRenderPose(source);
source.rotation.setFromAxisAngle(new Vector3(0,1,0),-Math.PI+.02);pose.push();pose.sample(.5);
assert(pose.rotation.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI))<1e-7,'crossing 180 degrees must take the short rotation path');
source.resetCount++;source.position.set(0,8,0);pose.push();pose.sample(0);
assert(pose.position.equals(source.position),'resets inside a physics step snap immediately');
console.log('PASS: camera render interpolation at 30/75/144 Hz, coherent attitude, pause, reset and 180-degree wrap');
