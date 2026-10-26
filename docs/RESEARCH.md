# Research: what a Tel Aviv time machine should feel like

This document collects the research behind the project: what the experience should feel like,
what has to be in it, where the data comes from, and how to make it fun and educational.

---

## 1. The feeling we are after

**"Standing still while a century flows around you."** The viewer is an observer, not a hero.
The emotional core is *continuity of place*: the same corner (Herzl St / Rothschild Blvd) seen as
sand dune → garden suburb → White City → state capital of commerce → glass towers. Every design
choice serves that moment of recognition: *"this is the same spot."*

Principles that follow from it:

| Principle | What it means in practice |
| --- | --- |
| **One place, many times** | The camera stays put when the year changes; only the world changes. Buildings rise out of the ground and sink away, so change is *visible*, not a cut. |
| **Atmosphere per era** | Each era has its own light and texture: sun-bleached sepia film for the 1910s, warm Kodachrome for the 1950s–60s, clean digital colour today. Sound changes too: wind and camel bells on the dunes, horns and crowds later. |
| **Life, not a model** | People walking with period clothing (hats, long dresses, khaki shorts, tembel hats, jeans), camels carrying building sand, carts, 1930s buses, Susitas, modern cars. Trees are planted and grow for decades. |
| **Honest history** | Every landmark and event shows a confidence badge (*documented / approximate / illustrative*) and its sources. Ordinary buildings are explicitly a reconstruction of *typical* fabric, not specific addresses. |
| **Beauty first** | Golden-hour default lighting, soft shadows, a reflective Mediterranean, era grading, a restrained glass UI and a serif display face (Frank Ruhl Libre, which also covers Hebrew). |
| **Calm interaction** | Few controls: a timeline you can scroll, play or click; orbit / walk; click anything to learn its story. |

### Reference experiences

- *Rome Reborn*, *Paris 1789* / *Assassin's Creed Discovery Tour* — curated historical walks.
- *Amsterdam Time Machine*, *Venice Time Machine* — data-driven city histories from archives.
- *Google Earth historical imagery* — the "time slider over one place" interaction.
- *Hindsight / rephotography apps* — overlaying archival photos onto the present.

## 2. The story arc (what must be in it)

The site of the simulation is **Ahuzat Bayit**, Tel Aviv's founding neighbourhood. It holds almost
every chapter of the city's history within a few hundred metres:

| Years | Era | What the viewer should see |
| --- | --- | --- |
| 1900–1908 | Sands north of Jaffa | Dunes, lone sycamores, Neve Tzedek (1887), the Jaffa railway (1892), old Jaffa on its hill with the clock tower and St Peter's. |
| 1909 | **The seashell lottery** (11 April 1909) | A crowd gathered on the dunes; plots being allotted with seashells. |
| 1910–1916 | Ahuzat Bayit / Tel Aviv | ~60 one–two storey houses with Marseille-tile roofs, gardens, the **Herzliya Gymnasium** at the head of Herzl St, the water tower and first kiosk on Rothschild. Renamed Tel Aviv (May 1910). |
| 1917 | **Expulsion** | The Ottoman authorities empty Jaffa and Tel Aviv — the streets fall almost silent. |
| 1919–1930 | Eclectic twenties | Township (1921), building boom, ornamented eclectic houses, Allenby St, the Great Synagogue (1926), the Pagoda House (1925), the Geddes plan (1925). |
| 1931–1947 | **The White City** | Fifth Aliyah; International Style ("Bauhaus") — ribbon balconies, pilotis, rounded corners, thermometer windows. Dizengoff House becomes the art museum. |
| 1948 | **Declaration of Independence** (14 May 1948) | Crowds outside 16 Rothschild Blvd. |
| 1950–1964 | A state is born | Merger with Jaffa (1950), austerity blocks, khaki and tembel hats. Gymnasium demolished (1962). |
| 1965–1989 | Concrete & ambition | **Shalom Meir Tower** (1965), concrete offices, decline of the old centre: grimy plaster, closed-in balconies, solar water heaters. |
| 1990–2008 | Renewal | Azrieli towers on the skyline, **UNESCO White City** (2003), restoration. |
| 2009–2025 | Today | Centennial, 2011 tent protest on Rothschild, towers along the boulevard, TAMA 38 rooftop additions, light rail (2023). |

### Facts verified for this build (with sources)

- Lottery of plots on 11 April 1909, using 120 seashells collected by Akiva Aryeh Weiss; Herzl St as
  main axis; Rothschild Blvd laid out in a levelled valley; renamed Tel Aviv 21 May 1910 —
  [Ahuzat Bayit (Wikipedia)](https://en.wikipedia.org/wiki/Ahuzat_Bayit),
  [History of Tel Aviv](https://en.wikipedia.org/wiki/History_of_Tel_Aviv).
- Gymnasium cornerstone 28 July 1909, architect Joseph Barsky (Temple-inspired façade), moved in
  1910, razed 1962 for the Shalom Meir Tower —
  [Herzliya Hebrew Gymnasium](https://en.wikipedia.org/wiki/Herzliya_Hebrew_Gymnasium),
  [Joseph Barsky](https://en.wikipedia.org/wiki/Joseph_Barsky),
  [Technion paper on its demolition](https://cris.technion.ac.il/en/publications/a-wish-for-destruction-the-life-and-death-of-the-herzliya-gymnasi).
- Shalom Meir Tower completed 1965, ~129 m / 34 floors (sources range 120–129 m), tallest in the
  Middle East at the time — [Shalom Meir Tower](https://en.wikipedia.org/wiki/Shalom_Meir_Tower).
- Dizengoff House, 16 Rothschild: lottery plot 43; Tel Aviv Museum of Art from 1932 (some sources
  say 1936) to 1971; International Style remodel attributed to Carl Rubin; Declaration 14 May 1948
  at 4 p.m. — [Independence Hall](https://en.wikipedia.org/wiki/Independence_Hall_(Israel)),
  [Jewish Virtual Library](https://www.jewishvirtuallibrary.org/independence-hall).
- Population: 1914 ≈ 2,000 (estimate); 1922 census 15,185; 1931 census 46,101; 1937 ≈ 150,000;
  1944 ≈ 166,660 — Tel Aviv municipality statistical tables,
  [Jewish Virtual Library](https://www.jewishvirtuallibrary.org/jsource/Society_&_Culture/geo/tahist.html).

Dates we could **not** confirm precisely are marked *approximate* in the app (e.g. when the
Ahuzat Bayit water tower came down, exact positions of the Pagoda House and Engel House).

## 3. Data sources

### Modern geometry (ground truth for the present)

| Source | What we get | Notes |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) via Overpass API | Footprints, `building:levels`, `height`, `start_date`, street centrelines, trees | ODbL; good coverage of central Tel Aviv. |
| [Tel Aviv-Yafo GIS](https://gisn.tel-aviv.gov.il/) and [API portal](https://apiportal.tel-aviv.gov.il/) | Municipal GIS layers (buildings, conservation buildings, trees, streets) | REST API for GIS layers; field names to be confirmed per layer. |
| [Tel Aviv open data](https://opendatasource.tel-aviv.gov.il/en) | Statistics (dwellings by year, population) | The yearbook has buildings by area and **year of construction** (aggregate). |
| [GovMap](https://www.govmap.gov.il) (Survey of Israel) | Orthophotos, parcels | Israeli TM grid (EPSG:2039) — reproject to WGS84. |
| [Overture Maps](https://overturemaps.org) buildings | Merged footprints + heights | Fallback where OSM is thin. |
| Google Photorealistic 3D Tiles / Cesium | Visual reference for today | Licence restricts derived use; reference only. |

### Historical maps & aerial photographs (ground truth for the past)

| Source | Period | Use |
| --- | --- | --- |
| [National Library of Israel – maps](https://www.nli.org.il/en/discover/maps) (Eran Laor collection) | 1880s–1960s | Georeference town plans of Jaffa/Tel Aviv to date streets and blocks. |
| NLI aerial photos 1914–1947 ([catalogue YBZ.0106](https://www.nli.org.il/en/archives/NNL_ARCHIVE_AL997009628348205171/NLI)) | WWI | German/Ottoman WWI aerials include the Tel Aviv–Jaffa area. |
| NLI – Zoltan Kluger aerial album | 1937–38 | Oblique aerials of the White City at its peak. |
| [Tel Aviv University – aerial photos](https://en-scilib.tau.ac.il/geolib-aerial-photos) | 1944–45 (RAF), 1950s–60s (Israel) | Scanned Tel Aviv–Jaffa sets for footprint tracing. |
| [Hebrew University aerial archive](https://en.geography.huji.ac.il/node/33549) | RAF 1944–48 | Pre-state city extent. |
| Survey of Palestine 1:20,000 / town plans | 1930s–40s | Street network and block structure. |
| PEF Survey of Western Palestine | 1870s | Dunes, orchards and roads before the city. |

### Photographs, architecture and texts

- [National Photo Collection (GPO)](https://www.gov.il/en/departments/units/national_photo_collection) — free use with credit.
- [Library of Congress – Matson (American Colony) collection](https://www.loc.gov/pictures/collection/matpc/) — public domain, 1898–1946, Jaffa and early Tel Aviv.
- National Library of Israel photo archives (Kluger, Weissenstein/PhotoHouse with permissions).
- [Wikimedia Commons – History of Tel Aviv](https://commons.wikimedia.org/wiki/Category:History_of_Tel_Aviv).
- [UNESCO – White City of Tel-Aviv](https://whc.unesco.org/en/list/1096/) — nomination dossier, zone maps.
- Tel Aviv conservation plan (Plan 2650B) — list of ~1,000 buildings for preservation with addresses and years.
- Books: Nitza Metzger-Szmuk, *Dwelling on the Dunes*; Azaryahu & Troen (eds.), *Tel Aviv: The First Century*; Sharon Rotbard, *White City, Black City* (critical counterpoint).

### Rules for using data

1. **Every fact carries a source and a confidence level.** The UI shows them.
2. Store data as plain JSON/TS with WGS84 coordinates (converted via `src/core/geo.ts`).
3. Prefer public-domain / CC sources for anything shipped (photos, maps). Link, don't embed, otherwise.
4. Separate *documented* sites from the *procedural* fabric so the illustrative layer can be
   replaced street by street as real data arrives.

## 4. Making it fun, interactive and surprising

Implemented in this build:

- **Scroll through time** — the mouse wheel over the timeline moves years; buildings spring up
  with a little overshoot and sink when demolished. Play button at 1–10 years/second.
- **Era moods** — sepia film, grain and haze fade as decades pass (toggle in *View*).
- **Ghosts** — show demolished buildings as translucent blue silhouettes (e.g. the Gymnasium
  inside the Shalom Meir Tower).
- **Click anything** — every building tells its *life story*: built, weathered, balconies closed
  in, solar heaters added, restored after UNESCO, an extra TAMA 38 floor, replaced by a tower.
  Click a phase to jump to that year.
- **Event cards** — when time passes a key moment, a card offers "Take me there".
- **Guided tour** — a cinematic, narrated-by-text journey through 9 key moments.
- **Walk mode** — drop to 1.7 m eye height and stroll the boulevard (WASD).
- **Living crowds & traffic** — density follows population (and empties in 1917); gatherings
  recreate the 1909 lottery, 14 May 1948 and the 2011 protest; camels → carts → Fords → buses →
  Susitas → modern cars.
- **Statistics chips** — population (census vs estimate), buildings, dominant style.
- **Time of day** — from dawn to night; windows and street lamps glow after dark.
- **Procedural soundscape** — wind, sea, crowds, traffic, camel bells, horns and birds.
- **Shareable links** — `#year=1948` opens directly in that year.

Ideas for later (see ROADMAP.md): then/now split screen, archival photo rephotography overlays,
"guess the year" and scavenger-hunt games, narrated audio tours, historical map drapes, characters
with short (clearly labelled) composite stories, classroom mode, Hebrew/Arabic UI, WebXR.
