# BetterVoting

BetterVoting is an online election and polling platform built by the Equal Vote Coalition, supporting multiple voting methods (STAR, IRV, Approval, Ranked Robin, and others).

## Language

**Support Actions**:
The canonical trio of ways a visitor can support the project — Volunteer, Donate, Merch — surfaced together in both the nav's "Support Us" dropdown and the landing page's support stripe. `/volunteer` redirects to the codebase contribution guide, so Volunteer already covers code/docs contribution — it isn't a separate action.
_Avoid_: Contribute (same destination as Volunteer, not a distinct Support Action)

**Submission Channel**:
The way an individual ballot reached the system — online (browser), Paper Ballots (admin-transcribed upload), or Discord. An election's `allowed_submit_types` setting lists which channels it currently accepts; a ballot submitted through a channel not on that list is rejected regardless of who submits it. Distinct from **Ballot Source**, which describes where an *election's* ballots as a whole originated (a live election vs. one imported from a prior election) — not how any one ballot was submitted.
_Avoid_: Ballot source, submission method, submit type

**Paper Ballots**:
The settings-UI label for admin-uploaded ballot submission — an election admin transcribing paper ballots and bulk-submitting them on voters' behalf. Whether an admin is *allowed to attempt* this is a role permission; whether the *election currently accepts* this Submission Channel is a separate, independent setting — both gates must pass.
_Avoid_: Admin upload, admin submission (internal/code names; use Paper Ballots when talking about the feature)
