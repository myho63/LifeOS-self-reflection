# Safety

> **Scope note.** This repository is the Self Reflection feature only. The
> parts of this document that bear on it directly are **crisis screening**
> (which runs on every saved reflection, before anything is stored) and
> **special-category data** (a mood plus free text about health, work and
> family is exactly that). Age gating and regulated-content rules are
> described here because the screening depends on them, but the surfaces they
> govern — career guidance, financial products — are not in this repository.

Life OS is simultaneously a youth product and an adult financial-planning
product, running from one codebase. Most of the safety design follows from
taking that seriously.

## The line the product stands on

Life OS **orients**; it does not **advise**. It helps someone understand their
options and what the trade-offs between them actually are. It does not tell
them what to do about their money, their health, or their legal affairs.

That distinction is what keeps a product discussing mortgages, pensions and
mental health on the right side of the regulatory line in most jurisdictions,
and it is enforced in the product rather than asserted in a footer:

- Every regulated domain carries `ORIENTATION_DISCLAIMER`.
- Every simulation returns `limitations` and `whatWouldChangeThis` alongside its
  numbers. A projection presented without its sensitivity and its limits
  borrows the authority of arithmetic for a guess.
- Value-laden decisions are never projected. They get a structured-tradeoff
  model that reflects the user's own priorities back at them.

## Age gating

Twelve life domains each carry a `minAge`. Below it, the domain is **hidden**
rather than down-weighted: estate planning is not merely low-priority for a
fourteen-year-old, it is inappropriate, and a hidden domain cannot appear in
priorities, blind spots, milestones or the decision catalogue.

| Domain | Minimum age |
| --- | --- |
| Identity, Learning, Career, Health, Mind, Relationships, Community, Play | 13 |
| Money | 15 |
| Home, Admin | 16 |
| Legacy | 25 |

On top of that, `isContentAllowed` withholds regulated-*product* content from
minors outright — not reworded for a younger reader, withheld. The issue is
appropriateness, not comprehension.

**Everything fails closed.** When age is unknown, the profile is flagged
`age_unverified_conservative_mode` and only content safe for the youngest
supported user (13) is shown. The onboarding planner applies the same rule: with
no age known it asks only questions appropriate to a thirteen-year-old.

Age of majority is jurisdiction-aware — 21 in Singapore, 19 in South Korea, 20
in New Zealand — because "adult" is not a global constant and gating regulated
content on the wrong number is a real compliance failure.

## Crisis screening

`screenText` is a **routing pre-filter, not a diagnostic instrument**. Its only
job is deciding whether user-authored text should interrupt the normal product
flow and surface human help instead.

It is deliberately biased toward false positives. Showing a support resource to
someone who did not need it costs very little; missing someone who did costs a
great deal.

| Severity | Action |
| --- | --- |
| `urgent` — self-harm intent, danger, harm to others | `interrupt_with_support` |
| `elevated` — acute hopelessness, "can't go on" | `interrupt_with_support` |
| `monitor` — persistent low mood, burnout, insomnia | `offer_support` |
| `none` | `continue` |

Under-18 flows add an explicit prompt to tell a trusted adult. Country-specific
lines are surfaced first where one is verified (988 in the US, Samaritans in the
UK); everything else routes to an international directory, because an
out-of-date number is worse than no number.

Constraints that hold regardless of implementation:

- It must never be presented to a user as an assessment of their mental state.
- It must never gate access to the product.
- It must never be the only safety mechanism. Every surface that accepts free
  text should also carry an always-visible route to help.
- The screened text is not persisted or logged. Only the resulting severity is,
  and only to monitor the filter itself.

The patterns are intentionally simple and readable so a clinician can review
them without reading code. A production deployment should pair them with a
trained classifier and a human escalation path — the patterns here are the
floor, not the ceiling.

## Special-category data

Health status, pregnancy, caring responsibilities and life events including
bereavement are special-category data under GDPR Article 9 and its equivalents.
`SIGNAL_SENSITIVITY` classifies every signal, `redactForAnalytics` enforces
what may leave the system, and request bodies never reach the logs. See
[`architecture.md`](architecture.md#data-protection).

## Known gaps

- **Age assurance.** Age is self-declared. Every gate above is only as good as
  that, and serving minors in most jurisdictions will eventually require
  something stronger.
- **Guardian involvement.** Users under 16 are flagged `guardian_aware`, but
  nothing is built on that flag yet. Parental consent requirements vary widely
  by jurisdiction and need to be designed against a specific launch market.
- **The crisis filter is English-only** and pattern-based. It will miss
  indirect and non-English expressions of distress.
- **No human escalation path exists.** The product can route someone to a
  helpline; it cannot yet route them to a person inside the organisation.
