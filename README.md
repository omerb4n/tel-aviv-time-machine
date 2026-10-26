# Tel Aviv Time Machine · מכונת הזמן של תל אביב

A web-based 3D simulation of Tel Aviv you can **scroll through time**: stand at the corner of
Herzl Street and Rothschild Boulevard and watch the same place go from sand dunes (1900) to the
seashell lottery (1909), the garden suburb, the White City, Independence Hall (1948), the Shalom
Meir Tower (1965) and today's towers (2025).

You are an observer: orbit above the city or walk the boulevard, scrub the timeline, and click any
building to hear its life story.

| 1912 — Ahuzat Bayit and the Gymnasium | 1940 — Rothschild Blvd, the White City |
| --- | --- |
| ![1912](docs/screenshots/b-1912-herzl.png) | ![1940](docs/screenshots/b-1940-roth.png) |
| **1936 — walking the boulevard** | **2025 — today** |
| ![1936 street level](docs/screenshots/b-1936-street.png) | ![2025](docs/screenshots/a-2025.png) |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # content & generator tests
npm run build      # static site in dist/
```

Deep links: `http://localhost:5173/#year=1948`.

## Controls

| | |
| --- | --- |
| Drag / right-drag / scroll | Orbit / pan / zoom |
| Scroll over the timeline, `←` `→` (`Shift` = 10 years) | Travel in time |
| `Space` | Play / pause time |
| Click a building or label | Its life story, sources and style |
| `T` | Guided tour |
| `V` | Walk at street level (`W A S D`, drag to look, `Esc` to fly) |
| `G` | Ghosts of demolished buildings |
| `M` | Ambient sound |

## What's inside

- 1900–2025 with 9 eras, 21 sourced events and a 9-stop guided tour.
- 16 landmark sites (Herzliya Gymnasium, Shalom Meir Tower, Dizengoff House/Independence Hall,
  first kiosk, water tower, Founders' Monument, Great Synagogue, Pagoda House, Engel House, Jaffa
  Clock Tower, St Peter's, Jaffa station, Azrieli and Sarona towers).
- Procedural streets of ordinary buildings whose life stories follow real periods: Ottoman-era
  houses, eclectic, International Style, austerity blocks, concrete, contemporary, glass towers —
  with weathering, closed balconies, rooftop solar heaters, UNESCO-era restoration and TAMA 38
  floors.
- Pedestrians in period dress, camels, carts, buses and cars; trees that grow for decades;
  dunes that flatten as the city spreads; day/night; period film grading; procedural sound.

Everything is generated in the browser — no binary assets.

## Honesty

Landmarks and events carry a confidence badge and sources. Ordinary buildings are an
*illustrative reconstruction* of typical fabric, not specific addresses; street geometry is
hand-sketched and will be replaced with GIS data (see the roadmap).

## Docs

- [docs/RESEARCH.md](docs/RESEARCH.md) — experience design, story arc, data sources, fun & education
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — technical decisions and module map
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestones
- [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) — how to add buildings, events and streets
