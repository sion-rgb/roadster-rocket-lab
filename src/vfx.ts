import * as THREE from 'three';

export class RocketVFX {
  private geometry=new THREE.BufferGeometry();private positions=new Float32Array(360*3);private colors=new Float32Array(360*3);private life=new Float32Array(360);private velocity=new Float32Array(360*3);private index=0;private emission=0;
  private plumes:THREE.Mesh[]=[];private plumeGeometry=new THREE.ConeGeometry(.09,.85,16,1,true).translate(0,.425,0);
  private plumeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uPower:{value:0}},
    vertexShader:`#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`#include <logdepthbuf_pars_fragment>
      uniform float uPower;varying vec2 vUv;void main(){
        #include <logdepthbuf_fragment>
        float fade=pow(1.-vUv.y,1.8);vec3 color=mix(vec3(.08,.45,1.4),vec3(2.5,2.8,3.2),fade);gl_FragColor=vec4(color,fade*uPower*.55);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  points:THREE.Points;
  constructor(scene:THREE.Scene){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const context=canvas.getContext('2d')!;
    const gradient=context.createRadialGradient(16,16,1,16,16,16);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.6)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,32,32);
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));this.positions.fill(-1000);
    this.points=new THREE.Points(this.geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(canvas),vertexColors:true,size:.11,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));this.points.frustumCulled=false;scene.add(this.points);
  }
  update(dt:number,thrust:number,sockets:THREE.Object3D[]){
    if(!this.plumes.length)for(const socket of sockets){const plume=new THREE.Mesh(this.plumeGeometry,this.plumeMaterial);socket.add(plume);this.plumes.push(plume);}
    this.plumeMaterial.uniforms.uPower.value=thrust;
    this.plumes.forEach((p,i)=>{p.visible=thrust>.05;p.scale.set(1,.5+thrust*.8+Math.sin(this.index*.3+i)*.04,1);});
    this.emission+=thrust*450*dt;const count=Math.floor(this.emission);this.emission-=count;
    for(let n=0;n<count;n++){
      const i=this.index++%360,socket=sockets[i%sockets.length],p=socket.getWorldPosition(new THREE.Vector3());
      const direction=new THREE.Vector3(0,-1,0).transformDirection(socket.parent!.matrixWorld);
      this.positions.set([p.x,p.y,p.z],i*3);this.velocity.set([direction.x*6+(Math.random()-.5)*.3,direction.y*6,direction.z*6+(Math.random()-.5)*.3],i*3);this.life[i]=.12+Math.random()*.18;
    }
    for(let i=0;i<360;i++)if(this.life[i]>0){
      this.life[i]-=dt;for(let j=0;j<3;j++)this.positions[i*3+j]+=this.velocity[i*3+j]*dt;
      const fade=Math.max(0,this.life[i]/.3);this.colors.set([fade*.5,fade*.78,fade],i*3);if(this.life[i]<=0)this.positions[i*3+1]=-1000;
    }
    this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.color.needsUpdate=true;
  }
}
