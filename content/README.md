# Content

Lessons are data, not code. Each lesson unit is one JSON file in `units/`, checked
against `schema/unit.schema.json`. You can add or improve content without writing any code.

```
content/
  schema/unit.schema.json   rules every unit must follow
  units/01-alphabet.json    one file per unit, ordered by its "order" field
  units/02-numbers.json
  media/letters/            images and short videos, referenced from units
  media/numbers/
  words/five-letter.json    the words Sign Five knows (schema/wordlist.schema.json)
```

## Check your change

```
npm install
npm run validate
```

The validator checks the schema, that every item id is unique across all units, that
"confusable_with" points at real items, and that every media file exists.

## Word lists

`words/five-letter.json` is the dictionary for Sign Five: lower-case words, letters only,
exactly five letters each, no repeats. Guesses must be in it (or be the answer, or a word
from the learner's own list), and practice answers are picked from it, skipping words with
J or Z. The validator checks all of this.

## Adding media (unlocks the reading drills)

Signs work without media: learners read the description and grade themselves. Adding an
image or video for a sign unlocks the "What is this sign?" review card for it. Adding media
for every letter in a word lets that word appear in the fingerspelling reading drill.

1. Put the file in `media/`, for example `media/letters/k.webp` or `media/letters/j.mp4`.
   Keep images under about 100 KB and videos under about 1 MB.
2. Add a `media` entry to the item:

```json
{
  "id": "k",
  "gloss": "K",
  "media": [
    { "src": "media/letters/k.webp", "type": "image", "credit": "Signer name", "license": "CC-BY-4.0" }
  ]
}
```

Guidelines:

- **Real signers, front view, plain background**, hand at chest height, palm toward the camera.
- **Video for letters with movement** (J and Z): one short loop, no sound.
- **Same framing for every letter** so the reading drill doesn't jump around.
- **Credit and license are required** for every file. Use CC BY 4.0 or more permissive.

You can also add an online video as `{ "embed": "youtube:VIDEO_ID", "start": 12, "end": 15, "credit": "..." }`.
Embeds show on the sign page but need internet and do not unlock the reading drills.

## Deaf review

Every unit has a `review` block. Content ships as `"status": "draft"` until a Deaf signer
reviews it; the app shows a Draft badge until then. When a Deaf signer has reviewed a unit,
set `"status": "reviewed"` and add their name (or how they wish to be credited) to `reviewed_by`.
