# Path 2 · Monthly audit export (BR-54, BR-55)

`scripts/pp_export.py` rebuilds the prototype's Excel audit export in Python, with native Excel charts. It is the reference for the last-day-of-month Power Automate export flow.

- `build_export(d, month, states, by, generated)` is pure and returns the sheet model.
- `write_xlsx(model, path)` writes the real `.xlsx` (openpyxl).
- Command line: `python3 scripts/pp_export.py data.json 2026-09 VIC,NSW out_dir` (data.json = the records, same shapes as `pp_monthly.py` plus the audit-form fields on visits).

## Workbook (as BR-54/55)
- **Dashboard:** title and period line; 8 KPI tiles (audits, coverage, Student Marketeers auditing, Editions, POS, coolers, share of shelf, ranging) with change versus the previous month; key points (the same highlight sentences as the monthly summary); **9 native bar charts**. For one state the first four charts switch to "by university & TAFE". Charts: audits completed; coverage; Editions/POS/coolers; share of shelf; share of front facings by brand (Red Bull navy); audits last 6 months; Editions/POS/coolers last 6 months; top 10 institutions; top 10 Student Marketeers.
- **Summary:** one row per state (16 columns) plus an "All states" total row when more than one state is exported.
- **One sheet per state** ("VIC audits"): every audit record in the month, **61 columns**, including scheduled, cancelled, rejected and duplicate, with a *Counted* flag. Frozen header and filter.
- **Chart data:** the figures behind the charts; charts point at these cells, so editing them updates the charts.
- Month to date is labelled as such; closed months say when they were closed.

## Proof
`npm run test:pp` runs the prototype's own `auditExportWorkbook` (sliced from `src/app.js`) and the Python build on the same synthetic data and requires identical output: file name, every sheet's title, notes, header, every row and cell, the dashboard cells and merges, and all chart definitions (series values, cell references, colours, positions). Covered: all states and single states, closed month, month to date, other months, sparse and empty data. A file test opens the written workbook: sheet names, 9 charts, 61 header columns, frozen header, filter, Arial font, charts linked to the Chart data sheet. I also rendered a sample through LibreOffice and checked the Dashboard visually.

## Not covered or different
- Not opened in desktop Excel here, only LibreOffice and openpyxl. Chart styling (title size, label font) can differ slightly from the prototype's hand-written chart XML.
- Dates follow Node's en-AU wording ("Sept", "June"); the browser's wording can differ.
- Ids sort by plain string order; the app uses browser locale sorting.
- Saving to SharePoint, the 18:00 last-day schedule, the "Audit export ready" notice and the Monthly Report row are flow steps, not built.
- The Excel for the monthly state summary and national breakdown (BR-53 download) is not built yet; it can reuse the writer.
