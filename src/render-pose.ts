import { Quaternion, Vector3 } from 'three';
import type { VehiclePhysics } from './physics';

// Share one interpolated pose between the cabin and camera, one physics tick behind.
export class VehicleRenderPose {
  readonly position=new Vector3();
  readonly rotation=new Quaternion();
  private previousPosition=new Vector3();
  private previousRotation=new Quaternion();
  private currentPosition=new Vector3();
  private currentRotation=new Quaternion();
  private resetCount=-1;

  constructor(private sim:Pick<VehiclePhysics,'position'|'rotation'|'resetCount'>){this.snap();}

  private snap(){
    this.resetCount=this.sim.resetCount;
    this.previousPosition.copy(this.sim.position);this.currentPosition.copy(this.sim.position);
    this.previousRotation.copy(this.sim.rotation);this.currentRotation.copy(this.sim.rotation);
  }

  // Call after every fixed physics step, including frames with several steps.
  push(){
    if(this.resetCount!==this.sim.resetCount){this.snap();return;}
    this.previousPosition.copy(this.currentPosition);this.previousRotation.copy(this.currentRotation);
    this.currentPosition.copy(this.sim.position);this.currentRotation.copy(this.sim.rotation);
  }

  sample(alpha:number){
    // A reset can also happen between physics ticks through keyboard or touch UI.
    if(this.resetCount!==this.sim.resetCount)this.snap();
    const t=Math.max(0,Math.min(1,alpha));
    this.position.lerpVectors(this.previousPosition,this.currentPosition,t);
    this.rotation.slerpQuaternions(this.previousRotation,this.currentRotation,t);
  }
}
