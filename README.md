# ASL

An open-source web app for learning American Sign Language, built to help you learn fast.
It runs entirely in your browser: no accounts, no servers, and camera video never leaves your device.

## What it does today

- **Daily review.** A spaced-repetition queue (FSRS) brings each sign back just before you would
  forget it. New signs are introduced a few per day.
- **Sign it.** See a letter or number, sign it (with an optional mirrored camera and record-and-replay),
  then reveal the handshape, palm and movement notes and grade yourself.
- **What is this sign?** For signs with an image or video, see the sign and type what it means.
- **Camera checks.** Sign a letter or number to your camera and get told what to fix, such as
  "Straighten your index finger" or "Turn your palm to face out". The Camera page runs through the
  alphabet and moves on as soon as each sign matches. Hand tracking runs on your device.
- **Read fingerspelling.** Watch a word spelled letter by letter and type it. The speed rises after clean
  reads and drops after misses, and words with your weakest letters come up more often.
- **Spell words.** Fingerspell a word against a timer and grade how clean it was.
- **Progress.** Retention, streak, reading speed in words per minute, the signs you misread most,
  and export/import of all your data as a JSON file.
- **Works offline** once loaded, and installs to your phone's home screen.

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
| `app/` | The web app: views, components and logic in `app/src/lib` |
| `content/` | Lesson units (JSON), media, and the content schema |
| `app/src/lib/engine/` | Camera checks: hand features and per-sign rules |
| `models/` | The bundled hand-tracking model |
| `fixtures/handshapes/` | Recorded hand samples that test the camera checks |
| `scripts/` | Content validator |
| `tests/` | Unit tests |
| `docs/` | Architecture and its review |

## How the camera checks work

MediaPipe finds 21 points on your hand in each video frame. The app turns those points into
measurements: how curled each finger is, where the thumb sits, how far the fingers spread,
which way the hand points and which way the palm faces. Each sign is a short list of readable
rules over those measurements, and each rule carries the fix to suggest when it fails.
A sign counts once it holds for about half a second.

Thumb positions tucked behind the fingers (A, E, M, N, S, T) are hard for any camera to see.
Those rules are marked unsure: they show as advice but never block a match. J, Z and 10 need
movement, which isn't checked yet; only their starting handshape is.

The rules are tested against a model hand in `tests/`, and real recorded samples in
`fixtures/handshapes/` keep them honest. See that folder's README to contribute samples.

## Deploying

The CI workflow tests every pull request and deploys `main` to GitHub Pages. In the repository
settings, set Pages to deploy from "GitHub Actions".

## Licenses

Code is MIT. Content in `content/` is CC BY 4.0 unless a media entry says otherwise.
