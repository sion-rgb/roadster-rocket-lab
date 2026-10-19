import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRocketHardware } from './car-details';

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

function tuneMaterial(material: THREE.Material, mobile: boolean): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  let mat = material as THREE.MeshPhysicalMaterial;
  if (/^(carbon_fibre|Rims)$/.test(material.name) && !mat.isMeshPhysicalMaterial) {
    // Preserve the GLB's maps and UV transforms while enabling its hero clearcoat.
    mat = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(mat, material);
  }
  mat.envMapIntensity = .9;
  if (mat.name === 'car_main_paint') {
    // Metallic base pigment under a dielectric lacquer. The original fine paint
    // normal remains intact; specular was disabled in the source viewer material.
    mat.color.set(0xb20a20); mat.metalness = .24; mat.roughness = .25;
    mat.clearcoat = 1; mat.clearcoatRoughness = .075;
    mat.specularIntensity = 1; mat.ior = 1.5; mat.envMapIntensity = 1.1;
    mat.normalScale.setScalar(.025);
    mat.userData.localReflection = true;
  }
  // The exterior face reflects the city while the cockpit looks through the back
  // face. This avoids double transparent layers and a costly transmission pass.
  if (/^Glass_(mid_tint|Tint_max|Clear)/.test(mat.name)) {
    mat.transmission = 0; mat.transparent = true; mat.depthWrite = false;
    mat.opacity = /Tint_max/.test(mat.name) ? .61 : /mid_tint/.test(mat.name) ? .24 : .09;
    mat.roughness = .055; mat.metalness = 0; mat.side = THREE.FrontSide;
    mat.clearcoat = 1; mat.clearcoatRoughness = .04; mat.specularIntensity = 1;
    mat.envMapIntensity = /Clear/.test(mat.name) ? .7 : 1.05;
    mat.color.set(/Clear/.test(mat.name) ? 0xdbe5e7 : 0x0a151d);
    mat.userData.localReflection = true;
  }
  if (/headlights/.test(mat.name)) {
    mat.color.set(0xc3d6e2); mat.emissive.set(0xc6e4ff);
    mat.emissiveIntensity = /AHO/.test(mat.name) ? 2.4 : 1.7;
    mat.metalness = .05; mat.roughness = .18;
  }
  if (/^indicator_/.test(mat.name)) {
    // Exported tenfold emissive strength previously blew out the lamp lenses.
    mat.color.set(0x5b2104); mat.emissive.set(0xff790a); mat.emissiveIntensity = .65;
    mat.metalness = 0; mat.roughness = .27;
  }
  if (mat.name === 'Glass_Amber') {
    mat.color.set(0x71360a); mat.metalness = 0; mat.roughness = .16;
  }
  if (/rear_lights|ior_1/.test(mat.name)) {
    mat.color.set(0x65050c); mat.emissive.set(0xff1428);
    mat.emissiveIntensity = /DHO|ior_1/.test(mat.name) ? 1.15 : .18;
    mat.metalness = 0; mat.roughness = .21;
  }
  if (mat.name === 'licence_plate_light') {
    mat.emissive.set(0xf1e6d3); mat.emissiveIntensity = .65; mat.metalness = 0;
  }
  if (mat.name === 'Rims') {
    mat.color.set(0x707780); mat.metalness = .98; mat.roughness = .255;
    mat.clearcoat = .35; mat.clearcoatRoughness = .2;
    mat.anisotropy = mobile ? 0 : .4;
    mat.userData.localReflection = true;
  }
  if (/^(mirror|chrome)$/.test(mat.name)) {
    mat.color.set(0xc1c8cf); mat.metalness = 1;
    mat.roughness = mat.name === 'mirror' ? .035 : .15;
    mat.emissiveIntensity = 0; mat.envMapIntensity = 1;
    mat.userData.localReflection = true;
  }
  if (mat.name === 'Brake_Disc') {
    mat.color.set(0x777c7f); mat.metalness = .88; mat.roughness = .42;
  }
  if (mat.name === 'carbon_fibre') {
    // Original embedded carbon albedo, normal and metal/roughness maps stay bound.
    mat.color.set(0x80858c); mat.metalness = .32; mat.roughness = .43;
    mat.normalScale.setScalar(.38); mat.clearcoat = .7; mat.clearcoatRoughness = .16;
    mat.userData.localReflection = true;
  }
  if (/^(interior|seats)$/.test(mat.name)) {
    mat.color.set(mat.name === 'seats' ? 0x24272c : 0x14191f);
    mat.metalness = 0; mat.roughness = mat.name === 'seats' ? .82 : .71;
    mat.envMapIntensity = .55;
  }
  if (/Metal_-_Black_rough|non_lustrous_metal/.test(mat.name)) {
    mat.color.set(0x1a2027); mat.metalness = .35; mat.roughness = .48;
  }
  if (mat.name === 'grill') { mat.metalness = .6; mat.roughness = .4; }
  if (mat.name === 'calipers') {
    mat.color.set(0xb61b25); mat.metalness = .18; mat.roughness = .36;
  }
  if (/Thread|Sidewall/.test(mat.name)) {
    // Keep the licensed tread and embossed sidewall maps; only tune their response.
    mat.roughness = /Thread/.test(mat.name) ? .9 : .78; mat.metalness = 0;
    mat.normalScale.setScalar(/Thread/.test(mat.name) ? .75 : .6);
    mat.envMapIntensity = .35;
  }
  mat.needsUpdate = true;
  return mat;
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
  const thrusters = createRocketHardware(group);
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
    const tuned = new Map<THREE.Material, THREE.Material>();
    source.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      originals.add(object.geometry);
      let wheel = -1;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) {
        const index = sourceWheels.indexOf(parent);
        if (index !== -1) { wheel = index; break; }
      }
      const originalMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!tuned.has(originalMaterial)) tuned.set(originalMaterial, tuneMaterial(originalMaterial, mobile));
      const material = tuned.get(originalMaterial)!;
      materials.add(material);
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
