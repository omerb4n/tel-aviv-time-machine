# Content guide: adding buildings, events and stories

All content lives in `src/data/` as typed TypeScript. `npm test` validates it.

## Coordinates

The scene uses metres with the origin at the Herzl St / Rothschild Blvd corner
(+x east, +z south). Three ways to place things:

```ts
import { toLocal } from '../core/geo';
import { placeOnStreet } from './streets';

toLocal(32.0647, 34.7712);                       // from WGS84 (GIS, OSM, Google Maps)
placeOnStreet('rothschild', 118, 'R', 16, 5);    // street, metres along it, side, depth, setback
{ x: 470, z: -430, rot: GRID_ROT }               // raw local metres
```

`rot` is the rotation about the vertical axis; the building's front (local +z) faces the street
when you use `placeOnStreet`.

## Adding a landmark

Append a `BuildingSite` to `LANDMARKS` in `src/data/landmarks.ts`:

```ts
{
  id: 'bialik-house',
  name: { en: 'Bialik House', he: 'בית ביאליק' },
  ...toLocal(32.0737, 34.7718),
  width: 16,
  depth: 14,
  landmark: true,
  phases: [
    { from: 1925, style: 'eclectic', floors: 2, color: '#efe2c6' },
  ],
  info: {
    architect: 'Yosef Minor',
    address: '22 Bialik St',
    summary: { en: 'Home of the national poet Hayim Nahman Bialik …' },
    facts: [{ en: '…' }],
    sources: [{ label: 'Bialik House – Wikipedia', url: 'https://en.wikipedia.org/wiki/Beit_Bialik' }],
    confidence: 'documented',
  },
}
```

Rules:

- Phases must be in order and must not overlap (`to` is the last year standing, inclusive).
- A remodel, a restoration or a replacement is a **new phase** on the same site.
- Use `confidence` honestly: `documented` (cited), `approximate` (real place; dates, size or
  position approximate) or `illustrative`.
- Procedural buildings that collide with a landmark are removed automatically.

To give a landmark a bespoke look, add a style to `BuildingStyle` in `types.ts` and a generator in
`world/buildings/styles.ts` (or, later, a glTF model).

## Adding an event

Append to `EVENTS` in `src/data/events.ts` (keep chronological order). Give it a `view`
(camera position and target) so tours and "Take me there" can frame it, and `major: true` to make
it a tour stop.

## Adding a street

Add a `Street` to `STREETS` with its polyline, widths, `opened` and `paved` years. Add `fabric`
to grow procedural buildings along it.

## Adding a notebook discovery

Discoveries live in `src/game/content/discoveries.ts` (pages in `collections.ts`). Each one needs:

- a **riddle** that says what to look for, never where, and a **nudge** that narrows it down;
- a **trigger**: `look` (a landmark by id, or any building of a style, optionally with a test on
  its phase, such as weathered or restored), `compare` (two year ranges at a spot, on a street, or
  by a building that changes), `photo` (an archive photograph, with a `find` trigger, a `look` or `poi`, that makes it turn up,
  and a `clue` shown until then) or `poi` (a prop);
- a one-sentence **gist**, the story, **sources** and a **confidence**.

`tests/notebook.test.ts` fails if a discovery cannot be made in any of the seven ticket years, so
check that the buildings it needs actually stand in one of them. See GAME_DESIGN.md §9.

## Replacing procedural fabric with real data (milestone 1)

1. Export footprints (OSM / municipal GIS) for an area as GeoJSON.
2. Convert each polygon to its oriented bounding box in local metres (`toLocal`).
3. Create a `BuildingSite` per footprint with phases from the best available dates
   (conservation list, `start_date`, permits, historical maps).
4. Add them before the fabric is generated: fabric parcels that overlap real sites are dropped
   by the collision check in `world/fabric.ts`.
