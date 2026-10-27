# Roadmap

## ✅ Milestone 0 — Vertical slice (this build)

- Ahuzat Bayit core (Herzl, Rothschild, Ahad Ha'am, Lilienblum, Yehuda HaLevi, Nahalat Binyamin,
  Allenby), Neve Tzedek, old Jaffa, the railway, the sea, a procedural greater city.
- 1900–2025 timeline with 9 eras, 21 events and a guided tour of 9 key moments.
- 16 landmark sites with sources: Herzliya Gymnasium → Shalom Meir Tower, Dizengoff House →
  museum → Independence Hall, first kiosk, water tower → Founders' Monument, Great Synagogue
  (two phases), Pagoda House, Engel House, Jaffa Clock Tower, St Peter's, Jaffa station, Azrieli
  towers, Sarona tower.
- Procedural fabric with life stories (weathering, closed balconies, solar heaters, restoration,
  TAMA 38 floors, towers).
- People, vehicles, trees, day/night, period grading, ghosts, walk mode, sound, deep links.

## 🚧 Milestone 0.5 — Exploration game (prototype)

The first build felt like a museum. The project is now an exploration game (see
[GAME_DESIGN.md](GAME_DESIGN.md)).

- ✅ First-person street walking with collision, touch stick and tap-to-examine.
- ✅ Time compass with anchored years; slip and peek through a time lens.
- ✅ Rephotography: line up an old photo to step into its year.
- ✅ Case 1 *The Vanishing School*: 5 leads, tiered hints, a deduction, free travel as the reward.
- ✅ Field journal, style stamps, landmark collection, field notes; local save.
- ✅ A distinctive interface, the "time walker's kit" (see [UI_DESIGN.md](UI_DESIGN.md)): ceramic
  street sign, objective tag, split-flap year board, year tickets, index-card clues, case folder.
- ✅ Less text: one-line objectives and hints, one-sentence cards with *More*, pictogram how-to.
- ✅ Rephotography by eye: focus brackets instead of a meter, three optional aids, a mastery note.
- ✅ Map of the current year: heading-up minimap, full map, trail, clue stamps, hint circles.
- ⏭ Playtest with 5–10 people and tune hints, distances and pacing (targets in GAME_DESIGN §8).
- ✅ Case 2 *The Seashell Lottery*: a crowd on the 1909 dune, Soskin's photo, drawing the shells.
  Cases share one world, with a save per case and shared collections.
- ⏭ Case 3 *The House on Plot 43* (14 May 1948 at 16 Rothschild).

## Milestone 0.6 — Street-level realism (on a GPU workstation)

The game puts the camera on the street, so detail is needed in small walkable areas rather than
across the whole city. That is what makes realism feasible on phones.

- Modular façade kits per style (windows, shutters, balconies, cornices, tiles), modelled in
  Blender against archival photos; glTF + meshopt + KTX2.
- Photo-sourced PBR materials (plaster, stone, asphalt, cobbles), aged per year.
- Street clutter (kiosks, posters, signs, wires, benches), baked lighting and AO, LOD and
  phone / laptop / desktop quality tiers.
- Temporal upscaling (TAA with dynamic resolution) instead of DLSS, which cannot run in browsers.
- Optional: a Gaussian-splat capture of present-day streets.

## Milestone 1 — Real geography (≈ 3–4 weeks)

- Import OSM + Tel Aviv GIS footprints and street centrelines for ~1 km² around Rothschild;
  replace the hand-sketched street polylines.
- Use the municipal conservation list (Plan 2650B) and OSM `start_date` to give real buildings
  real construction years and styles; keep procedural fabric only where data is missing.
- Georeference 5 historical maps/aerials (1917, 1925/27, 1936–38, 1949, 1965) and use them to
  date streets and blocks; optional "map drape" view mode per era.
- Content validation script. (CI with typecheck, tests, build and Pages deploy is done.)

## Milestone 2 — Landmarks & archive (≈ 4–6 weeks)

- 30 landmark sites with researched phases and bespoke glTF models (Gymnasium, Dizengoff House,
  Bialik House, Beit Ha'ir, Habima, Great Synagogue, Pagoda House, Engel House, Levin House,
  Shalom Meir Tower, Migdal HaOpera, Ha'Tachana, Sarona, …).
- Archival photo cards (public-domain / licensed) attached to sites and events, with credits.
- Hebrew UI (RTL) and Arabic, with all content strings localized.
- Expert review pass with historians / the municipal archive; feedback form for corrections.

## Milestone 3 — Experience (≈ 4 weeks)

- **Then & Now** split screen / swipe between two years.
- **Rephotography**: stand where a historical photographer stood; fade the photo over the scene.
- Narrated audio tour (voice + subtitles), cinematic camera paths, chapter music.
- Special scenes: Adloyada Purim parade, the Levant Fair, 1936 port opening, 1948 crowds, 2011
  protest, Pride parade — each clearly labelled as reconstruction.
- Games: *Guess the year*, *Find the Bauhaus*, scavenger hunts for classes.
- Clickable passers-by with short composite stories ("a Fifth Aliyah architect", "a 1950s
  newspaper seller") — explicitly fictional composites grounded in sources.

## Milestone 4 — Scale & quality (≈ 6 weeks)

- Whole-city coverage via per-era 3D Tiles with LOD and streaming.
- Higher fidelity: GTAO, volumetric clouds, seasonal light, rain, better water and foam.
- WebGPU renderer path; mobile performance tiers; offline PWA.
- Accessibility: reduced motion, keyboard-only flow, screen-reader descriptions of each era.

## Milestone 5 — Community & education

- Teacher mode with lesson plans and worksheets per era.
- Moderated community memories (photos, family stories) pinned to places and years.
- Open content repository so researchers can contribute sites, events and corrections via PRs.
