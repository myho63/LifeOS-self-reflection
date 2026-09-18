# How the reflection is read

## The rule

**The model reads. The code scores.**

A language model is good at reading a paragraph and saying *which* parts of a
life it touches and what it appears to mean. It is bad at saying how much
something matters, because a number it produces is a guess dressed as a
measurement: it has no access to the arithmetic, cannot show its working, and
will not give the same answer twice on the same input.

The first build of this panel ignored that. It asked the model for
`{"level": "high", "rate": 72.4}` — one decimal, ranked, out of a hundred. The
prompt even had to ask it to *spread the rates out* so two dimensions did not
land on the same value, which is a fair description of inventing a ranking.

So the work is split at the seam:

| | |
|---|---|
| **The model** | Which of the eleven dimensions each day's writing touches, and one short line on each. It is explicitly forbidden from rating, ranking, scoring or grading anything — the reply schema has no slot for a number. |
| **The code** | Every level, direction and confidence, computed from the person's own check-in values by `readDimensions()` in `packages/core/src/insights/reflection.ts`. |

Two things fall out of the split, both visible in the UI. The panel produces
levels **before any model has run**, because the user's own quick tags are
attributions too. And the date-window control costs nothing: narrowing the
window re-scores days already read, locally, with no second call.

## The three readings, and why they stay apart

For each dimension, the scored days are split into those the dimension was
attributed to and those it was not, and the two means are compared.

- **Impact** — how far apart the two means sit, scaled against a full swing
  (2.5 points on the 0–10 scale) and weighted by how much of the window the
  dimension covers. Reach is damped, never dismissed: something sharp and rare
  is not erased, but something running through most of the record outranks it
  at the same effect size.
- **Direction** — which side of the gap the days fall on, with a dead zone of
  0.35 points. Its own axis, because the same magnitude helping and weighing
  are opposite readings and one badge cannot carry both.
- **Confidence** — the width of the interval around the difference, against
  the same yardstick.

They routinely disagree, and the disagreement is the information: a dimension
seen on two days, both terrible, is **high impact, negative and barely
evidenced**. A design that collapsed them into one badge would have to choose
which of those to hide.

### Confidence is precision, not significance

The question is not "is this difference real" but "how tightly have we pinned
it down". The distinction decides a common case: fifty flat days reporting
*this does not move you* is the surest reading on the page, and a significance
test would file it as low confidence for having a small effect.

Two details do real work:

- **Welch's degrees of freedom**, not a pooled variance. Pooling lets the
  larger side lend its steadiness to the smaller one, so a dimension seen on
  two days borrows the composure of the other twenty and comes back better
  established than it has any right to be.
- **A floor on each side's standard deviation** (0.8 points). A self-rated
  0–10 check-in is a coarse instrument; without the floor, four days that
  happen to agree produce a standard error of zero and a confident claim out
  of four data points.

## What the reader sees

High, Medium, Low, or **Not enough data** — and the last of those names its own
reason: not mentioned, mentioned once, or mentioned on *every* day and so
having nothing to compare against.

The raw 0–100 score stays internal. It is on the returned object so the
ranking is testable and a support tool could explain a band, but it never
reaches the screen: a decimal implies a precision a handful of self-rated days
does not have.

## Life stage relevance is a separate reading

Nothing in `readDimensions()` weights a dimension by how much the user's life
stage asks of it, and nothing there should.

That reading already exists: `balance()` carries a stage-derived `priority` per
dimension and `dimensionScores()` ranks on it. The UI shows it under its own
heading, with a line saying it was not derived from the check-ins.

Folding the two together would answer two questions with one number and hide
the finding that matters most — a dimension the stage leans on hard that the
record cannot see. The page states that gap outright instead.

## What is enforced, not requested

| Guardrail | Why |
|---|---|
| Crisis screening runs before anything is stored | Deterministic, instant, free. Cannot be talked out of firing by the text it screens, and still works when the model is unavailable. |
| Quotes checked against the transcript in code | A contiguous six-word run must appear in what the person actually wrote. Turns "cite your evidence" from a prompt instruction into a constraint; a finding that cannot be grounded is dropped. |
| Dates come from the record, never the model | A date is exactly the kind of detail a model supplies confidently and gets wrong. |
| Day attributions checked against real dates | A date the model was not shown is dropped, an unknown dimension id is dropped, a repeat is ignored. The worst a bad reply can do is leave a day thinner than it should be. |
| The schema has no slot for a magnitude | Stronger than asking it nicely not to invent one. |

## Where the numbers are tested

`packages/core/test/reflection.test.ts`. The cases worth reading first are the
ones that pin the awkward behaviour: a big effect seen twice must not come back
confident; four identical days must not produce a standard error of zero; a
long flat record must come back *low impact, high confidence*; and the meter
must never disagree with the word beside it.
