import * as THREE from 'three';

type Standard = THREE.MeshStandardMaterial;
const surfaceMaps=new Map<string,THREE.Texture>();

/** Layered height fields produce continuous eroded headlands rather than cone peaks. */
export function addDistantHeadlands(root:THREE.Group){
  const mobile=typeof matchMedia!=='undefined'&&matchMedia('(max-width:760px)').matches;
  const add=(x:number,z:number,width:number,length:number,angle:number,color:number,phase:number)=>{
    const terrain=new THREE.PlaneGeometry(width,length,mobile?22:42,mobile?80:150);terrain.rotateX(-Math.PI/2);
    const p=terrain.attributes.position,colors:number[]=[];
    for(let i=0;i<p.count;i++){
      const px=p.getX(i),pz=p.getZ(i),u=px/width+.5,v=pz/length+.5;
      const spine=Math.sin(u*Math.PI)**1.25;
      const ridge=74+34*Math.sin(pz*.009+phase)+25*Math.sin(pz*.023+1.2)+17*Math.cos(pz*.047+phase);
      const erosion=12*Math.sin(px*.038+pz*.028)+7*Math.cos(px*.095-pz*.062);
      const ends=Math.min(1,v*12,(1-v)*12);
      const height=Math.max(-3,(ridge+erosion)*spine*ends-4);
      p.setY(i,height);
      const shade=.76+Math.max(0,height)/180*.24;colors.push(shade*.86,shade*.94,shade);
    }
    terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color,roughness:.98,vertexColors:true});
    const mesh=new THREE.Mesh(terrain,material);mesh.name='Eroded coastal headland';mesh.position.set(x,-3,z);mesh.rotation.y=angle;root.add(mesh);
  };
  add(-610,0,380,2700,0,0x718b8a,.3);
  add(-900,-130,460,2850,0,0x82999b,2.1);
  add(200,-1100,450,1500,Math.PI/2,0x82999b,1.7);
}
type Kit = {
  root: THREE.Group;
  materials: Record<string, Standard>;
  instance: (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry?: number, rx?: number, rz?: number, shadow?: boolean) => void;
  box: (material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow?: boolean, ry?: number) => void;
  collider: (x: number, y: number, z: number, w: number, h: number, d: number) => void;
};

/** 1k, CC0 Poly Haven photographs. Source URLs and SHA-256 hashes ship beside the files. */
export function applyCoastalPbr(material: Standard, asset: string, metres: number, normalStrength: number, worldProjection = true) {
  // The headless Rapier verification deliberately does not need browser assets.
  if (typeof document === 'undefined') return;
  const loader = new THREE.TextureLoader();
  const load = (role: string, srgb = false) => {
    const key=`${asset}:${role}`;
    if(surfaceMaps.has(key))return surfaceMaps.get(key)!;
    const texture = loader.load(`${import.meta.env.BASE_URL}assets/surfaces/${asset}_${role}_1k.jpg`);
    texture.name = `CC0 Poly Haven / ${asset} / ${role}`;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    surfaceMaps.set(key,texture);
    return texture;
  };
  material.map = load('diff', true);
  material.normalMap = load('nor_gl');
  material.roughnessMap = load('rough');
  material.normalScale.set(normalStrength, normalStrength);
  if (worldProjection) {
    // Independent UVs for all three PBR channels, including instances. Dominant-axis
    // projection gives metre-scaled paving on slabs and credible vertical curb faces.
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec4 surfaceWorld = vec4(position, 1.0);
        vec3 surfaceNormal = normal;
        #ifdef USE_INSTANCING
          surfaceWorld = instanceMatrix * surfaceWorld;
          surfaceNormal = mat3(instanceMatrix) * surfaceNormal;
        #endif
        surfaceWorld = modelMatrix * surfaceWorld;
        surfaceNormal = abs(normalize(mat3(modelMatrix) * surfaceNormal));
        vec2 surfaceUv = surfaceNormal.y > max(surfaceNormal.x, surfaceNormal.z)
          ? surfaceWorld.xz : (surfaceNormal.x > surfaceNormal.z ? surfaceWorld.zy : surfaceWorld.xy);
        surfaceUv /= ${metres.toFixed(3)};
        #ifdef USE_MAP
          vMapUv = surfaceUv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = surfaceUv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = surfaceUv;
        #endif
      `);
    };
    material.customProgramCacheKey = () => `coastal-ph-pbr-v1-${asset}-${metres}`;
  }
  material.needsUpdate = true;
}

/** Authored near-field range kit: details carry real-world scale without filling the route. */
export function addCoastalDetails({ root, materials: m, instance, box, collider }: Kit) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0xcac6b9, roughness: 0.77 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x62584a, metalness: 0.8, roughness: 0.36 });
  const basalt = new THREE.MeshStandardMaterial({ color: 0xa4a6a0, roughness: 0.94 });
  applyCoastalPbr(basalt, 'rock_face_03', 1, 0.65, false);
  const foliage = new THREE.MeshStandardMaterial({ color: 0x334839, roughness: 0.96 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x222728, roughness: 0.95 });
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const boulder = new THREE.IcosahedronGeometry(1, 1);
  const positions = boulder.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const sculpt = 1 + 0.11 * Math.sin(x * 9 + z * 7) + 0.05 * Math.cos(y * 16);
    positions.setXYZ(i, x * sculpt, y * sculpt, z * sculpt);
  }
  boulder.computeVertexNormals();
  const shrub = new THREE.IcosahedronGeometry(1, 1);
  let detailSeed = 8153;
  const random = () => { detailSeed = (detailSeed * 1664525 + 1013904223) >>> 0; return detailSeed / 4294967296; };
  const isApproach = (z: number, radius = 24) => [0, -180, -360].some(pad => Math.abs(z - pad) < radius);
  const isCrossing = (z: number) => [-630, -450, -270, -90, 90, 270, 450, 630].some(cross => Math.abs(z - cross) < 14);

  // Modular bevelled curb stones: 12 cm high, entirely outside the 23 m boulevard.
  // Their shared collider covers only uninterrupted runs and skips every junction/pad.
  const curbSection = new THREE.Shape();
  curbSection.moveTo(-0.22, 0); curbSection.lineTo(0.22, 0);
  curbSection.lineTo(0.22, 0.1); curbSection.lineTo(0.13, 0.17);
  curbSection.lineTo(-0.16, 0.17); curbSection.lineTo(-0.22, 0.11); curbSection.closePath();
  const curb = new THREE.ExtrudeGeometry(curbSection, { depth: 1.97, bevelEnabled: false, steps: 1 });
  curb.translate(0, 0, -0.985);
  for (let z = -700; z < 700; z += 2) {
    if (isApproach(z) || isCrossing(z)) continue;
    for (const x of [-11.83, 11.83]) instance(curb, concrete, x, 0.003, z, 1, 1, 1, 0, 0, 0, false);
  }
  for (let z = -690; z < 690; z += 12) {
    if (isApproach(z, 31) || isCrossing(z)) continue;
    for (const x of [-11.83, 11.83]) collider(x, 0.083, z, 0.44, 0.16, 10);
  }
  // A fine recessed gutter visually ties the road to the pavement. Flush drain grilles
  // and retroreflective studs remain cosmetic and cannot stop the car.
  for (let z = -680; z < 690; z += 18) {
    if (!isApproach(z) && !isCrossing(z)) {
      for (const x of [-11.33, 11.33]) {
        box(m.dark, x, 0.019, z, 0.27, 0.012, 0.7);
        for (let slit = 0; slit < 6; slit++) box(bronze, x, 0.028, z - 0.28 + slit * 0.11, 0.24, 0.009, 0.035);
      }
    }
    if (!isApproach(z, 21)) for (const x of [-0.2, 0.2]) {
      box(rubber, x, 0.026, z + 6, 0.12, 0.024, 0.15);
      box(m.amber, x, 0.041, z + 6.04, 0.075, 0.01, 0.045);
    }
  }
  // Bollards frame the promenade and terminal frontage, outside driving / pad bounds.
  for (let z = -360; z <= 160; z += 12) {
    if (isApproach(z)) continue;
    for (const x of [-18.8, 24.6]) {
      instance(cylinder, rubber, x, 0.035, z, 0.22, 0.07, 0.22);
      instance(cylinder, bronze, x, 0.5, z, 0.09, 0.94, 0.09, 0, 0, 0, true);
      instance(cylinder, m.line, x, 0.83, z, 0.096, 0.07, 0.096);
      collider(x, 0.48, z, 0.22, 0.96, 0.22);
    }
  }
  // Irregular granite armour at the wave line, layered two-deep rather than a wall.
  for (let z = -560; z < 600; z += 5.8) {
    const x = -37.1 - random() * 2;
    const sx = 1.1 + random() * 1.5, sy = 0.7 + random() * 0.95, sz = 1.2 + random() * 1.7;
    instance(boulder, basalt, x, -1.65, z, sx, sy, sz, random() * 6, random() * 0.5, random() * 0.4, false);
    if (z > -380 && z < 160) instance(boulder, basalt, x - 2.4, -2.05, z + 2, sx * 0.7, sy * 0.7, sz * 0.7, random() * 6);
  }
  // Low native coastal planting, defined by clustered silhouettes and bronze edging.
  for (let z = -420; z < 430; z += 26) {
    if (isApproach(z)) continue;
    for (const x of [-21.7, 29]) {
      box(bronze, x, 0.10, z, 3.6, 0.2, 2.5);
      box(m.stone, x, 0.14, z, 3.45, 0.12, 2.35);
      for (let tuft = 0; tuft < 5; tuft++) {
        instance(shrub, foliage, x + (random() - 0.5) * 2.8, 0.38 + random() * 0.18, z + (random() - 0.5) * 1.7, 0.6 + random() * 0.4, 0.35 + random() * 0.3, 0.55 + random() * 0.35, random() * 6);
      }
    }
  }

  // Long front canopy is a true, shallow doubly curved shell: a signature silhouette
  // and an arcade of ribs, instead of another roof slab. Existing hall collider stays.
  const canopy = new THREE.BufferGeometry();
  const shellVertices: number[] = [], shellUvs: number[] = [], shellIndices: number[] = [];
  const widthSegments = 12, lengthSegments = 20;
  for (let j = 0; j <= lengthSegments; j++) for (let i = 0; i <= widthSegments; i++) {
    const u = i / widthSegments, v = j / lengthSegments;
    shellVertices.push(26.4 + u * 14.8, 9.5 + Math.sin(u * Math.PI * 0.8) * 3.9 + Math.sin(v * Math.PI) * 0.95, -31 + v * 65);
    shellUvs.push(u, v);
  }
  for (let j = 0; j < lengthSegments; j++) for (let i = 0; i < widthSegments; i++) {
    const a = j * (widthSegments + 1) + i, b = a + widthSegments + 1;
    shellIndices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  canopy.setAttribute('position', new THREE.Float32BufferAttribute(shellVertices, 3));
  canopy.setAttribute('uv', new THREE.Float32BufferAttribute(shellUvs, 2)); canopy.setIndex(shellIndices); canopy.computeVertexNormals();
  const canopyMaterial = concrete.clone(); canopyMaterial.side = THREE.DoubleSide; canopyMaterial.metalness = 0.24; canopyMaterial.roughness = 0.4;
  const shell = new THREE.Mesh(canopy, canopyMaterial); shell.name = 'Sculpted coastal terminal sail canopy'; shell.castShadow = true; shell.receiveShadow = true; root.add(shell);
  const ribCurve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const u = i / 8;
    return new THREE.Vector3(26.4 + u * 14.8, 9.4 + Math.sin(u * Math.PI * 0.8) * 3.9, 0);
  }));
  const rib = new THREE.TubeGeometry(ribCurve, 12, 0.085, 5, false);
  for (let z = -31; z <= 34; z += 6.5) {
    instance(rib, bronze, 0, Math.sin((z + 31) / 65 * Math.PI) * 0.95, z, 1, 1, 1, 0, 0, 0, false);
    instance(cylinder, bronze, 28.4, 4.95, z, 0.09, 9.9, 0.09, 0, 0, 0, true);
    collider(28.4, 4.95, z, 0.22, 9.9, 0.22);
  }
  // Entrance fins, inset lobby and rooftop louvres read from both road and flight.
  for (let z = -25; z <= 28; z += 3.3) box(bronze, 36.8, 4.6, z, 0.16, 8.4, 0.2, true);
  for (let z = -20; z <= 23; z += 2.8) box(bronze, 65, 13.85, z, 23, 0.16, 0.2);
  for (let z = -11; z <= 11; z += 11) {
    box(m.dark, 37.05, 2.4, z, 0.04, 4.5, 5.8);
    box(m.trim, 36.98, 2.4, z, 0.08, 4.5, 0.06);
    box(m.trim, 36.9, 1.2, z - 0.35, 0.1, 0.8, 0.04);
  }

  // One small native canvas atlas contains real-purpose numbers, arrows and apron
  // legends. It is deliberately separate from the photographed material maps.
  if (typeof document !== 'undefined') {
    const atlas = document.createElement('canvas'); atlas.width = atlas.height = 1024;
    const ctx = atlas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#e5ddc9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 86px Arial';
      for (let i = 0; i < 3; i++) ctx.fillText(`PAD 0${i + 1}`, 512, i * 192 + 96);
      ctx.font = '500 42px Arial'; ctx.fillText('COASTAL FLIGHT TERMINAL', 512, 650);
      ctx.font = '500 28px Arial'; ctx.fillText('CONCEPT VEHICLES  /  SIMULATION RANGE', 512, 710);
      // Directional arrow has a 4.2 metre road footprint.
      ctx.beginPath(); ctx.moveTo(512, 778); ctx.lineTo(595, 872); ctx.lineTo(543, 872);
      ctx.lineTo(543, 996); ctx.lineTo(481, 996); ctx.lineTo(481, 872); ctx.lineTo(429, 872); ctx.closePath(); ctx.fill();
      const texture = new THREE.CanvasTexture(atlas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
      const decalMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, alphaTest: 0.05 });
      const decalGeometry = (top: number, bottom: number) => {
        const geometry = new THREE.PlaneGeometry(1, 1); const uv = geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, bottom + uv.getY(i) * (top - bottom));
        return geometry;
      };
      for (let i = 0; i < 3; i++) {
        const g = decalGeometry(1 - i * 192 / 1024, 1 - (i + 1) * 192 / 1024);
        instance(g, decalMaterial, 0, 0.04, [0, -180, -360][i] - 8.2, 8.5, 1.6, 1, 0, -Math.PI / 2);
      }
      const arrow = decalGeometry(1 - 768 / 1024, 0);
      for (let z = -420; z <= 190; z += 90) if (!isApproach(z, 34)) {
        instance(arrow, decalMaterial, -5.2, 0.036, z, 2.8, 4.2, 1, 0, -Math.PI / 2);
        instance(arrow, decalMaterial, 5.2, 0.036, z, 2.8, 4.2, 1, Math.PI, -Math.PI / 2);
      }
      const sign = decalGeometry(1 - 586 / 1024, 1 - 753 / 1024);
      instance(sign, decalMaterial, 36.95, 7.3, 1.5, 28, 4.56, 1, -Math.PI / 2);
    }
  }
}
