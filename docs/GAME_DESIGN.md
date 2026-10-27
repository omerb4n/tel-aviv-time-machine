# Game design: from museum to exploration

This document defines what the Tel Aviv Time Machine is as a **game**: what the player does,
why it is fun, and how history is woven into play. It replaces the "guided museum" framing of
Milestone 0, which is kept as the *free explore* mode.

---

## 1. Diagnosis: why the first build felt like a museum

| Symptom | Underlying problem |
| --- | --- |
| Info cards, tours and event pop-ups push content at you | **No information gap.** Everything is shown up front, so nothing makes you curious. |
| A slider gives you all 125 years at once | **No agency or progression.** Time travel is free, so it means nothing. |
| You look down from above | **No presence.** A god's-eye view is a map, not a place. |
| The reward for doing anything is a paragraph | **No competence.** You never figure anything out yourself. |
| There is nothing you could get wrong or miss | **No stakes, no surprise.** |

## 2. Design theory we build on

| Theory | What it says | What we do with it |
| --- | --- | --- |
| **Information-gap theory of curiosity** (Loewenstein, 1994) | Curiosity is the feeling of a *specific* gap between what you know and what you want to know, and it peaks when the gap feels closable. | Every case opens with one concrete question and a partial clue (a postcard of a building that is not there). Locked years show as `????` on the time compass. |
| **Knowledge-based progression** (*Outer Wilds*, *Return of the Obra Dinn*, *Her Story*, *Heaven's Vault*) | Progress is what the player knows, not items or stats. The world doesn't change; your understanding does. | Years are unlocked ("anchored") only by clues found in the world. The key to the next year is a fact. |
| **Self-determination theory applied to games** (Ryan, Rigby & Przybylski, 2006) | Games motivate when they satisfy **autonomy, competence and relatedness**. | *Autonomy:* free walking, multiple open leads, optional discoveries. *Competence:* rephotography alignment, deductions, style identification. *Relatedness:* real people and places, future composite characters. |
| **MDA framework** (Hunicke, LeBlanc & Zubek, 2004) | Design from the target **aesthetics** back to the mechanics. | Target aesthetics: **Discovery** (primary), **Fantasy** (being a time traveller), **Narrative** (the city's story). Not challenge or competition. |
| **Environmental storytelling** (Jenkins, 2004, "Game Design as Narrative Architecture") | Spaces can hold *embedded narratives* that the player reconstructs. | The city is the text: a mosaic, a site fence, a missing building, a weathered façade. We don't narrate; we let the street testify. |
| **A theory of fun** (Koster, 2004) | Fun is the feeling of learning a pattern. | Style stamps teach the player to *read* façades (ribbon balconies → International Style). Late in a case the player starts dating buildings by eye. |
| **Flow** (Csikszentmihalyi) and **tiered hints** | Keep challenge near skill, and never leave the player stuck. | Three-tier hints per lead: nudge → search circle on the map → on-screen and map marker. No timers, no failure states. |
| **Zeigarnik effect** | Unfinished tasks stay on the mind. | The step bar, `????` years, undiscovered field notes and locked next-case titles invite return. |
| **Player types** (Bartle's *explorers*; Quantic Foundry's *Discovery* and *Story* motivations) | Some players love finding secrets and understanding how worlds work. | We design for explorers first: hidden notes, landmark and style collections, peeking for "double exposures". |

Guard-rails: this is educational and for all ages, so **no manipulative loops** (no streak
punishment, loot boxes or fear of missing out). Rewards are knowledge and access, never currency.

## 3. Player fantasy

> *"I am a time walker on the streets of Tel Aviv. I notice things others walk past,
> and with the right clue I can step into any moment of this street's past."*

The player is still an **observer**: they never change history. They *investigate* it.

## 4. Core loop

```
   ┌──────────── wander the street (first person) ◀───────────────┐
   │                        │                                     │
   │                notice something odd                          │
   │       (a missing building, a mosaic, a sparkle, a photo)     │
   │                        │                                     │
   │           investigate: examine · rephotograph · peek         │
   │                        │                                     │
   │          clue → journal, maybe a new year anchored           │
   │                        │                                     │
   └─ slip to another year (time lens) ── next lead / deduction ─┘
```

A session should reach its **first discovery within 60 seconds**, and the first case should
take **10–15 minutes**.

## 5. Mechanics

### 5.1 Walking (presence)
- First person at 1.7 m eye height. Buildings are solid (footprint collision).
- Desktop: drag to look, WASD/arrows to walk, Shift to hurry, click to examine (E for screen centre).
- Touch: on-screen stick (left) to walk, drag anywhere to look, tap to examine.
- When the current lead's target is in reach (in the right year), a large **Examine** button
  appears (E on desktop). Players don't have to discover that the 3D world is tappable.
- A short *How to play* card follows the intro, and is also in the menu.

### 5.2 Time compass and anchored years (progression)
- Time travel is limited to **anchored years**. A case starts with one (the present).
- A clue can **anchor** a new year (a date on a mosaic, a poster, a postcard). It appears on
  the compass; un-found years appear as `????` slots.
- **Tap** a year to **slip**: the current view freezes and the new year opens from the centre
  of the screen through a glowing lens.
- **Hold** a year to **peek**: a small lens opens onto that year from exactly where you stand.
  Release to close it. Peeking is how you compare "then and now" in place.
- After a case is solved, **free travel** (the full timeline) is unlocked as the reward.

### 5.3 Rephotography (the signature mechanic)
- A lead gives you an archival photograph: the postcard in your pocket. Tap it (P) to hold it up
  as a translucent ghost over your view.
- **No meter.** You line it up by eye. Camera-style focus brackets appear when you are roughly in
  the right place and close in when the view matches; hold still and the shutter clicks and
  **you slip into its year**.
- If you are stuck, three optional aids, one at a time: the photo's **outlines** (a tracing),
  **match points** (coloured dots on the photo, rings in your view), then **directions** in words.
  Matching with no aids earns the *Photographer's eye* field note.
- This turns real archive material into concrete, spatial goals that need no text.
- The photos are the **real archive photographs** (public domain, from Wikimedia Commons): Herzl
  Street in 1913, Avraham Soskin's lottery of 1909 and Rudi Weissenstein's declaration of 1948.
  Each scene and photographer's spot is laid out so the model lines up with the print, and the
  print is fitted to the view by its match points (see UI_DESIGN.md §5). If a photo fails to
  load, the game falls back to a print rendered from the reconstruction.
- Details and reasoning: [UI_DESIGN.md §5](UI_DESIGN.md#5-rephotography-from-a-meter-to-an-eye).

### 5.4 Examining (the world as text)
- Points of interest (props that exist only in some years) shimmer when you are near and a
  lead needs them. They do not show from far away, so finding them feels earned.
- Landmarks open their story and are recorded in the journal (`n/16`).
- Ordinary buildings give **style stamps**: the first time you examine a building of a style
  up close, you learn that style and what to look for (`n/8`).

### 5.5 Leads, clues and deduction (narrative structure)
- A **case** is a small graph of **leads**. Each lead is a question ("What replaced it?"),
  a trigger (rephoto, examine a site, examine a point of interest), a clue and three hints.
- Leads can have requirements (graph edges) and valid years.
- When all leads are done, the case ends with a short **deduction** (multiple choice with
  gentle feedback). Then a **resolution card** with the real story and sources.

### 5.6 Map (orientation)
- A round, heading-up minimap; tap it for the full north-up map.
- The map is **the map of the current year**: streets, buildings and the railway as they were.
  It is drawn as a hand-inked survey map before 1948 and as a modern map after.
- Every street is always shown. What fills in as you play: landmarks you examined, numbered
  stamps where you found clues, and the trail you walked.
- The second hint tier draws a search circle on the map; the last tier a pin. No route lines.
- Details and reasoning: [UI_DESIGN.md §6](UI_DESIGN.md#6-the-map).

### 5.7 Field journal (memory and collection)
- Clues found so far, what you are looking for now, and `? ? ?` for what is still hidden.
- Anchored years, field notes (optional secrets such as *Double exposure*), style stamps and
  landmarks.

### 5.8 Honesty
- Every clue shows its **confidence** (documented / approximate / illustrative) and sources.
- Props that are reconstructions say so, and composite characters (future) are labelled as fiction.

## 6. Case 1: *The Vanishing School* (the prototype)

| # | Lead | Trigger | Clue → reward |
| --- | --- | --- | --- |
| 0 | *Intro:* Herzl St, 2025. A postcard shows a grand building where a tower stands. | | |
| 1 | **The postcard**: where was it taken? | Rephotograph on Herzl St | Herzl St 1910 → **slip to 1910** |
| 2 | **The building at the end of the street** | Examine the Gymnasium (1910–1961) | The Herzliya Gymnasium, and the question "what happened?" |
| 3 | **A trace in the present** | Examine Gutman's mosaic at the tower (2025) | "Razed in 1962" → **1962 anchored** |
| 4 | **The empty lot** | Examine the site fence (1962–64) | A tower is coming, and the school moved → **1965 anchored** |
| 5 | **What replaced it** | Examine the Shalom Meir Tower (1965+) | The tallest building in the Middle East |
| — | **Deduction**: why did the school vanish? | 3 choices | Case closed → **free travel unlocked** |

Optional field notes: *Double exposure* (peek into the past from the foot of the tower),
the first kiosk, and Dizengoff House (setting up Case 3).

## 6b. Case 2: *The Seashell Lottery*

How did 66 families decide who got which plot, on an empty dune? The case teaches the founding
of Tel Aviv (11 April 1909) and sets up Case 3 (the house on plot 43).

| # | Lead | Trigger | Clue → reward |
| --- | --- | --- | --- |
| 0 | *Intro:* Rothschild Blvd, 2025, by the fountain. | | |
| 1 | **The fountain on the boulevard** | Examine the Founders' Monument (1951+) | It honours the founding families of 1909 → **slip to 1909** |
| 2 | **People on the dune** | Examine the crowd (1909) | 66 families have come to divide the land |
| 3 | **The photographer** | Rephotograph Soskin's picture, *only in 1909* | The best-known image of the founding |
| 4 | **Two baskets** | Examine the shells, then **draw a white and a grey shell** | The lottery: names on white shells, plot numbers on grey → **1910 anchored** |
| 5 | **Plot 43** | Examine Dizengoff House (1910+) | The Dizengoffs' home, later Independence Hall |
| — | **Deduction**: how were plots assigned? | 3 choices | Case closed |

New mechanics in this case:
- **A hands-on draw** (`Clue.reveal`): before the clue card, the player turns over a white shell and
  a grey shell. It is a re-enactment ("one of the draws that day"), so the player *does* the lottery
  rather than reading about it.
- **A photo that only lines up in its year**: Soskin's photograph shows the crowd, so it locks only in
  1909. In other years the photo view says "this is the spot, but the photo was taken in 1909".
- **People of 1909**: an instanced crowd in period dress, a table with two baskets, and the
  photographer under his cloth beside a plate camera on a tripod.

Optional field notes: *Photographer's eye*, *Where the shells came from* (reach the beach in the
early years), *Water for the suburb* (the first water tower), *Out of the old town* (visit Neve
Tzedek before 1914).

Honesty: the exact spot of the lottery on the dune is not documented, so the crowd's placement is
illustrative; accounts differ on who drew the shells, so that clue is marked *approximate*.

## 6c. Case 3: *The House on Plot 43*

Why was the State of Israel declared in an art museum? The case follows one building through
four moments and ends inside the hall on 14 May 1948. It closes the opening arc: the lottery
(Case 2) → the house → the museum → the declaration.

| # | Lead | Trigger | Clue → reward |
| --- | --- | --- | --- |
| 0 | *Intro:* 16 Rothschild Blvd, 2025: Independence Hall. | | |
| 1 | **Independence Hall** | Examine the building (2025) | Built as a home in 1910 → **slip to 1910** |
| 2 | **The Dizengoffs' home** | Examine the house (1910–1931) | He gives it to the city for art → **1936 anchored** |
| 3 | **The museum** | Examine the museum sign (1932–1947) | The Tel Aviv Museum of Art → **1948 anchored** |
| 4 | **Friday, 14 May 1948** | Examine the door, **open the invitation** | A secret ceremony → **step into the hall** |
| 5 | **Four o'clock** | Rephotograph Weissenstein's picture *inside the hall* | Ben-Gurion reads the Declaration |
| — | **Deduction**: why a Tel Aviv art museum? | 3 choices | Case closed |

New in this case:
- **An interior.** A point of interest can be a `room` (a box inside a building, local +z = door).
  A lead's `enter` steps the player through the door after its clue. Inside, collision is the room's
  walls; a *Step outside* button appears by the door; time travel is paused ("this room only exists
  in this moment"). The hall is built procedurally: the leaders' table, Herzl's portrait between two
  flags, paintings on the walls, rows of seated guests. It is self-lit (soft emissive materials) rather than lit by extra lights, which would make every material in the scene costlier on phones.
- **People of 1948**: shirt sleeves, suits, coloured dresses, and seated figures.
- The invitation reuses the hands-on reveal from Case 2.

Optional field notes: *Photographer's eye*, *Two houses in one* (peek from the museum back into
1910), *Waiting outside* (stand with the crowd on the boulevard in 1948).

Honesty: the museum opening (1932) and its rebuilding (by 1936) are both given; the reason for
choosing this building comes mostly from guides and memoirs, so that clue is *approximate*; the
hall and portrait are stylised reconstructions, laid out after Weissenstein's photograph.

### Cases share a world

Every case's props stand in the world in their years (the 1909 crowd is there in Case 1 too); only
the current case's leads make them glimmer. Each case has its own save; style stamps and landmarks
are shared across cases (`tlvtm.profile.v1`). The title poster lists each case as a ticket with
its status, and the menu has *Choose a case*.

## 7. Future cases (each one is a place, a question and a few years)

| Case | Question | Signature moment |
| --- | --- | --- |
| **The White City** | Find the five features of the International Style on one street. | Style-stamp scavenger hunt; peek 1936 vs 1985 vs 2010 restoration. |
| **The Lost Water Tower** | What was the first thing in town taller than a house? | Find the Founders' Monument and peek back. |
| **Tents on the Boulevard** | What were thousands of people doing on Rothschild in 2011? | A moving crowd, a present-day lead. |

Later systems:
- composite characters met across decades;
- a daily *"Where and when?"* challenge, with a shareable result;
- classroom codes;
- narration and audio clues.

## 8. What we measure (playtests)

- **Time to first discovery** under 60 s for 80% of first-time players.
- **Case completion** above 60% of players who start it. Hint usage per lead shows where people get stuck.
- **Unprompted peeks** per session: are players using time as a tool?
- **Retention signal**: players who open the journal or look at the locked next cases after finishing.
- **Learning**: a 3-question quiz before and after (e.g. "What stood where the Shalom Tower is?").

## 9. Architecture (prototype)

```
src/game/
  types.ts              case content model: Lead, Trigger, Clue, Poi, PhotoDef, CaseDef
  cases/vanishingSchool.ts   Case 1 content (data only, testable)
  GameState.ts          pure progress state: leads, anchored years, collections, save/load
  rephoto.ts            pure alignment scoring for rephotography
  Game.ts               orchestrator: lens state machine, examining, guidance, flow
  GameUI.ts             DOM for HUD, compass, cards, journal, photo overlay
  Interactables.ts      year-bound props and sparkle markers
  Joystick.ts, sfx.ts   touch stick, procedural sound effects
world/TimeWipePass.ts   post-processing pass: frozen snapshot vs live scene through a lens
```

The world stays a pure function of the year, so a slip or peek is just `jumpTo(year)` (an
instant world switch that skips rise/sink animations) behind the lens effect. Progress lives
in `localStorage` (`tlvtm.case.v1`). The classic timeline still works (*Free explore* on the
title screen, the *Case* button to return, and `#year=` deep links).

### Authoring a case

1. Add `src/game/cases/<name>.ts` exporting a `CaseDef`.
2. Leads need a trigger, a clue with sources and confidence, three hints and a target
   position. Anchor years through clues.
3. Add any props as `pois` with a `prop` kind (add a new kind in `Interactables.ts`).
4. `tests/game.test.ts` checks that the case can be finished, its references exist, and its
   start and photo positions are not inside buildings.
