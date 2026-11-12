# Numbers plan: 10's movement, and numbers above 10

Nov 12, 2026 · A plan. The part for 10 is built, with first-estimate thresholds that still need
recordings (see "Plan for 10"); nothing above 10 is. It covers two things: checking the movement
in 10, and teaching or checking any number above 10.

## Where things stand

- **0 to 9** are still handshapes. The camera checks them, and "Sign the answer" uses them.
- **10** is a fist with the thumb standing up, clear of it, and then a shake. The camera now
  looks for the shake (`REPEATS['10']` in `movement.ts`), on thresholds no recording has
  confirmed yet.
- **J and Z** are the only signs whose movement is checked. `movement.ts` follows one fingertip
  and compares the path it draws with a template. That fits a drawn letter. It does not fit a
  shake, a flick or a two-part number.
- **Nothing above 10** exists: no content, pictures, reading levels or checks.

## What numbers above 10 need

The forms below are the ones most often taught. **They must be confirmed by a Deaf signer
before any of this ships**: number signs vary by region, 16 to 19 most of all, and the app's
existing content is still marked as unreviewed.

| Numbers | How they are made | What the camera has to see |
|---|---|---|
| 10 | Thumb-up fist, shaken | A small back-and-forth, twice |
| 11, 12 | Palm toward you; index (11) or index and middle (12) flick up off the thumb, twice | A finger folding and straightening, twice |
| 13, 14, 15 | The 3, 4 or 5 hand, palm toward you; the fingers bend toward you, twice | The same, on more fingers |
| 16 to 19 | 10 twisting into 6, 7, 8 or 9 (one common form) | Two handshapes, one after the other |
| 20 | Index finger and thumb tap together, twice | A gap closing and opening, twice |
| 21, 23, 25 | L, 3 or 5 hand with the thumb (21) or middle finger (23, 25) bending, twice | One finger folding, twice |
| 22, 33, 44… | The digit, bounced to the side | The hand moving sideways between two holds |
| 24, 26 to 29 | L, then 4, 6, 7, 8 or 9 | Two handshapes, one after the other |
| 30 to 99 | Two digits in a row (30 is 3 then 0) | Two handshapes, one after the other |
| 100 | 1, then C | Two handshapes, one after the other |

So three new kinds of check cover everything:

1. **Repeat.** One measurement swings back and forth twice inside about a second and a half:
   the thumb's sideways position (10), a finger's bend (11 to 15, 21, 23, 25), or the gap
   between thumb and index (20).
2. **Sequence.** Handshape A, then handshape B, close together (16 to 19, 24, 26 to 29, every
   two-digit number, 100).
3. **Bounce.** The same handshape held, moved sideways, and held again (22, 33, 44…).

## Plan for 10

1. **Record first.** Let Save sample capture three seconds for 10, as it does for J and Z, and
   record a few shaken 10s. Every threshold below comes from those recordings, not from a guess.
2. **Build the repeat check** (`RepeatTracker` in `movement.ts`): feed it one number per frame;
   it reports when the number has crossed a high and a low mark twice each inside a time window.
   For 10 the number is the thumb tip's sideways distance from the wrist, in palm lengths.
3. **Let a shake through the "hold still" gate.** Readings are ignored while the hand travels
   faster than 1.8 hand lengths a second. A brisk shake is close to that, so while the hand is a
   thumb-up fist the gate has to stay open.
4. **Decide where the shake is required.**
   - Camera practice and Review, where 10 is the sign being learned: require it, and replace
     today's note that the movement isn't checked.
   - Sign the answer: keep accepting a held thumb-up fist after the usual hold, and accept a
     shaken one straight away. A game shouldn't fail an answer over a missing wiggle.
5. **Separate 10 from thumbs up.** They are the same hand. Today they never meet, because Sign
   Five reads letters and Sign the answer has no Enter. If a numbers game ever needs Enter, the
   rule is: held still is thumbs up, shaken is 10.
6. **Tests.** A model hand rocked from side to side must count as a shake; a still one, a single
   nudge and a slow drift must not. The recordings go in `fixtures/handshapes`.

Size: small. It is also the proof that the repeat check works before 11 to 15 lean on it.

**Status, Nov 12:** steps 2 to 6 are built, with tests on a model hand. Step 1 is not done: no
shaken 10 has been recorded, so `swing` (0.12 palm lengths), `turns` (2) and `windowMs` (1500)
are estimates. Save sample now captures three seconds for 10; the first recordings should set
them.

## Plan for numbers above 10

In this order, so each step is useful by itself and the risky camera work comes after the
content is right.

1. **Confirm the forms.** Settle which form of each number the app teaches, 16 to 19 first, with
   a Deaf signer or one agreed reference. Everything after this depends on it.
2. **Teach 11 to 20 without the camera.** A new content unit with descriptions and tips; drawn
   pictures, since the photos in use stop at 9; three new motions for the drawings and the
   animated hand (flick, bend, tap); a reading level, "Numbers 11 to 20"; and review cards.
   Learners grade themselves, as they can for every sign today. Size: medium.
3. **Check 11 to 15 and 20 with the repeat check**, each on its own measurement, with the palm
   toward you. Needs recordings of each. Size: medium.
4. **Build the sequence check** for 16 to 19, 24 and 26 to 29. The camera reader holds each
   letter for 0.9 seconds, which is far too slow inside one sign, so a sequence needs its own
   short holds (about a third of a second each) that only apply once the first handshape of a
   known number has been seen. Size: medium.
5. **Two-digit numbers and 100.** With the sequence check in place these are mostly content:
   30 to 99 as digit pairs, then the bounce check for 22, 33 and the other doubles. Size: medium
   for the check, large for the content.
6. **Grow the games.** Sign the answer with sums up to 20, then up to 100; a drill for signing
   strings of digits, such as a phone number, to match the reading level that already exists.

## Risks

- **Speed.** A flick lasts about a sixth of a second, four or five camera frames. The smoothing
  that steadies still handshapes would flatten it, so the repeat check has to read unsmoothed
  frames.
- **Palm-toward-you hands are the camera's weak side.** The tracker sees the back of the hand
  and guesses at fingers folding away from it. 11 to 15 are all made that way.
- **Model hands can't settle thresholds.** They proved the rules for still handshapes were
  consistent; movement needs real recordings from more than one person.
- **Every number is content as well as code**: a description, a picture, a check and tests.
  Reaching 100 is mostly that work, not engine work.
