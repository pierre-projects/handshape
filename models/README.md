# Models

| File | What it is | Source | License |
| --- | --- | --- | --- |
| `hand_landmarker.task` | MediaPipe Hand Landmarker, float16, version 1. Finds 21 points per hand. | [MediaPipe models](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task) | Apache 2.0 |

SHA-256 of `hand_landmarker.task`:

```
fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1
```

The model is bundled so the app works offline and makes no requests to third parties.
The browser downloads it the first time the camera checker is used and caches it.

The sign checks themselves are not a trained model. They are readable rules in
`app/src/lib/engine/handshapes.ts`, tuned against recorded samples in `fixtures/handshapes/`.
