# Submission Channel eligibility is a second gate, not a replacement for role permissions

When adding admin-uploaded ("Paper Ballots") submission, we needed to decide how an election opts into accepting it. `canUploadBallots` already role-gates *who* may call the upload endpoint (`system_admin`/`owner`). We could have stopped there, or replaced it with a settings-only check.

Instead, `ElectionSettings.allowed_submit_types` is a second, independent gate: the permission answers "is this *user* allowed to attempt this," the setting answers "does this *election* currently accept this Submission Channel at all" (default: no, for Paper Ballots). Both must pass — an eligible admin on an election that hasn't opted in is still rejected, and vice versa is impossible by construction (the permission is role-based, not settings-based).

We chose this over merging the two because they vary independently: role eligibility is about trust in a person, channel acceptance is about a specific election's process (e.g. a paper-ballot election vs. a fully online one). A future reader touching `canUploadBallots` alone might reasonably assume it's sufficient — it now isn't, for any submission channel gated this way. Expect this same two-part shape (role permission + `allowed_submit_types` membership) to recur if more Submission Channels are added.
