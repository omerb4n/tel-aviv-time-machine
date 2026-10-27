# UI design: the time walker's kit

This document explains how the game's interface looks and behaves, and why. It covers the visual
identity, how much text the game shows, the rephotography challenge and the map. It goes with
[GAME_DESIGN.md](GAME_DESIGN.md), which covers what the player does.

---

## 1. What was wrong

Playtest feedback on the first prototype:

| Feedback | Diagnosis |
| --- | --- |
| "Looks stale, AI vibe-coded" | Dark translucent "glass" panels, rounded pills, one gold accent, a generic sans. It is the default look of a thousand dashboards and says nothing about Tel Aviv or time. |
| "Too much text, messy" | The objective box held a title, a paragraph, a hint and a button. Clue cards were full paragraphs. The menu had a body text. Everything competed. |
| "I just watched the percentage go up" | The rephoto meter (`73%` plus "turn left") turned an observation puzzle into hot-and-cold. Players optimised a number instead of looking at the street. |
| "I need a map" | No orientation at all beyond the street itself. |

## 2. Research

| Source | What it says | What we take from it |
| --- | --- | --- |
| **Fagerholt & Lorentzon, *Beyond the HUD* (Chalmers, 2009)** | Game UI sits on two axes: is it part of the fiction (*diegetic*)? Is it in the 3D space (*spatial*)? Diegetic and meta interfaces raise immersion. | Make each HUD element an *object the time walker carries*: a street sign, a tag, a ticket, a postcard. They are still screen overlays (practical on a phone) but they belong to the fiction. |
| **Firewatch (Campo Santo, 2016)** | A paper map and a compass, held up in the hands; the "you are here" dot can be switched off. Reviewers credit this with the feeling of really being somewhere. | The map is a printed map *of that year*, in the style of that year. |
| **Dahmani & Bohbot, *Scientific Reports* (2020)** | Habitual GPS use correlates with worse spatial memory when navigating without it. Step-by-step guidance replaces building a mental map. | Never show a route line. The map shows *where you are and where things are*; the player plans the way. Hints give a search *area* before they give a point. |
| **Minimap debates** (Clair Obscur, Gothic remake, Borderlands 4 compass) | Removing the minimap makes players read the world, but frustrates casual players. A fog-of-war or partial map is a common compromise. | Keep a small minimap (people asked for it), but make it calm: no objective arrow by default, a rotating "heading-up" disc for orientation, and a full north-up map for planning. |
| **The Witness (Jonathan Blow, 2016)** | Solutions are confirmed by sound and visuals in the world, not by meters. Puzzles are solved by *standing in the right place and looking*. | The rephoto has no meter. Feedback is a camera focus metaphor (brackets close in), the photo's own lines, and a shutter click. |
| **Rephotography tools** (ReShoot, Ephemeros, re.photos) | Real rephotographers use a translucent "ghost" of the old photo; re.photos asks users to place matching marker pairs. | Our aids copy real practice: first the photo's *outline* (a tracing), then *match points* (coloured pairs), only then words. |
| **Outer Wilds ship log** | Progress is shown as knowledge ("rumours") linked between places, not as a quest list. | The case file is a trail of clues with locked "? ? ?" entries, not a checklist. |
| **Jacob Eisenberg's street signs** | Tel Aviv's first street signs were deep-blue ceramic tiles by the Bezalel-trained ceramicist Jacob Eisenberg, in Hebrew, Arabic and English. | The street sign in the corner of the HUD. It names the street you stand on, so it doubles as orientation. |
| **1930s Tel Aviv print** (Levant Fair posters, Hebrew modernist lettering) | Flat colour, heavy display type, strong horizontals, a Mediterranean palette. | The title screen is a poster; the palette is cobalt, terracotta, brass and paper. |

Sources:
[Beyond the HUD (Chalmers)](https://publications.lib.chalmers.se/records/fulltext/111921.pdf) ·
[Firewatch's map (Dualshockers)](https://www.dualshockers.com/campo-santo-releases-printable-firewatch-maps-for-cooperative-playthrough-or-your-wall/) ·
[Dahmani & Bohbot 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7156656/) ·
[No minimap in Clair Obscur](https://www.gfinityesports.com/article/the-mini-map-is-boring-so-clair-obscur-expedition-33-left-it-behind) ·
[The Witness (Wikipedia)](https://en.wikipedia.org/wiki/The_Witness_(2016_video_game)) ·
[re.photos (PetaPixel)](https://petapixel.com/2017/11/27/re-photos-photo-sharing-service-now-photos/) ·
[Jacob Eisenberg (Wikipedia)](https://en.wikipedia.org/wiki/Jacob_Eisenberg) ·
[Levant Fair (Wikipedia)](https://en.wikipedia.org/wiki/Levant_Fair)

## 3. Visual identity

**Concept: the time walker's kit.** Everything on screen is a period object made of paper, enamel
and brass, laid over the living street.

| Element | Object | Why |
| --- | --- | --- |
| Where am I | **Ceramic street sign** (cobalt glaze, cream border, Hebrew above English) | Eisenberg's tiles; also teaches the Hebrew street names. Appears only when you are on a street that exists in that year. |
| What am I doing | **Luggage tag** (paper, punched hole, one line) | One short sentence. Tap it for the case file. A pencilled hint appears under it when asked for. |
| Hints | **Ink stamp "?"** next to the tag | One button, three tiers (nudge → map circle → exact mark). |
| When am I | **Split-flap board** (Solari) | Time travel = departures. The digits flip through the years in between, with a soft clack. |
| Where can I go | **Tickets** (notched, perforated) | Anchored years are tickets you earned; locked years are blank stubs. Tap to travel, hold to peek. |
| The photo | **The postcard in your pocket** (a tilted thumbnail) | Not a "Photo" button: the actual postcard. It wiggles when you are near the spot. |
| Clues | **Archive index cards** (ruled lines, red rule, typed header, rubber stamp) | The confidence badge becomes a stamp: DOCUMENTED / APPROXIMATE / ILLUSTRATIVE. A new year is a ticket stapled to the card. |
| Case file | **Manila folder** with tabs (Case · Finds) | The question, a trail of clues, finds. Style stamps are perforated postage stamps. |
| Title | **A 1930s poster** with the case as a ticket | First impression sets the tone. |

**Palette**

| Token | Colour | Use |
| --- | --- | --- |
| `--paper` | `#f3ead6` | Every surface |
| `--ink` | `#1d1a15` | Text, primary buttons |
| `--cobalt` | `#1c3a78` | Street sign, current year, done, links |
| `--clay` | `#b4442f` | Terracotta roofs: accents, current step, hints, button shadow |
| `--brass` | `#c8923a` | Minimap rim, peeking, the matched photo |
| `--manila` | `#d9bf8a` | The case folder |

**Type** (all on Google Fonts, with Hebrew):
- *Suez One*: display (titles, years, the street sign). Heavy and Mediterranean, like a 1930s poster.
- *Assistant*: text. A humanist sans designed for Hebrew and Latin together.
- *Courier Prime*: typed archive labels, kickers, hints, toasts. The voice of the archive.

**Texture**: a tiny SVG noise tile gives paper grain without image files. Primary buttons have a
hard offset shadow in terracotta, like misregistered print.

## 4. Less text

Rules:
1. **One line on screen.** The objective tag holds one short sentence (`Lead.short`, at most ~45
   characters). The full question lives in the case file.
2. **One sentence per card.** Cards show a title and a `gist`; the full story, facts and sources are
   behind **More**.
3. **Pictures over paragraphs.** *How to play* is four pictograms with three to five words each.
4. **Teach once.** "Tap a year to travel" / "Hold a year to peek" appear under the tickets only until
   you have done it (`seen` in the save).
5. **No body text in menus.** The menu is a list of big buttons with icons; "Restart" asks for a
   second tap instead of a dialog.
6. **Hints are one line**, and from the second tier on they point at the map instead of describing a route.

## 5. Rephotography: from a meter to an eye

Old: hold up the photo, watch a percentage and follow "turn left".

New:

1. **Find the place** using the postcard itself: a long street, a grand building at its end.
   You are on that street. Lead hints help (nudge, then a circle on the map, then a mark).
2. **Hold it up** (tap the postcard). The photo floats over the view as a translucent ghost.
   There is **no meter**.
3. **Feedback is coarse and physical**, like a camera:
   - Nothing while you are far.
   - **Focus brackets** appear (with a soft click) when you are within about 14 m and 20°.
   - The brackets close in and turn brass when the view matches; hold still and the **shutter
     clicks**. You step into the photograph.
4. **Optional aids**, one at a time (button "Need an aid?", or H):
   1. **Tracing**: the photo's outlines in cream ink (Sobel edges of the plate). Turns the
      comparison into lining up shapes.
   2. **Match points**: coloured dots on the photo and rings in your view for the same places
      (the school's door, both kerbs). Line each ring up with its dot.
   3. **Directions**: the old words ("the photographer stood a bit to your left").
5. **Mastery reward**: matching with no aids earns the *Photographer's eye* field note.

Why: matching becomes perception (the core of rephotography) rather than optimisation, and the
fallback ladder means nobody gets stuck. Tolerances: match at ≤ 6 m, ≤ 9° yaw and pitch;
brackets at ≤ 14 m, ≤ 20° yaw, ≤ 18° pitch.

Technical notes:
- On portrait phones the plate is rendered at 4:3 with the same vertical field of view, so the
  phone sees the centre of a landscape postcard and alignment still holds.
- Match points are projected with the photographer's camera when the plate is rendered and with
  the live camera every frame. A test keeps them within ±10° of the view axis so they are visible
  on a portrait phone.

## 6. The map

**Decision: show every street, reveal meaning.**

The city plan is a fact (a 1910 visitor could buy a map), and hiding real geography would be
artificial in an educational game. What you *discover* is what fills in:

| Always shown | Revealed by playing |
| --- | --- |
| Coast, sea, Jaffa, Neve Tzedek, the railway (1892–1948) | Landmarks you examined (blue diamonds with names) |
| Streets *that exist in that year*, with sand tracks before paving | Where you found clues (numbered terracotta stamps) |
| Buildings *standing in that year* | The trail you walked (a pencil line) |
| | Hint tier 2: a dashed search circle (offset so it doesn't give the spot away); tier 3: a pin |

**The map changes with time.** Before 1948 it is drawn as a hand-inked survey map (sepia ink,
engraved sea lines, sand tracks); from 1948 on as a clean modern map. Travelling to 1910 shows a
handful of streets in the dunes; 2025 shows the dense city. The map itself teaches how the city
grew.

**Minimap**: a round brass-rimmed disc, heading-up (the view cone always points up) so it helps you
turn the right way, with N on the rim. Tap it for the full map.
**Full map**: north-up for planning and learning the layout. Drag, pinch or scroll to zoom, ◎
to recentre. A cartouche says the year and the street you are on.

No route lines and no fast travel, by design (see Dahmani & Bohbot above).

## 7. Files

```
src/game/GameUI.ts     DOM for the kit: sign, tag, flap board, tickets, postcard, cards, folder, menu
src/game/Flap.ts       split-flap year board
src/game/MapView.ts    canvas map renderer, MiniMap (heading-up) and FullMap (pan/zoom)
src/game/mapData.ts    pure: a year's map layer, the street you stand on, hint circles (tested)
src/game/game.css      the design tokens and every style above
```

## 8. Next

- A real playtest on phones: do players find the postcard spot without aids? How many use each aid?
- Hebrew UI (the type already supports it; the sign is bilingual).
- A sound pass: paper rustle for cards, the flap board, a street-sign "clink".
- Era-specific paper: the 1960s cards could be printed forms, the 2020s a phone screen.
