import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** All dimensions are metres. Local forward is -Z; the chassis origin sits 0.65m above ground. */
export interface CarAsset {
  group: THREE.Group;
  /** [frontLeft, frontRight, rearLeft, rearRight]. Pivots rotate about local X; steer about local Y. */
  wheels: THREE.Group[];
  /** Exhaust sockets point down; their local +Y direction follows the exhaust plume. */
  thrusters: THREE.Object3D[];
  cockpit: THREE.Group;
  ready: Promise<boolean>;
  diagnostics: {
    source: 'loading' | 'licensed-glb' | 'original-fallback';
    triangles: number;
    meshes: number;
    materials: number;
    dimensions: number[];
    quality: 'desktop' | 'mobile';
    error?: string;
  };
}

const wheelNames = ['TRDEF-WheelFtL', 'TRDEF-WheelFtR', 'TRDEF-WheelBkL', 'TRDEF-WheelBkR'];
const targetSize = new THREE.Vector3(2, 1.15, 4.5);

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D,
  position: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

/** An authored local fallback keeps the simulator playable if the GLB fails to load. */
function createFallback(parent: THREE.Group, wheels: THREE.Group[], cockpit: THREE.Group): THREE.Group {
  const fallback = new THREE.Group();
  fallback.name = 'originalFallback';
  parent.add(fallback);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xb7081e, metalness: 0.72, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 });
  const black = new THREE.MeshStandardMaterial({ color: 0x11151b, metalness: 0.45, roughness: 0.35 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.88 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x687582, metalness: 0.95, roughness: 0.22 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b2535, metalness: 0.4, roughness: 0.12, clearcoat: 1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xc8edff, emissive: 0x8fcaff, emissiveIntensity: 3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff2538, emissive: 0xff1025, emissiveIntensity: 2 });
  // Cross-sections form a continuous, sculpted shell with rounded shoulders and a tapered nose.
  const sections = [
    [-2.24, .69, -.22, -.06], [-2.10, .87, -.25, .01], [-1.65, .98, -.27, .12],
    [-1.15, .97, -.27, .15], [-.65, .93, -.28, .11], [.20, .92, -.28, .06],
    [.95, .97, -.27, .15], [1.55, 1.00, -.25, .16], [2.08, .94, -.22, .12], [2.25, .82, -.18, .08],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  const count = 24;
  for (const [z, width, low, high] of sections) {
    for (let i = 0; i <= count; i++) {
      const a = (i / count) * Math.PI * 2;
      positions.push(width * Math.cos(a), low + (high - low) * (.5 + .5 * Math.sin(a)), z);
    }
  }
  for (let z = 0; z < sections.length - 1; z++) for (let i = 0; i < count; i++) {
    const a = z * (count + 1) + i; const b = a + count + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shell.setIndex(indices); shell.computeVertexNormals();
  mesh(shell, paint, fallback).material = paint;
  const canopy = mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glass, fallback, [0, .05, .2]);
  canopy.scale.set(.78, .48, 1.13);
  mesh(new THREE.BoxGeometry(1.58, .045, 2.0), black, fallback, [0, -.34, .05]);
  for (const x of [-1, 1]) {
    const lamp = mesh(new THREE.BoxGeometry(.53, .034, .12), white, fallback, [x * .61, -.015, -2.15]);
    lamp.rotation.z = x * .1;
    mesh(new THREE.BoxGeometry(.59, .035, .08), red, fallback, [x * .59, .09, 2.2]);
    mesh(new THREE.BoxGeometry(.10, .12, 1.7), black, fallback, [x * .94, -.28, .1]);
    const mirror = mesh(new THREE.SphereGeometry(1, 16, 10), paint, fallback, [x * 1.01, .25, -.68]);
    mirror.scale.set(.15, .055, .1);
  }
  const tyreGeo = new THREE.TorusGeometry(.26, .09, 12, 36);
  const hubGeo = new THREE.CylinderGeometry(.235, .235, .20, 32);
  for (const wheel of wheels) {
    const tyre = mesh(tyreGeo, rubber, wheel); tyre.rotation.y = Math.PI / 2;
    const hub = mesh(hubGeo, alloy, wheel); hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const spoke = mesh(new THREE.BoxGeometry(.22, .036, .26), black, wheel);
      spoke.rotation.x = (i / 5) * Math.PI * 2;
    }
  }
  for (const x of [-.39, .39]) {
    mesh(new THREE.BoxGeometry(.43, .14, .58), black, cockpit, [x, -.17, .22]);
    const back = mesh(new THREE.BoxGeometry(.43, .48, .12), black, cockpit, [x, .09, .5]);
    back.rotation.x = -.12;
  }
  mesh(new THREE.BoxGeometry(1.28, .15, .25), black, cockpit, [0, .12, -.68]);
  const steering = mesh(new THREE.TorusGeometry(.14, .018, 8, 24), black, cockpit, [-.39, .22, -.45]);
  steering.rotation.x = -.28;
  return fallback;
}

function makeThrusters(group: THREE.Group): THREE.Object3D[] {
  const metal = new THREE.MeshStandardMaterial({ color: 0x222c36, metalness: .9, roughness: .25 });
  const inset = new THREE.MeshStandardMaterial({ color: 0x02070b, metalness: .6, roughness: .45 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x778997, metalness: .95, roughness: .18 });
  const core = new THREE.MeshStandardMaterial({ color: 0x57d8ff, emissive: 0x21aaff, emissiveIntensity: .7 });
  const sockets: THREE.Object3D[] = [];
  for (const x of [-.72, .72]) for (const z of [-1.24, 1.3]) {
    const nozzle = new THREE.Group();
    nozzle.name = `rocketNozzle_${x < 0 ? 'L' : 'R'}_${z < 0 ? 'front' : 'rear'}`;
    nozzle.position.set(x, -.38, z);
    mesh(new THREE.CylinderGeometry(.11, .17, .19, 20, 1, true), metal, nozzle);
    mesh(new THREE.CylinderGeometry(.13, .13, .018, 20), inset, nozzle, [0, -.096, 0]);
    const lip = mesh(new THREE.TorusGeometry(.15, .018, 6, 24), rim, nozzle, [0, -.1, 0]);
    lip.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.065, .065, .02, 16), core, nozzle, [0, -.108, 0]);
    const socket = new THREE.Object3D();
    socket.position.y = -.13;
    socket.rotation.z = Math.PI;
    socket.name = `exhaustSocket_${sockets.length}`;
    nozzle.add(socket); group.add(nozzle); sockets.push(socket);
  }
  return sockets;
}

function tuneMaterial(material: THREE.Material): void {
  const mat = material as THREE.MeshPhysicalMaterial;
  if (!mat.isMeshStandardMaterial) return;
  if (mat.name === 'car_main_paint') {
    mat.color.set(0xc20b22); mat.metalness = .64; mat.roughness = .22;
    mat.clearcoat = 1; mat.clearcoatRoughness = .1;
  }
  // Tinted alpha glass avoids a full-screen transmission pass on every car window.
  if (/^Glass_(mid_tint|Tint_max|Clear)/.test(mat.name)) {
    mat.transmission = 0; mat.transparent = true; mat.depthWrite = false;
    mat.opacity = /Tint_max/.test(mat.name) ? .65 : /mid_tint/.test(mat.name) ? .22 : .12;
    mat.roughness = .11; mat.metalness = .12;
    if (/mid_tint|Tint_max/.test(mat.name)) mat.color.set(0x2b4657);
  }
  if (/headlights/.test(mat.name)) {
    mat.color.set(0xccecff); mat.emissive.set(0x9dcfff); mat.emissiveIntensity = 2;
  }
  if (/rear_lights|ior_1/.test(mat.name)) {
    mat.emissive.set(0xff1021); mat.emissiveIntensity = 1.4;
  }
  if (mat.name === 'calipers') { mat.color.set(0xaa1626); mat.roughness = .4; }
  if (/Thread|Sidewall/.test(mat.name)) { mat.roughness = .87; mat.metalness = .04; }
  mat.needsUpdate = true;
}

function releaseFallback(fallback: THREE.Group, wheels: THREE.Group[], cockpit: THREE.Group): void {
  const geometry = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const root of [fallback, ...wheels, cockpit]) root.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometry.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  fallback.removeFromParent();
  for (const wheel of wheels) wheel.clear();
  cockpit.clear();
  geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

export function createCar(): CarAsset {
  const group = new THREE.Group();
  group.name = 'roadsterRocketConcept';
  const wheels = [[-.91, -.28, -1.45], [.91, -.28, -1.45], [-.91, -.28, 1.45], [.91, -.28, 1.45]].map((p, i) => {
    const wheel = new THREE.Group(); wheel.name = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'][i];
    wheel.position.fromArray(p); group.add(wheel); return wheel;
  });
  const cockpit = new THREE.Group(); cockpit.name = 'cockpit'; group.add(cockpit);
  const fallback = createFallback(group, wheels, cockpit);
  const thrusters = makeThrusters(group);
  // The reduced asset is generated offline; no simplification work runs on the player's device.
  const mobile = matchMedia('(max-width:760px)').matches;
  const diagnostics: CarAsset['diagnostics'] = { source: 'loading', triangles: 0, meshes: 0, materials: 0, dimensions: [2, 1.15, 4.5], quality: mobile ? 'mobile' : 'desktop' };
  const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}assets/draco/`).setDecoderConfig({ type: 'wasm' });
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const ready = loader.loadAsync(`${import.meta.env.BASE_URL}assets/car/${mobile ? 'roadster-mobile.glb' : 'roadster.glb'}`).then(gltf => {
    const source = gltf.scene;
    const normalized = new THREE.Group(); normalized.add(source);
    normalized.rotation.y = Math.PI;
    normalized.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(normalized);
    const size = box.getSize(new THREE.Vector3());
    normalized.scale.set(targetSize.x / size.x, targetSize.y / size.y, targetSize.z / size.z);
    normalized.updateMatrixWorld(true);
    box.setFromObject(normalized);
    const center = box.getCenter(new THREE.Vector3());
    normalized.position.set(-center.x, -.65 - box.min.y, -center.z);
    normalized.updateMatrixWorld(true);
    const sourceWheels = wheelNames.map(name => source.getObjectByName(name));
    const centers = sourceWheels.map((wheel, i) => wheel ? wheel.getWorldPosition(new THREE.Vector3()) : wheels[i].position.clone());
    const bins = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; wheel: number }>();
    const originals = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    source.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      originals.add(object.geometry);
      let wheel = -1;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
        const index = sourceWheels.indexOf(parent);
        if (index !== -1) { wheel = index; break; }
      }
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!materials.has(material)) { tuneMaterial(material); materials.add(material); }
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      if (wheel !== -1) geometry.translate(-centers[wheel].x, -centers[wheel].y, -centers[wheel].z);
      // Exported attributes are normalized before material merging so each material costs one draw call.
      for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
      if (!geometry.hasAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
      geometry.clearGroups();
      const key = `${wheel}:${material.uuid}`;
      if (!bins.has(key)) bins.set(key, { material, geometries: [], wheel });
      bins.get(key)!.geometries.push(geometry);
    });
    releaseFallback(fallback, wheels, cockpit);
    wheels.forEach((wheel, i) => { wheel.position.copy(centers[i]); wheel.rotation.set(0, 0, 0); });
    for (const bin of bins.values()) {
      const merged = mergeGeometries(bin.geometries, false);
      if (!merged) throw new Error('Roadster geometry could not be merged');
      const part = mesh(merged, bin.material, bin.wheel === -1 ? group : wheels[bin.wheel]);
      part.name = `roadster_${bin.wheel === -1 ? 'body' : wheels[bin.wheel].name}_${bin.material.name}`;
      if (/Glass/.test(bin.material.name)) part.castShadow = false;
      diagnostics.triangles += merged.index ? merged.index.count / 3 : merged.getAttribute('position').count / 3;
      diagnostics.meshes++;
      bin.geometries.forEach(geometry => geometry.dispose());
    }
    originals.forEach(geometry => geometry.dispose());
    diagnostics.materials = materials.size;
    diagnostics.source = 'licensed-glb';
    group.userData.asset = diagnostics;
    draco.dispose();
    return true;
  }).catch((error: unknown) => {
    diagnostics.source = 'original-fallback';
    diagnostics.error = error instanceof Error ? error.message : String(error);
    group.userData.asset = diagnostics;
    console.warn('Roadster asset unavailable; using the original local fallback.', error);
    draco.dispose();
    return false;
  });
  return { group, wheels, thrusters, cockpit, ready, diagnostics };
}
