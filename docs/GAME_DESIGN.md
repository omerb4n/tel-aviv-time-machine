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
| **Flow** (Csikszentmihalyi) and **tiered hints** | Keep challenge near skill, and never leave the player stuck. | Three-tier hints per lead: nudge → direction → on-screen marker. No timers, no failure states. |
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
- A lead gives you an archival photograph. Hold it up (P) and it is overlaid on your view.
- An alignment meter ("walk a bit to your left", "look up a little") guides you to where the
  photographer stood. When the view lines up the photo dissolves and **you slip into its year**.
- This turns real archive material into concrete, spatial goals that need no text.
- In the prototype the "photo" is rendered from the reconstruction (and aged), with a link to
  the real archival photos. Milestone 2 uses licensed or public-domain originals.

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

### 5.6 Field journal (memory and collection)
- Clues found so far, what you are looking for now, and `? ? ?` for what is still hidden.
- Anchored years, field notes (optional secrets such as *Double exposure*), style stamps and
  landmarks.

### 5.7 Honesty
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

## 7. Future cases (each one is a place, a question and a few years)

| Case | Question | Signature moment |
| --- | --- | --- |
| **The Seashell Lottery** | How were the first plots handed out with seashells on a sand dune — and who got which? | Stand among the 1909 crowd on the dune; find the shells. |
| **The House on Plot 43** | Why did a mayor's house become the most important room in Israel? | Rephotograph 14 May 1948 at 16 Rothschild. |
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
