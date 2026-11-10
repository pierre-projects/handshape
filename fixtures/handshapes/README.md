# Handshape samples

Recorded hand points (no video) used to test and tune the camera checks in
`app/src/lib/engine/handshapes.ts`. Every file here is run by `tests/fixtures.test.ts`,
which expects the sign named in the file to match on most of its frames.

## Adding a sample

1. Open a sign in the app (Signs, then a letter), turn on the camera, and make the sign correctly.
2. Open **Details** and press **Save sample**. This downloads about a second of hand points as JSON.
3. Put the file in this folder and run `npm test`.

If the test fails, the checks are too strict for real hands. Look at the failing check in
the test output and adjust its threshold in `handshapes.ts`, keeping the other tests passing.

Samples from different people, hands, cameras and lighting make the checks fairer. Only add
samples of signs made correctly, ideally confirmed by a fluent signer.

## Format

```json
{
  "sign": "k",
  "frames": [
    { "handedness": "Right", "aspect": 1.333, "image": [[x, y, z], ...21], "world": [[x, y, z], ...21] }
  ]
}
```
