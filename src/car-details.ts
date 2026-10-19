import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original concept hardware; these housings do not represent an official propulsion system. */
export function createRocketHardware(parent: THREE.Group): THREE.Object3D[] {
  const assembly = new THREE.Group();
  assembly.name = 'originalRocketConceptHardware';
  parent.add(assembly);
  const shell = new THREE.MeshPhysicalMaterial({
    name: 'rocketCarbonShell', color: 0x171b20, metalness: .18, roughness: .34,
    clearcoat: .8, clearcoatRoughness: .16, envMapIntensity: .9,
  });
  const titanium = new THREE.MeshStandardMaterial({
    name: 'rocketBrushedTitanium', color: 0x7c8790, metalness: .96, roughness: .29, envMapIntensity: 1,
  });
  const ceramic = new THREE.MeshStandardMaterial({
    name: 'rocketCeramicThroat', color: 0x080b0e, metalness: .12, roughness: .78,
  });
  const ring = new THREE.MeshStandardMaterial({
    name: 'rocketMachinedLip', color: 0xc4c8cc, metalness: 1, roughness: .18, envMapIntensity: 1,
  });
  const core = new THREE.MeshStandardMaterial({
    name: 'rocketCore', color: 0x071724, emissive: 0x389dcc, emissiveIntensity: .28,
    metalness: .1, roughness: .4,
  });
  const warning = new THREE.MeshStandardMaterial({
    name: 'rocketSafetyMarks', color: 0xcaa16b, metalness: .05, roughness: .62,
  });
  for (const material of [shell, titanium, ring]) material.userData.localReflection = true;
  core.userData.thrusterCore = true;
  // All four units are baked into six material batches. Bolts, cooling fins and rings
  // add actual near-field shape without adding a draw call for each repeated part.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material,
    position: THREE.Vector3, rotation = new THREE.Euler()) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(position,
      new THREE.Quaternion().setFromEuler(rotation), new THREE.Vector3(1, 1, 1)));
    for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
    const bin = batches.get(material) ?? [];
    bin.push(geometry); batches.set(material, bin);
  };
  const housingProfile = new THREE.Shape();
  housingProfile.moveTo(-.155, -.035); housingProfile.lineTo(.155, -.035);
  housingProfile.lineTo(.145, .085); housingProfile.lineTo(.105, .13);
  housingProfile.lineTo(-.105, .13); housingProfile.lineTo(-.145, .085); housingProfile.closePath();
  const nozzleProfile = [
    new THREE.Vector2(.083, .065), new THREE.Vector2(.092, .045),
    new THREE.Vector2(.092, -.035), new THREE.Vector2(.108, -.09),
    new THREE.Vector2(.143, -.16), new THREE.Vector2(.146, -.176),
  ];
  const sockets: THREE.Object3D[] = [];
  for (const x of [-.88, .88]) for (const z of [-.81, .83]) {
    const center = new THREE.Vector3(x, -.36, z);
    const at = (dx = 0, dy = 0, dz = 0) => center.clone().add(new THREE.Vector3(dx, dy, dz));
    const housing = new THREE.ExtrudeGeometry(housingProfile, {
      depth: .34, bevelEnabled: true, bevelSegments: 2, steps: 1,
      bevelSize: .012, bevelThickness: .012, curveSegments: 1,
    });
    add(housing, shell, at(0, 0, -.17));
    // Two vertical mounting cheeks and the cross plate carry the gimbal cage.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(.027, .16, .25), titanium, at(side * .133, -.028));
      for (const fore of [-1, 1]) {
        add(new THREE.CylinderGeometry(.014, .014, .032, 6), ring,
          at(side * .15, .027, fore * .105), new THREE.Euler(0, 0, Math.PI / 2));
      }
    }
    add(new THREE.BoxGeometry(.272, .025, .27), titanium, at(0, -.075));
    add(new THREE.LatheGeometry(nozzleProfile, 28), titanium, at(0, -.035));
    // A dark, recessed ceramic cone and a small throat keep idle engines legible.
    add(new THREE.CylinderGeometry(.069, .126, .106, 24, 1, true), ceramic, at(0, -.14));
    add(new THREE.CylinderGeometry(.053, .053, .012, 24), core, at(0, -.112));
    for (const [radius, height, thickness] of [[.099, -.098, .008], [.125, -.165, .009], [.146, -.208, .011]]) {
      add(new THREE.TorusGeometry(radius, thickness, 6, 28), ring, at(0, height), new THREE.Euler(Math.PI / 2, 0, 0));
    }
    // Slim cooling slots and a service seam belong to the shell rather than neon trim.
    const outboard = Math.sign(x);
    for (let i = 0; i < 4; i++) {
      add(new THREE.BoxGeometry(.008, .032, .026), ceramic, at(outboard * .161, .045, -.09 + i * .06));
    }
    add(new THREE.BoxGeometry(.009, .012, .24), titanium, at(outboard * .163, -.018));
    add(new THREE.BoxGeometry(.009, .028, .045), warning, at(outboard * .168, .055, .12));
    const socket = new THREE.Object3D();
    socket.name = `exhaustSocket_${sockets.length}`;
    socket.position.copy(at(0, -.225)); socket.rotation.z = Math.PI;
    assembly.add(socket); sockets.push(socket);
  }
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error('Rocket hardware geometry could not be merged');
    const part = new THREE.Mesh(geometry, material);
    part.name = material.name;
    part.castShadow = false; part.receiveShadow = true;
    assembly.add(part);
    geometries.forEach(item => item.dispose());
  }
  assembly.userData.design = 'Original non-official simulated propulsion hardware';
  return sockets;
}
