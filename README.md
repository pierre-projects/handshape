# ASL

An open-source web app for learning American Sign Language, built to help you learn fast.
It runs entirely in your browser: no accounts, and camera video never leaves your device.

## What it does today

- **Daily review.** A spaced-repetition queue (FSRS) brings each sign back just before you would
  forget it. New signs are introduced a few per day. Cards are "Read it" (see a sign, type what it
  means, or tap "I don't know") and "Sign it" (make the sign, with an optional camera check), and
  you grade yourself; the camera or your typed answer suggests the grade.
- **Camera checks.** Sign a letter or number to your camera and get told what to fix, such as
  "Straighten your index finger" or "Turn your palm to face out". The Camera page works through the
  alphabet or numbers with a sign list you can jump around in. Hand tracking runs on your device.
- **Read fingerspelling.** Reading is the hard part, so it has its own module. Levels in three
  tracks, each played as ten quick reads: **Letters** (pick the letter you saw, then look-alikes
  flashed briefly, then a drill built from the letters *you* mix up), **Words** (short words up to
  names and places at four letters a second, with a hint such as "a name" as you'd have in
  conversation) and **Numbers** (0 to 10, then digit strings like phone numbers). A miss shows the
  word letter by letter with what you got wrong, and each session ends with a summary and a way
  to go over the ones you missed. **Free practice** reads word after word from the built-in words
  or your lists, at a speed that rises after clean reads and drops after misses. Words can be
  shown as letter pictures or, as an experiment, a drawn hand that moves from letter to letter.
- **Spell fingerspelling.** Fingerspell a word to the camera; each letter turns green as it matches,
  and you get a score for the word.
- **Sign Five.** A word game: guess the five-letter word in six tries by fingerspelling each guess
  to the camera (or typing it). Play the day's official Wordle word, or unlimited practice words.
- **Word lists.** Make named lists of the words you want to practise and pick one in any drill or game.
- **Dashboard.** What's due, streak, retention, reading speed, Sign Five stats, the signs you misread
  most, your word lists, settings, and export/import of all your data as a JSON file.
- **Works offline** once loaded (except fetching the daily Sign Five word), and installs to your
  phone's home screen.

Content covers the alphabet and numbers 0 to 10. Descriptions are drafts until a Deaf signer
reviews them. Reading drills unlock as images and videos are added; see `content/README.md`.

## Run it

```
npm install
npm run dev
```

Then open the address it prints. The camera needs `localhost` or https.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests |
| `npm run check` | Type check |
| `npm run validate` | Validate lesson content |
| `npm run build` | Production build into `dist/` |

## Layout

| Folder | Holds |
| --- | --- |
| `app/` | The web app: pages in `app/src/views`, components, and logic in `app/src/lib` |
| `app/src/lib/engine/` | Camera and hand tracking: hand measurements, per-sign rules, letter reading; the model hand and its animation |
| `content/` | Lesson units (JSON), media, word lists, and their schemas |
| `functions/` | Cloudflare Pages Function that relays the daily Wordle word |
| `models/` | The bundled hand-tracking model |
| `fixtures/handshapes/` | Recorded hand samples that test the camera checks |
| `scripts/` | Content validator |
| `tests/` | Unit tests |
| `docs/` | [Architecture](docs/architecture.md) and its [review](docs/architecture-review.md) |

## How the camera checks work

MediaPipe finds 21 points on your hand in each video frame. The app turns those points into
measurements: how curled each finger is, where the thumb sits, how far the fingers spread,
which way the hand points and which way the palm faces. Each sign is a short list of readable
rules over those measurements, and each rule carries the fix to suggest when it fails.
A sign counts once it holds for about half a second. In Sign Five, where the app has to work out
which letter you mean, a letter types only after you hold it steadily for about a second, and
holding it longer doesn't type it again.

Thumb positions tucked behind the fingers (A, E, M, N, S, T) are hard for any camera to see.
Those rules are marked unsure: they show as advice but never block a match.

Each hint names a part of the hand, and the camera view colours that finger on your tracked hand.
Turn on **Guide** to also see the target handshape drawn over your own hand, at your hand's size,
with the place to move that finger to picked out. If a sign keeps failing, the camera offers it
("Show me"). A finger that is straight but leaning forward at the knuckle, as the middle finger
is in K and P, is told to lift, not to "straighten".

J and Z are drawn in the air. Hold the handshape still for a moment, then draw: the app follows
your pinky (J) or index fingertip (Z), shows the trail, and matches the shape you drew. Drawing it
mirrored still counts, with a tip. In Sign Five, drawing a J or Z types it. 10's thumb shake isn't
checked yet; only its starting handshape is.

The rules are tested against a model hand (the same one the guide is drawn from), and real recorded samples in
`fixtures/handshapes/` keep them honest. See that folder's README to contribute samples.

## Deploying

The CI workflow tests every pull request and deploys `main` to GitHub Pages. In the repository
settings, set Pages to deploy from "GitHub Actions".

The app also deploys to Cloudflare Pages as-is: build command `npm run build`, output directory
`dist`, environment variable `NODE_VERSION=22`. Cloudflare also runs `functions/`, which lets Sign
Five fetch the official Wordle word; on GitHub Pages the game uses its own word of the day instead.

## Licenses

Code is MIT. Content in `content/` is CC BY 4.0 unless a media entry says otherwise.
