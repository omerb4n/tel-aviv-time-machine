# Game design: an open city and a field notebook

This document defines what the Tel Aviv Time Machine is as a **game**: what the player does,
why it is fun, and how the history of the city's architecture, planning and culture is woven
into play. The classic timeline (Milestone 0) remains as *free explore*.

---

## 1. Why this design

The first game build had three **cases** (*The Vanishing School*, *The Seashell Lottery*,
*The House on Plot 43*). Playtest feedback (October 2026):

| What the player said | What it means |
| --- | --- |
| "You can just click four times on the screen and it works." | The cases told you what to look at next, and an Examine button appeared when you got there. Nothing was found; it was followed. |
| "The cases feel like separate levels." | A linear case with a start and an end splits the city into levels. The city should be one place. |
| "I want exploration: to discover and be amazed on my own, but tracked." | The reward is noticing something yourself, and seeing it recorded. |
| "A sequential flow is fine, but it must be introduced better." | Any order should be offered, explained and optional, not imposed. |
| "I'm more interested in architecture, urbanism and culture." | The declaration of 1948 is political history. The game should teach how the city was built, how it looks and how people lived in it. |

So the cases are gone. The city is open, and a **field notebook** records what you notice.

## 2. Design theory we build on

| Theory | What it says | What we do with it |
| --- | --- | --- |
| **Information-gap theory of curiosity** (Loewenstein, 1994) | Curiosity is a *specific* gap that feels closable. | Each undiscovered notebook entry is a one-line riddle ("A house that stands on columns"), and old photographs turn up, without saying where they were taken, once you notice what is in them. |
| **Knowledge-based progression** (*Outer Wilds*, *Return of the Obra Dinn*, *Heaven's Vault*) | Progress is what the player knows. | Nothing unlocks; the notebook fills in. Once you know what a thermometer window is, you see them everywhere. |
| **Self-determination theory** (Ryan, Rigby & Przybylski, 2006) | Autonomy, competence, relatedness. | *Autonomy:* any street, any year, any order. *Competence:* reading façades, dating buildings by eye, matching photos. *Relatedness:* real people, places and photographs. |
| **MDA** (Hunicke, LeBlanc & Zubek, 2004) | Design back from the aesthetics. | **Discovery** first, then **fantasy** (a time walker) and **narrative** (the city's story). |
| **Environmental storytelling** (Jenkins, 2004) | Spaces hold embedded narratives. | A balcony closed in with shutters, a grey façade turned white, a tower where a school stood: the street tells the story if you look. |
| **A theory of fun** (Koster, 2004) | Fun is learning a pattern. | The White City collection teaches the International Style's features one at a time; the patterns repeat on every street. |
| **Explorer motivation** (Bartle; Quantic Foundry *Discovery*) | Some players love finding secrets and understanding how worlds work. | We design for explorers: no markers, a notebook that rewards curiosity, comparisons across years. |

Guard-rails: educational, for all ages, **no manipulative loops** (no streaks, timers,
currencies or fear of missing out).

## 3. Player fantasy

> *"I walk Tel Aviv through its whole life. I notice what others walk past, and my notebook
> fills with what I learned to see."*

The player is an **observer**: they never change history.

## 4. Core loop

```
   ┌──────────── wander (first person, any street, any year) ◀──────────┐
   │                              │                                     │
   │       look closely at something · compare two years in place      │
   │                 · stand where an old photo was taken               │
   │                              │                                     │
   │        "You notice…" → a notebook entry (what, why, sources)       │
   │                              │                                     │
   │          a new pattern to look for · a riddle in the notebook      │
   └──────────────────────────────┴─────────────────────────────────────┘
```

A first discovery should come **within two minutes** without help: the start, on Rothschild
Boulevard today, is surrounded by International Style buildings.

## 5. Mechanics

### 5.1 Walking (presence)
- First person at 1.7 m eye height. Buildings are solid.
- Desktop: click once to capture the mouse, then move it to look (Esc frees it; dragging still
  works). WASD/arrows to walk, Shift to hurry. A dot marks the centre; a click examines what it
  is on (E does the same).
- Touch: on-screen stick to walk, drag to look, tap to examine.
- **Rise and come down** (R / F, or the ▲ ▼ buttons): up to rooftops and beyond (120 m), to see
  the street plan from above or stand where a photographer stood on a roof. Below roof height
  buildings stay solid; above a building's roof you can pass over it, and coming down lands on
  the roof.

### 5.2 Time: seven years, open from the start
- The year tickets are **1909, 1922, 1936, 1960, 1985, 2011 and 2025**: the founding, the
  eclectic 1920s, the White City, the austerity years, the grey decades, the 2011 protests and
  today. All are open from the start; time is the tool, not the reward.
- **Tap** a ticket to **slip** to that year through a lens; **hold** it to **peek** from where you
  stand. Q peeks into the last year you were in.
- The full timeline (every year) stays in *free explore*.

### 5.3 Noticing (the core verb)
- **Look closely.** When you look at something worth noticing, from close enough and in a year
  when it is there, a ring at the centre of the view fills; hold your look and the discovery
  is written into the notebook. Tapping or clicking it (or E) notices it at once.
- **Nothing is marked.** No sparkles, no Examine button, no objective. The ring only appears
  when you are already looking at the right thing.
- Some discoveries are about **any** building of a kind (any International Style building's
  ribbon balconies; the side of one, where the stair window is). Others are one place (Engel
  House on its columns, the Pagoda House, the first kiosk).

### 5.4 Comparing (time as a tool)
- Some discoveries need **two years at one spot**: stand somewhere, then peek or slip into
  another year. A grey building that is white again; a school that became a tower; dunes that
  became Allenby Street; a bare boulevard that became a tunnel of trees.

### 5.5 Rephotography
- Real archive photographs **turn up when you notice their subject**: look closely at the
  Herzliya Gymnasium in its years (1910–1961) and the Herzl Street photograph (1913) is clipped
  into the notebook; find the crowd on the 1909 dune and Avraham Soskin's photograph of the
  lottery turns up. Until then the notebook shows only a clue to the subject. Noticing comes
  first, then the harder search for the spot: two steps, each a small win.
- **Not a sequence.** Every photograph that has turned up and is not yet placed can be worked
  on in any order: the postcard button (or P) offers a choice when there is more than one, and
  each has *Hold up* in the notebook. Find where it was taken and in which year, and line it up
  by eye.
- **No meter.** Focus brackets appear when you are close and lock when the view matches; the
  shutter clicks. Height counts too: the Herzl Street photograph was taken from a rooftop (about
  9 m up), so it only locks once you rise to it. The photo only locks in a year when the scene looks like the photo (the
  lottery crowd is there only in 1909; Herzl Street looks like 1913 until the 1920s).
- **A helping hand when very close.** Nearly lined up (within about 10 m, 14° and 5 m of
  height) and holding still for a moment, the view settles gently into the photographer's
  exact spot ("Almost: hold still…"). Finding the place and framing it stays the player's job;
  the last fiddly degrees do not. Any look or step cancels the settle.
- Optional aids, one at a time: the photo's outlines, match points, then directions. Matching
  with no aids is marked *by eye* in the notebook.
- The held print is the whole real photograph, the view is cropped to it, and its empty parts
  fade so the world shows through (UI_DESIGN.md §5).

### 5.6 The field notebook (tracking)
- Three sections: **Architecture**, **Urbanism**, **Culture**. Each holds collections, each
  collection opens with a short introduction (what it is about and what to look for) and a
  count (`3 / 6`).
- An undiscovered entry shows only its **riddle**. A *Nudge* adds one more line and, for
  entries that are a single place, a search circle on the map. There is no stronger hint:
  the point is to find it yourself.
- A discovered entry shows what you noticed, the year and place you found it, the story behind
  "More", its confidence and sources.
- Two more collections are filled by examining: **Styles** (tap an ordinary building to learn
  its style) and **Landmarks**.
- The HUD tag shows the notebook count and your latest find; it opens the notebook.

### 5.7 Optional order (threads)
- Each collection's introduction suggests where to start ("Begin on Rothschild Boulevard in
  1936"), but entries can be found in any order. A first find in a collection opens a new page
  in the notebook, with that introduction on the discovery card, so each theme is introduced
  the first time you meet it.

### 5.8 Map
- The map of the current year, with your trail and a pin for every discovery where you made
  it. A nudge draws a search circle. No routes.

### 5.9 Honesty
- Every entry shows its **confidence** (documented / approximate / illustrative) and sources.
  Building positions and the procedural streets are approximate; the notebook says so where
  it matters.

## 6. The first slice: Ahuzat Bayit to the White City

Twenty-one discoveries in the modelled core (Rothschild, Herzl, Ahad Ha'am, Lilienblum,
Nahalat Binyamin, Yehuda HaLevi, Allenby).

### Architecture

**The White City** (1931–1948, restored after 2003)

| Entry | How you find it | Years |
| --- | --- | --- |
| Ribbon balconies | Look closely at any International Style building | 1936, 1960, 2025 |
| Thermometer windows | Look at the side of one, where the stair window is | 1936 on |
| On columns (pilotis) | Look at Engel House, 84 Rothschild | 1936 on |
| Closed-in balconies | Look at a weathered International Style building | 1985, 2011 |
| White again | Stand by a grey one and compare it with after its restoration | 1985 ↔ 2025 |
| One floor more | Look at a restored building with a floor added on the roof | 2025 |

**Before the White City**

| Entry | How you find it | Years |
| --- | --- | --- |
| Red roofs and gardens | Look at a first-generation garden house | 1909, 1922 |
| East meets West | Look at an eclectic building | 1922 on |
| The Pagoda House | Look at it | 1936 on |

### Urbanism: *Building a city*

| Entry | How you find it | Years |
| --- | --- | --- |
| The lottery on the dune | Match Soskin's photograph | 1909 |
| A street aimed at a school | Match the Herzl Street photograph | 1910–1925 (ticket 1922) |
| Water for the suburb | Look at the water tower | 1909, 1922 |
| A boulevard of trees | On Rothschild's promenade, compare 1909 with a later year | 1909 ↔ 1936+ |
| Beyond the first streets | On Allenby Street, compare 1909 with a later year | 1909 ↔ 1922+ |
| A school for a tower | At the head of Herzl Street, compare 1960 with a later year | 1960 ↔ 1985+ |
| Tents on the boulevard | Look at a protest tent | 2011 |

### Culture: *City life*

| Entry | How you find it | Years |
| --- | --- | --- |
| The first kiosk | Look at it | any |
| A museum in the mayor's house | Look at Dizengoff House | 1936, 1960 |
| A new face for the synagogue | At the Great Synagogue, compare 1960 with 1985 | 1960 ↔ 1985+ |
| The founders' fountain | Look at the Founders' Monument | 1960 on |
| A wall that tells the story | Look at Gutman's mosaic at the Shalom Meir Tower | 1985 on |

## 7. Next

- More collections in the same world: *Eclectic tiles* (Bezalel ceramics such as Ze'ev Raban's
  murals on the Lederberg House), *Kiosks* (the 1995 boulevard plan restored them),
  *Shikun* (austerity housing).
- New areas: the Geddes Plan north (Dizengoff Square, the boulevards), Neve Tzedek, Jaffa port.
- A second layer of threads: a short guided walk per collection, offered in the notebook.
- Hebrew text (every string is already `Localized`).

## 8. What we measure (playtests)

- **Time to first discovery** (target under two minutes, unhelped).
- **Discoveries per session** and **nudges per discovery**: where do people get stuck?
- **Unprompted comparisons** (peeks and slips that lead to a discovery).
- **Learning**: before and after, can players name three features of the International Style?

## 9. Architecture

```
src/game/
  types.ts              content model: Discovery, Collection, Trigger, Poi, PhotoDef
  content/              the notebook's content (data only, testable)
    collections.ts        sections, collections and their introductions
    discoveries.ts        every discovery: riddle, nudge, trigger, text, sources
    photos.ts             the archive photographs and where they were taken
    pois.ts               props that stand in the world in their years
  NotebookState.ts      pure progress: found entries, stamps, landmarks, trail, save/load
  discover.ts           pure trigger tests (look, compare, photo)
  rephoto.ts            pure rephotography maths
  Game.ts               orchestrator: lens, noticing, comparing, photos, notebook, map
  GameUI.ts             DOM: HUD, tickets, cards, notebook, photo overlay, noticing ring
```

Progress lives in `localStorage` (`tlvtm.notebook.v1`). Style stamps and landmarks from the
case builds carry over.

### Authoring a discovery

1. Add it to `src/game/content/discoveries.ts` with a section and collection, a riddle and a
   nudge, a trigger, a one-sentence gist, the story, confidence and sources.
2. Triggers: `look` (a site by id, or any building of a style with an optional phase test),
   `compare` (two year ranges at a place, or by a kind of building), `photo` (an archive
   photograph), `poi` (a prop).
3. `tests/notebook.test.ts` checks that every trigger refers to things that exist in its years,
   that every discovery can be found in at least one of the seven years, and that the start is
   on open ground.
