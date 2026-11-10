# Handshape samples

Recorded hand points (no video) used to test and tune the camera checks in
`app/src/lib/engine/handshapes.ts` and the drawn letters in `app/src/lib/engine/movement.ts`.
Every file here is run by `tests/fixtures.test.ts`:

- a **still sign** must match on most of its frames;
- a **drawn letter** (J or Z, marked `"movement": true`) is replayed and must be recognized.

## Adding a sample

The **Save sample** button only exists on the local dev server (`npm run dev`); the live app
leaves it out.

1. Run `npm run dev` and open **Camera practice** (Signs, then "Practice on camera") and pick the sign, or open a
   "Sign it" card in Review. Turn on the camera.
2. Make the sign correctly. For J and Z, hold the handshape still for a moment, then draw the
   letter. The camera should not need to accept it for the sample to be useful.
3. Open **Details** and press **Save sample** straight away. This downloads the last second of
   hand points (about three seconds for J and Z) as JSON.
4. Put the file in this folder and run `npm test`.

If the test fails, the checks are too strict for real hands. Look at the failing check in the
test output and adjust its threshold (`T` in `handshapes.ts`, or the constants in `movement.ts`),
keeping the other tests passing.

Samples from different people, hands, cameras and lighting make the checks fairer. Only add
samples of signs made correctly, ideally confirmed by a fluent signer.

Details also shows what the camera measured (bend per finger, the bend in each finger's own
joints, spread, thumb position, palm and tilt), which is the quickest way to see which threshold
a correct sign is missing.

### Most wanted

- **P and K.** The middle finger leans far forward, and in P the camera sees the hand from
  above. Thresholds: `straightTipMax`, `foldedMin`, `tippedDownMin`.
- **1, 2, 4 and 5**, palm toward you. Thresholds: `extendedMax` (ring and pinky), `fanMin`, and
  the thumb test `thumbSticksOut` (`thumbAsideMax`).
- **T and X.** They are told apart by whether the index finger stands up off the fist
  (`indexStandsUp`, thresholds `raiseKnuckleMin` and `raiseTipMin`). Details shows the two numbers
  live as "index raise". Samples of both letters set the boundary.
- **J and Z**, drawn at your natural size and speed.

## Format

```json
{
  "sign": "k",
  "movement": false,
  "frames": [
    { "t": 0, "handedness": "Right", "aspect": 1.333, "image": [[x, y, z], ...21], "world": [[x, y, z], ...21] }
  ]
}
```

`t` is milliseconds since the first frame. `movement` is only present (and `true`) for J and Z.
