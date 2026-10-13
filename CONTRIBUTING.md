# Contributing to the ECA prototype

1. **Edit source, never the built file.** Change `src/app.js` (logic and UI), `src/head.html` (styles) or `src/data/data.json` (seed data), then run `npm run build`. `public/index.html` and `tests/index.html` are generated.
2. **Keep it one file.** The published page must stay self-contained: React 18.3.1, ReactDOM 18.3.1 and htm 3.1.1 load from the pinned CDN URLs in `scripts/build.py`; everything else is inline. No bundler, no new libraries.
3. **Markup is htm, not JSX.** Use `html\`…\`` tagged templates with plain HTML attribute names (`class`, `for`, `style="…"` strings are converted by the `h()` adapter at the top of `src/app.js`).
4. **State changes go through reducers.** `reducer` (data) and `ecaReducer` (leaderboard, login, admin). Every user-visible change writes an audit-log entry with `stamp(...)`.
5. **Saved-data migrations.** If you change seed data or data shapes, add a load-time migration in `App()` (see `ROSTER_REV`, `ecaRev`, `NAME_FIXES`, `EXTRA_UNIS`) so browsers and the shared store that already hold data are upgraded, not reset.
6. **Shared storage.** Collections listed in `SHARED` sync to the artifact database. New shared collections need an entry there and in `sharedBase()`.
7. **Test.** `npm install` once, then `npm test`. Every script must end with `NO ERRORS`. Add a script under `tests/` for any new behaviour.
8. **Accessibility.** Keep labels on every input, 40 px+ touch targets, visible focus (yellow outline), colour plus icon plus text on status chips, and no horizontal scroll at 375 px.
9. **No real secrets or new personal data** in code, fixtures or screenshots.
