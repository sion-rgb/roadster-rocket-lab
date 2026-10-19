# Asset provenance and graphics notes

## Hero vehicle

**Tesla Roadster 2020**, by **metarex.4d**, [original Sketchfab model](https://sketchfab.com/3d-models/tesla-roadster-2020-1fbf29e297bd4a17ac39a00a378441d8), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

License verified on 2026-10-19 using the [public Sketchfab model metadata endpoint](https://api.sketchfab.com/v3/models/1fbf29e297bd4a17ac39a00a378441d8). It returned license slug `by`, URL `http://creativecommons.org/licenses/by/4.0/`, `isDownloadable: true`, and the requirement: “Author must be credited. Commercial use is allowed.” Evidence is retained in `public/assets/car/license-evidence.json`.

The primary Sketchfab web page returned 403 during the sourcing pass. The asset was acquired from a normal public GitHub mirror whose README names the same model, author and CC Attribution license. No account, restricted download endpoint or signed URL was bypassed.

- [Exact mirror file](https://github.com/stevenzhang070302/tesla-roadster-webgi/blob/907561805d936d64b3cb834b580e81007f6d987a/assets/tesla.glb)
- [Mirror's attribution](https://github.com/stevenzhang070302/tesla-roadster-webgi/blob/907561805d936d64b3cb834b580e81007f6d987a/Readme.md)
- Bundled file: `public/assets/car/roadster.glb`
- Bytes: 7,962,640
- SHA-256: `9ca3f8be562d47e08c80770f094a5dcf30b65c697951ddd60476dfb25588acc3`
- GLB metadata: 608,769 triangles; 105 mesh primitives; 26 shared materials; 10 embedded images; Draco mesh compression; detailed interior; no embedded animation clips.

The unmodified GLB remains available in the public package. At runtime the simulator normalizes the visual bounds to 2.00 m wide × 1.15 m high × 4.50 m long. These are concept-simulator dimensions, not a claim about a production vehicle. A Y rotation of π converts the imported +Z forward orientation to the simulator's −Z forward direction. The chassis origin is 0.65 m above the tyre contact plane. Geometry transforms are baked before shared-material merging, preserving UV coordinates and smooth normals. The four extracted wheel pivots are returned in front-left, front-right, rear-left, rear-right order and roll about local X, with local Y available for steering. Brake calipers remain attached to the chassis.

Car paint, tint and lights are adapted for the scene. Window glass uses alpha blending instead of transmission to avoid additional render-target passes. Rocket nozzles and exhaust sockets are original procedural additions. All rocket functionality and flight figures are fictional simulation values, not official engineering data. Tesla and Roadster are trademarks of their respective owner; no endorsement is implied.

## Draco decoder

`public/assets/draco/draco_wasm_wrapper.js` and `draco_decoder.wasm` are copied from the installed Three.js package's `examples/jsm/libs/draco/gltf/` distribution. Google Draco is licensed under the Apache License 2.0; the license is included in `public/assets/draco/LICENSE.txt`. [Draco upstream](https://github.com/google/draco), [license](https://github.com/google/draco/blob/main/LICENSE).

## Original fallback and limitations

The sculpted fallback car in `src/car.ts` and the rocket nozzles are original programmatic geometry supplied with this project's source license. The fallback provides a drivable model if a local asset load fails and is explicitly identified by `car.diagnostics.source = 'original-fallback'`. A successful detailed model load changes this to `licensed-glb`.

The desktop hero's ~609k triangles are deliberately concentrated in one car. At initial viewport widths of 760 px or less, `car.ts` selects an offline-generated `roadster-mobile.glb` adaptation containing 201,937 triangles (66.8% fewer). The original is preserved unchanged. The derivative retains 105 primitives, all 26 materials, 10 embedded images and all four wheel nodes, with source normals and UV data retained. It was generated using glTF Transform 4.5.1, meshoptimizer 1.3.0 and Draco 1.5.9, targeting a 0.30 triangle ratio with relative geometric error capped at 0.005. Topology constraints made the achieved ratio 0.332. Output size is 6,868,844 bytes; textures dominate the file size. The browser performs no runtime simplification. Geometry statistics are recorded in `artifacts/car-lod-inspection.json`.

Shared-material merging reduces draw calls. Runtime renderer measurements and mobile performance must be evaluated in the complete scene; static metadata alone does not prove frame rate or visual quality. Material adjustments simplify some WebGI-specific effects from the mirror. The model is a fan-authored interpretation rather than manufacturer CAD. The mobile derivative discards unsupported optional WebGI-specific metadata during glTF Transform processing; standard glTF PBR, clearcoat, tint and texture-transform extensions are retained.

## v1.1 outdoor lighting and PBR surfaces

The following assets are supplied by [Poly Haven](https://polyhaven.com/) under [CC0](https://polyhaven.com/license). They are bundled locally and require no player account or asset-service connection.

- [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky), original by Greg Zaal, sky edits by Jarod Guest: 2k HDR for desktop and 1k HDR for mobile, used for outdoor lighting, background and reflections. Local files: `public/assets/hdri/coastal-sky-2k.hdr`, `coastal-sky-1k.hdr`. Exact URLs, byte sizes and SHA-256: `public/assets/hdri/sources.json`.
- [Asphalt 02](https://polyhaven.com/a/asphalt_02): 1k photographic diffuse, OpenGL normal and roughness, used on roads / pads.
- [Concrete Pavement](https://polyhaven.com/a/concrete_pavement): 1k diffuse, OpenGL normal and roughness, used on the promenade.
- [Rock Face 03](https://polyhaven.com/a/rock_face_03): 1k diffuse, OpenGL normal and roughness, used on the coastal armour stones.

All nine surface files, source asset pages, original download URLs and SHA-256 hashes are recorded in `public/assets/surfaces/sources.json`. Albedo textures use sRGB; normal and roughness textures use linear data. Browser code performs metre-scale UV projection. Original source files are retained without recompression.

The v1.1 nozzle assemblies, machined rings, cooling slots, gimbal mounts, curb profiles, terminal sail canopy, drainage, pad markings, low planting and terrain height fields are original authored geometry / canvas markings. They use the application's MIT source license. Physical automotive material adjustments retain the Roadster model's embedded tread, carbon and paint maps; the original GLB is unchanged. Dynamic cubemap / planar reflection textures are produced by rendering this scene at runtime, not downloaded artwork.
