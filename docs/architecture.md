# ASL Learning App Architecture

Nov 9, 2026 · @pie

## Overview

An open-source web app for learning American Sign Language, built as a static site with no backend: all camera processing, sign recognition and progress tracking run in the learner's browser.

- **Goal:** teach ASL from fingerspelling up to short conversations, with live camera feedback on the learner's signs.
- **Video never leaves the device.** Only hand and face points are computed, locally.
- **No accounts or servers.** Free to host, easy to fork, works offline once loaded.
- **Content and models are plain files in the repo**, so contributors can add lessons and improve the recognizer through pull requests.
- **Built with the Deaf community.** Sign content is reviewed by Deaf signers before it ships.

## Architecture

&#91;embedded content: app architecture · 4 modules, 1 shared engine, static hosting\]

The repo deploys to a static host; the browser loads the app, models and clips once, then does all camera, recognition and storage work on the device.

## Learning modules

Four modules share one sign engine; each uses it differently.

| Module | What the learner does | Engine parts used |
| --- | --- | --- |
| Lessons | Watches clips of real signers, with slow motion and mirror view | Sign library |
| Practice | Signs to the camera and gets told what to fix, e.g. "palm should face out" | Tracking, recognizer |
| Conversation | Answers prompts in a live back-and-forth; the app captions what it understood | Tracking, recognizer, speech-to-text, sign library |
| Progress | Reviews signs they keep missing, on a spaced-repetition schedule | Local storage |

Useful feedback names the part of the sign to fix: handshape, location, movement, palm orientation or facial expression.

## Sign engine and tech stack

The engine turns camera frames into landmark points, then scores those points against the target sign, all in the browser.

| Layer | Choice | Notes |
| --- | --- | --- |
| UI framework | React or Svelte, built as a PWA | Installable on phones; works offline |
| Tracking | MediaPipe Tasks Vision (Holistic or Hand Landmarker) | 21 points per hand, plus face and body for grammar later |
| Recognizer, phase 1 | Rule-based handshape checks | Enough for static fingerspelling letters |
| Recognizer, phase 2+ | Small TF.js model (LSTM or transformer) trained on landmark sequences | Handles motion signs and vocabulary |
| Speech | Web Speech API, with a typing fallback | Browser support varies; Safari is weakest |
| Storage | localStorage or IndexedDB, with export/import | No accounts; progress stays on the device |
| Offline | Service worker caching models and clips | Models are several MB; cache after first load |
| Hosting | GitHub Pages or Netlify | Free https, which the camera requires |

The recognizer sits behind one interface (landmarks in, scores and fix hints out), so a stronger model, such as SignGemma if its weights are released, can replace it without touching the modules.

## Data, content and repo layout

Lessons are data, not code: each unit is a JSON file listing its signs, descriptions, clip paths and the checks Practice runs.

| Folder | Holds |
| --- | --- |
| `app/` | The web app (modules, engine, UI) |
| `content/` | One JSON file per lesson unit, plus clip credits |
| `content/clips/` | Short videos of real signers |
| `models/` | Exported TF.js recognizer models |
| `training/` | Python scripts for recording landmark data and training models |
| `docs/` | Architecture and contribution guides |

A new lesson unit should need only a JSON file and its clips, so non-programmers can contribute through a pull request.

## Open-source considerations

Licensing and sign content are the hard parts of this project, more than the code.

- **Code license:** MIT or Apache 2.0.
- **Model and dataset licenses:** check every one. Many ASL video datasets are licensed for research only, so models trained on them may not be shippable. [sign.mt](https://sign.mt) is CC BY-NC-SA 4.0, which blocks commercial reuse of anything built on it.
- **Sign clips:** ask Deaf signers to contribute under a clear open license (such as CC BY), credit each signer, and keep a contributor agreement for footage.
- **Training pipeline in the repo:** scripts and instructions for recording landmark data let others retrain and improve the recognizer.
- **Deaf review:** CONTRIBUTING.md requires review by a Deaf signer for any new or changed sign content.

Open question: which license to use for clips and lesson content, separate from the code license.

## Roadmap

The curriculum and the recognizer grow together: each phase needs a slightly stronger model than the last.

1. **Fingerspelling and numbers.** Lessons and Practice with rule-based checks for static handshapes.
2. **Motion letters and sideways palms (J, Z, G, H, P, Q).** First trained TF.js model on landmark sequences.
3. **Greetings and introductions.** Word-level recognizer for a first vocabulary set.
4. **Family, food and everyday verbs.** Larger vocabulary; Deaf contributors record clips.
5. **Questions and facial grammar.** Add face landmarks for raised and lowered eyebrows.
6. **Conversation mode.** Speech-to-text, signer clips and short guided dialogues.
