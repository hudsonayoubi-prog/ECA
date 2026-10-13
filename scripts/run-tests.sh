#!/usr/bin/env bash
# Runs every end-to-end check. Each script prints "NO ERRORS" when the page raised no errors.
# Needs: Node 18+, `npm install`, and a Chromium (Playwright's own, or set CHROMIUM_PATH).
set -e
cd "$(dirname "$0")/.." && python3 scripts/build.py
cd tests && mkdir -p out
fail=0
for t in eca shared roll st milla step1 facings comps tafe wa logo monthly exec export permissions; do
  printf '%-10s ' "$t"
  if out=$(node "$t.js" 2>&1) && echo "$out" | tail -1 | grep -q "NO ERRORS"; then echo PASS; else echo FAIL; echo "$out" | tail -5; fail=1; fi
done
exit $fail
