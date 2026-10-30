# Architecture

## Technical decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Platform | Static web app (no server) | Works anywhere, deploys to GitHub Pages / any CDN, easy for schools. |
| 3D engine | **three.js** (r169) | Mature, small, huge ecosystem (glTF, 3D Tiles renderers, post-processing), full shader control. Babylon.js is a fine alternative; Cesium is great for globe-scale streaming but heavier and less art-directable; Unreal/Unity pixel-streaming costs money per user. |
| Language / build | **TypeScript + Vite** | Type-safe content model, instant dev server, tiny production bundle. |
| UI | Plain DOM + CSS (no framework) | The UI is small; avoids a second render loop and keeps the bundle light. A framework can be added if the UI grows (e.g. classroom mode). |
| Assets | **Procedural** (geometry and canvas textures generated at load), plus an optional **asset pack** | No binary assets in git except three archive photographs (`src/assets/archive`, ~0.8 MB). The asset pack (`public/pack`, CC0 photo materials as KTX2 and Blender kits as meshopt glTF) is built by `tools/assets/pack.mjs`, published as a release asset and pinned with hashes in `assets.lock.json`; without it the game keeps its procedural look. |
| Content | Typed data modules in `src/data` | Reviewable in PRs, testable, convertible to/from JSON for a future CMS. |
| Time | Continuous float year, integer year drives the world | Smooth animation on the timeline while the world changes in discrete, testable steps. |

## Module map

```
src/
  main.ts                 bootstraps everything, owns the frame loop and UI wiring
  core/
    TimeController.ts     the current year; play, step, tween; change events
    CameraRig.ts          orbit / fly-to / street-level walk camera
    geo.ts                WGS84 ⇄ local metres (origin: Herzl/Rothschild)
    math.ts               PRNG, noise, easing, interpolation
  data/                   ← the content (no three.js imports)
    types.ts              content model: sites, phases, streets, events, eras
    streets.ts            street centrelines + placement helpers
    landmarks.ts          hand-authored landmark sites (with sources)
    events.ts             timeline events and camera views
    eras.ts               eras + mood (grading) per period
    population.ts         census / estimates
    styleInfo.ts          educational text per architectural style
    geography.ts          coastline, Jaffa hill, Neve Tzedek, railway
    development.ts        urban growth model (where/when land is built on)
  world/                  ← everything that renders
    fabric.ts             procedural parcels + their life stories (pure, testable)
    buildings/
      PartBuilder.ts      merges primitive parts into one geometry per building
      styles.ts           style generators (Ottoman house … glass tower, landmarks)
      BuildingManager.ts  lazy mesh building, rise/sink animation, picking, ghosts
      BuildingBatches.ts  draws all buildings as one BatchedMesh per material
      facadeGrammar.ts    where the facade kit's modules go on a building (pure, tested)
      KitDressing.ts      draws the facade kit near the player, one BatchedMesh per kit material
    CityBlanket.ts        instanced low-detail city beyond the core
    Terrain.ts            dunes that flatten as the city grows
    Streets.ts            sand tracks → asphalt, sidewalks, lamps, railway
    Vegetation.ts         trees that are planted, grow and are cut down
    People.ts             instanced pedestrians with GPU walk cycle
    Traffic.ts            instanced period vehicles
    Sea.ts, Atmosphere.ts sky, sun, fog, environment reflections
    PostFX.ts             TAA + bloom + period film grading
    AssetPack.ts          the optional pack: KTX2 photo sets and glTF kits (lazy chunk)
    buildingShader.ts     building material extension: ageing grime and photo detail
    TAAPass.ts            temporal anti-aliasing with upsampling (dynamic resolution)
    Quality.ts            quality tiers and the dynamic-resolution controller (pure, tested)
    PerfOverlay.ts        #perf frame statistics
    textures.ts, materials.ts  procedural textures and shared materials
  game/                   the exploration game (see GAME_DESIGN.md §9)
    content/              the notebook's content: collections, discoveries, photos, props
    NotebookState.ts      pure progress state + save/load
    discover.ts           pure tests for noticing and comparing
    Game.ts, GameUI.ts    orchestration (time lens, noticing, rephotography, notebook) and HUD (see UI_DESIGN.md)
    Flap.ts               split-flap year board
    mapData.ts, MapView.ts  the map of a year (pure data) and its canvas minimap / full map
  ui/                     timeline, info panel, labels, toasts, tour (free-explore mode)
  audio/Ambience.ts       procedural WebAudio soundscape

assets/materials.json     CC0 photo sets in the pack (ambientCG ids, tile size, use)
assets.lock.json          the pack's published version and a SHA-256 per file
tools/assets/             npm run assets / assets:build / assets:publish
tools/blender/            Blender kit harness (build_kit.py, kitlib.py, kits/*.py)
```

## Data flow

```
TimeController.year ──onChange(integer year)──▶ BuildingManager / Streets / Vegetation /
       ▲                                         People / Traffic / CityBlanket / Terrain*
       │                                         Atmosphere (era haze) · HUD · InfoPanel
 Timeline / keyboard / tour / deep link          (*throttled: CPU heightfield)
```

Every world system is a function of the **year** (plus the hour of day). There is no hidden
simulation state that depends on the path you took through time, so jumping from 1909 to 2025
gives exactly the same scene as playing through every year. That makes the world deterministic,
shareable (`#year=1948`) and testable.

## Content model

- A **site** (`BuildingSite`) is a footprint on the ground. It has one or more **phases**
  (`BuildingPhase`): `{from, to?, style, floors|height, color, weathering, note}`. A building being
  remodelled, weathered, restored or replaced is a new phase on the same site.
- **Landmarks** are hand-written sites with `info` (summary, facts, sources, confidence).
- **Fabric** sites are generated along streets by `world/fabric.ts`. Each parcel gets a
  deterministic life story following real stylistic periods and replacement rates. Real data can
  replace them parcel by parcel (see CONTENT_GUIDE.md).
- **Events** have a year, text, sources, confidence and a camera view (used by tours and cards).
- **Eras** define the period mood used for grading and haze.

## Rendering pipeline

1. Sky (Preetham) + directional sun with a soft shadow map that follows the camera focus. Its size
   and reach depend on the quality tier; on phones and laptops it is cached and redrawn only when
   the sun, the year, a building or the player's spot changes (walkers and cars then cast none).
2. PMREM environment from the sky for reflections on glass and sea.
3. Scene: terrain, sea, streets, instanced city blanket, buildings, instanced trees / people /
   vehicles. Each building phase is merged into one geometry per material and added to one
   `BatchedMesh` per material (`BuildingBatches`). With `WEBGL_multi_draw` that is one draw call
   per batch, whatever the number of buildings, and buildings are culled one by one. The
   per-building meshes are kept but never drawn: picking, labels, the highlight and the rise/sink
   animation work on them, and their matrix and visibility are copied into the batches.
   Building materials age with the year: each phase's `weathering` reaches the shader as a
   vertex attribute and becomes blotches, rain streaks and a splash band near the ground
   (`buildingShader.ts`). With the asset pack, photo sets tile at their real size over the
   painted colours (divided by their mean colour, so a phase keeps its paint), with their normal
   and roughness; roads and sidewalks take the photo sets outright. Phones get the 1K set
   (3.7 MB), other tiers 2K.
   The pack's facade kit (`kit_slice.glb`, from `tools/blender/kits/slice.py`) frames the
   windows that the facade textures paint: sills, lintels, louvred shutters, arched surrounds,
   Bauhaus eyebrows and mullions, aluminium frames, the Gymnasium's portal. `facadeGrammar.ts`
   walks each wall's painted window grid (the metre UVs of `PartBuilder`, whose part bounds it
   reads) and places a module on every window nothing stands in front of, with shutters that
   match the painted tile. `KitDressing` holds each module's geometry once in one `BatchedMesh`
   per kit material, every placed module an instance; `BuildingManager` adds the instances for
   buildings within the tier's `kitRadius` of the camera (60 / 80 / 120 m) and drops them as the
   player moves on, a few milliseconds a frame. The kit is never picked or collided with; the
   building meshes stay the proxy.
4. Post: TAA pass (`TAAPass`: the scene at a dynamic render scale with Halton jitter, reprojected
   through the logarithmic depth buffer, neighbourhood-clamped, upsampled and sharpened) → UnrealBloom (stronger at night) → tone mapping (ACES) → period
   grading pass (sepia, saturation, fade, grain, vignette) → time-lens pass (a frozen snapshot of
   the previous year outside a circle, the live new year inside it).

**Quality tiers** (`world/Quality.ts`): phone / laptop / desktop, guessed from the GPU name and
screen, set the output pixel ratio, render-scale range, frame-time target and shadow settings.
`ResolutionController` lowers the render scale when frames run late and probes back up.
`#perf` shows fps, draw calls and triangles (`world/PerfOverlay.ts`).

Performance strategies: lazy per-phase mesh generation within a time budget per frame, invisible
phases are skipped entirely, instancing for everything repeated, logarithmic depth for the
0.5 m–40 km range, procedural textures shared between materials.

## Testing

- `npm test` — Vitest unit tests on the content and generators: era coverage, landmark phase
  ordering, event sources, population interpolation, street geometry, determinism of the
  procedural city, **no overlapping buildings**, and period correctness (e.g. 1930s construction is
  International Style).
- `npm run typecheck` — strict TypeScript.
- Visual checks: headless Chromium (Playwright) screenshots at key years.

## Extension points

- **GIS import pipeline** (`scripts/`, milestone 1): fetch OSM / municipal footprints for the core,
  convert with `toLocal`, attach `start_date`/conservation-list years, emit `BuildingSite` JSON.
- **Landmark models**: a style can return a glTF (Draco/meshopt + KTX2) instead of procedural
  parts; the manager already treats each phase as an opaque mesh.
- **Historical map drapes**: georeferenced map/aerial rasters as terrain textures per era.
- **Streaming**: for the whole city, move the blanket to 3D Tiles (per-era tilesets) with LOD.
- **WebGPU**: three.js `WebGPURenderer` once node materials cover our shader tweaks.
