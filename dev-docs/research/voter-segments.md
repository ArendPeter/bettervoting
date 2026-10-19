# How comparable election tools assign races to voter segments

Research for [#1706](https://github.com/Equal-Vote/bettervoting/issues/1706) (map: [#1701](https://github.com/Equal-Vote/bettervoting/issues/1701), Voter Groups out of beta). Sources are vendor help centres and published specs, read October 2026. Each claim cites its source; a "not documented" note means the primary source is silent on that point. It does not mean the feature is missing.

## Summary

| Tool | Name for the concept | Voter → segment | Race ↔ segment configured on | Segments per voter | Documented checks |
|---|---|---|---|---|---|
| ElectionBuddy | Voting Groups | "Groups" column in the voter list | **Voters page → Voter Options → Group Settings**: every ballot question is listed and you assign groups to it [1] | One. For overlaps, "create a group for all variations" [2] | "View Ballot By Voting Group" preview; told to re-check assignments whenever the voter list changes [1] |
| Simply Voting | Elector segmentation / segments | CSV columns (e.g. `Type`, `Location`); `;` separates several values [3] | Per question, on Question Details (Segment 1 / Segment 2 fields, with autocomplete) [4] | Several values in each of up to two segment dimensions [3][4] | Import summary lists problems; 255-char cap per field (longer values are truncated); proof the ballot once per "ballot style" [3][5] |
| Rubric | Voter groups | Predefined groups; a "yes" in each group's CSV column, or edit the voter row [6] | Per question, in the ballot question's side panel [6] | Not stated (the UI suggests several) | None documented |
| Election Runner | (none) | n/a | n/a. "Every voter … is eligible to vote for every question" [7] | n/a | Workaround is **Linked Elections**, one election per segment, matched by identical Voter ID and Key [8][9] |
| OpaVote | (none) | n/a | n/a | n/a | Workaround is one election per voter group; the manager merges the shared contest's ballots before counting [10] |
| BigPulse | Voter Category Poll | Categories attached to voters | Not documented. Categories are used to **filter results**, not to restrict ballots [11] | not documented | Hides filtered counts when a category has one voter or every voter in it voted the same way [11] |
| Government (NIST, VIP, VotingWorks) | Precinct / precinct split → **ballot style** | Voter's residence precinct (or split) | Contest → **district**; precinct/split → districts; ballot style = the derived contest set [12][13][14] | Exactly one precinct or split | (see below) |

## Findings by tool

### ElectionBuddy: "Voting Groups"
- Purpose: "Voters will only see the questions they're allowed to vote on, so you can include all your questions on one ballot." [1]
- Setup is on the **Voters page**, not the ballot editor. Under Voter Options you choose "Voting Groups". The voter table then has a "Groups" column, and a "Group Settings" section lists each ballot question title so you can assign groups to it (e.g. "School President" gets every group, "Grade 10 Representative" only Grade 10). [1]
- This is the closest match to our Settings-page grid: a single place that lists every race and its groups, kept apart from race editing.
- One group per voter. Voters who belong to more than one category go into combination groups: "you would create a group for all variations". [2]
- Checks: "If you make a change to the voter list you will need to reassign the Voting Group question" and "Double-check your Voting Groups anytime you touch your Voter List". These are manual instructions, not automated warnings. A "View Ballot By Voting Group" preview exists, and reminders can target groups ("Send to Voting Groups"). [1]
- After launch: "Once a vote begins, a voter's group cannot be changed." The workaround is to spoil that voter's ballot and re-add them with the correct group. [1]
- Voters with no group: not documented.

### Simply Voting: "segmentation"
- Segments come from **elector data**. CSV columns are segment categories, rows are electors, and "The order of data in the file is not important." [3]
- Several values per field are separated by semicolons (`Associate;Retired`). There are two independent dimensions (Segment 1, Segment 2). [3][4]
- Questions are restricted on **Question Details**. Within a field, matching any listed value is enough (OR). Across Segment 1 and Segment 2, the elector must match both (AND). [4]
- **Default:** "If no segment is selected, the question can be seen by all electors in the election." [4]
- **Ordering:** electors must be loaded first ("electors with the defined segments must exist in the Electors list"), and question autocomplete then suggests segments taken from the elector data. [4] This is the reverse of our plan, where the group list is defined first and voters are checked against it.
- Checks: 255-character cap per field, with longer values "truncated down to 255 characters upon import"; an import preview with column mapping; a success message that lists problems found. [3]
- Proofing: you review the ballot "from each type of elector's perspective", one pass per **ballot style**. "Segments that are not applied to any questions will not appear in the Ballot Proof segmentation option list." Finalizing requires at least one proof vote. [5]
- During voting, bulk adds and updates need support to unlock more imports. [3]
- Segmentation is also used for turnout tracking and email targeting, not only for restricting questions. [3]

### Rubric: "voter groups"
- Groups are predefined during election setup. Voters are assigned by putting "yes" in each group's CSV column, or by editing the voter row. Questions are restricted from the ballot question's side panel. [6]
- This is the same order as our plan (list first, then voters and races point at it), but each group is a yes/no column and race assignment happens on the race.

### Election Runner and OpaVote: no native support
- Election Runner: "every voter that is a added to an election is eligible to vote for every question on the ballot". [7] Its Linked Elections feature chains separate elections. "Voters must have the exact same Voter ID & Voter Key in all elections", and after submitting one ballot the voter picks the next election they're eligible for. For large lists it recommends a master file plus one import file per election. [8][9]
- OpaVote suggests one election per voter group, so each voter gets one link. The trade-off is that "the election manager needs to do more work since the ballots are split up", because the shared contest has to be merged across elections before counting. [10]
- These workarounds show what BetterVoting admins do today without Voter Groups: several elections, and manual merging of the shared race.

### BigPulse
- "Voter Category Poll": categories place voters "into known groupings". The documented use is **filtering results by category**. Filtered counts are hidden when "a category has only one voter in it" or when everyone in a category voted the same way. [11] I found no public doc on restricting ballots by category. Per-group tallies are out of scope for #1701, but this privacy rule is worth remembering if they come up later.

### Government election administration: precincts, splits, ballot styles
- NIST glossary [12]:
  - *Precinct*: "Election administration division corresponding to a geographic area that is the basis for determining which contests" a voter may vote in.
  - *Precinct split*: "A subdivision of a precinct which arises when a precinct is split by two or more election districts".
  - *Election district*: "Administrative area in which voters are entitled to vote in contests that are specific to that area".
  - *Ballot style*: "Ballot data that has been put into contest order for a particular precinct or precinct split".
- VotingWorks VxSuite election definition (open-source, VVSG 2.0) [13]:
  - Each **contest has a single `districtId`**.
  - A precinct has `districtIds`, or `splits` that each have their own `districtIds` (never both).
  - A ballot style lists `precincts` and `districts`, and every contest in those districts "is considered a part of the ballot style".
- VIP spec [14]: each split is its own Precinct record with the same `Name` and a different `PrecinctSplitName`, linked to `ElectoralDistrictIds` and a `BallotStyleId` ("the BallotStyle, which a person who lives in this precinct will vote").
- **How government systems handle scale:** they never edit a contests × precincts grid. A middle **district** layer turns the many-to-many link into two simple ones (contest → one district; precinct → a few districts). Ballot styles are then derived, and many precincts share one style. Splits exist because one geographic unit can need two different contest sets.
- Each voter has exactly one precinct or split, which matches our "at most one group per voter".

## Patterns
1. **Name.** The closest SaaS tools say "Voting Groups" (ElectionBuddy) or "voter groups" (Rubric), which backs our user-facing term **Voter Group**. "Segment" (Simply Voting) and "category" (BigPulse) also appear. "Precinct" only appears where groups are geographic.
2. **Assigning voters is always a column in the voter list or CSV**, never a separate step. Single-value column: ElectionBuddy. Multi-value with `;`: Simply Voting. One yes/no column per group: Rubric.
3. **Linking races to groups** happens either on each race (Simply Voting, Rubric) or in one central list of every race (ElectionBuddy, on the Voters page). Nobody documents a grid UI. Government tools use a district layer instead.
4. **One group per voter is common.** ElectionBuddy handles overlaps with combination groups. Only Simply Voting allows several values, plus a second AND-ed dimension.
5. **Default:** a race with no restriction is open to everyone (Simply Voting, stated explicitly).
6. **Checks are mostly manual.** Vendors offer a per-group (or per-ballot-style) preview, an import summary, and "re-check after changing the voter list" advice. None documents automated warnings such as "group with no races", "race no voter can see" or "voter group not in list". **That gap is room for our warnings catalogue to do better than the market.**
7. **After launch, a voter's group is frozen** (ElectionBuddy: spoil and re-add; Simply Voting: support must unlock bulk changes). This matches our rule that a voter's group can't be edited after upload.

## Implications for #1701

**Settings grid (#1702–#1705, Settings prototype)**
- ElectionBuddy's central "every question, assign groups" list on a non-race page is the precedent for a Settings-page grid, so our plan isn't unusual.
- Preview the ballot per *distinct race set* (Simply Voting's "ballot style"), not per group. Groups that see the same races collapse into one preview, and groups that change nothing can be hidden.
- **Keep "unrestricted" separate from "no groups checked".** Today `getApprovedRaces` (`packages/shared/src/domain_model/Election.ts`) treats `precincts: undefined` as open to all, but `precincts: []` as open to **no one**. A grid where the admin unticks every box would quietly hide the race from everyone. Either the grid writes `undefined` for "all groups" / "no restriction", or `[]` triggers a blocking warning. Simply Voting's rule is "none selected = everyone".
- For scale (out of scope, but the data model must stay compatible): government systems use an intermediate district layer. A future "district" or "race tag" helper could generate the same `race.precincts` arrays, so the current flat model stays compatible.

**Add Voters enforcement**
- Every tool assigns the group through a voter-list or CSV column, which supports a single "Voter Group" column validated against the Settings list.
- Rubric (list first, voters checked against it) is the closest precedent. Simply Voting does the reverse (the list is derived from voter data). If the list is empty when voters are uploaded, consider offering to create groups from the uploaded values.
- Report unknown group values in an import summary, as Simply Voting does, rather than failing silently.
- Case and whitespace: no vendor documents its matching rules. Our current exact, case-sensitive match is likely to surprise CSV users (`Ward 1` vs `ward 1`). Normalising on upload, or warning on near-matches, is cheap.

**Warnings catalogue** (things no vendor documents, so worth having)
- A race visible to no group (`[]`, or only unknown groups).
- A group on the list with no voters, or with no races beyond the unrestricted ones.
- Voters with no group, who will only see unrestricted races.
- Groups that produce identical ballots (could be merged; informational only).
- A reminder like ElectionBuddy's: changing the group list after voters are added can orphan voters.

## Sources
1. ElectionBuddy, "Voter Options – Voting Groups": https://help.electionbuddy.com/kb/election-setup-voters-page/voter-options-voting-groups
2. ElectionBuddy, "Voting Groups – Voters in Multiple Groups": https://help.electionbuddy.com/kb/election-setup-voters-page/voting-groups-voters-in-multiple-groups
3. Simply Voting, "Managing Segmented Electors": https://help.simplyvoting.com/docs/managing-segmented-electors
4. Simply Voting, "Managing Segmented Questions": https://help.simplyvoting.com/docs/managing-segmented-questions
5. Simply Voting, "Proofing a Segmented Election": https://help.simplyvoting.com/docs/proofing-segmented-election
6. Rubric, "Creating groups of voters": https://helpcenter.hellorubric.com/articles/2030801-creating-groups-of-voters
7. Election Runner, "How to Limit Ballot Questions to Specific Voters": https://electionrunner.com/support/kb/voters/how-to-limit-ballot-certain-voters/
8. Election Runner, "Linking Voters to Multiple Elections": https://electionrunner.com/support/kb/voters/linking-voters-to-multiple-elections/
9. Election Runner, "How to Filter or Limit Ballot Questions by Voter": https://electionrunner.com/support/kb/ballot/how-to-filter-ballot-questions-by-voter/
10. OpaVote blog, "Elections with sub groups of voters" (2018): https://blog.opavote.com/2018/06/elections-with-sub-groups-of-voters.html
11. BigPulse, "Voting is anonymous A1": https://www.bigpulse.com/A1
12. NIST Election Terminology Glossary: https://pages.nist.gov/ElectionGlossary
13. VotingWorks, "VxSuite Election Definition": https://docs.voting.works/vxsuite-tdp-v4/readme/election-package/vxsuite-election-definition
14. Voting Information Project spec, Precinct element: https://vip-specification.readthedocs.io/en/release/built_rst/xml/elements/precinct.html
