# Architecture Review: ASL Learning App

Review of `architecture.md` (Nov 9, 2026). The lens is the stated personal goal: **learn ASL fast**, with the open-source project as the vehicle.

## Status (Nov 10, 2026)

This review was written against the first plan. [architecture.md](architecture.md) now
describes the app as built. Where each recommendation stands:

| Recommendation | Status |
| --- | --- |
| Spaced repetition as the spine (FSRS) | Done: Review page, every exercise feeds the queue |
| Every exercise works without the recognizer (self-grading) | Done: Again / Hard / Good / Easy everywhere; the camera suggests the grade |
| Receptive fingerspelling with speed control and WPM | Done: Read drill, adaptive speed, weak letters come up more often |
| Self-recording and side-by-side comparison | Partly: record and replay in Review; no side-by-side with a model clip yet |
| Parameter checking instead of whole-sign classification | Done for handshape and palm direction; location, movement and non-manuals not yet |
| Pick one UI framework | Done: Svelte 5 |
| Tracking: Hand + Pose + Face from phase 1 | Hand only so far; location checks (and so first vocabulary) need pose or face |
| Normalisation, handedness, smoothing | Done (hand-relative measurements, signing-hand setting, smoothing); segmentation not needed yet |
| Engine as its own UI-free package, tested in Node | Done, at `app/src/lib/engine/` rather than `app/engine/`; tested with synthetic hands |
| Run tracking in a Web Worker | Not yet |
| IndexedDB with JSON export/import | Done |
| JSON Schema for content, validated in CI | Done, for lesson units and word lists |
| `fixtures/` of recorded landmarks | Set up, with a sample-saving tool; no samples yet |
| `reviewed_by` and clip license in the data | Done in the schema; no unit reviewed yet |
| Three licenses (code, content, models) | Done: MIT (`LICENSE`), CC BY 4.0 (`content/LICENSE.md`), each model's license listed in `models/README.md` (no separate `models/LICENSE` file) |
| Speech: typing by default, on-device if added | No speech features; nothing is sent to a speech service |
| Privacy page, "beyond the app" page | Not yet |
| Embedded clip sources | Supported in the schema; not used yet |

One addition the review didn't anticipate: Sign Five fetches the official Wordle word through
the app's own relay, which is the app's only network request (see architecture.md, "Network and
privacy").

## Verdict

The architecture is sound for what it describes: a static, privacy-preserving, browser-only app with a swappable recognizer and lessons-as-data. The main problem is that it is organised around the hardest, slowest part (camera sign recognition) while the parts that make a learner faster (receptive practice, spaced repetition, self-recording, vocabulary scale) are either missing or sitting in a side module. As written, you would spend months on the recognizer before the app teaches you anything you could not get from a flashcard deck.

The fix is not a rewrite. It is three changes of emphasis:

1. **Make spaced repetition the spine, not a module.** Every exercise type feeds one review queue.
2. **Make every exercise work without the recognizer** via self-grading and side-by-side video, so the ML is an upgrade rather than a dependency.
3. **Change the recognizer from whole-sign classification to parameter checking** (handshape, location, orientation, movement, non-manuals). That is what produces the "palm should face out" feedback, it needs far less training data, and it scales with content instead of with datasets.

The rest of this document goes through the doc section by section, then proposes a revised engine design, content schema, and roadmap.

---

## 1. What is missing for learning fast

### 1.1 Receptive practice is absent

The doc is almost entirely expressive: you sign, the camera checks. But the known bottleneck for ASL learners is **receptive** skill, and receptive fingerspelling in particular. People can produce the alphabet in a week and still cannot read a fingerspelled name a year later.

Receptive training needs zero machine learning:

- Show a fingerspelled word (real video, not static letter images, because real fingerspelling blurs letters together) and have the learner type what they saw.
- Speed slider from 0.5x to 1.5x. Track words-per-minute read correctly.
- Same for vocabulary: show a clip, learner picks or types the gloss.

This is the highest-value, lowest-cost feature in the whole project and it can be built in a day. It should be Phase 1, before any camera work.

### 1.2 Self-recording and side-by-side comparison

Let the learner record themselves signing and play it back next to the model clip, mirrored, at the same speed. No recognizer involved. Self-review against a model is one of the most effective techniques for motor-skill learning and it works for every sign on day one, including the ones the recognizer will never handle. Recording stays in memory or IndexedDB and never uploads, so the privacy story holds.

### 1.3 Self-grading as the universal fallback

Design every exercise so the learner can grade themselves (Again / Hard / Good / Easy, Anki style). When the recognizer has an opinion, it pre-fills the grade and shows its reasoning. When it is unsure or does not cover the sign, the learner grades. This single decision decouples the learning loop from recognizer progress entirely.

### 1.4 Vocabulary scale

Basic conversation needs roughly 500 to 1,000 signs. The content plan (one JSON per unit, clips recorded by Deaf contributors) is right for quality but it will take a long time to reach that size. Two things help:

- **Support embedded clip sources** in the content schema, not just local files. YouTube embeds via iframe are permitted by YouTube's terms, and several large ASL dictionaries publish there. This gets you to hundreds of signs on day one with no licensing work, at the cost of those clips being online-only. Local, openly licensed clips replace embeds over time.
- **Treat the Deaf-recorded clip library as the long-term asset**, with the embed layer as scaffolding. The schema should record clip source, license and signer for each entry so the two are never confused.

### 1.5 Learning metrics

"Learn fast" needs a definition. The Progress module should track and show:

- Receptive fingerspelling: words per minute at a given accuracy.
- Vocabulary: signs in the review queue, retention rate, signs due.
- Production: per-parameter error rates (handshape vs. location vs. orientation), which tells you what to drill.
- Streak and time on task.

### 1.6 Pointers beyond the app

The app can take someone to the point where they can fingerspell, understand slow fingerspelling, and produce a few hundred signs. It cannot teach conversational fluency; only signing with Deaf people does that. A short "beyond the app" page (Deaf events, tutors, receptive practice via Deaf vloggers) keeps the project honest and will be the single most useful page for a learner who wants speed.

---

## 2. Section-by-section critique

### Overview

Strong. The four principles (no backend, video stays local, content as files, Deaf review) are the right ones and they should be stated as hard constraints that pull requests are checked against.

One claim needs tightening: "video never leaves the device" is true, but on Chrome the **Web Speech API sends audio to Google's servers**. Either say so in the privacy statement, or use an on-device speech model (Whisper via transformers.js or whisper.cpp WASM; the tiny English model is about 40 MB) and keep the promise absolute. Typing fallback is fine as the default.

### Learning modules

The four modules are reasonable but the table reveals the imbalance: Lessons and Progress use almost nothing, Practice and Conversation carry all the hard engineering. Suggested re-cut:

| Module | What the learner does | Needs recognizer? |
| --- | --- | --- |
| Learn | Watch clip, mirror, slow motion, read parameter breakdown | No |
| Receptive drill | See sign or fingerspelled word, answer by typing or choosing | No |
| Production drill | Sign to camera; record and compare; get parameter feedback | Optional |
| Review | Spaced-repetition queue mixing all drill types | No |
| Conversation | Guided dialogues with signed prompts | Optional |

"Review" is the daily entry point. The others feed it.

### Sign engine and tech stack

**UI framework: "React or Svelte"** is an undecided decision. Pick whichever you already know. The UI is not where this project is hard. If no preference, Svelte with the static adapter keeps the bundle small next to multi-megabyte models.

**Tracking: "Holistic or Hand Landmarker"** is also undecided, and the choice matters earlier than the doc implies. Location is a core sign parameter from day one (the same handshape at the chin, chest or forehead is three different signs), and checking location requires a reference frame from the face or shoulders. So you need face and pose landmarks in Phase 1, not Phase 5. Plan for Hand Landmarker plus Pose Landmarker (upper body) plus a face landmarker, running as separate MediaPipe tasks if a combined holistic task is not available or stable on the web. Budget for frame rate accordingly.

**Recognizer, phase 1 and phase 2+.** The two-phase plan (rules for static letters, then a trained sequence model) is the biggest risk in the document. The phase 2 model needs labelled landmark sequences across many signers to generalise; every large ASL video dataset is research-licensed or non-commercial, and self-recorded data generalises to one person. See section 3 for the alternative: a parameter-based checker that scales with content rather than data.

**Missing engine stages.** The doc has "landmarks in, scores out" but no description of what happens between. These are needed regardless of model choice:

- **Normalisation**: translate to a body-relative origin (shoulder midpoint), scale by shoulder width, optionally rotate so shoulders are horizontal. Without this, nothing works across distances and camera angles.
- **Handedness**: a dominant-hand setting that mirrors landmarks for left-handed signers, and consistent dominant/non-dominant labelling across frames.
- **Temporal segmentation**: deciding when a sign starts and ends. Simple heuristics are enough to begin: hands at rest below the chest or out of frame mark boundaries; a "hold to begin" pose works too.
- **Smoothing**: a short exponential moving average on landmarks removes jitter that otherwise breaks handshape rules.

**Storage.** Use IndexedDB from the start, not localStorage. Review history grows past the 5 MB localStorage limit quickly, and recordings cannot go there at all. A thin wrapper (idb or Dexie) is enough. Keep export/import as a plain JSON file.

**Offline.** Correct, with one wrinkle: embedded clips are online-only. The service worker should cache models and local clips and the UI should mark which content works offline.

**Performance.** MediaPipe and the recognizer should run in a Web Worker with an OffscreenCanvas so the UI stays responsive. Target 30 fps on a mid-range phone and measure on one early.

**Hosting.** Fine. HTTPS is required for camera access and both hosts provide it.

**SignGemma.** Keep the swappable interface, but do not plan around it. It is a large model intended for server or desktop inference, and its availability for browser use is uncertain.

### Data, content and repo layout

Good structure. Additions:

- A **JSON Schema** for lesson units and a validator that runs in CI, so a content pull request fails fast on a typo rather than at runtime.
- `fixtures/`: recorded landmark sequences with expected recognizer output. Every rule change runs against them. Without this the recognizer regresses silently.
- `app/engine/` as its own package with no UI dependencies, so it can be tested with Node and reused.
- Clip metadata: signer, license, handedness, regional variant, camera angle. Regional variation is real and the schema should allow more than one accepted form per gloss.

### Open-source considerations

The licensing section is right to call this the hard part. Specific notes:

- **Resolve the open question with three licenses.** Code: MIT. Content (lesson JSON, clips, credits): CC BY 4.0, or CC BY-SA 4.0 if you want derivative lesson packs to stay open. Models: each model file carries the license of its training data. Put a `LICENSE` file in each of `app/`, `content/` and `models/`.
- **Non-commercial data may be acceptable for this project** because the app is non-commercial, but any model trained on it is then non-commercial too and every fork inherits that. State it in `models/LICENSE` and keep such models out of the default build if you want the default to be fully permissive.
- **Datasets to evaluate** (verify licenses before use; they change): the Google/Kaggle ASL fingerspelling and isolated-sign landmark datasets, which are landmark-only and so sidestep video privacy; ASL Citizen; How2Sign (non-commercial); WLASL and MS-ASL (research use, built from scraped video, avoid for shipping models).
- **The training pipeline must be opt-in and visible.** Recording landmark data for training is the one place the "nothing leaves the device" promise could be broken. Make contribution an explicit export step the learner performs, never a background upload.
- **Deaf review** as a CONTRIBUTING.md requirement is good. Add a `reviewed_by` field to the content schema so review is recorded in the data, not just in pull request history.

### Roadmap

The roadmap is ordered by recognizer difficulty. For a learner it should be ordered by learning value per week of work. See section 5.

---

## 3. Proposed engine design: parameter checking

ASL signs are conventionally described by five parameters: handshape, location, palm orientation, movement and non-manual markers. A sign is a combination of values for each. The doc already says useful feedback names the parameter to fix. Make that the architecture.

### 3.1 Sign specification

Each sign in the content JSON carries a structured description:

```json
{
  "gloss": "MOTHER",
  "variants": [
    {
      "dominant": {
        "handshape": "5",
        "location": "chin",
        "orientation": "palm-left",
        "movement": { "type": "tap", "repeat": 2 }
      },
      "nondominant": null,
      "nonmanual": null
    }
  ],
  "clips": [
    { "src": "clips/mother-01.mp4", "signer": "…", "license": "CC-BY-4.0", "angle": "front" },
    { "embed": "youtube:VIDEO_ID", "signer": "…", "online_only": true }
  ],
  "tips": ["Thumb touches the chin, fingers spread."],
  "reviewed_by": ["…"]
}
```

The vocabulary of values (handshape names, location zones, orientations, movement types) is a small controlled list defined once in a schema. Contributors fill in the spec; the engine checks it.

### 3.2 Checkers

The engine becomes a set of small, independently testable checkers:

| Checker | Input | Phase 1 implementation | Later |
| --- | --- | --- | --- |
| Handshape | Normalised hand landmarks | Rule-based finger extension and contact tests, or nearest-neighbour against a small per-handshape template set | Small classifier over ~50 handshapes, trainable from self-recorded data because handshapes are far more uniform across signers than whole signs |
| Location | Hand position relative to face and body landmarks | Zone test (forehead, temple, cheek, chin, neck, chest, neutral space, non-dominant hand) | Finer zones |
| Orientation | Palm normal from three hand landmarks | Angle test against expected direction | Tolerance tuned from data |
| Movement | Wrist trajectory over the segmented sign | Templates for tap, straight, arc, circle, wiggle, with repeat count | Dynamic time warping against a reference trajectory |
| Non-manual | Face landmarks | Eyebrow height relative to neutral | Mouth morphemes, head tilt |

A sign passes when all checkers pass. When one fails, the feedback names it. This is the "palm should face out" message, produced by construction.

### 3.3 Why this beats whole-sign classification for this project

- **No large dataset needed.** A handshape classifier covers the whole vocabulary; everything else is geometry.
- **Scales with content.** A contributor adding a sign adds a spec, not training data.
- **Feedback is explainable** and aligned with how ASL is actually taught.
- **Graceful coverage.** A sign with an unusual movement can mark that checker "unsupported" and still get handshape, location and orientation feedback, with self-grading for the rest.
- **Whole-sign models still fit.** The recognizer interface can run a sequence model as an additional checker later, and fingerspelling sequence recognition (where self-recorded data does generalise reasonably because letters are constrained) is a good first use of it.

### 3.4 Interface

```ts
interface Recognizer {
  evaluate(sign: SignSpec, frames: NormalisedFrame[]): Evaluation;
}

interface Evaluation {
  pass: boolean;
  confidence: number;            // 0..1, how sure the engine is overall
  parameters: Record<Parameter, {
    status: "pass" | "fail" | "unsupported";
    score: number;
    hint?: string;               // "Palm should face out"
  }>;
}
```

The UI uses `confidence` to decide whether to pre-fill the self-grade or ask the learner.

---

## 4. Revised stack decisions

| Layer | Recommendation | Reason |
| --- | --- | --- |
| UI | The framework you know; Svelte if indifferent. PWA. | UI is not the hard part |
| Tracking | MediaPipe Tasks: Hand + Pose (upper body) + Face from Phase 1 | Location checks need a body frame |
| Engine | Pure TypeScript package, runs in a Web Worker, tested with landmark fixtures | Testability and frame rate |
| Recognizer | Parameter checkers (section 3); small TF.js handshape classifier when rules plateau | Scales with content |
| Speech | Typing by default; on-device Whisper if speech is added | Keeps the privacy promise |
| Storage | IndexedDB with JSON export/import | localStorage is too small |
| Review scheduling | FSRS (open source, better retention per review than SM-2) | It is the spine |
| Offline | Service worker caches models and local clips; embeds marked online-only | Honest offline story |
| Hosting | GitHub Pages | Free HTTPS |

---

## 5. Revised roadmap, ordered by learning value

Each phase should leave you using the app daily.

1. **Week 1: Review spine and receptive fingerspelling.** FSRS queue, IndexedDB, alphabet and numbers with clips, receptive fingerspelling drill with speed control and WPM tracking. No camera yet. You start learning on day one.
2. **Weeks 2 to 3: Camera, mirror, self-record.** Mirrored camera view, record and compare side by side with the model clip, self-grading into the review queue. Still no recognizer.
3. **Weeks 3 to 5: Static handshape checker.** Hand Landmarker, normalisation, rule-based handshapes for the alphabet and numbers. Fixtures and tests. First real automated feedback.
4. **Weeks 5 to 8: First 150 signs and the location and orientation checkers.** Greetings, introductions, questions. Pose and face landmarks, zone and orientation tests. Embedded clips allowed; Deaf-recorded clips begin replacing them.
5. **Months 3 to 4: Movement checker and motion letters.** Trajectory templates; J and Z; the vocabulary grows to 500 with family, food, everyday verbs.
6. **Month 4+: Non-manual markers and conversation mode.** Eyebrow checks for question types; guided dialogues built from existing clips, with self-grading first and recognizer scoring where supported.
7. **Ongoing: handshape classifier and fingerspelling sequence model** once rule-based checks plateau, trained on self-recorded and permissively licensed landmark data.

The original roadmap's phases 1 to 6 all still happen; they are just interleaved with the parts that make you faster.

---

## 6. Smaller items

- Pick one framework and one tracking configuration in the doc; remove the "or"s.
- Add handedness, normalisation, segmentation and smoothing to the engine description.
- Add `fixtures/` and `schema/` to the repo layout.
- Add a privacy page that states exactly what runs where, including the speech caveat.
- Add a "beyond the app" page for learners.
- Record `reviewed_by` and clip license in the data, not just in pull request history.
- Decide the content license now (CC BY 4.0 is the simplest defensible default) so the first contributed clip is covered.
