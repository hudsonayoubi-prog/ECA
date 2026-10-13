# Path 2 · Scoring logic (leaderboard)

`scripts/pp_scoring.py` is a line-for-line Python port of `scoreMonth` in `src/app.js` (BR-41 to BR-44). It is the reference for the Power Automate score flow (F5) and any Dataverse-side job. It is pure: audits, people, locations and the rule set go in; the scorecard comes out.

## Rules it reproduces
- **Counts:** Completed visits with a named Student Marketeer, not Imported, dated in the month. Only **Approved** score; no approval value counts as Approved (pre-approval records). Pending, Rejected and Duplicate are tallied but never score.
- **Ranging %:** per person, the latest approved audit at each location (date + time, first wins on a tie); Red Bull SKUs ranged ÷ Red Bull SKUs that apply to that location type (Vending machines and stores currently share the same four); unanswered SKUs count as not ranged; averaged across locations.
- **Other measures:** sums of DPs added, Editions sold in, POS placed, Coolers installed.
- **Normalise:** `relative` = value ÷ the best qualified person (leader = 100); `target` = value ÷ monthly target; both capped at 100. Ranging is already a percentage.
- **Total:** each score × weight ÷ sum of weights, added up, rounded to 1 dp (JavaScript rounding). Not qualified (fewer than the minimum audits, default 3) = 0 and no rank.
- **Order:** qualified first, then total, TDP, ranging, audits, earliest last approval, name.

## Inputs from Dataverse
`rules_from_dataverse` (Scoring Rule Set row), `visit_from_dataverse` (Audit Visit row; ranging from `eca_rangingjson`) and `snapshot_rows` (output as Snapshot Row columns) map the Stage 1 columns. Join users and locations on the lookup IDs.

## Proof
`npm run test:pp` runs the prototype's own JavaScript (`tests/pp/score_js.js`, sliced from `src/app.js`) and the Python port on the same synthetic data and requires identical ranks, totals and scores. Covered: 25 random relative-method months, 10 target-method months, odd weights (incl. all zero) and minimum audits, ties, unknown locations, junk ranging values, and that the Red Bull product list still matches the app.

## Gaps and cautions
- The board's store-type and activity filters are not ported (they don't change the score itself).
- Name tie-breaks use plain ordering; the app uses browser `localeCompare`, which can differ for accented names. Not exercised by the tests (ASCII names only).
- Finalising a month (locking a snapshot), the 48-hour edit window and the no-self-approval rule are not in this module yet.
- If the Red Bull product list changes in the app, update `PRODUCTS`; the product-match test will fail until you do.
