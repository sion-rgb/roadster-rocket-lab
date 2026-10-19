import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

type ReflectiveMaterial=THREE.MeshStandardMaterial;
/** Outdoor IBL, bounded local reflections and photographic finishing. No gameplay ownership. */
export async function createRendering(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,car:THREE.Group,sun:THREE.DirectionalLight,mobile:boolean){
  const stats={hdr:'loading',localReflections:!mobile,waterReflection:true,wetPadReflection:!mobile,cubeUpdates:0,planarUpdates:0,reflectionSize:mobile?256:512,quality:mobile?'balanced':'high',postPasses:mobile?0:2,frames:0,meanCalls:0,peakCalls:0,meanTriangles:0,peakTriangles:0};
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
  scene.traverse(o=>{if(o instanceof THREE.HemisphereLight){o.intensity=.38;o.color.set(0xb3d5ed);o.groundColor.set(0x706354);}});
  sun.color.set(0xffe1b0);sun.intensity=3.1;sun.shadow.radius=3.5;sun.shadow.normalBias=.035;sun.shadow.bias=-.00002;
  sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;
  const sunOffset=new THREE.Vector3(-60,85,-65);
  const oldSky=scene.getObjectByName('Moving coastal sky');
  let hdr:THREE.DataTexture|undefined;
  try{
    hdr=await new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}assets/hdri/coastal-sky-${mobile?'1k':'2k'}.hdr`);
    hdr.mapping=THREE.EquirectangularReflectionMapping;
    scene.background=hdr;scene.environment=hdr;scene.environmentIntensity=.85;scene.backgroundIntensity=.72;scene.backgroundBlurriness=.015;
    if(oldSky)oldSky.visible=false;
    // Match the key light to the brightest sky region instead of unrelated studio highlights.
    const image=hdr.image as unknown as {width:number;height:number;data:Uint16Array};let highest=0,index=0;
    for(let i=0;i<image.data.length;i+=64){const value=THREE.DataUtils.fromHalfFloat(image.data[i])*.2126+THREE.DataUtils.fromHalfFloat(image.data[i+1])*.7152+THREE.DataUtils.fromHalfFloat(image.data[i+2])*.0722;if(value>highest){highest=value;index=i/4;}}
    const longitude=(index%image.width)/image.width*Math.PI*2-Math.PI,latitude=(Math.floor(index/image.width)/image.height-.5)*Math.PI;
    sunOffset.set(Math.cos(latitude)*Math.cos(longitude),Math.max(.42,Math.sin(latitude)),Math.cos(latitude)*Math.sin(longitude)).normalize().multiplyScalar(140);
    stats.hdr='CC0 Kloppenheim 06';
  }catch{stats.hdr='procedural fallback';}
  scene.fog=new THREE.Fog(0xa3bbc2,260,1450);

  const water=scene.getObjectByName('Animated coastal water') as THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
  const waterMirror=new Reflector(new THREE.PlaneGeometry(2000,3600),{textureWidth:stats.reflectionSize,textureHeight:stats.reflectionSize,clipBias:.004,multisample:0});
  waterMirror.rotation.x=-Math.PI/2;waterMirror.position.copy(water.position);waterMirror.visible=false;waterMirror.name='Ocean reflection capture';scene.add(waterMirror);
  const padMirror=new Reflector(new THREE.CircleGeometry(13.4,64),{textureWidth:mobile?256:512,textureHeight:mobile?256:512,clipBias:.001,multisample:0});
  padMirror.rotation.x=-Math.PI/2;padMirror.position.y=.044;padMirror.visible=false;scene.add(padMirror);
  const reflectionWorld=new THREE.Matrix4(),padWorld=new THREE.Matrix4();
  const waterShader=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uReflection:{value:waterMirror.getRenderTarget().texture},uSky:{value:hdr??null},uHasSky:{value:hdr?1:0},uMatrix:{value:reflectionWorld},uSun:{value:sunOffset.clone().normalize()},uFog:{value:new THREE.Color(0xa3bbc2)}},
    vertexShader:`#include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uTime; uniform mat4 uMatrix; varying vec3 vWorld; varying vec4 vReflect;
      void main(){vec4 world=modelMatrix*vec4(position,1.);world.y+=sin(world.x*.13+uTime*.7)*.10+sin(world.z*.19-uTime*.8)*.065;vWorld=world.xyz;vReflect=uMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;uniform sampler2D uReflection;uniform sampler2D uSky;uniform float uHasSky;uniform vec3 uSun;uniform vec3 uFog;varying vec3 vWorld;varying vec4 vReflect;
      float wave(vec2 p){return sin(p.x*.7+uTime*.8)*sin(p.y*.9-uTime*.6)+.28*sin(p.x*2.7+p.y*1.9+uTime);}
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p=vWorld.xz;vec3 V=normalize(cameraPosition-vWorld);
        vec3 N=normalize(vec3(-cos(p.x*.13+uTime*.7)*.065+wave(p)*.04,1.,-cos(p.y*.19-uTime*.8)*.045+wave(p+6.)*.035));
        float f=pow(1.-max(dot(V,N),0.),4.);vec3 R=reflect(-V,N);
        vec3 sky=uHasSky>.5?texture2D(uSky,equirectUv(R)).rgb:vec3(.45,.62,.75);
        vec2 uv=vReflect.xy/vReflect.w+N.xz*.018;float inView=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
        vec3 mirrored=texture2D(uReflection,clamp(uv,.002,.998)).rgb;
        vec3 reflection=mix(sky,mirrored,inView*.86);float coast=1.-smoothstep(0.,75.,abs(vWorld.x+35.));
        vec3 deep=mix(vec3(.012,.075,.105),vec3(.025,.20,.20),coast);
        vec3 color=mix(deep,reflection,.20+f*.72);
        float sparkle=pow(max(dot(N,normalize(V+uSun)),0.),180.)*(.72+.28*sin(p.y*5.+uTime*2.));color+=vec3(1.,.8,.5)*sparkle*.9;
        float foam=(1.-smoothstep(.0,1.2,abs(vWorld.x+35.)))*smoothstep(.28,.8,wave(p*.6));color=mix(color,vec3(.65,.76,.73),foam*.5);
        float fog=smoothstep(360.,1800.,length(cameraPosition-vWorld));color=mix(color,uFog,fog*.75);gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  water.material.dispose();water.material=waterShader;
  const padMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{uTexture:{value:padMirror.getRenderTarget().texture},uMatrix:{value:padWorld}},
    vertexShader:`#include <common>
      #include <logdepthbuf_pars_vertex>
      uniform mat4 uMatrix;varying vec3 vWorld;varying vec4 vReflect;varying vec2 vUv;
      void main(){vec4 world=modelMatrix*vec4(position,1.);vUv=uv;vWorld=world.xyz;vReflect=uMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`#include <logdepthbuf_pars_fragment>
      uniform sampler2D uTexture;varying vec3 vWorld;varying vec4 vReflect;varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 V=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(V.y,0.),3.);float patches=.72+.28*sin(vWorld.x*1.7+sin(vWorld.z*.6))*sin(vWorld.z*.8);float edge=1.-smoothstep(.35,.5,length(vUv-.5));
        vec2 uv=vReflect.xy/vReflect.w;vec3 color=texture2D(uTexture,uv).rgb;gl_FragColor=vec4(color,(.12+fresnel*.35)*patches*edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const pad=new THREE.Mesh(new THREE.CircleGeometry(13.4,64),padMaterial);pad.rotation.x=-Math.PI/2;pad.position.y=.044;pad.renderOrder=2;pad.name='Rain-polished landing pad';pad.visible=!mobile;scene.add(pad);

  const cubeTarget=new THREE.WebGLCubeRenderTarget(mobile?64:128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const cube=new THREE.CubeCamera(.2,1800,cubeTarget);scene.add(cube);
  const reflectionMaterials=new Set<ReflectiveMaterial>();const cores:THREE.MeshStandardMaterial[]=[];
  car.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m instanceof THREE.MeshStandardMaterial&&m.userData.localReflection){reflectionMaterials.add(m);if(!mobile){m.envMap=cubeTarget.texture;m.needsUpdate=true;}}if(m.userData.thrusterCore)cores.push(m);}});

  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const ctx=contactCanvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'rgba(4,12,17,.7)');gradient.addColorStop(.48,'rgba(4,12,17,.35)');gradient.addColorStop(1,'rgba(4,12,17,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const contactMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,opacity:.5,depthWrite:false});
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(3.0,5.5),contactMaterial);contact.rotation.x=-Math.PI/2;contact.position.y=.039;contact.renderOrder=1;scene.add(contact);

  let composer:EffectComposer|undefined;
  if(!mobile){
    const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
    composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.12,.25,2.1));composer.addPass(new OutputPass());
  }
  let cubeClock=1,waterClock=1,padClock=1;const inverse=new THREE.Matrix4();
  const reflect=(mirror:Reflector,matrix:THREE.Matrix4)=>{
    water.visible=false;pad.visible=false;
    mirror.updateMatrixWorld(true);
    const material=mirror.material as THREE.ShaderMaterial;
    mirror.onBeforeRender(renderer,scene,camera,mirror.geometry,material,null as never);
    matrix.copy(material.uniforms.textureMatrix.value).multiply(inverse.copy(mirror.matrixWorld).invert());
    mirror.visible=false;water.visible=true;stats.planarUpdates++;
  };
  return {
    stats,reflectionMaterials:reflectionMaterials.size,
    resize(){composer?.setPixelRatio(renderer.getPixelRatio());composer?.setSize(innerWidth,innerHeight);},
    update(dt:number,time:number,position:THREE.Vector3,rotation:THREE.Quaternion,thrust:number){
      cubeClock+=dt;waterClock+=dt;padClock+=dt;waterShader.uniforms.uTime.value=time;
      sun.target.position.copy(position);sun.position.copy(position).add(sunOffset);
      contact.position.set(position.x,.039,position.z);contact.rotation.z=-new THREE.Euler().setFromQuaternion(rotation,'YXZ').y;contactMaterial.opacity=.58*Math.max(0,1-(position.y-.65)/3);
      for(const core of cores)core.emissiveIntensity=.3+thrust*3;
      camera.updateMatrixWorld();scene.updateMatrixWorld(true);
      // Reflection passes skip shadow updates. Initialise a real depth shadow map
      // first, so their shadow samplers never bind a colour-texture fallback.
      if(!sun.shadow.map){
        water.visible=false;pad.visible=false;car.visible=false;
        renderer.render(scene,camera);
        water.visible=true;car.visible=true;
      }
      if(!mobile&&cubeClock>.38){
        const shadows=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;car.visible=false;water.visible=false;pad.visible=false;contact.visible=false;
        cube.position.copy(position).add(new THREE.Vector3(0,.4,0));cube.update(renderer,scene);
        car.visible=true;water.visible=true;contact.visible=true;renderer.shadowMap.autoUpdate=shadows;cubeClock=0;stats.cubeUpdates++;
      }
      if(waterClock>(mobile?.33:.10)){reflect(waterMirror,reflectionWorld);waterClock=0;}
      const nearest=Math.round(-position.z/180);pad.position.z=-Math.min(2,Math.max(0,nearest))*180;
      padMirror.position.z=pad.position.z;
      const showPad=!mobile&&position.y<4&&Math.hypot(position.x,position.z-pad.position.z)<22;
      if(showPad&&padClock>.10){reflect(padMirror,padWorld);padClock=0;}
      pad.visible=showPad;
    },
    render(dt:number){
      if(composer)composer.render(dt);else renderer.render(scene,camera);
      const {calls,triangles}=renderer.info.render;stats.frames++;stats.meanCalls+=(calls-stats.meanCalls)/stats.frames;stats.meanTriangles+=(triangles-stats.meanTriangles)/stats.frames;stats.peakCalls=Math.max(stats.peakCalls,calls);stats.peakTriangles=Math.max(stats.peakTriangles,triangles);
    }
  };
}
