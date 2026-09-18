# LifeOS — Self Reflection

A check-in journal, an AI reading of what you wrote, and eleven life dimensions
scored **deterministically from your own check-ins**.

This repository is one feature of [LifeOS](https://github.com/myho63/lifeOS),
extracted so it can be read, run and shared on its own. Nothing else from the
platform is here — no dashboard, no goals, no habits, no career matching.

```bash
npm install
npm test              # 144 tests over the engine
npm run build         # → app/self-reflection.html
```

Then open `app/self-reflection.html`. No server, no key, no network call.

## What it does

**Write a sentence about your day.** Or don't — a face on the calendar is
enough. A neutral day gets its own question; a good day is told to enjoy itself
and asks for nothing; a hard day asks what made it hard.

**LifeOS reads what you wrote.** *What's changing?* returns up to four findings,
each one quoting you. Every quote is checked against your own text in code
before it is shown, and the dates beside them come from the record rather than
from the model.

**All eleven dimensions get a reading.** Impact, direction and confidence — three
separate answers, because they routinely disagree. A dimension seen on two days,
both terrible, is high impact, negative, and barely evidenced, and the panel says
all three.

**Your life stage is shown beside that, never multiplied into it.** What a stage
asks of a dimension and what your own fortnight shows are different questions.
The gap between them is the part worth knowing, and the page names it.

## The one idea worth taking away

**The model reads. The code scores.**

The model says which dimensions a day's writing touches and writes a line about
each. It is explicitly forbidden from rating, ranking or scoring anything — the
reply schema has no slot for a number. Every level comes from
`readDimensions()`, which is arithmetic over the user's own check-in values and
is in the test suite.

An earlier build asked the model for the number itself. It looked like a
measurement — one decimal, ranked, out of a hundred — and it was a guess that
came back different every run. [`docs/reflection-engine.md`](docs/reflection-engine.md)
is the full account, including why confidence is *precision* rather than
significance.

## Layout

```
packages/core/          the engine. No I/O, no framework, no network.
  src/insights/
    reflection.ts       readDimensions() — impact, direction, confidence
    engine.ts           the year curve and the month readings
  src/taxonomy/         the eleven dimensions, the fourteen life stages
  src/segmentation/     which stage someone is in
  src/orientation/      what that stage asks of each dimension
  src/balance/          stage priority against self-rated standing
  src/safety/           crisis screening, run before anything is stored
  test/                 144 tests

app/
  index.html            the page: markup, styles and behaviour
  build.mjs             bundles the engine into it
  self-reflection.html  the built file — committed, so it can just be opened
```

The engine is **bundled into the page and run there**, so the levels on screen
are computed by the same code the tests cover rather than written into the
markup. Change the engine and the page changes with it.

## What is real and what is sample

**Real** — everything computed: the eleven impact levels with their directions
and confidence, the month averages and the month-over-month comparison, the year
curve, the life-stage priorities, the crisis screen.

**Sample** — the profile it opens with. A seeded persona with a couple of years
of check-ins, so the calendar and the year curve have a pattern rather than an
empty grid. The sample is a fixed function of the calendar date, not the clock,
so a given day reads the same today and in five years.

**Yours** — anything you enter is kept separately from the sample and is the
*only* thing the analysis reads. The seeded history is never scored; the panel
says so under the table. Entries are written to `localStorage`, or to the
viewer's own store when the page is opened inside the claude.ai artifact viewer.

## The AI path

The panel calls Claude through the **viewer's own** sampling capability when the
page runs as a claude.ai artifact. That means no API key in this repository, no
server, and no spend of yours — it runs on the reader's own account, only ever
on a deliberate action (a check-in, a save, or the button), never on a timer.

Opened as a plain file, there is no model available and the page says so. Every
number still works: the levels never came from the model.

## What is deliberately not here

- **No auth, no server, no database.** This is the feature, not a deployment.
- **No wearables, calendar or health imports.** Every check-in is typed by hand.
- **Not the rest of LifeOS** — goals, habits, ikigai, decisions, career matching
  and the API all live in the parent repository. `packages/core` here has been
  trimmed to the modules this feature actually reads.

## Credits

Extracted from [myho63/lifeOS](https://github.com/myho63/lifeOS).
