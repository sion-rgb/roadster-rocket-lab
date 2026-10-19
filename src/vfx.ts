import * as THREE from 'three';
export class RocketVFX {
  private geometry=new THREE.BufferGeometry();private positions=new Float32Array(360*3);private life=new Float32Array(360);private velocity=new Float32Array(360*3);private index=0;points:THREE.Points;
  constructor(scene:THREE.Scene){this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.positions.fill(-1000);this.points=new THREE.Points(this.geometry,new THREE.PointsMaterial({color:0xffb16b,size:.13,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));this.points.frustumCulled=false;scene.add(this.points);}
  update(dt:number,thrust:number,sockets:THREE.Object3D[]){
    if(thrust>.05)for(let n=0;n<Math.ceil(thrust*14);n++){const i=this.index++%360,socket=sockets[i%sockets.length],p=socket.getWorldPosition(new THREE.Vector3());const direction=new THREE.Vector3(0,-1,0).transformDirection(socket.parent!.matrixWorld);this.positions.set([p.x,p.y,p.z],i*3);this.velocity.set([direction.x*5+(Math.random()-.5)*.7,direction.y*5,direction.z*5+(Math.random()-.5)*.7],i*3);this.life[i]=.15+Math.random()*.3;}
    for(let i=0;i<360;i++){if(this.life[i]>0){this.life[i]-=dt;for(let j=0;j<3;j++)this.positions[i*3+j]+=this.velocity[i*3+j]*dt;if(this.life[i]<=0)this.positions[i*3+1]=-1000;}}
    this.geometry.attributes.position.needsUpdate=true;
  }
}
