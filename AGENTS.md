# Notes for coding agents

A web 3D **time-travel exploration game** of Tel Aviv: walk the streets in first person, slip
between seven years (1909, 1922, 1936, 1960, 1985, 2011, 2025), notice architecture, urbanism and
culture, fill a field notebook, and line up real archive photographs. A classic "scrub the
timeline from above" mode remains as Free explore. Live: https://omerb4n.github.io/tel-aviv-time-machine/

## Read first

| Doc | What's in it |
| --- | --- |
| [README.md](README.md) | What the player sees, controls, credits for archive photos |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical decisions and the module map |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | The game: noticing, comparing years, rephotography, the notebook, and the design theory behind it |
| [docs/UI_DESIGN.md](docs/UI_DESIGN.md) | The diegetic, archival UI (street signs, tickets, split-flap board, index cards) |
| [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | Adding buildings, landmarks, events and notebook discoveries |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, including what is next |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Historical sources |

## Stack and commands

Vite + TypeScript (strict) + three.js 0.169 + Vitest. Plain-DOM UI, no framework, no server.

```bash
npm ci            # install
npm run dev       # dev server (add -- --host to open it on a phone on the same Wi-Fi)
npm test          # Vitest
npm run build     # tsc --noEmit, then vite build
npm run assets    # fetch the pinned asset pack into public/pack (assets:build builds it; never commit it)
```

CI (`.github/workflows`, Node 22) runs `npm ci`, `npm test` and `npm run build` on every PR, and
**deploys to GitHub Pages on every push to `main`**. Never push to `gh-pages` or deploy by hand.

## Code map in one breath

- `src/data/`: the content, no three.js (sites and phases, streets, landmarks, eras, events).
- `src/world/`: everything that renders. The world is a pure function of the year:
  `fabric.ts` (procedural parcels with `phases` over the years, `phaseAt(site, year)`),
  `buildings/` (style generators → merged geometry, `BuildingManager` for lazy meshes, picking,
  collision, roof heights), streets, terrain, vegetation, people, traffic, sky, post FX (per-era
  film grade, `TimeWipePass` for the time-lens portal).
- `src/core/`: `CameraRig` (orbit / walk / pointer-lock look / rise and descend), `TimeController`.
- `src/game/`: the exploration game. Pure, tested logic (`NotebookState`, `discover.ts`,
  `rephoto.ts`, `mapData.ts`) and orchestration (`Game.ts`) plus UI (`GameUI.ts`, `game.css`).
  Content in `src/game/content/` (collections, discoveries, photos, props).
- `window.tlvtm` exposes `{ time, rig, buildings, scene, camera, renderer, game, ... }` for
  debugging and headless tests (e.g. `tlvtm.game.travel(1922)`, `tlvtm.renderer.info`).
  `#year=1936` in the URL opens Free explore.

## Invariants the game relies on

Break these and discoveries or photos silently stop working:

- **Site layout.** Site ids, positions, rotations and footprints are what noticing tests against
  (`src/game/discover.ts`): local +z is the street front (`onFront`: `lz > depth/2 - 3.2`), style
  and phase matches, and collision via `BuildingManager.blockedAt`.
- **Roof heights.** `BuildingManager.roofHeight` (with its `LANDMARK_HEIGHT` table) decides where
  a descending player lands; keep it in step with the meshes.
- **Rephotography.** `src/game/content/photos.ts` holds the camera pose and match points of each
  real photograph (Herzl Street 1913, from a roof ~9 m up; the 1909 lottery on the dune). The
  world must still line up with the prints; the "tracing" aid is rendered from the model.
- **Picking.** Noticing and taps raycast building meshes and props (`src/game/Interactables.ts`);
  keep the `userData` they read (`siteId`, `phaseIndex`, `ghost` on buildings; `poiId` on props).
- **Fast year changes.** Travel calls `buildings.settle()` for an instant switch, and the time
  lens shows two years at once.
- **Every discovery must be makeable** in one of the seven years (`tests/notebook.test.ts`).
- **Phones are first-class**: touch joystick, ▲▼ lift buttons, portrait layouts. Test at 390 px wide.

## Conventions

- Work on a branch; open a PR only when the owner asks. The owner merges PRs.
- Keep `npm test` and `npm run build` green; add tests for pure logic.
- Update the docs above when behaviour, content model or architecture changes.
- Content is real history: every discovery and landmark has sources and a confidence
  (documented / approximate / illustrative). Don't invent facts; mark composites as such.
- Assets: CC0 or public domain only, with source and licence recorded (README credits). Keep
  them small: the site is served straight from GitHub Pages (no Git LFS there). Generated
  binaries (KTX2 textures, glTF kits) go in the asset pack, a release asset pinned by
  `assets.lock.json`, never in git history (docs/REALISM_PLAN.md §6).
- Ask the owner before hard-to-reverse choices: new dependencies, large binary assets, changes
  to the save format (`tlvtm.notebook.v1` in localStorage; keep old saves loading).
- Writing style in UI text: short, plain, period-flavoured; say what to look for, never where.
