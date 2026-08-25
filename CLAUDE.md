# Claude Code Instructions

## Git
- Always use the full remote URL (not a remote name) when running git push (e.g. `git push https://github.com/ArendPeter/star-server.git <branch>`).
- Never push to any URL matching `github.com/Equal-Vote/*` without explicit confirmation.

**Human summary on PRs**
Every PR an agent opens must start with a short, human-written note above the AI-generated summary, under a `## Human Summary` heading. This exists so reviewers get the author's own context — the *what* and the *why* — alongside the mechanical details the AI provides below it.

Before running `gh pr create`, stop and ask the user: "Before I open this PR — in a sentence or two: what are you trying to accomplish, and why? I'll put this at the top of the PR description, above my own summary, so reviewers get your context alongside the AI-generated details." Require both the what and the why; if the answer only covers one, ask a follow-up for the other.

Put the answer verbatim under `## Human Summary`, first in the body, followed by the agent's own `## Summary`/`## Test plan` sections. This applies whether the session is interactive or unattended. If no human is available to answer, do not open the PR — stop and surface that you're blocked, rather than fabricating a note or skipping the requirement.

**Draft PRs**
PRs opened by an agent must be created as drafts (`gh pr create --draft`), so the user reviews it before it's visible to their dev lead. Only mark a PR ready for review (`gh pr ready`) when the user explicitly instructs it in that moment — never automatically, and never as a default follow-up to opening the draft. After opening a draft PR, tell the user it's a draft and theirs to review before it goes to their dev lead.
