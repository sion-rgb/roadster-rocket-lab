import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/** Coastal test range. All dimensions and collision proxies are in metres. */
export function createWorld(scene: THREE.Scene, physics: RAPIER.World) {
  const root = new THREE.Group();
  root.name = 'Coastal city and flight range';
  scene.add(root);
  scene.fog = new THREE.Fog(0xb6c8d0, 220, 1200);
  const landingPads = [0, -180, -360].map(z => new THREE.Vector3(0, 0, z));
  const spawn = new THREE.Vector3(0, 0.75, 8);

  // One draw per shared geometry/material role, including the complete window kit.
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; shadow: boolean }>();
  const transform = new THREE.Object3D();
  function instance(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0, shadow = false) {
    const key = `${geometry.uuid}/${material.uuid}/${shadow}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material, matrices: [], shadow };
      batches.set(key, batch);
    }
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    batch.matrices.push(transform.matrix.clone());
  }
  function box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = false, ry = 0) {
    instance(boxGeometry, material, x, y, z, w, h, d, ry, 0, 0, shadow);
  }
  function collider(x: number, y: number, z: number, w: number, h: number, d: number) {
    physics.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setFriction(0.8));
  }
  const standard = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const materials = {
    sand: standard(0xad9d7e, 1),
    grass: standard(0x687b5a, 1),
    concrete: standard(0xb2b6ae, 0.84),
    paving: standard(0x9a9f95, 0.9),
    stone: standard(0x66796f, 0.9),
    road: standard(0x29383f, 0.96),
    line: standard(0xe5e8db, 0.85),
    amber: standard(0xe9b868, 0.7),
    trim: standard(0xd2d5ce, 0.43, 0.42),
    dark: standard(0x273d48, 0.75, 0.25),
    facade: standard(0x6e929d, 0.46, 0.28),
    facadeLight: standard(0xc4c5b9, 0.7),
    glass: standard(0x496d80, 0.21, 0.65),
    glassLight: standard(0x9fb6b6, 0.22, 0.6),
    glassWarm: standard(0xc3bda3, 0.3, 0.4),
    trunk: standard(0x75634b, 0.95),
    leaf: standard(0x3d6046, 0.9),
    signal: new THREE.MeshStandardMaterial({ color: 0x92c9d2, emissive: 0x66cadd, emissiveIntensity: 0.7, roughness: 0.5 }),
    beacon: new THREE.MeshStandardMaterial({ color: 0xf1b764, emissive: 0xec9e42, emissiveIntensity: 1.2, roughness: 0.4 }),
  };

  function surfaceTexture(material: THREE.MeshStandardMaterial, paving: boolean) {
    // Browser-only canvas assets; the deterministic physics smoke check needs no DOM.
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(256, 256);
    let grainSeed = paving ? 1701 : 293;
    for (let i = 0; i < image.data.length; i += 4) {
      grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
      const grain = grainSeed / 4294967296;
      const value = (paving ? 231 : 220) + (grain - 0.5) * (paving ? 12 : 32);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    if (paving) {
      context.strokeStyle = '#a5a5a5';
      context.lineWidth = 1.4;
      context.strokeRect(0, 0, 256, 256);
      context.strokeStyle = '#d5d5d5';
      context.lineWidth = 0.6;
      context.beginPath(); context.moveTo(42, 0); context.lineTo(41, 65); context.lineTo(37, 82); context.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    const bump = map.clone();
    bump.colorSpace = THREE.NoColorSpace;
    material.map = map;
    material.bumpMap = bump;
    material.bumpScale = paving ? 0.018 : 0.027;
    const metres = paving ? 2.8 : 3.6;
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec4 surfaceWorld = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          surfaceWorld = instanceMatrix * surfaceWorld;
        #endif
        surfaceWorld = modelMatrix * surfaceWorld;
        vMapUv = surfaceWorld.xz / ${metres.toFixed(1)};
        vBumpMapUv = vMapUv;
      `);
    };
    material.customProgramCacheKey = () => `coastal-world-surface-${metres}`;
  }
  surfaceTexture(materials.road, false);
  surfaceTexture(materials.paving, true);

  // The ocean deliberately has no ground collider. Land top and every pad top are y=0.
  collider(280, -1, 0, 630, 2, 1600);
  box(materials.sand, 280, -0.26, 0, 630, 0.5, 1600);
  box(materials.road, 0, 0.003, 0, 23, 0.006, 1460);
  box(materials.paving, -24, -0.01, 0, 19, 0.02, 1460);
  box(materials.paving, 19, -0.01, 0, 13, 0.02, 1460);
  box(materials.grass, 34, -0.008, 0, 14, 0.016, 1460);
  box(materials.concrete, -34.2, -0.7, 0, 1.7, 1.4, 1490);
  box(materials.stone, -34.8, -1.65, 0, 1.8, 1.9, 1490);
  box(materials.sand, -38.5, -2.25, 0, 6.4, 1.2, 1490);
  collider(-34.2, -0.75, 0, 1.7, 1.5, 1490);
  // Boundaries are beyond the visible playable range and never cross the coast.
  collider(599, 12, 0, 2, 24, 1600);
  collider(282, 12, -800, 635, 24, 2);
  collider(282, 12, 800, 635, 24, 2);
  for (let z = -714; z < 725; z += 12) {
    if (!landingPads.some(p => Math.abs(p.z - z) < 17)) box(materials.line, 0, 0.018, z, 0.16, 0.016, 5.4);
    box(materials.line, -10.5, 0.018, z, 0.12, 0.016, 12);
    box(materials.line, 10.5, 0.018, z, 0.12, 0.016, 12);
    box(materials.amber, -12.4, 0.015, z, 0.12, 0.012, 7);
  }
  for (const z of [-630, -450, -270, -90, 90, 270, 450, 630]) {
    box(materials.road, 176, 0.007, z, 343, 0.014, 18);
    for (let x = 31; x < 350; x += 12) box(materials.line, x, 0.026, z, 5, 0.012, 0.15);
    for (let x = -9; x <= 9; x += 3) {
      box(materials.line, x, 0.029, z - 11.5, 1.3, 0.012, 3.6);
      box(materials.line, x, 0.029, z + 11.5, 1.3, 0.012, 3.6);
    }
  }
  // City service streets create long sightlines while flying between buildings.
  for (const x of [97, 161, 236, 327]) {
    box(materials.road, x, 0.008, 0, 14, 0.016, 1280);
    for (let z = -620; z < 620; z += 15) box(materials.line, x, 0.023, z, 0.12, 0.012, 6);
  }

  const padGeometry = new THREE.CircleGeometry(13.5, 80);
  const ringGeometry = new THREE.RingGeometry(11.2, 11.45, 80);
  const padMaterial = materials.road.clone();
  padMaterial.color.setHex(0x39484d);
  padMaterial.onBeforeCompile = materials.road.onBeforeCompile;
  padMaterial.customProgramCacheKey = materials.road.customProgramCacheKey;
  for (let index = 0; index < landingPads.length; index++) {
    const p = landingPads[index];
    box(materials.paving, p.x, 0.008, p.z, 38, 0.016, 38);
    instance(padGeometry, padMaterial, p.x, 0.02, p.z, 1, 1, 1, 0, -Math.PI / 2);
    instance(ringGeometry, materials.amber, p.x, 0.026, p.z, 1, 1, 1, 0, -Math.PI / 2);
    box(materials.line, -2.7, 0.028, p.z, 0.5, 0.012, 6);
    box(materials.line, 2.7, 0.028, p.z, 0.5, 0.012, 6);
    box(materials.line, 0, 0.028, p.z, 5.4, 0.012, 0.5);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = Math.cos(angle) * 12.2;
      const z = p.z + Math.sin(angle) * 12.2;
      box(materials.signal, x, 0.035, z, 0.35, 0.045, 0.35);
    }
    // Three readable touchdown lines on either approach, with a clear driving lane.
    for (const direction of [-1, 1]) for (let i = 0; i < 3; i++) {
      const z = p.z + direction * (23 + i * 4.2);
      box(materials.amber, -3.5, 0.021, z, 1.5, 0.012, 0.22);
      box(materials.amber, 3.5, 0.021, z, 1.5, 0.012, 0.22);
    }
  }

  // Deterministic architectural variation, not random per reload.
  let seed = 4217;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function windowGrid(x: number, z: number, w: number, d: number, base: number, h: number) {
    const floors = Math.floor((h - 2) / 3.7);
    const nx = Math.max(2, Math.floor(w / 3.4));
    const nz = Math.max(2, Math.floor(d / 3.4));
    for (let floor = 0; floor < floors; floor++) {
      const y = base + 2.3 + floor * 3.7;
      for (let side = 0; side < 4; side++) {
        const count = side < 2 ? nx : nz;
        const span = side < 2 ? w : d;
        for (let column = 0; column < count; column++) {
          const along = (column + 0.5) * span / count - span / 2;
          const faceX = side < 2 ? x + along : x + (side === 2 ? w / 2 + 0.025 : -w / 2 - 0.025);
          const faceZ = side < 2 ? z + (side === 0 ? d / 2 + 0.025 : -d / 2 - 0.025) : z + along;
          const material = random() < 0.09 ? materials.glassWarm : random() < 0.33 ? materials.glassLight : materials.glass;
          const rotation = side === 0 ? 0 : side === 1 ? Math.PI : side === 2 ? Math.PI / 2 : -Math.PI / 2;
          instance(planeGeometry, material, faceX, y, faceZ, span / count - 0.2, 2.65, 1, rotation);
        }
      }
    }
  }
  function building(x: number, z: number, w: number, d: number, h: number, style: number) {
    const bodyMaterial = style % 3 === 0 ? materials.facadeLight : materials.facade;
    // Podium, inset tower, overhanging roof, screened machinery and a terrace.
    box(materials.concrete, x, 0.15, z, w + 6, 0.3, d + 6);
    box(materials.dark, x, 2.5, z, w + 2, 5, d + 2, true);
    box(bodyMaterial, x, (h + 5) / 2, z, w, h - 5, d, true);
    collider(x, h / 2, z, w, h, d);
    windowGrid(x, z, w, d, 4.9, h - 5);
    for (let y = 5; y < h; y += 11.1) box(materials.trim, x, y, z, w + 0.3, 0.2, d + 0.3);
    box(materials.trim, x, h + 0.22, z, w + 1.6, 0.44, d + 1.6, true);
    box(materials.dark, x + w * 0.13, h + 1.5, z, w * 0.45, 2.5, d * 0.45, true);
    for (let i = 0; i < 3; i++) box(materials.trim, x - w * 0.3, h + 0.8, z - d * 0.23 + i * 2.5, w * 0.16, 0.9, 1.6);
    if (style % 3 === 0) {
      // Deep vertical fins catch real shadows and break the facade silhouette.
      for (let px = -w / 2 + 2; px < w / 2; px += 5.3) {
        box(materials.concrete, x + px, h / 2 + 2.5, z + d / 2 + 0.4, 0.27, h - 5, 1);
        box(materials.concrete, x + px, h / 2 + 2.5, z - d / 2 - 0.4, 0.27, h - 5, 1);
      }
    }
    if (style % 3 === 1) {
      const wingW = w * 0.42;
      const wingH = h * 0.53;
      const wingX = x + w / 2 + wingW / 2;
      box(materials.facadeLight, wingX, wingH / 2, z + d * 0.1, wingW, wingH, d * 0.75, true);
      collider(wingX, wingH / 2, z + d * 0.1, wingW, wingH, d * 0.75);
      windowGrid(wingX, z + d * 0.1, wingW, d * 0.75, 0, wingH);
      box(materials.trim, wingX, wingH + 0.25, z + d * 0.1, wingW + 0.8, 0.5, d * 0.75 + 0.8);
    }
    if (style % 3 === 2) {
      // A set-back crown and open pergola produce a different rooftop read.
      const crownH = h * 0.16;
      box(materials.dark, x, h + crownH / 2, z, w * 0.63, crownH, d * 0.61, true);
      collider(x, h + crownH / 2, z, w * 0.63, crownH, d * 0.61);
      windowGrid(x, z, w * 0.63, d * 0.61, h, crownH);
      for (let dx = -w / 2; dx < w / 2; dx += 3) box(materials.trim, x + dx, h + 3, z + d * 0.33, 0.28, 0.3, d * 0.24);
    }
    // Recessed retail doors and small storefront canopy make the street human scale.
    box(materials.glass, x, 1.65, z + d / 2 + 1.03, Math.min(12, w - 2), 3, 0.04);
    box(materials.concrete, x, 4.6, z + d / 2 + 2.1, w + 3, 0.3, 4.3, true);
  }

  for (let row = 0; row < 4; row++) {
    for (let block = 0; block < 7; block++) {
      if (row === 0 && block === 3) continue;
      const x = [60, 128, 198, 283][row] + (random() - 0.5) * 8;
      const z = -540 + block * 180 + (random() - 0.5) * 20;
      const h = 29 + random() * 47 + row * 3;
      building(x, z, 23 + random() * 12, 33 + random() * 22, h, row + block);
      if (row > 0) building(x + 1, z + 60, 20 + random() * 9, 23 + random() * 11, 17 + random() * 31, row + block + 1);
    }
  }

  // A signature aviation terminal: broad glass hall, cantilevered wings and control tower.
  box(materials.dark, 59, 5.5, 2, 44, 11, 55, true);
  collider(59, 5.5, 2, 44, 11, 55);
  windowGrid(59, 2, 44, 55, 0, 10.8);
  box(materials.concrete, 59, 11.6, 2, 51, 1.2, 64, true);
  box(materials.trim, 57, 13.3, 2, 48, 0.5, 62, true);
  for (let z = -23; z < 31; z += 9) {
    box(materials.concrete, 35.6, 5.4, z, 0.7, 10.8, 0.7, true);
    box(materials.dark, 53, 13.8, z, 15, 0.55, 4.8, false, -0.18);
  }
  box(materials.facadeLight, 83, 19, -18, 8, 38, 8, true);
  collider(83, 19, -18, 8, 38, 8);
  box(materials.dark, 83, 39, -18, 15, 5, 15, true);
  windowGrid(83, -18, 15, 15, 36.8, 5);
  box(materials.concrete, 83, 42, -18, 18, 1, 18, true);
  instance(cylinderGeometry, materials.trim, 83, 46, -18, 0.2, 7, 0.2);
  box(materials.beacon, 83, 49.7, -18, 0.6, 0.6, 0.6);

  // Curved rachis and paired tapered leaflets, shared by every palm crown.
  const frondVertices: number[] = [];
  function ribbon(points: THREE.Vector3[], width: number) {
    for (let segment = 0; segment < points.length - 1; segment++) {
      const a = points[segment];
      const b = points[segment + 1];
      const side = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3(0, 1, 0)).normalize();
      const wa = width * (1 - segment / (points.length - 1));
      const wb = width * (1 - (segment + 1) / (points.length - 1));
      const p0 = a.clone().addScaledVector(side, wa);
      const p1 = a.clone().addScaledVector(side, -wa);
      const p2 = b.clone().addScaledVector(side, wb);
      const p3 = b.clone().addScaledVector(side, -wb);
      for (const p of [p0, p1, p2, p2, p1, p3]) frondVertices.push(p.x, p.y, p.z);
    }
  }
  const frondCurve = (t: number) => new THREE.Vector3(4.5 * t, 1.1 * Math.sin(t * Math.PI) - 1.4 * t * t, 0);
  ribbon(Array.from({ length: 9 }, (_, i) => frondCurve(i / 8)), 0.045);
  for (let i = 0; i < 9; i++) {
    const t = 0.15 + i * 0.088;
    const base = frondCurve(t);
    const length = (0.75 + Math.sin(t * Math.PI) * 0.65) * (1 - t * 0.3);
    for (const side of [-1, 1]) {
      ribbon(Array.from({ length: 4 }, (_, step) => {
        const u = step / 3;
        return new THREE.Vector3(base.x + length * u * 0.48, base.y + Math.sin(u * Math.PI) * 0.12 - u * u * length * 0.55, side * length * u);
      }), 0.09 * (1 - t * 0.45));
    }
  }
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(frondVertices, 3));
  leafGeometry.computeVertexNormals();
  const palmTrunkGeometry = new THREE.CylinderGeometry(0.64, 1, 1, 10, 4);
  materials.leaf.side = THREE.DoubleSide;
  function palm(x: number, z: number, height: number, phase: number) {
    instance(palmTrunkGeometry, materials.trunk, x + 0.24, height / 2, z, 0.24, height, 0.24, phase, 0, -0.06, true);
    for (let i = 0; i < 8; i++) {
      const scale = i % 3 === 0 ? 0.82 : 1;
      instance(leafGeometry, materials.leaf, x + 0.48, height - 0.13, z, scale, scale, scale, phase + i * Math.PI / 4, 0, (i % 3 - 1) * 0.09, true);
    }
  }
  for (let z = -690; z <= 690; z += 26) {
    if (!landingPads.some(p => Math.abs(p.z - z) < 22)) {
      palm(-21.8, z, 7 + random() * 2.1, random() * 6);
      palm(29, z + 9, 6.8 + random() * 1.4, random() * 6);
      instance(cylinderGeometry, materials.stone, -21.8, 0.025, z, 0.85, 0.05, 0.85);
    }
    // Slim lights have a horizontal arm rather than floating luminous cubes.
    for (const side of [-1, 1]) {
      const x = side < 0 ? -15.4 : 20.9;
      instance(cylinderGeometry, materials.trim, x, 3.2, z, 0.075, 6.4, 0.075);
      box(materials.trim, x - side * 0.65, 6.4, z, 1.4, 0.1, 0.18);
      box(materials.line, x - side * 1.12, 6.32, z, 0.52, 0.05, 0.25);
    }
    box(materials.trim, -32.7, 0.5, z, 0.09, 1, 0.09);
    box(materials.trim, -32.7, 0.9, z + 13, 0.07, 0.07, 26);
    box(materials.trim, -32.7, 0.51, z + 13, 0.06, 0.06, 26);
  }
  for (let z = -660; z < 690; z += 52) {
    box(materials.dark, -28, 0.44, z, 0.6, 0.16, 2.6);
    box(materials.trim, -28.3, 0.67, z, 0.1, 0.5, 2.6);
    box(materials.dark, -28, 0.2, z - 0.9, 0.4, 0.4, 0.15);
    box(materials.dark, -28, 0.2, z + 0.9, 0.4, 0.4, 0.15);
  }
  // Modest rooftop planting silhouettes, a coherent low-cost layer above the city.
  for (let z = -530; z < 560; z += 90) {
    for (const x of [43, 89, 174, 256]) {
      box(materials.concrete, x, 0.35, z + 30, 3, 0.7, 3);
      instance(cylinderGeometry, materials.leaf, x, 1.7, z + 30, 1.15, 2.5, 1.15);
    }
  }

  // Distant headlands: layered silhouettes, deliberately outside the driving volume.
  const mountainGeometry = new THREE.ConeGeometry(1, 1, 7);
  const mountainMaterials = [standard(0x7a9b9d, 1), standard(0x89a5aa, 1), standard(0x9fb5ba, 1)];
  for (let i = 0; i < 24; i++) {
    const z = -920 + i * 81;
    const h = 44 + random() * 112;
    instance(mountainGeometry, mountainMaterials[i % 3], -450 - random() * 230, h / 2 - 3, z, 86 + random() * 80, h, 85 + random() * 70, random() * 2);
  }
  for (let i = 0; i < 15; i++) {
    const h = 60 + random() * 95;
    instance(mountainGeometry, mountainMaterials[2], 420 + random() * 180, h / 2 - 2, -860 - random() * 190, 90 + random() * 95, h, 105 + random() * 50, random() * 4);
  }

  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    mesh.name = `Coastal kit ${name}`;
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = batch.shadow;
    mesh.receiveShadow = !(batch.material === materials.signal || batch.material === materials.beacon);
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
  }

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Color(0x4d9bdb) }, uHorizon: { value: new THREE.Color(0xc4dbe4) } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform float uTime; uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vDirection;
      float noise(vec2 p) { return sin(p.x*1.8 + sin(p.y*1.1)) * sin(p.y*1.6 + cos(p.x*0.7)); }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 d = normalize(vDirection); float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.31));
        vec3 sun = normalize(vec3(-0.56, 0.42, -0.71));
        float shine = max(dot(d, sun), 0.0);
        col += vec3(1.0, 0.78, 0.43) * (pow(shine, 1500.0)*1.6 + pow(shine, 12.0)*0.11);
        vec2 p = d.xz / max(d.y + 0.2, 0.12) * 5.0 + vec2(uTime*0.002, 0.0);
        float cloud = smoothstep(0.47, 0.9, noise(p) * 0.55 + noise(p*2.1)*0.18 + 0.38);
        cloud *= smoothstep(0.03, 0.19, h) * (1.0-smoothstep(0.3,0.82,h));
        col = mix(col, vec3(0.92,0.95,0.95), cloud*0.2);
        gl_FragColor = vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2300, 24, 16), skyMaterial);
  sky.name = 'Moving coastal sky';
  sky.renderOrder = -100;
  root.add(sky);

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: new THREE.Color(0xb6c8d0) } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uTime; varying vec3 vWorld;
      void main() {
        vec3 p = position;
        vec4 world = modelMatrix*vec4(p,1.0);
        world.y += sin(world.x*0.11 + uTime*0.85)*0.13 + sin(world.z*0.18 - uTime*0.9)*0.09;
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform float uTime; uniform vec3 uFog; varying vec3 vWorld;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 view = normalize(cameraPosition-vWorld);
        float wx = cos(vWorld.x*0.11+uTime*0.85)*0.055;
        float wz = cos(vWorld.z*0.18-uTime*0.9)*0.065;
        vec3 normal = normalize(vec3(-wx,1.0,-wz));
        float fresnel = pow(1.0-max(dot(view,normal),0.0),3.0);
        vec3 col = mix(vec3(0.014,0.145,0.19),vec3(0.26,0.50,0.61),fresnel);
        float ripple = sin(vWorld.x*0.58+vWorld.z*0.18+uTime*1.4) * sin(vWorld.z*0.65-uTime);
        col += ripple*0.007;
        float spec = pow(max(dot(reflect(-normalize(vec3(-0.56,0.42,-0.71)),normal),view),0.0),140.0);
        col += vec3(1.0,0.81,0.53)*spec*0.65;
        float coastal = 1.0-smoothstep(0.0,80.0,abs(vWorld.x+35.0));
        col += vec3(0.02,0.085,0.07)*coastal;
        float distanceFog = smoothstep(300.0,1700.0,length(cameraPosition-vWorld));
        col = mix(col,uFog,distanceFog*0.87);
        gl_FragColor = vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const waterGeometry = new THREE.PlaneGeometry(2000, 3600, 100, 160);
  waterGeometry.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name = 'Animated coastal water';
  water.position.set(-1035, -1.9, 0);
  root.add(water);

  return {
    landingPads,
    spawn,
    update(_dt: number, time: number) {
      skyMaterial.uniforms.uTime.value = time;
      waterMaterial.uniforms.uTime.value = time;
    },
  };
}
