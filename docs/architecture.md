# ASL Learning App Architecture

Nov 10, 2026 · @pie · Describes the app as built on `main`. The original plan (Nov 9) and its
review are in git history and in [architecture-review.md](architecture-review.md).

## Overview

An open-source web app for learning American Sign Language, built as a static site with no
backend: camera processing, sign checking and progress tracking all run in the learner's browser.

- **Goal:** learn ASL fast, starting with fingerspelling and numbers, with live camera feedback.
- **Video never leaves the device.** The camera image is turned into 21 hand points per frame,
  locally, and nothing is recorded unless the learner asks.
- **No accounts.** Progress lives in the browser's IndexedDB, with JSON export and import.
- **One small network call.** Sign Five asks this app's own relay for the day's official Wordle
  word (a date goes out, a word comes back). Everything else works offline once loaded.
- **Content is data.** Lessons, media and word lists are files in `content/`, checked by a
  validator in CI, so contributors can add content without writing code.
- **Every exercise works without the camera.** Learners can always grade themselves; the camera
  check, when there is one, suggests the grade.

## How it fits together

```mermaid
flowchart LR
  subgraph Browser
    Views["Pages (views/)"] --> Components["Components"]
    Views --> Lib["Logic (lib/)"]
    Components --> Engine["Camera engine (lib/engine/)"]
    Lib --> DB[("IndexedDB")]
    Engine --> MP["MediaPipe Hand Landmarker (WASM + model, bundled)"]
  end
  Content["content/ (JSON, media, word lists)"] -->|bundled at build| Views
  Views -->|"date only"| Relay["Wordle relay (Cloudflare Pages Function)"] --> NYT["NYT daily word"]
```

The build bundles the app, the content and the hand-tracking model into static files. The
browser loads them once (the 22 MB hand tracker only when the camera is first turned on), and a
service worker keeps them for offline use.

## Pages

Routing is by URL hash (`#/review`, `#/fingerspelling/read`, …), so any static host works without
redirect rules. Each page is one file in `app/src/views/`, and only `App.svelte` routes to pages.
Every address is defined once in `lib/routes.ts`; pages link with `routes.*`, never a hand-written
`#/…`. Addresses from older versions (`#/learn`, `#/practice`, `#/fingerspell`, `#/progress`) are
redirected there, so old bookmarks keep working.

The main navigation is the same five places on every screen size: Today, Review, Signs, Spelling,
Dashboard. Camera practice belongs with Signs (and is linked from Today and every sign).

| Page | Route | What the learner does |
| --- | --- | --- |
| Today | `#/` | Gets one clear next step, sees streak and signs started, and picks any activity from the Practise hub |
| Review | `#/review`, `#/review/more` | Works through the spaced-repetition queue: new signs, "Read it" (type what a sign means) and "Sign it" (make the sign, camera optional), then grades Again / Hard / Good / Easy. `/more` starts with five extra new signs |
| Signs | `#/signs`, `#/signs/<id>` | Browses every sign: picture, handshape, palm, movement, tips, look-alikes |
| Camera practice | `#/camera`, `#/camera/<id>` | Signs each letter or number to the camera; a sign list shows progress, and the next sign comes on Next (or automatically, if turned on) |
| Fingerspelling | `#/fingerspelling` | Chooses between the two drills and the word game |
| Read drill | `#/fingerspelling/read` | Watches a word spelled letter by letter and types it; speed adapts |
| Spell drill | `#/fingerspelling/spell` | Fingerspells a word; the camera checks each letter and scores the word |
| Sign Five | `#/fingerspelling/sign-five` | Guesses a five-letter word in six tries by fingerspelling it (daily word or practice) |
| Dashboard | `#/dashboard` | Signs and fingerspelling progress, activity, word lists (`/lists`, `/lists/<id>`), settings and data (`/settings`) |

"Edit list" in a drill remembers the drill for the browser tab, and the lists page offers "Back
to …" until you leave the dashboard.

## Code layout

```
app/src/
  App.svelte            navigation and routing
  app.css               design tokens (colours, radii) and shared classes
  views/                one file per page (table above)
  components/           reusable UI: sign pictures, camera checks, list picker, grade buttons…
  lib/                  logic with no UI
    engine/             camera and hand tracking: no Svelte, tested in Node
```

| Module | Responsibility |
| --- | --- |
| `lib/routes.ts` | Every address, redirects from older ones, page names, and the "Back to …" memory |
| `lib/types.ts` | Shared types and defaults (settings, cards, attempts, word lists, Sign Five save) |
| `lib/db.ts` | IndexedDB store: cards, reviews, attempts, settings; export, import, delete all |
| `lib/settings.svelte.ts` | The one shared copy of settings; `updateSettings(patch)` merges into the latest saved settings and saves in order |
| `lib/lists.ts` | Named word lists: helpers, and migration of settings saved by older versions |
| `lib/content.ts` | Loads `content/` units and media at build time |
| `lib/srs.ts` | FSRS scheduling (ts-fsrs), the review queue and session, wait times in words |
| `lib/stats.ts` | Review stats: card counts, retention, streak, activity, weakest signs |
| `lib/spelling.ts` | Fingerspelling: playback timing, adaptive speed, word picking, `spellingSummary()` |
| `lib/fingerspell.ts` | What the fingerspelling pages share: letters, showable letters, chosen word list |
| `lib/guess.ts` | Sign Five: scoring guesses, daily word (official or local), saved game |
| `lib/illustrations.ts` | Drawn hand illustrations used when a sign has no image |
| `lib/engine/camera.ts` | Opens the camera, loads the tracker, runs it each frame, draws the hand |
| `lib/engine/landmarker.ts` | MediaPipe Hand Landmarker (loaded on demand, GPU with CPU fallback) |
| `lib/engine/features.ts` | Turns 21 hand points into measurements: finger curl, spread, thumb position, hand and palm direction |
| `lib/engine/handshapes.ts` | One readable rule list per letter and number, each rule with the fix to suggest |
| `lib/engine/tracker.ts` | Smoothing across frames, and "held long enough" timing |
| `lib/engine/reader.ts` | Reads *which* letter is being made (for Sign Five), with safeguards against stray letters |

Rules that keep this tidy: pages don't import other pages; `lib/` doesn't import components;
`lib/engine/` doesn't import Svelte; colours come from tokens in `app.css`.

## Camera engine

Every camera feature uses the same pipeline:

1. **Camera and tracker** (`camera.ts`, `landmarker.ts`): front camera at 640×480; MediaPipe
   returns 21 points per hand. The learner's signing hand is preferred when two are visible.
2. **Smoothing** (`tracker.ts`): a moving average removes jitter.
3. **Measurements** (`features.ts`): curl per finger, spread, thumb placement, which way the
   hand points and the palm faces, all relative to the hand's own size.
4. **Rules** (`handshapes.ts`): each sign is a list of checks. Thumb positions the camera often
   can't see are marked *unsure*: they show as advice but never block a match.
5. **Judging** (`judge()`): a loose match doesn't count if the hand fully matches a different
   sign, so one fist can't pass for A, E, M, N, S and T alike.
6. **Timing:** a target sign counts once held for 0.6 s (`HoldTimer`). Sign Five's open reader
   (`LetterReader`) needs 0.9 s, ignores fast movement, and won't type the same letter again
   until the hand changes or drops, so a long hold types one letter.

J, Z and 10 involve movement, which isn't checked yet: only their starting handshape is.

## Data and storage

All learner data is in one IndexedDB database (`asl`):

| Store | Holds |
| --- | --- |
| `cards` | One FSRS card per sign and direction (recognise, produce) |
| `reviews` | Every review: grade, time, typed answer, camera match |
| `attempts` | Every fingerspelling attempt: word, mode, correct, speed, replays |
| `settings` | Small records: `settings` (preferences, word lists) and `signFive` (game in progress, stats) |

- **Export / import** is one JSON file with all of the above. Import replaces everything; older
  files without newer fields still import.
- **Migrations** happen when settings are read: older one-list settings become named lists, and
  Sign Five data from older versions moves from localStorage into the database once.
- **localStorage** holds only per-device conveniences (Camera page toggles).

## Content

| Path | Holds | Checked by |
| --- | --- | --- |
| `content/units/*.json` | Lesson units: signs, descriptions, tips, look-alikes, media, review status | `schema/unit.schema.json` + `npm run validate` |
| `content/media/` | Public-domain letter and number images | validator (files exist) |
| `content/words/*.json` | Word lists, e.g. the Sign Five dictionary | `schema/wordlist.schema.json` + validator (length, repeats) |

Each unit records whether it has been reviewed by a Deaf signer (`review.status`, `reviewed_by`);
the app shows unreviewed content as a draft.

## Network and privacy

- No analytics, accounts or uploads. Camera frames are processed and discarded in the browser.
- The only request the app makes is Sign Five's daily word: `GET /api/wordle/<date>.json` to the
  app's own host. In production a Cloudflare Pages Function (`functions/api/wordle/[date].js`)
  fetches the NYT answer and returns only the word; in development the Vite dev server does the
  same. If the relay can't be reached (offline, or a host without functions such as GitHub Pages),
  the game uses its own word of the day.

## Build, test and deploy

| Layer | Choice |
| --- | --- |
| UI | Svelte 5 (runes), Vite 6, installable PWA (vite-plugin-pwa) |
| Tracking | MediaPipe Tasks Vision, Hand Landmarker, WASM and model bundled |
| Scheduling | FSRS via ts-fsrs |
| Storage | IndexedDB via idb |
| Tests | Vitest (logic, engine against synthetic hands, storage with fake-indexeddb), svelte-check |
| CI | GitHub Actions: validate, type check, test and build on every pull request and every push to `main` |
| Hosting | GitHub Pages from `main` (CI deploys it); Cloudflare Pages also works and adds the Wordle relay |

For Cloudflare Pages: build command `npm run build`, output `dist`, `NODE_VERSION=22`.

## Licenses

Code is MIT. Content in `content/` is CC BY 4.0 unless a media entry says otherwise; the letter
and number images are public domain from wpclipart.com, credited on each item. The hand-tracking
model's source and license are listed in `models/README.md`.

## Roadmap

Done:

1. Review spine: FSRS queue, IndexedDB, export and import, self-grading everywhere.
2. Alphabet and numbers 0–10 with public-domain images and drawn hands.
3. Static handshape checks for every letter and number, with fix hints and look-alike detection.
4. Receptive fingerspelling (adaptive speed, WPM) and expressive fingerspelling with per-letter
   camera scoring.
5. Sign Five word game, named word lists, dashboard.

Next:

1. **Real recorded samples** in `fixtures/handshapes/` to tune the rules against real hands
   (the folder is set up; no samples yet).
2. **Movement checks** for J, Z and 10 (wrist trajectory templates).
3. **First vocabulary unit** (greetings, introductions) with location checks, which need face
   or body landmarks as a reference.
4. **Run tracking in a Web Worker** so the page stays smooth on slower phones.
5. **Deaf review** of the alphabet and numbers units, recorded in `reviewed_by`.
6. Later: facial grammar for questions, and guided conversation practice.
