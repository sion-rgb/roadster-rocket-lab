# Coastal world implementation

The environment is authored in `src/world.ts` using locally generated geometry and shaders. It contains no downloaded third-party model, image, font, or texture and needs no external asset credential.

- Metric scale: land top `y = 0`; spawn `[0, 0.75, 8]`; landing centres `[0, 0, 0]`, `[0, 0, -180]`, `[0, 0, -360]`.
- Main coastal boulevard: 23 m wide, along the Z axis. Ocean starts west of `x = -35`; it deliberately has no ground collider.
- Architectural kit: 30–80 m city towers with podiums, real window grids, vertical fins, wings, inset crowns, rooftop screens and canopies, plus a low aviation terminal and control tower.
- Street layer: cross streets, service roads, crossing marks, promenade, railing, benches, palms, lighting poles and touchdown approach marks.
- Atmosphere: animated shader ocean, moving cloud sky, warm sun disc, fog and layered mountain silhouettes. The main application owns all real lighting and shadows; the sun-disc direction is approximately `[-0.56, 0.42, -0.71]`.
- Repeated windows, buildings, furniture, markings and vegetation use shared geometry/material instancing. Collision uses only simple fixed Rapier cuboids, separate from visuals.

## Focused verification

`npm exec -- tsc --noEmit --pretty false` passed at integration time.

A Node/tsx smoke check initialized the real Rapier WASM module, called `createWorld`, stepped physics, and called `update`. It recorded:

| Metric | Result |
| --- | ---: |
| Scene mesh batches, excluding shadow-pass multiplication | 31 |
| Geometry triangles across all instances | 122,762 |
| Instanced elements plus sky and water | 24,129 |
| Shared geometries | 9 |
| Materials | 24 |
| Fixed collision proxies | 87 |
| Downward ray from `[0, 10, 8]` | Hit at `y = 0` |
| Downward ray from `[-40, 10, 8]` | No ground hit |

These are deterministic CPU scene counts, not a claim of measured rendering FPS or a GPU/browser validation. Final browser QA is performed by the integrated application. The sky sphere radius is 2,300 m; the camera far plane must include it.
